#!/usr/bin/env bash
# ==============================================================================
# SATELLITE PROCESSING PIPELINE: Raw GeoTIFF -> Cloud-Optimized GeoTIFF -> PMTiles
# For Copernicus Sentinel-2, OpenAerialMap Drone Orthophotos, and ISRO Bhuvan
# ==============================================================================

set -euo pipefail

INPUT_TIF="${1:-}"
OUTPUT_DIR="${2:-./processed_satellite}"

if [ -z "$INPUT_TIF" ]; then
    echo "Usage: $0 <input_geotiff.tif> [output_dir]"
    exit 1
fi

if [ ! -f "$INPUT_TIF" ]; then
    echo "Error: Input GeoTIFF not found: $INPUT_TIF"
    exit 1
fi

mkdir -p "$OUTPUT_DIR"
BASENAME=$(basename "$INPUT_TIF" .tif)
WARPED_TIF="$OUTPUT_DIR/${BASENAME}_3857.tif"
COG_TIF="$OUTPUT_DIR/${BASENAME}_cog.tif"
PMTILES_FILE="$OUTPUT_DIR/${BASENAME}.pmtiles"

echo "==============================================================="
echo "   KERALA SATELLITE GEOTIFF -> COG -> PMTILES PIPELINE         "
echo "==============================================================="

echo -e "\n[STEP 1/4] Reprojecting to Web Mercator (EPSG:3857)..."
gdalwarp -t_srs EPSG:3857 -r bilinear -multi -wo NUM_THREADS=ALL_CPUS "$INPUT_TIF" "$WARPED_TIF"

echo "[STEP 2/4] Building Pyramid Overviews (Z levels)..."
gdaladdo -r average "$WARPED_TIF" 2 4 8 16 32 64

echo "[STEP 3/4] Converting to Cloud-Optimized GeoTIFF (COG)..."
gdal_translate "$WARPED_TIF" "$COG_TIF" \
    -co COMPRESS=JPEG \
    -co PHOTOMETRIC=YCBCR \
    -co TILED=YES \
    -co COPY_SRC_OVERVIEWS=YES \
    -co BLOCKSIZE=512

echo "[STEP 4/4] Packing into single-file PMTiles archive..."
pmtiles convert "$COG_TIF" "$PMTILES_FILE"

echo -e "\n✔ Pipeline Complete! Generated:"
echo "  -> Cloud-Optimized GeoTIFF: $COG_TIF"
echo "  -> PMTiles Archive:         $PMTILES_FILE"
echo "Ready for deployment to Cloudflare R2 or offline mobile bundle."
