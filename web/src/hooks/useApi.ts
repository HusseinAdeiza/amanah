import { useState, useEffect, useCallback } from "react";

const API_BASE = "/api";

export interface TreasuryData {
  totalUsd: number;
  allocation: { asset: string; usdValue: number; percentage: number }[];
}

export interface Donation {
  id: number;
  donor_ref: string;
  asset: string;
  amount: string;
  usd_estimate: number;
  timestamp: string;
  receipt_cid?: string;
}

export interface Proposal {
  id: number;
  rule_id: string;
  asset_from: string;
  asset_to: string;
  amount: string;
  usd_estimate: number;
  reason: string;
  status: string;
}

export interface AuditEntry {
  id: number;
  event_type: string;
  cid: string | null;
  hash: string;
  previous_hash: string | null;
  timestamp: string;
}

function usePolling<T>(url: string, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [url]);

  useEffect(() => {
    fetchData();
    if (intervalMs <= 0) return;
    const id = setInterval(fetchData, intervalMs);
    return () => clearInterval(id);
  }, [fetchData, intervalMs]);

  return { data, error, refresh: fetchData };
}

export function useTreasury(pollInterval = 3000) {
  const { data } = usePolling<{ totalUsd: number; allocation: TreasuryData["allocation"] }>(`${API_BASE}/treasury`, pollInterval);
  return data;
}

export function useDonations(pollInterval = 3000) {
  const { data } = usePolling<{ donations: Donation[] }>(`${API_BASE}/donations`, pollInterval);
  return data?.donations ?? [];
}

export function useProposals(pollInterval = 3000) {
  const { data } = usePolling<{ pending: Proposal[]; all: Proposal[] }>(`${API_BASE}/proposals`, pollInterval);
  return data ?? { pending: [], all: [] };
}

export function useAudit(pollInterval = 3000) {
  const { data } = usePolling<{ chain: AuditEntry[] }>(`${API_BASE}/audit`, pollInterval);
  return data?.chain ?? [];
}

export async function submitDonation(asset: string, amount: string, donor: string): Promise<{ donation: Donation; receiptCid: string }> {
  const res = await fetch(`${API_BASE}/donations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ asset, amount, donor }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
