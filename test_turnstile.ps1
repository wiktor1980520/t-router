$baseUrl = "http://localhost:8080/api"

# 1. Test Registration without Turnstile Token
$bodyNoToken = @{
    email = "user-no-token@test.com"
    password = "User123!"
    phone = "13800000001"
    verification_code = "123456"
    # turnstile_token missing
} | ConvertTo-Json

Write-Host "Testing Registration WITHOUT Turnstile Token..."
try {
    Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $bodyNoToken -ContentType "application/json"
    Write-Host "FAILURE: Registration succeeded without token!" -ForegroundColor Red
} catch {
    $err = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($err)
    $respBody = $reader.ReadToEnd()
    Write-Host "SUCCESS: Registration failed as expected. Response: $respBody" -ForegroundColor Green
}

# 2. Test Registration WITH Turnstile Token (Dummy)
# Note: Since we use the dummy secret key 1x00000000000000000000AA, any token should pass verification?
# Actually, the site key and secret key must match the test pair.
# If we used the "Always Pass" secret key, then any token provided by the "Always Pass" site key works.
# But here we just send a string.
# If Turnstile verification is enabled, it will call Cloudflare API.
# Cloudflare API with dummy secret might accept any token or specific ones.
# Let's try "XXXX.DUMMY.TOKEN.XXXX"
$bodyWithToken = @{
    email = "user-with-token@test.com"
    password = "User123!"
    phone = "13800000002"
    verification_code = "123456"
    turnstile_token = "XXXX.DUMMY.TOKEN.XXXX"
} | ConvertTo-Json

Write-Host "`nTesting Registration WITH Turnstile Token..."
try {
    # Note: verification_code "123456" might fail if SMS mock is not validating it or if it's invalid.
    # But we want to see if Turnstile passes.
    # If Turnstile passes, we might get "Invalid verification code" or Success.
    # If Turnstile fails, we get "Security check failed".
    
    Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body $bodyWithToken -ContentType "application/json"
    Write-Host "SUCCESS: Registration succeeded (or passed Turnstile)" -ForegroundColor Green
} catch {
    $err = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($err)
    $respBody = $reader.ReadToEnd()
    if ($respBody -match "Security check failed") {
         Write-Host "FAILURE: Turnstile check failed. Response: $respBody" -ForegroundColor Red
    } else {
         Write-Host "SUCCESS: Passed Turnstile (failed on other step: $respBody)" -ForegroundColor Green
    }
}
