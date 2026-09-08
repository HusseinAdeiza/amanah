import { createReceipt, verifyReceipt, verifyChain, type IpfsClient } from "@amanah/receipts";
import { run, get, all } from "../lib/db.js";
import { logger } from "../lib/logger.js";

export interface AuditEntry {
  id: number;
  nonce: string;
  eventType: string;
  cid: string | null;
  hash: string;
  previousHash: string | null;
  timestamp: string;
  payload: unknown;
}

function mapAuditRow(row: Record<string, unknown>): AuditEntry {
  return {
    id: row.id as number,
    nonce: row.nonce as string,
    eventType: row.event_type as string,
    cid: row.cid as string | null,
    hash: row.hash as string,
    previousHash: row.previous_hash as string | null,
    timestamp: row.timestamp as string,
    payload: row.payload as unknown,
  };
}

export class AuditTrail {
  constructor(private ipfs: IpfsClient) {}

  async recordEvent(
    eventType: string,
    payload: Record<string, unknown>
  ): Promise<{ entry: AuditEntry; cid: string }> {
    const last = await get<{ hash: string }>("SELECT hash FROM receipts ORDER BY id DESC LIMIT 1");
    const previousHash = last?.hash ?? null;
    const receipt = createReceipt(eventType as never, payload, previousHash);

    const { cid } = await this.ipfs.pinReceipt(receipt);
    await run(
      `INSERT INTO receipts (nonce, event_type, cid, hash, previous_hash, timestamp, payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [receipt.nonce, eventType, cid, receipt.hash, receipt.previousHash, receipt.timestamp, JSON.stringify(payload)]
    );

    const entry = mapAuditRow((await get<Record<string, unknown>>("SELECT * FROM receipts WHERE nonce = ?", [receipt.nonce]))!);
    logger.info({ nonce: receipt.nonce, eventType, cid }, "Audit event recorded");
    return { entry, cid };
  }

  async getChain(): Promise<AuditEntry[]> {
    const rows = await all<Record<string, unknown>>("SELECT * FROM receipts ORDER BY id ASC");
    return rows.map(mapAuditRow);
  }

  async verifyLocalChain(): Promise<{ valid: boolean; firstInvalidIndex: number | null }> {
    const entries = await this.getChain();
    const receipts = entries.map((e) => ({
      version: "1.0.0" as const,
      eventType: e.eventType as never,
      timestamp: e.timestamp,
      nonce: e.nonce,
      payload: JSON.parse(e.payload as string) as Record<string, unknown>,
      previousHash: e.previousHash,
      hash: e.hash,
    }));
    return verifyChain(receipts);
  }

  async verifyRemoteChain(): Promise<{ valid: boolean; errors: string[] }> {
    const entries = await this.getChain();
    const errors: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e.cid) {
        errors.push(`Entry ${i} missing CID`);
        continue;
      }
      const remote = await this.ipfs.fetchReceipt(e.cid);
      if (!remote) {
        errors.push(`Entry ${i}: CID ${e.cid} not found on IPFS`);
        continue;
      }
      if (!verifyReceipt(remote)) {
        errors.push(`Entry ${i}: receipt hash mismatch`);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  async getDonationTrail(donationId: number): Promise<AuditEntry[]> {
    const allEntries = await this.getChain();
    return allEntries.filter((e) => {
      try {
        const payload = JSON.parse(e.payload as string) as Record<string, unknown>;
        return payload.donationId === donationId;
      } catch {
        return false;
      }
    });
  }

  async getTreasurySummary(): Promise<{ totalDonationsUsd: number; totalProposals: number; pendingProposals: number }> {
    const donations = (await get<{ total: number }>("SELECT COALESCE(SUM(usd_estimate), 0) as total FROM donations"))!;
    const proposals = (await get<{ total: number }>("SELECT COUNT(*) as total FROM proposals"))!;
    const pending = (await get<{ total: number }>("SELECT COUNT(*) as total FROM proposals WHERE status = 'pending'"))!;
    return {
      totalDonationsUsd: donations.total,
      totalProposals: proposals.total,
      pendingProposals: pending.total,
    };
  }
}
