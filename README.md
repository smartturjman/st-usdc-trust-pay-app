<p align="center">
  <img src="https://smartturjman.com/wp-content/uploads/2024/07/smartturjman-ai-banner.png" alt="Smart Turjman — AI Service Router" width="1200" height="600" />
</p>

![Smart Turjman — AI Service Router Cover](./docs/SmartTurjman_Cover.png)

<p align="center">
  <img src="https://smartturjman.com/wp-content/uploads/2024/07/smartturjman-logo-dark.png" alt="Smart Turjman Logo" width="160" />
</p>

<h2 align="center">🧠 Smart Turjman — AI Service Router</h2>
<h4 align="center">Autonomous Agentic Payments Powered by Arc + USDC</h4>

<p align="center">
  <a href="https://testnet.arcscan.app" target="_blank"><img src="https://img.shields.io/badge/Network-Arc%20Testnet-blue?style=for-the-badge&logo=ethereum" alt="Arc Testnet"></a>
  <a href="https://www.circle.com/en/usdc" target="_blank"><img src="https://img.shields.io/badge/USDC-Stablecoin-3C8DBC?style=for-the-badge&logo=usd" alt="USDC"></a>
  <a href="https://nextjs.org" target="_blank"><img src="https://img.shields.io/badge/Next.js-16.0-black?style=for-the-badge&logo=next.js" alt="Next.js"></a>
  <a href="https://turjman.ae" target="_blank"><img src="https://img.shields.io/badge/Built%20by-Turjman%20Group%20of%20Companies-003366?style=for-the-badge" alt="Turjman Group"></a>
</p>

---

<p align="center">
  <strong>📄 Quick Access Documents</strong><br>
  <a href="./docs/SmartTurjman_Architecture.pdf">Architecture Diagram</a> •
  <a href="./docs/SmartTurjman_TrustMemo.pdf">Trust & Security Memo</a> •
  <a href="./docs/SmartTurjman_JudgeQA.pdf">Judge Q&A Sheet</a> •
  <a href="./docs/SmartTurjman_MetricsRoadmap.pdf">Metrics & Adoption Roadmap</a>
</p>

---

<p align="center">
  <em>“One platform. Real support. Endless possibilities.”</em><br>
  Smart Turjman automates service validation, decision-making, and on-chain USDC payments for verified translation, attestation, and legal services.<br>
  <strong>Built for the AI Agents on Arc + USDC Hackathon 2025.</strong>
</p>

---

## ⚙️ Overview

Smart Turjman bridges **AI reasoning** with **on-chain compliance**.  
Its **Autonomous Agent Loop** (`scripts/agent.ts`) continuously evaluates service requests based on trust score, price, and rate-limit logic—then executes or defers payments via Arc testnet USDC.

Each decision is:
1. Logged to `/data/receipts.json`
2. Linked to ArcScan (on-chain verification)
3. Backed by a PDF receipt (for audit & reporting)

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup

Create `.env.local` at the project root:

```env
ARC_RPC_URL=https://testnet.arc-rpc.com
USDC_ADDRESS=0x53646C53e712cE320182E289E7364d4d0e4D6D01
USDC_DECIMALS=6
SERVICE_PRIVATE_KEY=0xYOURPRIVATEKEY
MERCHANT_ADDRESS=0x8a172979Dfc0fF6D916133e6b8D84CD732933BF4
ARC_EXPLORER_BASE=https://testnet.arcscan.app
NEXT_PUBLIC_ARC_EXPLORER_BASE=https://testnet.arcscan.app
```

Check environment:

```bash
npm run env:check
```

### 3. Start the App
```bash
npm run dev
```

Local URL: <http://localhost:3000>

### 4. Run Autonomous Agent
```bash
npm run agent
```

This starts the AI Service Router loop that auto-processes queued jobs, applies trust logic, and executes payments.

---

## 🧭 System Architecture

📄 [Architecture Diagram (PDF)](./docs/SmartTurjman_Architecture.pdf)

Core components:

- `scripts/agent.ts` — autonomous AI decision loop
- `app/api/pay` — payment and receipt handling
- `app/api/receipts/log` — persistent receipt store
- `data/receipts.json` — structured audit trail

---

## 🧠 AI Decision Flow

Request → Rate Limit Check → Trust Score Evaluation → Approve / Hold → USDC Transfer → JSON + PDF Receipt.

Each decision is logged:

