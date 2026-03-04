# Set output encoding to UTF-8 to handle Chinese characters correctly
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$headers = @{
    "Authorization" = "Bearer sk-test-123456"
    "Content-Type" = "application/json"
}

$body = @{
    model = "moonshot-v1-8k"
    messages = @(
        @{
            role = "user"
            content = "Hello, who are you?"
        }
    )
}

# Convert hash table to JSON, ensuring proper encoding
$json = $body | ConvertTo-Json -Depth 5 -Compress

try {
    # Force UTF-8 encoding for the request body
    $response = Invoke-RestMethod -Uri "http://localhost:80/v1/chat/completions" -Method Post -Headers $headers -Body $json -ContentType "application/json; charset=utf-8"
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Output "Error:"
    Write-Output $_.Exception.Message
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $reader.ReadToEnd()
    }
}
