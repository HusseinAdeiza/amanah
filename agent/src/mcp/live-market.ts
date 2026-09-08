import { logger } from "../lib/logger.js";
import { config } from "../lib/config.js";
import type { Balance, ConvertRequest, ConvertResult, MarketPrice, McpClient } from "./types.js";
import { MockMcpClient } from "./mock.js";

interface Ticker24h {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastQty: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

export class LiveMarketMcpClient implements McpClient {
  private mock = new MockMcpClient();
  private cache = new Map<string, { price: number; timestamp: number }>();
  private cacheTtlMs = 30_000;

  name(): string {
    return "live-market-mcp";
  }

  async getBalances(): Promise<Balance[]> {
    return this.mock.getBalances();
  }

  async getPrices(assets: string[]): Promise<MarketPrice[]> {
    const results: MarketPrice[] = [];
    for (const asset of assets) {
      const cached = this.cache.get(asset);
      if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
        results.push({ asset, priceUsd: cached.price, timestamp: cached.timestamp });
        continue;
      }
      try {
        const price = await this.fetchPrice(asset);
        this.cache.set(asset, { price, timestamp: Date.now() });
        results.push({ asset, priceUsd: price, timestamp: Date.now() });
      } catch (err) {
        logger.warn({ asset, err }, "Failed to fetch live price, falling back to mock");
        const mockPrices = await this.mock.getPrices([asset]);
        results.push(...mockPrices);
      }
    }
    return results;
  }

  async executeConvert(req: ConvertRequest): Promise<ConvertResult> {
    logger.info({ req }, "Live-demo: convert simulated (no real execution)");
    return this.mock.executeConvert(req);
  }

  seedVolatileDrop(asset: string, newPrice: number) {
    this.mock.seedVolatileDrop(asset, newPrice);
  }

  private async fetchPrice(asset: string): Promise<number> {
    const symbol = `${asset}USDT`;
    const url = `${config.BINANCE_PUBLIC_API}/api/v3/ticker/24hr?symbol=${symbol}`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`Binance API error: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as Ticker24h;
    return parseFloat(data.lastPrice);
  }
}
