import { initSchema } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { MockMcpClient } from "./mcp/mock.js";
import { MockIpfsClient } from "@amanah/receipts";
import { RulesEngine } from "./rules/index.js";
import { AuditTrail } from "./audit/index.js";
import { processDonation } from "./intake/index.js";

async function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function banner(title: string) {
  console.log(`\n${"=".repeat(60)}\n  ${title}\n${"=".repeat(60)}`);
}

async function runDemo() {
  banner("AMANAH DEMO — Autonomous Treasury Agent for NGOs");
  await initSchema();

  const mcp = new MockMcpClient();
  const ipfs = new MockIpfsClient();
  const rules = new RulesEngine("./rules.yaml");
  const audit = new AuditTrail(ipfs);

  console.log("\n[1] Initial treasury state (mock balances):");
  const initialBalances = await mcp.getBalances();
  console.table(initialBalances.map((b) => ({ Asset: b.asset, Free: b.free, "USD Value": `$${(b.usdValue ?? 0).toFixed(2)}` })));

  console.log("\n[2] Simulating incoming donations...");
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

  console.log("\n[3] Evaluating protection rules...");
  const proposals = await rules.evaluate(mcp);
  if (proposals.length === 0) {
    console.log("  No rules triggered yet. Let's simulate a volatile drop to trigger rebalancing...");
    mcp.seedVolatileDrop("BNB", 180); // price drops significantly
    const proposals2 = await rules.evaluate(mcp);
    console.log(`  ✓ ${proposals2.length} proposal(s) created by rules engine`);
    for (const p of proposals2) {
      console.log(`    - Proposal #${p.id}: ${p.assetFrom} → ${p.assetTo} (${p.reason})`);
    }
  } else {
    console.log(`  ✓ ${proposals.length} proposal(s) created`);
  }

  console.log("\n[4] Pending proposals awaiting human confirmation:");
  const pending = await rules.getPendingProposals();
  console.table(pending.map((p) => ({ ID: p.id, Rule: p.ruleId, Action: `${p.assetFrom} → ${p.assetTo}`, Amount: p.amount })));

  console.log("\n[5] Human operator confirms Proposal #1...");
  if (pending.length > 0) {
    const confirmed = await rules.confirmProposal(pending[0].id, mcp, ipfs, "operator-sam", true);
    console.log(`  ✓ Proposal #${confirmed.proposal.id} confirmed & executed (dry-run). Receipt: ${confirmed.receiptCid}`);
  }

  console.log("\n[6] Audit trail with hash-chain verification:");
  const chain = await audit.getChain();
  console.table(chain.map((e) => ({ Event: e.eventType, Hash: e.hash.slice(0, 20) + "...", Previous: e.previousHash ? e.previousHash.slice(0, 20) + "..." : "null" })));
  const verifyLocal = await audit.verifyLocalChain();
  console.log(`  Local chain integrity: ${verifyLocal.valid ? "✓ VALID" : "✗ INVALID"}`);

  console.log("\n[7] Treasury summary after protection action:");
  const summary = await audit.getTreasurySummary();
  const finalBalances = await mcp.getBalances();
  const totalUsd = finalBalances.reduce((s, b) => s + (b.usdValue ?? 0), 0);
  console.log(`  Total value: $${totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
  console.log(`  Total donations recorded: $${summary.totalDonationsUsd.toLocaleString()}`);
  console.log(`  Proposals: ${summary.totalProposals} total, ${summary.pendingProposals} pending`);

  console.log("\n[8] IPFS receipt links (mock):");
  for (const e of chain.slice(0, 5)) {
    if (e.cid) console.log(`  - ${e.eventType}: https://mock.ipfs/${e.cid}`);
  }

  banner("DEMO COMPLETE");
  console.log("\nNext: open the web dashboard at http://localhost:5173 (after running pnpm run dev)");
  console.log("Or explore via CLI: pnpm --filter agent run cli\n");
}

runDemo().catch((err) => {
  logger.error({ err }, "Demo failed");
  process.exit(1);
});
