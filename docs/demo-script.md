# Amanah — 3-Minute Live Demo Video Script

> Exact narration for hackathon demo video. Run `node scripts/demo-live.mjs` for the live market data version.

---

## 0:00–0:30 — Problem

**[Screen: text slides or voiceover with simple visuals]**

"Every year, millions in crypto donations flow to NGOs in emerging markets. But three invisible problems erode that impact:

One: **volatility**. A donation in BNB can lose 30% of its value before it ever reaches a program.

Two: **zero treasury staff**. A grassroots NGO in Kenya or Indonesia doesn't have a finance team watching charts.

Three: **donor distrust**. Donors want proof, but NGOs hand over error-prone spreadsheets.

We built Amanah to fix all three."

---

## 0:30–0:45 — Solution Overview

**[Screen: Amanah logo + tagline]**

"Amanah means trust. It's an autonomous treasury agent that receives donations, protects their value with pre-approved rules, and proves every movement on an immutable public trail.

It never speculates. A human always confirms any action that moves funds. And every event is hash-chained and pinned to IPFS."

---

## 0:45–1:15 — Live Demo: Real Market Data + Donation Intake

**[Screen: terminal running `node scripts/demo-live.mjs`]**

"We're running live-demo mode. Notice: real market prices from Binance public API — no authentication needed — but balances and execution remain simulated for safety.

First, we see the initial treasury with simulated balances. Then the live price fetch: BTC, BNB, ETH — all real 24-hour ticker data.

Now three donations arrive: BNB from donor-alpha, BTC from donor-beta, ETH from donor-gamma. Each is logged with a pseudonymous donor reference, a USD estimate using the real live price, and an IPFS receipt."

**[Narrator pauses as the terminal prints each receipt CID]**

"Every donation immediately generates a signed, hash-chained receipt."

---

## 1:15–1:45 — Rule Trigger & Proposal

**[Screen: terminal continues — rules evaluate against real prices]**

"Now the protection rules engine checks the treasury against real market data. If a volatile asset holding exceeds $500 equivalent, or if volatile exposure crosses 30%, a proposal is created.

The engine creates a proposal: convert BNB to USDC. But notice — it does NOT execute. It stages the action and waits for human confirmation. This is confirm-before-execute, matching Binance Agent OS safety patterns."

---

## 1:45–2:15 — Human Confirmation & Execution

**[Screen: terminal — operator confirms proposal]**

"The NGO operator sees the pending proposal, confirms it, and the convert is simulated. The real system would call the Binance MCP spot-convert tool inside an Agentic sub-account.

A new receipt is generated, hash-linked to the previous one, and pinned to IPFS."

---

## 2:15–2:45 — Audit Trail Verification

**[Screen: terminal — audit chain display]**

"Now we verify the audit trail. Every receipt includes the hash of the previous receipt, forming a tamper-evident chain. We check locally — valid. And remotely against IPFS — valid.

Anyone in the world can fetch a receipt by CID and independently verify the chain integrity."

---

## 2:45–3:10 — Dashboard

**[Screen: switch to browser at localhost:5173]**

"This is the public dashboard. No keys, no secrets — it reads from the agent's read-only API.

We see total treasury value, asset allocation, the live donation feed, pending proposals, and the full audit trail with IPFS links and verification badges.

Donors, regulators, and the public can verify every movement without trusting the NGO's word alone."

---

## 3:10–3:30 — Closing

**[Screen: architecture diagram + GitHub link]**

"Amanah is built on Binance Agent OS MCP tools, uses Agentic Wallet for donation intake, and pins audit receipts to IPFS. It runs in dry-run mode by default, or live-demo mode with real market data and simulated execution. Full live trading requires an Agentic sub-account with least-privilege scopes.

It's open-source, fully demoable in under five minutes, and ready to protect real treasuries.

Thank you."

---

## Technical Notes for Recording

- Run `node scripts/demo-live.mjs` in one terminal window for the CLI segments.
- In a second terminal, run `pnpm --filter agent run start` and `pnpm --filter web run dev` for the dashboard segment.
- The live prices are fetched from Binance public API and cached for 30 seconds.
- For a purely offline demo, use `pnpm run demo` instead.
