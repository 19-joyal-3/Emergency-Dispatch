#!/usr/bin/env bash
# ==============================================================================
# CLOUDFLARE R2 SERVERLESS SATELLITE DEPLOYMENT PIPELINE
# Deploys PMTiles archives with HTTP Range request & CORS support ($0 Egress Fees)
# ==============================================================================

set -euo pipefail

PMTILES_PATH="${1:-./public/kerala_satellite.pmtiles}"
BUCKET_NAME="${2:-kerala-satellite-tiles}"
R2_ACCOUNT_ID="${CLOUDFLARE_R2_ACCOUNT_ID:-}"

echo "==============================================================="
echo "   CLOUDFLARE R2 SERVERLESS SATELLITE DEPLOYMENT PIPELINE      "
echo "==============================================================="

if [ ! -f "$PMTILES_PATH" ]; then
    echo "Error: PMTiles archive not found at: $PMTILES_PATH"
    exit 1
fi

ENDPOINT_URL="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# 1. Create CORS configuration for HTTP Range Requests
cat << 'EOF' > ./cors-r2-pmtiles.json
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
EOF

echo -e "\n[STEP 1/3] Generated CORS configuration for HTTP Range Requests (cors-r2-pmtiles.json)..."

if [ -n "$R2_ACCOUNT_ID" ]; then
    echo -e "\n[STEP 2/3] Uploading $PMTILES_PATH to Cloudflare R2 bucket: $BUCKET_NAME..."
    aws s3 cp "$PMTILES_PATH" "s3://${BUCKET_NAME}/kerala_satellite.pmtiles" \
        --endpoint-url "$ENDPOINT_URL" \
        --content-type "application/vnd.pmtiles"

    aws s3api put-bucket-cors \
        --bucket "$BUCKET_NAME" \
        --cors-configuration file://./cors-r2-pmtiles.json \
        --endpoint-url "$ENDPOINT_URL"

    echo "✔ PMTiles archive successfully uploaded to Cloudflare R2!"
else
    echo -e "\n⚠️ CLOUDFLARE_R2_ACCOUNT_ID is not set."
    echo "Run the upload with:"
    echo "  aws s3 cp $PMTILES_PATH s3://${BUCKET_NAME}/kerala_satellite.pmtiles --endpoint-url https://<account_id>.r2.cloudflarestorage.com --content-type application/vnd.pmtiles"
fi

echo -e "\n[STEP 3/3] Connect to Vanguard Emergency Dispatch App:"
echo "Set the public URL in your .env file or localStorage:"
echo "  VITE_PMTILES_URL=\"https://pub-<your-r2-bucket>.r2.dev/kerala_satellite.pmtiles\""
echo "Or in browser console:"
echo "  localStorage.setItem('vanguard_pmtiles_url', 'https://pub-<your-r2-bucket>.r2.dev/kerala_satellite.pmtiles')"
