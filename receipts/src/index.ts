import { createHash } from "crypto";
import { z } from "zod";

export const ReceiptEventType = z.enum([
  "donation_received",
  "protection_rule_triggered",
  "convert_proposed",
  "convert_confirmed",
  "convert_executed",
  "disbursement",
  "emergency_stop",
]);

export type ReceiptEventType = z.infer<typeof ReceiptEventType>;

export const ReceiptSchema = z.object({
  version: z.literal("1.0.0"),
  eventType: ReceiptEventType,
  timestamp: z.string().datetime(),
  nonce: z.string().uuid(),
  payload: z.record(z.unknown()),
  previousHash: z.string().nullable(),
  hash: z.string(),
});

export type Receipt = z.infer<typeof ReceiptSchema>;

export function createReceipt(
  eventType: ReceiptEventType,
  payload: Record<string, unknown>,
  previousHash: string | null
): Receipt {
  const nonce = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const hash = hashReceipt({ version: "1.0.0", eventType, timestamp, nonce, payload, previousHash });
  return {
    version: "1.0.0",
    eventType,
    timestamp,
    nonce,
    payload,
    previousHash,
    hash,
  };
}

function hashReceipt(receipt: Omit<Receipt, "hash">): string {
  const data = JSON.stringify({
    version: receipt.version,
    eventType: receipt.eventType,
    timestamp: receipt.timestamp,
    nonce: receipt.nonce,
    payload: receipt.payload,
    previousHash: receipt.previousHash,
  });
  return createHash("sha256").update(data).digest("hex");
}

export function verifyReceipt(receipt: Receipt): boolean {
  const computed = hashReceipt(receipt);
  return computed === receipt.hash;
}

export function verifyChain(receipts: Receipt[]): { valid: boolean; firstInvalidIndex: number | null } {
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i];
    if (!verifyReceipt(r)) return { valid: false, firstInvalidIndex: i };
    if (i > 0 && r.previousHash !== receipts[i - 1].hash) {
      return { valid: false, firstInvalidIndex: i };
    }
    if (i === 0 && r.previousHash !== null) {
      return { valid: false, firstInvalidIndex: 0 };
    }
  }
  return { valid: true, firstInvalidIndex: null };
}

export * from "./ipfs.js";
