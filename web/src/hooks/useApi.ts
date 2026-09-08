import { useState, useEffect } from "react";

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

export function useTreasury() {
  const [data, setData] = useState<TreasuryData | null>(null);
  useEffect(() => {
    fetch(`${API_BASE}/treasury`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);
  return data;
}

export function useDonations() {
  const [data, setData] = useState<Donation[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/donations`)
      .then((r) => r.json())
      .then((d) => setData(d.donations || []))
      .catch(() => setData([]));
  }, []);
  return data;
}

export function useProposals() {
  const [data, setData] = useState<{ pending: Proposal[]; all: Proposal[] }>({ pending: [], all: [] });
  useEffect(() => {
    fetch(`${API_BASE}/proposals`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ pending: [], all: [] }));
  }, []);
  return data;
}

export function useAudit() {
  const [data, setData] = useState<AuditEntry[]>([]);
  useEffect(() => {
    fetch(`${API_BASE}/audit`)
      .then((r) => r.json())
      .then((d) => setData(d.chain || []))
      .catch(() => setData([]));
  }, []);
  return data;
}
