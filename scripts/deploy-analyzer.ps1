# Deploy Fish Analyzer Edge Function
# Run: .\scripts\deploy-analyzer.ps1
# Or:  pwsh -File scripts\deploy-analyzer.ps1

$ErrorActionPreference = "Stop"
$ProjectRef = "iutwkyiiendlqxytdzih"

Write-Host "=== Deploy Fish Analyzer ===" -ForegroundColor Cyan
Write-Host ""

# Check if logged in
Write-Host "Checking Supabase login..." -ForegroundColor Yellow
$loginCheck = npx supabase projects list 2>&1
if ($LASTEXITCODE -ne 0 -or $loginCheck -match "Access token not provided") {
    Write-Host "You need to log in first. Run:" -ForegroundColor Red
    Write-Host "  npx supabase login" -ForegroundColor White
    Write-Host ""
    Write-Host "A browser will open. Sign in, then run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "Linking project..." -ForegroundColor Yellow
npx supabase link --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) {
    Write-Host "Link failed. Make sure you have the database password." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Deploying analyze-fish function..." -ForegroundColor Yellow
npx supabase functions deploy analyze-fish --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) {
    Write-Host "Deploy failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Deploying upload-catch-photo function..." -ForegroundColor Yellow
npx supabase functions deploy upload-catch-photo --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) {
    Write-Host "Deploy failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Deploy complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Set the OPENAI_API_KEY secret for AI to work:" -ForegroundColor Yellow
Write-Host "  1. Get API key from https://platform.openai.com/api-keys" -ForegroundColor White
Write-Host "  2. Run: npx supabase secrets set OPENAI_API_KEY=your_key_here --project-ref $ProjectRef" -ForegroundColor White
Write-Host ""
Write-Host "Or in Supabase Dashboard: Edge Functions -> analyze-fish -> Manage secrets" -ForegroundColor White
