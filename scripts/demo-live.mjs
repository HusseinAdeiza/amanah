#!/usr/bin/env node
/**
 * Amanah Live-Demo Mode
 * Uses real Binance public market data + optional real IPFS receipts.
 * Balances and trade execution remain simulated for safety.
 */
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initSchema } from "../agent/dist/lib/db.js";
import { LiveMarketMcpClient } from "../agent/dist/mcp/live-market.js";
import { MockIpfsClient, Web3StorageIpfsClient } from "../receipts/dist/index.js";
import { RulesEngine } from "../agent/dist/rules/index.js";
import { AuditTrail } from "../agent/dist/audit/index.js";
import { processDonation } from "../agent/dist/intake/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function banner(title) {
  console.log(`\n${"=".repeat(60)}\n  ${title}\n${"=".repeat(60)}`);
}

async function runLiveDemo() {
  banner("AMANAH LIVE DEMO — Real Market Data + Simulated Execution");
  await initSchema();

  const mcp = new LiveMarketMcpClient();
  const token = process.env.WEB3_STORAGE_TOKEN;
  const ipfs = token && token.length > 0 ? new Web3StorageIpfsClient(token) : new MockIpfsClient();
  const rules = new RulesEngine(join(__dirname, "../agent/rules.yaml"));
  const audit = new AuditTrail(ipfs);

  console.log("\n[1] Initial treasury state (simulated balances):");
  const initialBalances = await mcp.getBalances();
  console.table(initialBalances.map((b) => ({ Asset: b.asset, Free: b.free, "USD Value": `$${(b.usdValue ?? 0).toFixed(2)}` })));

  console.log("\n[2] Fetching REAL market prices from Binance public API...");
  const livePrices = await mcp.getPrices(["BTC", "BNB", "ETH"]);
  console.table(livePrices.map((p) => ({ Asset: p.asset, "Price USD": p.priceUsd.toFixed(2), Source: "Binance Public API" })));

  console.log("\n[3] Simulating incoming donations in volatile assets...");
  const donations = [
    { donorRef: "donor-alpha", asset: "BNB", amount: "2.5" },
    { donorRef: "donor-beta", asset: "BTC", amount: "0.05" },
    { donorRef: "donor-gamma", asset: "ETH", amount: "1.2" },
  ];
  for (const d of donations) {
    const result = await processDonation(mcp, ipfs, d);
    console.log(`  ✓ ${d.amount} ${d.asset} from ${d.donorRef} → receipt ${result.receiptCid}`);
    await sleep(200);
  }

  console.log("\n[4] Evaluating protection rules against REAL prices...");
  const proposals = await rules.evaluate(mcp);
  if (proposals.length === 0) {
    console.log("  No rules triggered with current market conditions.");
  } else {
    console.log(`  ✓ ${proposals.length} proposal(s) created based on live market data:`);
    for (const p of proposals) {
      console.log(`    - Proposal #${p.id}: ${p.assetFrom} → ${p.assetTo} (${p.reason})`);
    }
  }

  console.log("\n[5] Pending proposals awaiting human confirmation:");
  const pending = await rules.getPendingProposals();
  console.table(pending.map((p) => ({ ID: p.id, Rule: p.ruleId, Action: `${p.assetFrom} → ${p.assetTo}`, Amount: p.amount })));

  if (pending.length > 0) {
    console.log("\n[6] Human operator confirms Proposal #1...");
    const confirmed = await rules.confirmProposal(pending[0].id, mcp, ipfs, "operator-sam", true);
    console.log(`  ✓ Proposal #${confirmed.proposal.id} confirmed & executed (simulated). Receipt: ${confirmed.receiptCid}`);
  } else {
    console.log("\n[6] No pending proposals to confirm.");
  }

  console.log("\n[7] Audit trail with hash-chain verification:");
  const chain = await audit.getChain();
  console.table(chain.map((e) => ({ Event: e.eventType, Hash: e.hash.slice(0, 20) + "...", Previous: e.previousHash ? e.previousHash.slice(0, 20) + "..." : "null" })));
  const verifyLocal = await audit.verifyLocalChain();
  console.log(`  Local chain integrity: ${verifyLocal.valid ? "✓ VALID" : "✗ INVALID"}`);

  console.log("\n[8] Treasury summary after protection action:");
  const summary = await audit.getTreasurySummary();
  const finalBalances = await mcp.getBalances();
  const totalUsd = finalBalances.reduce((s, b) => s + (b.usdValue ?? 0), 0);
  console.log(`  Total value: $${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
  console.log(`  Total donations recorded: $${summary.totalDonationsUsd.toLocaleString()}`);
  console.log(`  Proposals: ${summary.totalProposals} total, ${summary.pendingProposals} pending`);

  console.log("\n[9] IPFS receipt links:");
  for (const e of chain.slice(-5)) {
    if (e.cid) {
      const url = token ? `https://w3s.link/ipfs/${e.cid}` : `https://mock.ipfs/${e.cid}`;
      console.log(`  - ${e.eventType}: ${url}`);
    }
  }

  banner("LIVE DEMO COMPLETE");
  console.log("\nNotes:");
  console.log("  • Market data: REAL (Binance public API, no auth required)");
  console.log("  • Balances: SIMULATED (no real funds at risk)");
  console.log("  • Trade execution: SIMULATED (confirm-before-execute safety)");
  console.log(`  • IPFS receipts: ${token ? "REAL (web3.storage)" : "MOCK (set WEB3_STORAGE_TOKEN for real pinning)"}`);
  console.log("\nFor full live trading, use DRY_RUN=false with a Binance Agentic sub-account.\n");
}

runLiveDemo().catch((err) => {
  console.error("Live demo failed:", err);
  process.exit(1);
});
