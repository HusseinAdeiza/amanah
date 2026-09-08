import { readFileSync } from "fs";
import { parse } from "yaml";
import { z } from "zod";
import { createReceipt, type IpfsClient } from "@amanah/receipts";
import { run, get, all } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import type { Balance, McpClient } from "../mcp/types.js";
import { RulesConfigSchema, type Rule } from "./schema.js";

export interface Proposal {
  id: number;
  ruleId: string;
  action: string;
  assetFrom: string;
  assetTo: string;
  amount: string;
  usdEstimate: number;
  reason: string;
  status: "pending" | "confirmed" | "rejected" | "executed";
}

function mapProposalRow(row: Record<string, unknown>): Proposal {
  return {
    id: row.id as number,
    ruleId: row.rule_id as string,
    action: row.action as string,
    assetFrom: row.asset_from as string,
    assetTo: row.asset_to as string,
    amount: row.amount as string,
    usdEstimate: row.usd_estimate as number,
    reason: row.reason as string,
    status: row.status as Proposal["status"],
  };
}

export class RulesEngine {
  private rules: Rule[] = [];

  constructor(private configPath: string) {
    this.loadConfig();
  }

  loadConfig(): void {
    try {
      const raw = readFileSync(this.configPath, "utf-8");
      const parsed = parse(raw);
      const config = RulesConfigSchema.parse(parsed);
      this.rules = config.rules.filter((r) => r.enabled);
      logger.info({ count: this.rules.length }, "Rules loaded");
    } catch (err) {
      logger.error({ err }, "Failed to load rules config");
      this.rules = [];
    }
  }

