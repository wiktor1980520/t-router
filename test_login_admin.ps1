$body = @{
    email = "admin@t-router.com"
    password = "Admin@123"
    turnstile_token = "mock-token"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/login" -Method Post -Body $body -ContentType "application/json"
    Write-Host "Login successful!"
    Write-Host "Token: $($response.token)"
    Write-Host "User: $($response.user | ConvertTo-Json)"
} catch {
    Write-Error "Login failed: $_"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $respBody = $reader.ReadToEnd()
        Write-Host "Response Body: $respBody"
    }
}
