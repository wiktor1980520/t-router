$ErrorActionPreference = "Stop"

$VERSION = "0.6.0"
$COMMIT_HASH = $(git rev-parse --short HEAD 2>$null)
if (-not $COMMIT_HASH) {
    $COMMIT_HASH = "unknown"
}
$BUILD_TIME = $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Write-Host "Building TRouter Gateway..."
Write-Host "Version:    $VERSION"
Write-Host "Commit:     $COMMIT_HASH"
Write-Host "BuildTime:  $BUILD_TIME"

$LDFLAGS = "-X 'trouter/internal/config.Version=$VERSION' -X 'trouter/internal/config.CommitHash=$COMMIT_HASH' -X 'trouter/internal/config.BuildTime=$BUILD_TIME'"

go build -ldflags $LDFLAGS -o trouter_v$VERSION.exe cmd/gateway/main.go

if ($LASTEXITCODE -eq 0) {
    Write-Host "Build successful: trouter_v$VERSION.exe"
} else {
    Write-Host "Build failed!"
    exit 1
}
