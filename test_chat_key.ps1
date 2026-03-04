
param(
    [string]$key
)

if (-not $key) {
    echo "Usage: .\test_chat_key.ps1 <api_key>"
    exit
}

$headers = @{
    Authorization = "Bearer $key"
}

$body = @{
    model = "moonshot-v1-8k"
    messages = @(
        @{
            role = "user"
            content = "Hello, are you working?"
        }
    )
} | ConvertTo-Json -Depth 5

echo "Testing Chat Completion with Key: $key"

try {
    $res = Invoke-RestMethod -Method Post -Uri "http://localhost:80/v1/chat/completions" -Body $body -Headers $headers -ContentType "application/json"
    echo "Response:"
    $res.choices[0].message.content
} catch {
    echo "Chat Completion failed: $_"
    $_.Exception.Response
}
