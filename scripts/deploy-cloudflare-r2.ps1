# ==============================================================================
# CLOUDFLARE R2 SERVERLESS SATELLITE DEPLOYMENT PIPELINE
# Deploys PMTiles archives with HTTP Range request & CORS support ($0 Egress Fees)
# ==============================================================================

param (
    [Parameter(Mandatory=$false)]
    [string]$PmtilesPath = "./public/kerala_satellite.pmtiles",

    [Parameter(Mandatory=$false)]
    [string]$BucketName = "kerala-satellite-tiles",

    [Parameter(Mandatory=$false)]
    [string]$R2AccountId = $env:CLOUDFLARE_R2_ACCOUNT_ID
)

$ErrorActionPreference = "Stop"

Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "   CLOUDFLARE R2 SERVERLESS SATELLITE DEPLOYMENT PIPELINE      " -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan

if (-not (Test-Path $PmtilesPath)) {
    Write-Error "PMTiles archive not found at: $PmtilesPath"
}

if (-not $R2AccountId) {
    Write-Host "`n⚠️ CLOUDFLARE_R2_ACCOUNT_ID environment variable not set." -ForegroundColor Yellow
    Write-Host "Please set your Cloudflare Account ID and AWS credentials:" -ForegroundColor Yellow
    Write-Host '  $env:CLOUDFLARE_R2_ACCOUNT_ID = "<your_cloudflare_account_id>"' -ForegroundColor Gray
    Write-Host '  $env:AWS_ACCESS_KEY_ID = "<your_r2_access_key_id>"' -ForegroundColor Gray
    Write-Host '  $env:AWS_SECRET_ACCESS_KEY = "<your_r2_secret_access_key>"' -ForegroundColor Gray
    Write-Host "`nOr configure AWS CLI profile with: aws configure --profile r2`n" -ForegroundColor Gray
}

$EndpointUrl = "https://${R2AccountId}.r2.cloudflarestorage.com"

# 1. Create CORS configuration JSON file for HTTP Range Requests
$CorsConfig = @"
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["Range", "If-Match", "If-Modified-Since", "Content-Type"],
      "ExposeHeaders": ["Content-Range", "ETag", "Content-Length", "Accept-Ranges"],
      "MaxAgeSeconds": 86400
    }
  ]
}
"@
$CorsFile = "./cors-r2-pmtiles.json"
$CorsConfig | Out-File -FilePath $CorsFile -Encoding ascii

Write-Host "[STEP 1/3] Generated CORS configuration for HTTP Range Requests ($CorsFile)..." -ForegroundColor Green

Write-Host "[STEP 2/3] Uploading $PmtilesPath to Cloudflare R2 bucket: $BucketName..." -ForegroundColor Yellow
Write-Host "Command: aws s3 cp $PmtilesPath s3://${BucketName}/kerala_satellite.pmtiles --endpoint-url $EndpointUrl --content-type application/vnd.pmtiles`n" -ForegroundColor Gray

if ($R2AccountId) {
    aws s3 cp $PmtilesPath "s3://${BucketName}/kerala_satellite.pmtiles" --endpoint-url $EndpointUrl --content-type "application/vnd.pmtiles"
    aws s3api put-bucket-cors --bucket $BucketName --cors-configuration "file://$CorsFile" --endpoint-url $EndpointUrl
    Write-Host "✔ PMTiles archive successfully uploaded to Cloudflare R2!" -ForegroundColor Green
} else {
    Write-Host "ℹ️ Run the above aws s3 cp command once your R2 credentials are authenticated." -ForegroundColor Cyan
}

Write-Host "`n[STEP 3/3] Connect to Vanguard Emergency Dispatch App:" -ForegroundColor Green
Write-Host "Set the public URL in your .env file or localStorage:" -ForegroundColor White
Write-Host '  VITE_PMTILES_URL="https://pub-<your-r2-bucket>.r2.dev/kerala_satellite.pmtiles"' -ForegroundColor Yellow
Write-Host "Or in browser console:" -ForegroundColor White
Write-Host "  localStorage.setItem('vanguard_pmtiles_url', 'https://pub-<your-r2-bucket>.r2.dev/kerala_satellite.pmtiles')`n" -ForegroundColor Yellow
