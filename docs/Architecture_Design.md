# TRouter - System Architecture Design

## 1. High-Level Architecture

TRouter is designed as a **cloud-native, high-performance API Gateway** specifically for LLMs. It follows a microservices-ready layered architecture.

```mermaid
graph TD
    Client[User / App] -->|HTTPS /v1/*| LoadBalancer[Nginx / Cloud LB]
    LoadBalancer --> Gateway[**TRouter Gateway** (Go)]

    subgraph "TRouter Core"
        Gateway -->|Auth & Rate Limit| Middleware
        Gateway -->|Turnstile Check| AuthMiddleware
        Gateway -->|Decision| RouterEngine[**Smart Router**]
        Gateway -->|Async Log| AuditService[Audit Logger]
        Gateway -->|Deduct| BillingService[Billing Manager]
        BillingService -.->|Check Balance| AlertService[**Balance Alert**]
    end

    subgraph "Data Storage"
        Redis[(Redis)] -->|Hot Data| Gateway
        PostgreSQL[(PostgreSQL)] -->|Persist| Gateway
    end

    subgraph "Upstream Providers"
        RouterEngine -->|Adapter| OpenAI[OpenAI]
        RouterEngine -->|Adapter| Azure[Azure OpenAI]
        RouterEngine -->|Adapter| Anthropic[Anthropic]
        RouterEngine -->|Adapter| OSS_Agg[Groq/Together/DeepInfra]
    end

    subgraph "Third-Party Services"
        PaymentGW[Payment Aggregator] -->|Webhook| Gateway
    end
```

## 2. Core Components

### 2.1 Gateway Service (Golang + Gin)
*   **Responsibility:** Request handling, Authentication, Validation, Response Streaming.
*   **Concurrency:** Uses Go Goroutines for non-blocking I/O.
*   **Middleware Chain:**
    1.  `Recovery`: Panic recovery.
    2.  `CORS`: Cross-origin support.
    3.  `AuthMiddleware`: Validate Bearer Token (JWT/API Key).
    4.  `RateLimit`: Rate limiter (MVP: in-memory per API Key; can be upgraded to Redis sliding window).
    5.  `CostEstimation`: Pre-flight check for user balance.

### 2.2 Smart Router Engine
*   **Logic:**
    *   **Input:** User Request Model (e.g., `gpt-4`), API Key Routing Preference (`lowest_cost` / `lowest_latency`).
    *   **Process:**
        1.  Lookup `ModelRoute` for all active providers supporting the model.
        2.  **Filter:** Exclude disabled providers.
        3.  **Sort:**
            *   If `lowest_cost`: Sort by (Input Cost + Output Cost) ASC.
            *   If `lowest_latency`: Sort by Priority DESC (or latency metrics if available).
            *   Default: Sort by Priority DESC.
        4.  **Return:** Ordered list of candidate providers.
*   **Failover & Fallback:**
    *   The Gateway iterates through the candidate list.
    *   If the primary provider fails (connection error or 5xx), the system automatically retries with the next provider in the list.
    *   **Streaming Support:** Fallback is supported for streaming requests *before* the first byte is sent to the client.
*   **Pricing Model (Static Arbitrage):**
    *   **User Billing:** Based on `Model.RetailPriceInput` / `RetailPriceOutput` (Fixed Admin Price).
    *   **Provider Cost:** Recorded based on `ModelRoute.CostInput` / `CostOutput` (Actual Cost).
    *   **Profit:** Difference between Retail Price and Provider Cost.

### 2.3 Billing & Payment
*   **Data Model:**
    *   `Transactions`: Immutable ledger of all credits/debits.
    *   `User.Balance`: Cached current balance (updated atomically).
*   **Payment Flow:**
    1.  User initiates Top-up -> Request Payment Gateway URL.
    2.  User pays on third-party page (Alipay/Card).
    3.  Payment Gateway calls TRouter Webhook (`/api/payment/notify`).
    4.  TRouter verifies signature -> Creates Transaction -> Updates Balance.

### 2.4 Audit Logging
*   **Design:** Asynchronous writing to avoid blocking the main request path.
*   **Storage:**
    *   **Hot Storage (Recent):** PostgreSQL `request_logs` table.
    *   **Cold Storage (Long-term):** S3 / ClickHouse (Future).
*   **Schema:**
    ```sql
    CREATE TABLE audit_logs (
        id UUID PRIMARY KEY,
        request_id VARCHAR(64),
        user_id UINT,
        model_id VARCHAR(50),
        provider_id VARCHAR(50),
        prompt_tokens INT,
        completion_tokens INT,
        total_cost DECIMAL(20, 10),
        latency_ms INT,
        status_code INT,
        client_ip VARCHAR(45),
        created_at TIMESTAMP
    );
    ```

### 2.5 Balance Alert System
*   **Trigger:** Post-transaction balance check.
*   **Logic:**
    *   If `User.Balance` < `User.AlertThreshold` AND `LastAlertTime` > 24h:
    *   Push notification to Queue (Redis/RabbitMQ).
    *   Worker consumes queue -> Sends Email/Webhook.
*   **Tech Stack:** Go background worker + SMTP/HTTP Client.

## 3. Database Schema Design (PostgreSQL)

### 3.1 ER Diagram Concepts

*   **User** 1:N **ApiKey**
*   **User** 1:N **Transaction**
*   **User** 1:N **AuditLog**
*   **Provider** 1:N **ModelRoute** (Which models this provider serves)
*   **Model** 1:N **ModelRoute**

### 3.2 Key Tables

**Providers Table:**
```sql
CREATE TABLE providers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL, -- e.g., "openai", "azure-east-us"
    base_url VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    weight INT DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE
);
```

**ModelRoutes Table (The Routing Table):**
```sql
CREATE TABLE model_routes (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(50) NOT NULL, -- e.g., "gpt-4"
    provider_id INT REFERENCES providers(id),
    cost_input DECIMAL(20, 10), -- Cost per 1k tokens (Upstream)
    cost_output DECIMAL(20, 10),
    priority INT DEFAULT 0, -- Higher = Preferred
    UNIQUE(model_name, provider_id)
);
```

## 4. Deployment Strategy
*   **Docker Compose:** For single-node deployment (MVP).
*   **Kubernetes:** For high-availability production (Future).
*   **CI/CD:** GitHub Actions -> Build Docker Image -> Deploy.
