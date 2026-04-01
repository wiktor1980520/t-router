-- OpenRouter-like Platform Database Schema (PostgreSQL)
-- Version: 0.1.0

-- 1. Users & Auth
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- Nullable if using only OAuth
    invitation_code VARCHAR(20), -- Uppercased; used for channel attribution
    balance DECIMAL(20, 6) DEFAULT 0.000000 CHECK (balance >= 0), -- Stored in USD, precision up to 6 decimal places
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    org_id UUID, -- Optional: attach key to organization/team
    key_hash VARCHAR(255) UNIQUE NOT NULL, -- Store hashed key, not raw
    key_prefix VARCHAR(10) NOT NULL, -- First few chars for display (e.g., "sk-...")
    label VARCHAR(50),
    routing_preference VARCHAR(20) DEFAULT 'lowest_cost', -- 'lowest_cost', 'lowest_latency'
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    monthly_budget DECIMAL(20, 8) NOT NULL DEFAULT 0.0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, user_id)
);

CREATE TABLE org_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    period VARCHAR(7) NOT NULL,
    spent DECIMAL(20, 8) NOT NULL DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, period)
);

-- 2. Models & Providers (The Core Routing Data)
CREATE TABLE providers (
    id VARCHAR(50) PRIMARY KEY, -- e.g., 'openai', 'anthropic', 'groq'
    name VARCHAR(100) NOT NULL,
    base_url VARCHAR(255) NOT NULL,
    api_key VARCHAR(255), -- Encrypted storage recommended in prod
    is_active BOOLEAN DEFAULT TRUE,
    health_score INT DEFAULT 100 -- 0-100, updated by health checks
);

CREATE TABLE models (
    id VARCHAR(100) PRIMARY KEY, -- e.g., 'llama-3-70b-instruct' (Unified ID exposed to users)
    name VARCHAR(100) NOT NULL,
    description TEXT,
    context_length INT,
    
    -- Retail Price (Static Arbitrage) - Price for User (USD per 1M tokens)
    retail_price_input DECIMAL(12, 8) DEFAULT 0.0,
    retail_price_output DECIMAL(12, 8) DEFAULT 0.0,
    
    is_active BOOLEAN DEFAULT TRUE
);

-- Many-to-Many mapping: Which provider serves which model?
CREATE TABLE model_provider_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id VARCHAR(100) NOT NULL REFERENCES models(id),
    provider_id VARCHAR(50) NOT NULL REFERENCES providers(id),
    
    -- Provider-specific model ID (e.g., Groq might call it 'llama3-70b-8192')
    provider_model_id VARCHAR(100) NOT NULL,
    
    -- Cost (USD per 1M tokens)
    cost_per_input_token DECIMAL(12, 8) NOT NULL,
    cost_per_output_token DECIMAL(12, 8) NOT NULL,
    
    latency_score INT DEFAULT 0, -- Moving average of latency (ms)
    is_active BOOLEAN DEFAULT TRUE,
    
    UNIQUE(model_id, provider_id)
);

-- 3. Billing & Logs
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(20, 8) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'recharge', 'consumption'
    status VARCHAR(20) NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'failed'
    payment_method VARCHAR(50),
    description VARCHAR(255),
    reference_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(type, reference_id)
);

CREATE TABLE payment_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    out_trade_no VARCHAR(100) NOT NULL UNIQUE,
    channel VARCHAR(50) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'manual_review'
    gateway_trade_no VARCHAR(100),
    notify_payload TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subscription_plans (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    monthly_price DECIMAL(20, 8) NOT NULL DEFAULT 0.0,
    monthly_quota DECIMAL(20, 8) NOT NULL DEFAULT 0.0,
    allowed_models TEXT,
    rate_limit INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    plan_id BIGINT NOT NULL REFERENCES subscription_plans(id),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    remaining_quota DECIMAL(20, 8) NOT NULL DEFAULT 0.0,
    auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE request_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    api_key_id UUID REFERENCES api_keys(id),
    org_id UUID REFERENCES organizations(id),
    
    model_id VARCHAR(100) NOT NULL,
    provider_id VARCHAR(50) NOT NULL, -- Which provider actually served this
    
    prompt_tokens INT NOT NULL,
    completion_tokens INT NOT NULL,
    total_cost DECIMAL(12, 8) NOT NULL,
    provider_cost DECIMAL(12, 8) NOT NULL DEFAULT 0.0,
    
    status_code INT NOT NULL,
    duration_ms INT NOT NULL,
    ttft_ms INT, -- Time to First Token (for streaming)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_mappings_model ON model_provider_mappings(model_id);
CREATE INDEX idx_logs_user_date ON request_logs(user_id, created_at);
