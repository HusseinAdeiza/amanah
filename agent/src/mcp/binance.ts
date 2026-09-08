import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { logger } from "../lib/logger.js";
import type { Balance, ConvertRequest, ConvertResult, MarketPrice, McpClient } from "./types.js";

export class BinanceMcpClient implements McpClient {
  private client: Client;
  private connected = false;

  constructor(private url: string) {
    this.client = new Client({ name: "amanah-agent", version: "1.0.0" }, { capabilities: {} });
  }

  async connect(): Promise<void> {
    const transport = new SSEClientTransport(new URL(this.url));
    await this.client.connect(transport);
    this.connected = true;
    logger.info("Binance MCP client connected");
  }

  async getBalances(): Promise<Balance[]> {
    this.ensureConnected();
    const result = await this.client.callTool({ name: "get_account_balances", arguments: {} });
    const content = (result.content as Array<{ type: string; text: string }>) ?? [];
    const json = content.find((c) => c.type === "text")?.text ?? "[]";
    return JSON.parse(json) as Balance[];
  }

  async getPrices(assets: string[]): Promise<MarketPrice[]> {
    this.ensureConnected();
    const result = await this.client.callTool({
      name: "get_market_prices",
      arguments: { symbols: assets.map((a) => `${a}USDT`) },
    });
    const content = (result.content as Array<{ type: string; text: string }>) ?? [];
    const json = content.find((c) => c.type === "text")?.text ?? "[]";
    const raw = JSON.parse(json) as Array<{ symbol: string; price: string }>;
    return raw.map((r) => {
      const asset = r.symbol.replace("USDT", "").replace("USDC", "");
      return { asset, priceUsd: parseFloat(r.price), timestamp: Date.now() };
    });
  }

  async executeConvert(req: ConvertRequest): Promise<ConvertResult> {
    this.ensureConnected();
    const result = await this.client.callTool({
      name: "spot_convert",
      arguments: {
        fromAsset: req.fromAsset,
        toAsset: req.toAsset,
        amount: req.amount,
      },
    });
    const content = (result.content as Array<{ type: string; text: string }>) ?? [];
    const json = content.find((c) => c.type === "text")?.text ?? "{}";
    const parsed = JSON.parse(json) as ConvertResult;
    return parsed;
  }

  name(): string {
    return "binance-mcp";
  }

  private ensureConnected() {
    if (!this.connected) throw new Error("MCP client not connected");
  }
}