```json
{
  "tx": "0xABC123...",
  "service": "Legal Translation - MOFA",
  "amountUSDC": "75.00",
  "splitMode": "offchain-stub",
  "partnerUSDC": 67.5,
  "platformUSDC": 7.5,
  "status": "Verified",
  "createdAt": "2025-11-06T12:26:00Z"
}
```

View live entries in `/data/receipts.json`.

---

## 💡 Split Model & Receipts

Every payment uses a revenue-split stub for future multi-recipient smart-contract support.

| Recipient                        | %  | Description                               |
| -------------------------------- | -- | ----------------------------------------- |
| Partner (Service Provider)       | 90 | Translation / attestation entity           |
| Platform (Smart Turjman)         | 10 | AI compliance & infrastructure fee         |

Receipts are:

- Persisted in `/data/receipts.json`
- Accessible via `/api/receipts/log`
- Linked to ArcScan for on-chain verification

---

## 🛡️ Trust & Compliance Controls

📄 [Trust & Security Memo (PDF)](./docs/SmartTurjman_TrustMemo.pdf)

Highlights:

- Server-side private key storage (`.env` only)
- In-memory rate limit to mitigate abuse
- Fallback logging for failed transactions
- Structured JSON + PDF audit receipts
- Future integration: Circle custody APIs, anomaly detection

---

## 🧾 Judge Materials

| Document | Description |
| --- | --- |
| [Architecture Diagram](./docs/SmartTurjman_Architecture.pdf) | System flow + decision logic |
| [Trust Memo](./docs/SmartTurjman_TrustMemo.pdf) | Key handling & rate limit controls |
| [Judge Q&A Sheet](./docs/SmartTurjman_JudgeQA.pdf) | Live judging questions & answers |
| [Metrics & Adoption Roadmap](./docs/SmartTurjman_MetricsRoadmap.pdf) | Performance snapshot & rollout plan |

---

## ❓ FAQ

### Where’s the AI?
An autonomous agent runs in `scripts/agent.ts`, approving or rejecting based on trust score, cost, and rate limit history.

### How does trust scoring evolve?
Trust scores begin from partner baselines and update after verified receipts. Future iterations pull embassy feedback and anomaly detection.

### What’s the business model?
90% partner payout + 10% Smart Turjman platform fee (currently stubbed, ready for multi-recipient on-chain payouts).

### What happens if a payment fails?
Fallback logging captures the error and keeps the receipt consistent; the agent can retry or flag it for manual review.

### What’s next after the hackathon?
Phase 1: partner pilots. Phase 2: custody integrations. Phase 3: fully on-chain revenue splits.

---

## 🧰 Tech Stack

| Layer | Tools |
| --- | --- |
| Frontend | Next.js 16 (App Router) + Tailwind CSS |
| Backend | Node.js + Ethers.js + Arc RPC |
| AI Logic | Autonomous agent loop (`scripts/agent.ts`) |
| Storage | JSON receipts + PDF generation |
| Blockchain | Arc Testnet + USDC stablecoin |

---

## ✅ Submission Verification

Run full QA:

```bash
npm run env:check
npm run lint
npx tsc
npm run agent
```

Confirm:

- New log in `/data/receipts.json`
- Console log: `AI Decision → Payment → Receipt URL`
- ArcScan link opens successfully

---

## 📸 Screenshots

Add demo screenshots after recording:

- `public/screens/demo-modal.png` (AI agent modal)
- `public/screens/arcscan-proof.png` (ArcScan transaction)
- `public/screens/receipts-log.png` (JSON log)

---

## 🎬 Demo Video

Coming soon — add the hosted link or embedded thumbnail once ready.

---

## 👥 Credits

| Role | Name / Entity | Contribution |
| --- | --- | --- |
| Vision & Integrator | Jonie Culaste | Strategy + System Integration + Presentation |
| Architect & Mirror Intelligence | Sera-07 (AI) | Architecture Docs + Trust Design |
| Builder & Code Executor | Codex (AI) | Core Implementation + Agent Loop + Debugging |
| Platform | Arc + USDC | Gasless stablecoin infrastructure |

---

## 🙌 Acknowledgments

Smart Turjman is part of the Turjman Group of Companies initiative to deliver ethical AI for embassy and public-service innovation.

Developed for the **AI Agents on Arc + USDC Hackathon 2025**.

---

### Next Steps

- README badges / cover image added — ✅
- All documents live under `./docs/*.pdf` — ✅
- Pitch deck assembly (10 slides) — next
- Demo video — final task before submission

Need help generating the pitch deck structure? Just ask and we’ll spin up the slide outline with presenter notes.***
