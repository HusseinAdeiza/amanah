import { useState, useCallback } from "react";
import { useTreasury, useDonations, useProposals, useAudit, submitDonation } from "./hooks/useApi";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <h2 style={{ fontSize: 14, textTransform: "uppercase", letterSpacing: 1, color: "#666", marginBottom: 12 }}>{title}</h2>
      {children}
    </div>
  );
}

function AllocationDonut({ data }: { data: { asset: string; usdValue: number; percentage: number }[] }) {
  const total = data.reduce((s, d) => s + d.usdValue, 0);
  const colors = ["#2d6a4f", "#40916c", "#52b788", "#74c69d", "#95d5b2", "#b7e4c7"];
  let cumulative = 0;
  const size = 160;
  const r = 70;
  const cx = size / 2;
  const cy = size / 2;

  const segments = data.map((d, i) => {
    const start = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += d.usdValue;
    const end = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = end - start > Math.PI ? 1 : 0;
    return (
      <path
        key={d.asset}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={colors[i % colors.length]}
        stroke="#fff"
        strokeWidth={2}
      />
    );
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{segments}</svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((d, i) => (
          <div key={d.asset} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: colors[i % colors.length] }} />
            <span style={{ fontSize: 13 }}>
              {d.asset} — {d.percentage.toFixed(1)}% (${d.usdValue.toLocaleString(undefined, { maximumFractionDigits: 0 })})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function parseDonationInput(input: string): { amount: string; asset: string; donor: string } | null {
  const s = input.trim().toUpperCase();
  const withoutDonate = s.replace(/^DONATE\s+/, "");
  const m = withoutDonate.match(/^(\d+(?:\.\d+)?)\s+(BNB|BTC|ETH|USDC)(?:\s+(.+))?$/);
  if (!m) return null;
  const amount = m[1];
  const asset = m[2];
  const rest = m[3]?.trim();
  let donor = "anonymous";
  if (rest) {
    if (rest === "ANONYMOUS") donor = "anonymous";
    else if (rest.startsWith("FROM ")) donor = rest.slice(5).trim();
    else donor = rest;
  }
  return { amount, asset, donor };
}

export default function App() {
  const treasury = useTreasury(3000);
  const donations = useDonations(3000);
  const proposals = useProposals(3000);
  const audit = useAudit(3000);

  const [donationInput, setDonationInput] = useState("");
  const [donationStatus, setDonationStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [lastReceipt, setLastReceipt] = useState("");
  const [lastError, setLastError] = useState("");

  const handleDonate = useCallback(async () => {
    const parsed = parseDonationInput(donationInput);
    if (!parsed) {
      setDonationStatus("error");
      setLastError("Format: 'donate 2.5 BNB' or '2.5 BNB from Yunusa'");
      return;
    }
    setDonationStatus("submitting");
    setLastError("");
    try {
      const result = await submitDonation(parsed.asset, parsed.amount, parsed.donor);
      setDonationStatus("success");
      setLastReceipt(result.receiptCid);
      setDonationInput("");
    } catch (err) {
      setDonationStatus("error");
      setLastError(err instanceof Error ? err.message : "Failed");
    }
  }, [donationInput]);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Amanah</h1>
        <p style={{ color: "#555", marginTop: 4 }}>Autonomous treasury agent for charities and NGOs</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        <Card title="Treasury Value">
          <div style={{ fontSize: 36, fontWeight: 700, color: "#2d6a4f" }}>
            ${treasury ? treasury.totalUsd.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
          </div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Total portfolio value (USD)</div>
        </Card>

        <Card title="Asset Allocation">
          {treasury && treasury.allocation.length > 0 ? (
            <AllocationDonut data={treasury.allocation} />
          ) : (
            <div style={{ color: "#888" }}>Loading...</div>
          )}
        </Card>

        <Card title="Simulate Donation">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="text"
              placeholder="e.g. donate 2.5 BNB from Yunusa"
              value={donationInput}
              onChange={(e) => setDonationInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDonate()}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}
            />
            <button
              onClick={handleDonate}
              disabled={donationStatus === "submitting"}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: "#2d6a4f",
                color: "#fff",
                fontWeight: 600,
                cursor: donationStatus === "submitting" ? "not-allowed" : "pointer",
                opacity: donationStatus === "submitting" ? 0.7 : 1,
              }}
            >
              {donationStatus === "submitting" ? "Processing..." : "Donate"}
            </button>
            {donationStatus === "success" && (
              <div style={{ fontSize: 12, color: "#2d6a4f", background: "#e8f5e9", padding: 8, borderRadius: 6 }}>
                ✓ Donation recorded. Receipt: {lastReceipt.slice(0, 20)}...
              </div>
            )}
            {donationStatus === "error" && (
              <div style={{ fontSize: 12, color: "#c62828", background: "#ffebee", padding: 8, borderRadius: 6 }}>
                ✗ {lastError}
              </div>
            )}
          </div>
        </Card>

        <Card title="Pending Proposals">
          {proposals.pending.length === 0 ? (
            <div style={{ color: "#888" }}>No pending proposals</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {proposals.pending.map((p) => (
                <div key={p.id} style={{ padding: 12, background: "#fffbe6", borderRadius: 8, border: "1px solid #ffe58f" }}>
                  <div style={{ fontWeight: 600 }}>
                    {p.asset_from} → {p.asset_to}
                  </div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{p.reason}</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Amount: {p.amount}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent Donations">
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflow: "auto" }}>
            {donations.slice(0, 10).map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #eee" }}>
                <span style={{ fontSize: 13 }}>
                  {d.asset} {d.amount}
                </span>
                <span style={{ fontSize: 13, color: "#666" }}>${d.usd_estimate.toFixed(2)}</span>
              </div>
            ))}
            {donations.length === 0 && <div style={{ color: "#888" }}>No donations yet</div>}
          </div>
        </Card>

        <Card title="Audit Trail">
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflow: "auto" }}>
            {audit.slice(-20).map((e) => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
                <span style={{ fontWeight: 500 }}>{e.event_type}</span>
                <span style={{ color: "#888", fontFamily: "monospace" }}>{e.hash.slice(0, 16)}...</span>
              </div>
            ))}
            {audit.length === 0 && <div style={{ color: "#888" }}>No audit events</div>}
          </div>
        </Card>
      </div>

      <footer style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid #ddd", fontSize: 12, color: "#999", textAlign: "center" }}>
        Amanah — Built for the Binance Agent OS Mini Hackathon · All receipts are hash-chained and pinned to IPFS
      </footer>
    </div>
  );
}
