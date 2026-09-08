import { logger } from "../lib/logger.js";
import type { Balance, ConvertRequest, ConvertResult, MarketPrice, McpClient } from "./types.js";

export class MockMcpClient implements McpClient {
  private balances: Balance[] = [
    { asset: "USDC", free: "10000.00", locked: "0" },
    { asset: "BNB", free: "15.00", locked: "0" },
    { asset: "BTC", free: "0.12", locked: "0" },
    { asset: "ETH", free: "3.50", locked: "0" },
  ];

  private prices: Record<string, number> = {
    USDC: 1.0,
    BNB: 520.0,
    BTC: 64000.0,
    ETH: 3400.0,
  };

  async getBalances(): Promise<Balance[]> {
    await delay(50);
    return this.balances.map((b) => ({
      ...b,
      usdValue: parseFloat(b.free) * (this.prices[b.asset] ?? 0),
    }));
  }

  async getPrices(assets: string[]): Promise<MarketPrice[]> {
    await delay(30);
    return assets.map((asset) => ({
      asset,
      priceUsd: this.prices[asset] ?? 1.0,
      timestamp: Date.now(),
    }));
  }

  async executeConvert(req: ConvertRequest): Promise<ConvertResult> {
    await delay(100);
    const from = this.balances.find((b) => b.asset === req.fromAsset);
    if (!from || parseFloat(from.free) < parseFloat(req.amount)) {
      return { success: false, error: "Insufficient balance" };
    }
    from.free = (parseFloat(from.free) - parseFloat(req.amount)).toFixed(8);
    let to = this.balances.find((b) => b.asset === req.toAsset);
    if (!to) {
      to = { asset: req.toAsset, free: "0", locked: "0" };
      this.balances.push(to);
    }
    const fromPrice = this.prices[req.fromAsset] ?? 1;
    const toPrice = this.prices[req.toAsset] ?? 1;
    const received = ((parseFloat(req.amount) * fromPrice) / toPrice).toFixed(8);
    to.free = (parseFloat(to.free) + parseFloat(received)).toFixed(8);
    logger.info({ from: req.fromAsset, to: req.toAsset, amount: req.amount }, "Mock convert executed");
    return { success: true, txHash: `mock-tx-${Date.now()}`, executedPrice: toPrice };
  }

  name(): string {
    return "mock-mcp";
  }

  seedVolatileDrop(asset: string, newPrice: number) {
    this.prices[asset] = newPrice;
  }
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}
