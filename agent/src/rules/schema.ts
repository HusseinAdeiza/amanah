import { z } from "zod";

export const RuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  condition: z.object({
    type: z.enum(["threshold", "ratio", "schedule"]),
    asset: z.string().optional(),
    minUsd: z.number().optional(),
    maxRatio: z.number().optional(),
    cron: z.string().optional(),
  }),
  action: z.object({
    type: z.literal("convert"),
    fromAsset: z.string(),
    toAsset: z.string(),
    amount: z.enum(["all", "partial"]),
  }),
});

export type Rule = z.infer<typeof RuleSchema>;

export const RulesConfigSchema = z.object({
  version: z.string(),
  rules: z.array(RuleSchema),
});

export type RulesConfig = z.infer<typeof RulesConfigSchema>;
