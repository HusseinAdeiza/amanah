import { initSchema } from "./lib/db.js";
import { logger } from "./lib/logger.js";
import { MockMcpClient } from "./mcp/mock.js";
import { BinanceMcpClient } from "./mcp/binance.js";
import { MockIpfsClient, Web3StorageIpfsClient } from "@amanah/receipts";
import { RulesEngine } from "./rules/index.js";
import { AuditTrail } from "./audit/index.js";
import { createApi } from "./api.js";
import { config } from "./lib/config.js";
import type { McpClient } from "./mcp/types.js";
import type { IpfsClient } from "@amanah/receipts";

async function main() {
  await initSchema();

  let mcp: McpClient;
  let ipfs: IpfsClient;

  if (config.DRY_RUN === "true") {
    logger.info("DRY-RUN mode enabled — using mock MCP and IPFS");
    mcp = new MockMcpClient();
    ipfs = new MockIpfsClient();
  } else {
    if (!config.BINANCE_MCP_URL) throw new Error("BINANCE_MCP_URL required when DRY_RUN=false");
    const binance = new BinanceMcpClient(config.BINANCE_MCP_URL);
    await binance.connect();
    mcp = binance;
    if (!config.WEB3_STORAGE_TOKEN) throw new Error("WEB3_STORAGE_TOKEN required when DRY_RUN=false");
    ipfs = new Web3StorageIpfsClient(config.WEB3_STORAGE_TOKEN);
  }

  const rules = new RulesEngine(config.RULES_CONFIG_PATH);
  const audit = new AuditTrail(ipfs);

  const app = createApi(mcp, ipfs, rules, audit);
  app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, "API server listening");
  });
}

main().catch((err) => {
  logger.fatal({ err }, "Agent crashed");
  process.exit(1);
});
