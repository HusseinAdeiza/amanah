export interface Balance {
  asset: string;
  free: string;
  locked: string;
  usdValue?: number;
}

export interface MarketPrice {
  asset: string;
  priceUsd: number;
  timestamp: number;
}

export interface ConvertRequest {
  fromAsset: string;
  toAsset: string;
  amount: string;
}

export interface ConvertResult {
  success: boolean;
  txHash?: string;
  executedPrice?: number;
  error?: string;
}

export interface McpClient {
  getBalances(): Promise<Balance[]>;
  getPrices(assets: string[]): Promise<MarketPrice[]>;
  executeConvert(req: ConvertRequest): Promise<ConvertResult>;
  name(): string;
}
