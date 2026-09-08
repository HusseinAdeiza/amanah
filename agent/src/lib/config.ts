import { z } from "zod";

const ConfigSchema = z.object({
  DRY_RUN: z.enum(["true", "false"]).default("true"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("4000"),
  DB_PATH: z.string().default("./data/amanah.sqlite"),
  BINANCE_MCP_URL: z.string().optional(),
  WEB3_STORAGE_TOKEN: z.string().optional(),
  AGENT_SUBACCOUNT_API_KEY: z.string().optional(),
  AGENT_SUBACCOUNT_SECRET: z.string().optional(),
  STABLECOIN_ASSET: z.string().default("USDC"),
  RULES_CONFIG_PATH: z.string().default("./rules.yaml"),
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
