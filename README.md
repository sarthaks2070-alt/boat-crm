# AI-Powered Influencer CRM & Campaign Automation for boAt

A complete, live, full-stack AI Influencer CRM and Campaign Automation system engineered specifically for **boAt’s Influencer Marketing team**. It automates the end-to-end influencer collaboration lifecycle—from discovery and public onboarding to AI profile evaluation, campaign brief dispatch, AI-assisted script compliance auditing, multi-stage approval workflows, Kanban pipeline tracking, automated communications, and post-campaign performance analytics.

---

## 🚀 Live Access & Setup

The system runs on the built-in Antigravity Node 24 runtime with zero external dependencies and native SQLite persistence.

- **Local URL**: [http://localhost:3000](http://localhost:3000)
- **Project Directory**: `C:\Users\CSC\.gemini\antigravity\scratch\boat-influencer-crm`
- **Run Command**:
  ```powershell
  & "C:\Users\CSC\AppData\Roaming\Antigravity\bin\agy-node.cmd" server.js
  ```
  Or double-click `run.bat` in the project directory.

---

## 💎 Key Features & Capabilities

### 1. Influencer Onboarding & Discovery
- **Public Creator Application Portal**: Creators apply via an official boAt-branded form providing Name, Instagram Handle, Follower Count, Engagement Rate (ER%), Content Category, Demographic split, Commercial Rate, and preferred boAt products.
- **Instant CRM Integration**: Creator data is immediately ingested into SQLite (`boat_crm.db`) and queued for evaluation.

### 2. AI-Based Influencer Evaluation Studio
- **Multi-Vector Evaluation Algorithm**:
  - **Audience Relevance** (Ages 18–30 youth concentration)
  - **Engagement Quality** (Organic benchmark comparison, bot detection)
  - **Brand & Category Fit** (Alignment with boAt audio, gaming, ANC, and wearables)
  - **Credibility & Real Reach** (Fake follower risk audit)
  - **Content Quality & Aesthetics** (Visual standards)
  - **Commercial ROI Viability** (Predicted Cost Per Engagement: CPE)
- **boAt Fit Index (0–100)** with Match Tiers:
  - `Platinum Match (90–100)`
  - `Gold Match (80–89)`
  - `Silver Match (65–79)`
  - `Mismatch / High Risk (<65)`
- **Explainable AI Output**: Highlights specific strengths, potential drawbacks, predicted CPE in ₹, and recommended boAt product lines (e.g. Nirvana Ion ANC, Immortal 131, Wave Pro, Stone 1500).

### 3. Campaign Brief & Product Hub
- Pre-seeded flagship boAt campaigns:
  1. **boAt Nirvana Ion ANC - Silence The Chaos** (32dB ANC, 120h battery, ENx Quad Mics, HiFi DSP)
  2. **boAt Wave Pro - Move in Style** (Live Cricket Scores, ASAP Charge 30m, IP68)
  3. **boAt Immortal 131 - Beast Mode Gaming** (40ms low latency, RGB LEDs, 40h playback)
  4. **boAt Stone 1500 - Monster Bass Outdoor** (40W boAt Signature Sound, TWS pair, IPX6)
- Comprehensive creative briefs including campaign objectives, target audience, mandatory communication points, dos & don'ts, and required hashtags (`#DoWhatFloatsYourBoAt`).

### 4. AI-Assisted Script Review Studio
- **Side-by-Side Review Studio**: Displays creator concept, target video format, duration, and dialogue editor alongside a live AI compliance scanner.
- **Automated Brand & Specs Verification**:
  - Checks presence of mandatory product specs (e.g. 32dB ANC, 120hr battery, 40ms Beast Mode).
  - Verifies inclusion of campaign hashtags and purchase call to action (`link in bio`).
  - Scans tone against boAt's energetic, Gen-Z voice.
  - Detects prohibited content: direct competitor naming (Apple, Sony, OnePlus) and misleading claims (e.g. false waterproof swimming claims for splash-resistant products).
  - Generates line-by-line rewrite suggestions and an AI Compliance Score (0–100).

### 5. Centralized Approval Workflow & Audit Trail
- Workflow stages:
  `Applied` → `Screening` → `Shortlisted` → `Contacted` → `Negotiation` → `Selected` → `Brief Shared` → `Script Submitted` → `Script Approved` → `Content Created` → `Published` → `Campaign Completed`
- 1-click marketing actions: `✅ Approve Script`, `📝 Request Revisions`, `❌ Reject Concept`.
- Immutable activity log recording all timestamps, reviewer notes, and automated actions.

### 6. Pipeline Tracking (Kanban & Table)
- Real-time interactive Kanban board with drag-and-drop or 1-click stage advancement buttons.
- Multi-parameter filtering by search keyword, content niche, creator tier (Macro, Mid, Micro, Nano), and minimum AI score.

### 7. Automated Communications & Notifications
- Automated triggers:
  - Application confirmation sent upon onboarding.
  - Campaign brief dispatched upon shortlisting.
  - Script revision requests with AI notes.
  - Script approval greenlight for production.
- Simulated delivery across Email & WhatsApp channels with real-time logs.

### 8. Performance Tracking & ROI Analytics
- Aggregated metrics: Verified Views, Reach, Engagements, Link Clicks, Direct Orders, CPE, and ROI Multiplier.
- AI Post-Campaign Strategic Intelligence generating key learnings for future product drops.

---

## 🛠️ Architecture

- **Backend**: Native Node.js 24 (`node:http`, `node:sqlite`, `node:crypto`, `node:fs`).
- **Database**: SQLite with WAL mode (`data/boat_crm.db`).
- **AI Intelligence**: Heuristic & rule-based scoring engine (`ai-engine.js`) with Gemini API extensibility.
- **Frontend**: Responsive Single-Page Application (`index.html`, `style.css`, `app.js`).
