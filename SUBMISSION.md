# Amanah — Hackathon Submission Checklist

> Track A: AI Agent with Binance Agent OS  
> Binance Agent OS Mini Hackathon · Deadline: Sept 8, 2026, 23:59 UTC

---

## Submission Requirements

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | **Follow** [@Binance](https://x.com/Binance) on X | ⬜ Pending | Screenshot after follow |
| 2 | **Repost** the official hackathon announcement | ⬜ Pending | Link to repost |
| 3 | **Quote-repost** with demo video + GitHub repo | ⬜ Pending | [GitHub](https://github.com/HusseinAdeiza/amanah) |
| 4 | **Submit** the hackathon survey form | ⬜ Pending | See survey link below |

---

## Quick Links

| Resource | URL |
|----------|-----|
| **GitHub Repository** | https://github.com/HusseinAdeiza/amanah |
| **Demo Script (narration)** | [`docs/demo-script.md`](./docs/demo-script.md) |
| **Official Announcement** | *(add link to Binance Agent OS Mini Hackathon post)* |
| **Hackathon Survey** | *(add survey link here)* |

---

## Demo Video Notes

- **Script location:** [`docs/demo-script.md`](./docs/demo-script.md)
- **Run demo locally:** `pnpm install && pnpm run demo`
- **Run with dashboard:** `pnpm run dev` (API on :4000, dashboard on :5173)
- **Dry-run mode:** Enabled by default — no real funds, no API keys required

---

## Project Summary for Survey

- **Project name:** Amanah
- **Track:** Track A — AI Agent with Binance Agent OS
- **Problem:** Charities/NGOs face volatility erosion, zero treasury staff, and donor distrust
- **Solution:** Autonomous treasury agent that receives donations, protects value via rule-based conversions, and proves every movement on an IPFS hash-chained audit trail
- **Agent OS features used:** MCP Server (balances/prices/spot convert), Agentic Wallet / x402 (donation intake), confirm-before-execute (human approval for all converts)
- **Tech stack:** Node.js + TypeScript (ESM), SQLite, IPFS (web3.storage), Vite + React, pnpm monorepo
