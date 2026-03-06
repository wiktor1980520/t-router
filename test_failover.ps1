
$baseUrl = "http://localhost:8080"
$adminEmail = "admin@t-router.com"
$adminPassword = "admin123" # Assuming default or known password

# 1. Login to get Token
echo "Logging in..."
$loginBody = @{
    email = "admin@t-router.com"
    password = "Admin@123"
} | ConvertTo-Json

try {
    $loginResp = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginResp.token
    echo "Login successful. Token: $token"
} catch {
    echo "Login failed: $_"
    exit
}

$headers = @{
    "Authorization" = "Bearer $token"
}

# 2. Create Test Model
echo "Creating Test Model 'gpt-failover'..."
$modelBody = @{
    id = "gpt-failover"
    name = "Failover Test Model"
    description = "Model for testing failover"
    context_length = 4096
    retail_price_input = 0
    retail_price_output = 0
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$baseUrl/api/admin/models" -Method Post -Body $modelBody -ContentType "application/json" -Headers $headers
} catch {
    echo "Model creation failed (maybe exists): $_"
}

# 3. Create Provider A (Invalid URL)
echo "Creating Provider A..."
$provABody = @{
    name = "ProviderA_Fail"
    type = "openai"
    base_url = "http://localhost:9991/v1" # Invalid port
    api_key = "sk-test-a"
    weight = 10
} | ConvertTo-Json

try {
    $provA = Invoke-RestMethod -Uri "$baseUrl/api/admin/providers" -Method Post -Body $provABody -ContentType "application/json" -Headers $headers
    $provAId = $provA.id
} catch {
    echo "Provider A creation failed: $_"
    # Try to fetch if exists (simplified: just assume failure means duplicate name, skip fetch for now)
}

# 4. Create Provider B (Invalid URL)
echo "Creating Provider B..."
$provBBody = @{
    name = "ProviderB_Fail"
    type = "openai"
    base_url = "http://localhost:9992/v1" # Invalid port
    api_key = "sk-test-b"
    weight = 10
} | ConvertTo-Json

try {
    $provB = Invoke-RestMethod -Uri "$baseUrl/api/admin/providers" -Method Post -Body $provBBody -ContentType "application/json" -Headers $headers
    $provBId = $provB.id
} catch {
    echo "Provider B creation failed: $_"
}

# 5. Create Routes
echo "Creating Routes..."
# Route A: Priority 10
$routeABody = @{
    model_name = "gpt-failover"
    provider_id = $provAId
    priority = 10
    weight = 50
    cost_input = 0
    cost_output = 0
} | ConvertTo-Json

Invoke-RestMethod -Uri "$baseUrl/api/admin/routes" -Method Post -Body $routeABody -ContentType "application/json" -Headers $headers

# Route B: Priority 10
$routeBBody = @{
    model_name = "gpt-failover"
    provider_id = $provBId
    priority = 10
    weight = 50
    cost_input = 0
    cost_output = 0
} | ConvertTo-Json

Invoke-RestMethod -Uri "$baseUrl/api/admin/routes" -Method Post -Body $routeBBody -ContentType "application/json" -Headers $headers

# 6. Create API Key for User (Required for Chat)
echo "Creating API Key..."
$keyBody = @{
    label = "Test Key"
} | ConvertTo-Json
$keyResp = Invoke-RestMethod -Uri "$baseUrl/api/keys" -Method Post -Body $keyBody -ContentType "application/json" -Headers $headers
$apiKey = $keyResp.key
echo "API Key: $apiKey"

# 7. Send Chat Request
echo "Sending Chat Request (Expect Failover)..."
$chatHeaders = @{
    "Authorization" = "Bearer $apiKey"
}
$chatBody = @{
    model = "gpt-failover"
    messages = @(
        @{ role = "user"; content = "Hello" }
    )
} | ConvertTo-Json

try {
    Invoke-RestMethod -Uri "$baseUrl/v1/chat/completions" -Method Post -Body $chatBody -ContentType "application/json" -Headers $chatHeaders
} catch {
    echo "Request failed as expected (both providers invalid)."
    echo "Response: $_"
}

echo "Done. Please check backend logs for failover attempts."
