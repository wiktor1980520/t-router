# Test Latency-Based Routing
$baseUrl = "http://localhost:8080/api"
$chatUrl = "http://localhost:8080/v1/chat/completions"

# 1. Login to get token
$loginBody = @{
    email = "admin@t-router.com"
    password = "Admin@123"
} | ConvertTo-Json

try {
    $loginResp = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResp.token
    Write-Host "Login successful. Token: $token"
} catch {
    Write-Error "Login failed: $_"
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $token"
}

# 2. Register Providers
# Provider 1: Fast (10ms)
$fastProvider = @{
    name = "MockFast"
    type = "openai"
    base_url = "http://localhost:8081/fast"
    api_key = "sk-mock-fast"
} | ConvertTo-Json

try {
    $p1 = Invoke-RestMethod -Uri "$baseUrl/admin/providers" -Method Post -Body $fastProvider -Headers $headers -ContentType "application/json"
    $fastId = $p1.id
    Write-Host "Registered Fast Provider (ID: $fastId)"
} catch {
    Write-Error "Failed to register fast provider: $_"
}

# Provider 2: Slow (500ms)
$slowProvider = @{
    name = "MockSlow"
    type = "openai"
    base_url = "http://localhost:8081/slow"
    api_key = "sk-mock-slow"
} | ConvertTo-Json

try {
    $p2 = Invoke-RestMethod -Uri "$baseUrl/admin/providers" -Method Post -Body $slowProvider -Headers $headers -ContentType "application/json"
    $slowId = $p2.id
    Write-Host "Registered Slow Provider (ID: $slowId)"
} catch {
    Write-Error "Failed to register slow provider: $_"
}

# 3. Create Routes
# Both have same priority (10) and weight (10)
$modelName = "test-latency-model"

$routeFast = @{
    model_name = $modelName
    provider_id = $fastId
    priority = 10
    weight = 10
    cost_input = 0
    cost_output = 0
} | ConvertTo-Json

$routeSlow = @{
    model_name = $modelName
    provider_id = $slowId
    priority = 10
    weight = 10
    cost_input = 0
    cost_output = 0
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$baseUrl/admin/routes" -Method Post -Body $routeFast -Headers $headers -ContentType "application/json"
    Write-Host "Created Route for Fast Provider"
    Invoke-RestMethod -Uri "$baseUrl/admin/routes" -Method Post -Body $routeSlow -Headers $headers -ContentType "application/json"
    Write-Host "Created Route for Slow Provider"
} catch {
    Write-Error "Failed to create routes: $_"
}

# 3b. Create API Key
try {
    $apiKeyName = "TestKey-$(Get-Random)"
    $keyBody = @{
        label = $apiKeyName
    } | ConvertTo-Json
    $keyResp = Invoke-RestMethod -Uri "$baseUrl/keys" -Method Post -Body $keyBody -Headers $headers -ContentType "application/json"
    $apiKey = $keyResp.key
    Write-Host "Created API Key: $apiKey"
} catch {
    Write-Error "Failed to create API key: $_"
}

# 4. Wait for Health Check (Interval is 5s, wait 10s to be safe)
Write-Host "Waiting 10s for health check to update latencies..."
Start-Sleep -Seconds 10

# 5. Send Chat Completion Request with strategy="lowest_latency"
$chatBody = @{
    model = $modelName
    messages = @(
        @{ role = "user"; content = "Hello" }
    )
    routing_strategy = "lowest_latency"
} | ConvertTo-Json

$chatHeaders = @{
    "Authorization" = "Bearer $apiKey"
    "X-Router-Strategy" = "lowest_latency"
}

try {
    $resp = Invoke-RestMethod -Uri $chatUrl -Method Post -Body $chatBody -Headers $chatHeaders -ContentType "application/json"
    $content = $resp.choices[0].message.content
    Write-Host "Response received: $content"

    if ($content -match "/fast") {
        Write-Host "SUCCESS: Routed to Fast Provider" -ForegroundColor Green
    } else {
        Write-Host "FAILURE: Routed to Slow Provider (Expected Fast)" -ForegroundColor Red
    }
} catch {
    Write-Error "Chat request failed: $_"
}