  async evaluate(mcp: McpClient): Promise<Proposal[]> {
    const balances = await mcp.getBalances();
    const totalUsd = balances.reduce((sum, b) => sum + (b.usdValue ?? 0), 0);
    const proposals: Proposal[] = [];

    for (const rule of this.rules) {
      const match = this.evaluateRule(rule, balances, totalUsd);
      if (match) {
        const existing = await get<{ id: number }>(
          "SELECT id FROM proposals WHERE rule_id = ? AND status = 'pending'",
          [rule.id]
        );
        if (existing) continue;

        const result = await run(
          `INSERT INTO proposals (rule_id, action, asset_from, asset_to, amount, usd_estimate, reason, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [rule.id, rule.action.type, match.fromAsset, match.toAsset, match.amount, match.usdEstimate, match.reason]
        );
        proposals.push({
          id: result.lastID,
          ruleId: rule.id,
          action: rule.action.type,
          assetFrom: match.fromAsset,
          assetTo: match.toAsset,
          amount: match.amount,
          usdEstimate: match.usdEstimate,
          reason: match.reason,
          status: "pending",
        });
        logger.info({ proposalId: result.lastID, ruleId: rule.id }, "Proposal created");
      }
    }
    return proposals;
  }

  private evaluateRule(
    rule: Rule,
    balances: Balance[],
    totalUsd: number
  ): { fromAsset: string; toAsset: string; amount: string; usdEstimate: number; reason: string } | null {
    const cond = rule.condition;
    if (cond.type === "threshold" && cond.asset && cond.minUsd) {
      const bal = balances.find((b) => b.asset === cond.asset);
      const usd = bal?.usdValue ?? 0;
      if (usd > cond.minUsd) {
        return {
          fromAsset: cond.asset,
          toAsset: rule.action.toAsset,
          amount: bal?.free ?? "0",
          usdEstimate: usd,
          reason: `Threshold rule: ${cond.asset} holding $${usd.toFixed(2)} exceeds $${cond.minUsd}`,
        };
      }
    }
    if (cond.type === "ratio" && cond.maxRatio) {
      const volatileAssets = ["BNB", "BTC", "ETH"];
      const volatileUsd = balances
        .filter((b) => volatileAssets.includes(b.asset))
        .reduce((sum, b) => sum + (b.usdValue ?? 0), 0);
      const ratio = totalUsd > 0 ? volatileUsd / totalUsd : 0;
      if (ratio > cond.maxRatio) {
        const target = balances.find((b) => volatileAssets.includes(b.asset));
        if (target) {
          return {
            fromAsset: target.asset,
            toAsset: rule.action.toAsset,
            amount: target.free,
            usdEstimate: target.usdValue ?? 0,
            reason: `Ratio rule: volatile exposure ${(ratio * 100).toFixed(1)}% exceeds ${(cond.maxRatio * 100).toFixed(0)}%`,
          };
        }
      }
    }
    return null;
  }

  async getPendingProposals(): Promise<Proposal[]> {
    const rows = await all<Record<string, unknown>>("SELECT * FROM proposals WHERE status = 'pending' ORDER BY created_at DESC");
    return rows.map(mapProposalRow);
  }

  async getAllProposals(): Promise<Proposal[]> {
    const rows = await all<Record<string, unknown>>("SELECT * FROM proposals ORDER BY created_at DESC");
    return rows.map(mapProposalRow);
  }

  async confirmProposal(
    proposalId: number,
    mcp: McpClient,
    ipfs: IpfsClient,
    confirmedBy: string,
    dryRun: boolean
  ): Promise<{ proposal: Proposal; receiptCid: string }> {
    const row = await get<Record<string, unknown>>("SELECT * FROM proposals WHERE id = ?", [proposalId]);
    if (!row) throw new Error("Proposal not found");
    const proposal = mapProposalRow(row);
    if (proposal.status !== "pending") throw new Error(`Proposal already ${proposal.status}`);

    await run(
      "UPDATE proposals SET status = 'confirmed', confirmed_by = ?, confirmed_at = ? WHERE id = ?",
      [confirmedBy, new Date().toISOString(), proposalId]
    );
    proposal.status = "confirmed";

    const receiptPayload = {
      proposalId,
      ruleId: proposal.ruleId,
      assetFrom: proposal.assetFrom,
      assetTo: proposal.assetTo,
      amount: proposal.amount,
      usdEstimate: proposal.usdEstimate,
      confirmedBy,
      dryRun,
    };

    let prevHash: string | null = null;
    const last = await get<{ hash: string }>("SELECT hash FROM receipts ORDER BY id DESC LIMIT 1");
    if (last) prevHash = last.hash;
    const linked = createReceipt("convert_confirmed", receiptPayload, prevHash);

    const { cid } = await ipfs.pinReceipt(linked);
    await run(
      `INSERT INTO receipts (nonce, event_type, cid, hash, previous_hash, timestamp, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [linked.nonce, linked.eventType, cid, linked.hash, linked.previousHash, linked.timestamp, JSON.stringify(linked.payload)]
    );

    if (!dryRun) {
      const result = await mcp.executeConvert({
        fromAsset: proposal.assetFrom,
        toAsset: proposal.assetTo,
        amount: proposal.amount,
      });
      if (result.success) {
        await run("UPDATE proposals SET status = 'executed' WHERE id = ?", [proposalId]);
        proposal.status = "executed";
        logger.info({ proposalId, txHash: result.txHash }, "Convert executed");
      } else {
        logger.error({ proposalId, error: result.error }, "Convert execution failed");
      }
    } else {
      await run("UPDATE proposals SET status = 'executed' WHERE id = ?", [proposalId]);
      proposal.status = "executed";
      logger.info({ proposalId }, "Dry-run: convert simulated");
    }

    await run("UPDATE proposals SET receipt_cid = ? WHERE id = ?", [cid, proposalId]);
    return { proposal, receiptCid: cid };
  }

  async rejectProposal(proposalId: number, reason: string): Promise<Proposal> {
    const row = await get<Record<string, unknown>>("SELECT * FROM proposals WHERE id = ?", [proposalId]);
    if (!row) throw new Error("Proposal not found");
    const proposal = mapProposalRow(row);
    await run("UPDATE proposals SET status = 'rejected' WHERE id = ?", [proposalId]);
    proposal.status = "rejected";
    logger.info({ proposalId, reason }, "Proposal rejected");
    return proposal;
  }
}
