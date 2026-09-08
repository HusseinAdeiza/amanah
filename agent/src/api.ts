import express, { type Express } from "express";
import cors from "cors";
import { z } from "zod";
import { logger } from "./lib/logger.js";
import { config } from "./lib/config.js";
import { all, get } from "./lib/db.js";
import type { McpClient } from "./mcp/types.js";
import { RulesEngine } from "./rules/index.js";
import { AuditTrail } from "./audit/index.js";
import { processDonation } from "./intake/index.js";
import type { IpfsClient } from "@amanah/receipts";

export function createApi(mcp: McpClient, ipfs: IpfsClient, rules: RulesEngine, audit: AuditTrail): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true, dryRun: config.DRY_RUN === "true" }));

  app.get("/balances", async (_req, res) => {
    try {
      const balances = await mcp.getBalances();
      res.json({ balances });
    } catch (err) {
      logger.error({ err }, "GET /balances failed");
      res.status(500).json({ error: "Failed to fetch balances" });
    }
  });

  app.get("/donations", async (_req, res) => {
    try {
      const rows = await all("SELECT * FROM donations ORDER BY timestamp DESC");
      res.json({ donations: rows });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  app.post("/donations", async (req, res) => {
    try {
      const schema = z.object({
        asset: z.string().min(1),
        amount: z.string().min(1),
        donor: z.string().optional().default("anonymous"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.format() });
      }
      const { asset, amount, donor } = parsed.data;
      const result = await processDonation(mcp, ipfs, {
        donorRef: donor,
        asset: asset.toUpperCase(),
        amount,
      });
      const donation = await get<Record<string, unknown>>("SELECT * FROM donations WHERE id = ?", [result.donationId]);
      res.json({ donation, receiptCid: result.receiptCid });
    } catch (err) {
      logger.error({ err }, "POST /donations failed");
      res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  app.get("/proposals", async (_req, res) => {
    try {
      const pending = await rules.getPendingProposals();
      const allProposals = await rules.getAllProposals();
      res.json({ pending, all: allProposals });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  app.post("/proposals/:id/confirm", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { operator } = req.body;
      if (!operator) return res.status(400).json({ error: "operator required" });
      const result = await rules.confirmProposal(id, mcp, ipfs, operator, config.DRY_RUN === "true");
      res.json({ proposal: result.proposal, receiptCid: result.receiptCid });
    } catch (err) {
      logger.error({ err }, "POST /proposals/:id/confirm failed");
      res.status(400).json({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  app.post("/proposals/:id/reject", async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { reason } = req.body;
      const proposal = await rules.rejectProposal(id, reason || "rejected-by-api");
      res.json({ proposal });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  app.get("/audit", async (_req, res) => {
    try {
      const chain = await audit.getChain();
      res.json({ chain });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  app.get("/audit/verify", async (_req, res) => {
    try {
      const local = await audit.verifyLocalChain();
      const remote = await audit.verifyRemoteChain();
      res.json({ local, remote });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  app.get("/summary", async (_req, res) => {
    try {
      const balances = await mcp.getBalances();
      const totalUsd = balances.reduce((s, b) => s + (b.usdValue ?? 0), 0);
      const summary = await audit.getTreasurySummary();
      res.json({ totalUsd, balances, ...summary });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  app.get("/treasury", async (_req, res) => {
    try {
      const balances = await mcp.getBalances();
      const totalUsd = balances.reduce((s, b) => s + (b.usdValue ?? 0), 0);
      const allocation = balances.map((b) => ({
        asset: b.asset,
        usdValue: b.usdValue ?? 0,
        percentage: totalUsd > 0 ? ((b.usdValue ?? 0) / totalUsd) * 100 : 0,
      }));
      res.json({ totalUsd, allocation });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  });

  return app;
}
