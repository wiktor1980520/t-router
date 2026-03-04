
$baseUrl = "http://localhost:80/api"

# 1. Register
echo "1. Registering new user..."
$registerBody = @{
    email = "test_dash_$(Get-Random)@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $registerRes = Invoke-RestMethod -Method Post -Uri "$baseUrl/auth/register" -Body $registerBody -ContentType "application/json"
    echo "Registered User: $($registerRes.user.email)"
    $token = $registerRes.token
} catch {
    echo "Register failed: $_"
    exit
}

# 2. Get Me
echo "`n2. Getting User Profile..."
$headers = @{
    Authorization = "Bearer $token"
}
try {
    $meRes = Invoke-RestMethod -Method Get -Uri "$baseUrl/user/me" -Headers $headers
    echo "User Balance: $($meRes.balance)"
} catch {
    echo "Get Me failed: $_"
}

# 3. Create API Key
echo "`n3. Creating API Key..."
$keyBody = @{
    label = "Test Key"
} | ConvertTo-Json

try {
    $keyRes = Invoke-RestMethod -Method Post -Uri "$baseUrl/keys" -Body $keyBody -Headers $headers -ContentType "application/json"
    echo "Created Key: $($keyRes.key)"
    echo "Key ID: $($keyRes.id)"
} catch {
    echo "Create Key failed: $_"
}

# 4. List API Keys
echo "`n4. Listing API Keys..."
try {
    $keysRes = Invoke-RestMethod -Method Get -Uri "$baseUrl/keys" -Headers $headers
    echo "Found $($keysRes.Count) keys"
    $keysRes | Format-Table label, key_prefix, is_active
} catch {
    echo "List Keys failed: $_"
}

# 5. Recharge
echo "`n5. Recharging..."
$rechargeBody = @{
    amount = 50.0
} | ConvertTo-Json

try {
    $rechargeRes = Invoke-RestMethod -Method Post -Uri "$baseUrl/user/recharge" -Body $rechargeBody -Headers $headers -ContentType "application/json"
    echo "Recharge Result: $($rechargeRes.message)"
} catch {
    echo "Recharge failed: $_"
}

# 6. Check Balance again
echo "`n6. Checking Balance..."
try {
    $meRes = Invoke-RestMethod -Method Get -Uri "$baseUrl/user/me" -Headers $headers
    echo "New User Balance: $($meRes.balance)"
} catch {
    echo "Get Me failed: $_"
}

# 7. Check Transactions
echo "`n7. Checking Transactions..."
try {
    $txRes = Invoke-RestMethod -Method Get -Uri "$baseUrl/user/transactions" -Headers $headers
    echo "Found $($txRes.Count) transactions"
    $txRes | Format-Table type, amount, description
} catch {
    echo "Get Transactions failed: $_"
}
