import { createReceipt, type IpfsClient } from "@amanah/receipts";
import { run } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import type { McpClient } from "../mcp/types.js";

export interface DonationEvent {
  donorRef: string;
  asset: string;
  amount: string;
  txHash?: string;
}

export async function processDonation(
  mcp: McpClient,
  ipfs: IpfsClient,
  event: DonationEvent
): Promise<{ donationId: number; receiptCid: string }> {
  const prices = await mcp.getPrices([event.asset]);
  const price = prices.find((p) => p.asset === event.asset)?.priceUsd ?? 0;
  const usdEstimate = parseFloat(event.amount) * price;

  const result = await run(
    `INSERT INTO donations (donor_ref, asset, amount, usd_estimate, timestamp, tx_hash)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [event.donorRef, event.asset, event.amount, usdEstimate, new Date().toISOString(), event.txHash ?? null]
  );
  const donationId = result.lastID;

  const receipt = createReceipt("donation_received", {
    donationId,
    donorRef: event.donorRef,
    asset: event.asset,
    amount: event.amount,
    usdEstimate,
    txHash: event.txHash,
  }, null);

  const { cid } = await ipfs.pinReceipt(receipt);
  await run("UPDATE donations SET receipt_cid = ? WHERE id = ?", [cid, donationId]);

  logger.info({ donationId, asset: event.asset, usdEstimate, cid }, "Donation processed");
  return { donationId, receiptCid: cid };
}
