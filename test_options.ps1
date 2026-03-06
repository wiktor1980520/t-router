try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/login" -Method Options -UseBasicParsing
    Write-Host "OPTIONS request successful! Status: $($response.StatusCode)"
    Write-Host "Headers: $($response.Headers | ConvertTo-Json)"
} catch {
    Write-Error "OPTIONS request failed: $_"
}
