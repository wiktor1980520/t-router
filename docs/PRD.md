# TRouter - High-Performance Vertical LLM Gateway Product Requirements Document (PRD)

| Version | Date       | Author       | Change Log |
| :--- | :--- | :--- | :--- |
| v1.0.0  | 2026-03-03 | Trae (AI PM) | Refined based on strategic direction: Vertical LLM Gateway, Hybrid B2B/C, Aggregated Payment |

## 1. Product Overview

### 1.1 Product Vision
To build the world's most **cost-effective and high-performance Vertical LLM Gateway**. TRouter aggregates global AI model providers (OpenAI, Anthropic, Azure, Groq, etc.) to provide developers and enterprises with a unified, reliable, and lower-cost AI infrastructure.

### 1.2 Strategic Positioning
*   **Vertical Focus:** Exclusively focused on LLM/AI API routing and management (vs. generic API gateways like Kong).
*   **Business Model:** **API Arbitrage (Reseller)**. We profit from the margin between wholesale model prices (via high-volume commitments or cheaper providers) and retail prices, as well as SaaS subscription fees for advanced features.
*   **Target Audience:** **Hybrid (B2B + B2C)**.
    *   **B2C (Developers):** Attraction via low price, ease of use, and "one key for all models".
    *   **B2B (Enterprises):** Retention via high availability (HA), unified billing, granular permission management, and audit logging.

### 1.4 Target Platforms
*   **Web Dashboard (SaaS Console):**
    *   **PC/Desktop:** Primary interface for developers and enterprise admins to manage keys, billing, and logs. Optimized for large data tables and charts.
    *   **Mobile Web:** Responsive design for quick checks on balance and system status.
*   **API Interface:**
    *   **Standard Endpoint:** `https://api.t-router.com/v1` (Public access).
    *   **Protocol:** HTTPS/JSON, fully compatible with OpenAI SDKs (Python/Node.js).

### 1.5 Unique Selling Points (USP)
1.  **Smart Routing & Arbitrage:** Dynamic routing based on **Price, Latency, and Availability**. Automatically route traffic to the cheapest reliable provider for a given model (e.g., routing "Llama 3" to Groq vs. DeepInfra based on real-time status).
    *   *Arbitrage Logic:* System prioritizes providers where `(Retail Price - Provider Cost)` yields the highest margin, while respecting SLA.
2.  **High Performance:** Built on **Golang**, ensuring minimal overhead (<10ms) and high concurrency support.
3.  **Flexible Billing:** Hybrid pre-paid/post-paid models with support for **Aggregated Payment Gateways** (Alipay, WeChat Pay, Stripe, Crypto).
4.  **Enterprise-Grade Audit:** Comprehensive logging of every request for compliance and cost analysis.

---

## 2. Functional Requirements

### 2.1 Unified API Gateway (The Core)
*   **Protocol:** 100% compatible with OpenAI `POST /v1/chat/completions` standard.
*   **Multi-Channel Aggregation:**
    *   **Tier 1 Providers:** OpenAI, Azure OpenAI, Anthropic, Google Gemini.
    *   **Tier 2/Open Source Providers:** Groq, Together AI, DeepInfra, OpenRouter, Moonshot.
    *   **Local/Private Models:** Support routing to local vLLM/Ollama instances.
*   **Normalization:** Automatically handle differences in upstream API responses (e.g., `finish_reason`, `usage` formats) to ensure a consistent response format.

### 2.2 Smart Routing Engine
*   **User Preferences:**
    *   Users can customize their routing preference per API Key or globally (e.g., "Price Priority" vs. "Speed Priority").
*   **Strategy Configuration:**
    *   *Lowest Cost (Price Priority):* Route to the cheapest provider.
        *   **Fallback Logic:** If the cheapest provider fails, retry with the **second cheapest** provider, and so on.
    *   *Lowest Latency (Speed Priority):* Route to the fastest provider (TTFT).
    *   *High Availability:* Round-robin with health checks and auto-failover.
*   **Fallback Mechanism:** If Provider A fails (5xx/Timeout), immediately retry with Provider B according to the selected strategy, transparent to the user.

### 2.3 Billing & Payment System
*   **Wallet System:** User balance (Credits).
*   **Real-time Deduction:** Deduct credits immediately after request completion based on Token count.
*   **Aggregated Payment Integration:**
    *   Integrate with a payment aggregator (e.g., Epay, Rainbow) to support Alipay, WeChat Pay, USDT, and Credit Cards via a single interface.
    *   **Webhook Handling:** Securely handle asynchronous payment notifications.
*   **Pricing Strategy (Static Arbitrage):**
    *   **V1 Implementation:** Admin manually sets fixed retail prices or multipliers (e.g., "Input: ¥10/1M tokens") for each model.
    *   System calculates margin based on configured upstream costs.

### 2.4 Audit & Compliance System
*   **Full Logging:** Record Request/Response metadata (User ID, Model, Provider Used, Tokens, Latency, Cost, Client IP).
*   **Content Redaction:** Option to log full content or redact sensitive PII (Configurable).
*   **Search & Export:** Admin/User can search logs by Request ID or Date Range.

### 2.5 Dashboard (User & Admin)
*   **User Console:** API Key management, Top-up, Usage Analytics (Charts), Error Logs.
*   **Admin Console:**
    *   **Channel Management:** Add/Remove upstream providers, set priorities/weights.
    *   **User Management:** Ban users, adjust balances.
    *   **System Status:** Real-time QPS, Success Rate, Revenue monitoring.

---

### 2.6 Balance Alert System
*   **Threshold Configuration:** Users can set a "Low Balance Threshold" (e.g., alert when < $10.00).
*   **Notification Channels:**
    *   **Email:** Send warning emails to the registered address.
    *   **Webhook:** Trigger a user-defined webhook (for automated systems to pause requests or auto-topup).
*   **Frequency Control:** Prevent spamming (e.g., max 1 alert per 24h unless balance drops further).
*   **Hard Stop:** Optional "Auto-Stop" setting to reject requests if balance < $0.50 to prevent overdraft.

## 3. Non-Functional Requirements

*   **Performance:** P99 Overhead < 20ms. Support 10k+ QPS.
*   **Reliability:** 99.99% SLA via multi-provider redundancy.
*   **Security:** 
    *   API Keys hashed (SHA-256/Bcrypt). 
    *   TLS 1.3 enforcement. 
    *   Rate Limiting (Token Bucket) per user/IP.
    *   **Bot Protection:** Cloudflare Turnstile integration on Login/Register pages.

---

## 4. Roadmap (V1.0 Target)

### Phase 1: MVP (Current Status)
*   [x] Basic Gateway (Go/Gin).
*   [x] OpenAI/Moonshot Integration.
*   [x] Simple Pre-paid Billing (Mock/Manual).
*   [x] Basic Dashboard (React).

### Phase 2: V1.0 Core (Next Steps)
*   [ ] **Smart Routing Implementation:** Weighted routing logic + Failover.
*   [ ] **Payment Gateway Integration:** Epay/Stripe Webhook handling.
*   [ ] **Database Schema Upgrade:** Support detailed Audit Logs and multiple Providers per Model.
*   [ ] **Admin API:** Dynamic configuration of upstream providers (no restart required).

### Phase 3: Enterprise Features (Future)
*   [ ] SSO (OIDC/SAML).
*   [ ] Team/Organization Management.
*   [ ] Advanced Rate Limiting (Global distributed limits).
