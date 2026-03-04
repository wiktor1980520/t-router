# TRouter - Product Roadmap & Iteration Plan

| Version | Target Date | Theme | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **v0.1 (MVP)** | 2026-03-05 | **Core Gateway** | • Basic OpenAI-compatible Gateway (Go)<br>• User Auth (JWT) + Turnstile<br>• Simple Pre-paid Billing<br>• Single Provider Integration (Moonshot/OpenAI)<br>• Basic Dashboard (React) |
| **v0.5** | 2026-03-15 | **Smart Routing** | • Multi-Provider Aggregation (Groq, Anthropic, Azure)<br>• **Smart Routing Engine** (Lowest Price/Latency logic)<br>• **Balance Alert System** (Email/Webhook)<br>• Detailed Audit Logs (Database Storage) |
| **v1.0** | 2026-04-01 | **Commercial Launch** | • **Aggregated Payment Gateway** (Alipay/Stripe)<br>• API Arbitrage Pricing Logic (Retail > Wholesale)<br>• Advanced Dashboard (Charts, Analytics)<br>• Public API Documentation |
| **v2.0** | 2026-06-01 | **Enterprise Scale** | • Team/Organization Management<br>• SSO (SAML/OIDC)<br>• Dedicated Instances/Private Deployment<br>• Advanced Rate Limiting (Global Redis) |

## Detailed Feature Breakdown

### Phase 1: MVP Validation (Completed/In-Progress)
*   **Objective:** Validate the core technical loop (Request -> Auth -> Route -> Response -> Bill).
*   **Status:**
    *   [x] Gateway Framework (Gin)
    *   [x] Auth Middleware (JWT/API Key)
    *   [x] Database Models (User/Transaction)
    *   [x] Basic Dashboard UI
    *   [ ] Cloudflare Turnstile Integration (In Progress)

### Phase 2: Intelligence & Security (Current Focus)
*   **Objective:** Enable the "Smart" part of the gateway and ensure robust security.
*   **Features:**
    *   **Smart Router:** Implement the `RouterEngine` to select providers dynamically.
    *   **Balance Alerts:** Backend worker to check balances and send emails.
    *   **Audit Logging:** Async logging to PostgreSQL for full transparency.
    *   **Security Hardening:** Rate limiting optimization, input validation.

### Phase 3: Monetization & Expansion
*   **Objective:** Enable real revenue flow and scale up.
*   **Features:**
    *   **Payment Integration:** Webhook handlers for 3rd party payment providers.
    *   **Arbitrage Pricing:** Dynamic pricing engine to adjust retail prices based on upstream fluctuations.
    *   **Public SDK/Docs:** Developer-friendly onboarding.
