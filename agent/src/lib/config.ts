import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { z } from "zod";

function getAgentRoot(): string {
  const libDir = dirname(fileURLToPath(import.meta.url));
  // libDir is .../amanah/agent/src/lib/ (dev) or .../amanah/agent/dist/lib/ (prod)
  // Go up 2 levels to reach agent/ package root
  return dirname(dirname(libDir));
}

function getDefaultDbPath(): string {
  return join(getAgentRoot(), "data", "amanah.sqlite");
}

function getDefaultRulesPath(): string {
  return join(getAgentRoot(), "rules.yaml");
}

const ConfigSchema = z.object({
  DRY_RUN: z.enum(["true", "false"]).default("true"),
  LIVE_MARKET: z.enum(["true", "false"]).default("false"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("4000"),
  DB_PATH: z.string().default(getDefaultDbPath()),
  BINANCE_MCP_URL: z.string().optional(),
  BINANCE_PUBLIC_API: z.string().default("https://api.binance.com"),
  WEB3_STORAGE_TOKEN: z.string().optional(),
  AGENT_SUBACCOUNT_API_KEY: z.string().optional(),
  AGENT_SUBACCOUNT_SECRET: z.string().optional(),
  STABLECOIN_ASSET: z.string().default("USDC"),
  RULES_CONFIG_PATH: z.string().default(getDefaultRulesPath()),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const raw: Record<string, string | undefined> = {};
  for (const key of Object.keys(ConfigSchema.shape)) {
    raw[key] = process.env[key];
  }
  return ConfigSchema.parse(raw);
}

export const config = loadConfig();
