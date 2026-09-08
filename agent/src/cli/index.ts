import * as readline from "readline";
import { logger } from "../lib/logger.js";
import type { McpClient } from "../mcp/types.js";
import { RulesEngine } from "../rules/index.js";
import { AuditTrail } from "../audit/index.js";
import { processDonation } from "../intake/index.js";
import type { IpfsClient } from "@amanah/receipts";
import { config } from "../lib/config.js";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(q: string): Promise<string> {
  return new Promise((res) => rl.question(q, res));
}

export async function startRepl(mcp: McpClient, ipfs: IpfsClient, rules: RulesEngine, audit: AuditTrail): Promise<void> {
  console.log("\n  Amanah Treasury Agent CLI\n  Type 'help' for commands.\n");

  while (true) {
    const line = await ask("amanah> ");
    const [cmd, ...args] = line.trim().split(/\s+/);

    try {
      switch (cmd.toLowerCase()) {
        case "help":
          console.log(`
Commands:
  balance                  Show current balances
  value                    Show total treasury value in USD
  donate <asset> <amount>  Simulate a donation
  rules                    Evaluate protection rules
  proposals                List pending proposals
  confirm <id>             Confirm a proposal (dry-run unless DRY_RUN=false)
  reject <id> [reason]     Reject a proposal
  audit                    Show full audit trail
  verify                   Verify local + remote receipt chain
  summary                  Treasury summary
  exit                     Exit CLI
`);
          break;

        case "balance": {
          const balances = await mcp.getBalances();
          console.table(balances.map((b) => ({ Asset: b.asset, Free: b.free, "USD Value": b.usdValue?.toFixed(2) ?? "-" })));
          break;
        }

        case "value": {
          const balances = await mcp.getBalances();
          const total = balances.reduce((s, b) => s + (b.usdValue ?? 0), 0);
          console.log(`Total treasury value: $${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
          break;
        }

        case "donate": {
          const [asset, amount] = args;
          if (!asset || !amount) {
            console.log("Usage: donate <asset> <amount>");
            break;
          }
          const { donationId, receiptCid } = await processDonation(mcp, ipfs, {
            donorRef: `cli-${Date.now()}`,
            asset: asset.toUpperCase(),
            amount,
          });
          console.log(`Donation #${donationId} recorded. Receipt: ${receiptCid}`);
          break;
        }

        case "rules": {
          const proposals = await rules.evaluate(mcp);
          if (proposals.length === 0) {
            console.log("No rules triggered.");
          } else {
            console.log(`${proposals.length} proposal(s) created:`);
            console.table(proposals.map((p) => ({ ID: p.id, Rule: p.ruleId, From: p.assetFrom, To: p.assetTo, Amount: p.amount, Reason: p.reason })));
          }
          break;
        }

        case "proposals": {
          const pending = await rules.getPendingProposals();
          if (pending.length === 0) {
            console.log("No pending proposals.");
          } else {
            console.table(pending.map((p) => ({ ID: p.id, Rule: p.ruleId, From: p.assetFrom, To: p.assetTo, Amount: p.amount, Reason: p.reason })));
          }
          break;
        }

        case "confirm": {
          const id = parseInt(args[0], 10);
          if (isNaN(id)) {
            console.log("Usage: confirm <proposal-id>");
            break;
          }
          const operator = await ask("Your name/operator ID: ");
          const result = await rules.confirmProposal(id, mcp, ipfs, operator, config.DRY_RUN === "true");
          console.log(`Proposal #${result.proposal.id} confirmed. Receipt: ${result.receiptCid}`);
          break;
        }

        case "reject": {
          const id = parseInt(args[0], 10);
          const reason = args.slice(1).join(" ") || "rejected-by-operator";
          if (isNaN(id)) {
            console.log("Usage: reject <proposal-id> [reason]");
            break;
          }
          await rules.rejectProposal(id, reason);
          console.log(`Proposal #${id} rejected.`);
          break;
        }

        case "audit": {
          const chain = await audit.getChain();
          console.table(chain.map((e) => ({ Type: e.eventType, Hash: e.hash.slice(0, 16) + "...", CID: e.cid ?? "-", Time: e.timestamp })));
          break;
        }

        case "verify": {
          const local = await audit.verifyLocalChain();
          console.log(`Local chain: ${local.valid ? "VALID" : `INVALID at index ${local.firstInvalidIndex}`}`);
          const remote = await audit.verifyRemoteChain();
          console.log(`Remote chain: ${remote.valid ? "VALID" : remote.errors.join("; ")}`);
          break;
        }

        case "summary": {
          const s = await audit.getTreasurySummary();
          console.log(`Total donations (USD): $${s.totalDonationsUsd.toLocaleString()}`);
          console.log(`Total proposals: ${s.totalProposals}`);
          console.log(`Pending proposals: ${s.pendingProposals}`);
          break;
        }

        case "exit":
        case "quit":
          rl.close();
          return;

        default:
          console.log("Unknown command. Type 'help' for available commands.");
      }
    } catch (err) {
      logger.error({ err }, "CLI command failed");
      console.error("Error:", err instanceof Error ? err.message : err);
    }
  }
}
