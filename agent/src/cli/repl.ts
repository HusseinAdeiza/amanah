#!/usr/bin/env node
import { initSchema } from "../lib/db.js";
import { MockMcpClient } from "../mcp/mock.js";
import { MockIpfsClient } from "@amanah/receipts";
import { RulesEngine } from "../rules/index.js";
import { AuditTrail } from "../audit/index.js";
import { startRepl } from "./index.js";

async function main() {
  await initSchema();
  const mcp = new MockMcpClient();
  const ipfs = new MockIpfsClient();
  const rules = new RulesEngine("./rules.yaml");
  const audit = new AuditTrail(ipfs);
  await startRepl(mcp, ipfs, rules, audit);
}

main();
