# ==============================================================================
# SATELLITE PROCESSING PIPELINE: Raw GeoTIFF -> Cloud-Optimized GeoTIFF -> PMTiles
# For Copernicus Sentinel-2, OpenAerialMap Drone Orthophotos, and ISRO Bhuvan
# ==============================================================================

param (
    [Parameter(Mandatory=$true)]
    [string]$InputTif,

    [Parameter(Mandatory=$false)]
    [string]$OutputDir = "./processed_satellite"
)

$ErrorActionPreference = "Stop"

Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "   KERALA SATELLITE GEOTIFF -> COG -> PMTILES PIPELINE         " -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan

if (-not (Test-Path $InputTif)) {
    Write-Error "Input file not found: $InputTif"
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$BaseName = [System.IO.Path]::GetFileNameWithoutExtension($InputTif)
$WarpedTif = Join-Path $OutputDir "${BaseName}_3857.tif"
$CogTif = Join-Path $OutputDir "${BaseName}_cog.tif"
$PmtilesFile = Join-Path $OutputDir "${BaseName}.pmtiles"

Write-Host "`n[STEP 1/4] Reprojecting to Web Mercator (EPSG:3857)..." -ForegroundColor Yellow
gdalwarp -t_srs EPSG:3857 -r bilinear -multi -wo NUM_THREADS=ALL_CPUS $InputTif $WarpedTif

Write-Host "[STEP 2/4] Building Pyramid Overviews (Z levels)..." -ForegroundColor Yellow
gdaladdo -r average $WarpedTif 2 4 8 16 32 64

Write-Host "[STEP 3/4] Converting to Cloud-Optimized GeoTIFF (COG)..." -ForegroundColor Yellow
gdal_translate $WarpedTif $CogTif `
    -co COMPRESS=JPEG `
    -co PHOTOMETRIC=YCBCR `
    -co TILED=YES `
    -co COPY_SRC_OVERVIEWS=YES `
    -co BLOCKSIZE=512

Write-Host "[STEP 4/4] Packing into single-file PMTiles archive..." -ForegroundColor Yellow
pmtiles convert $CogTif $PmtilesFile

Write-Host "`n✔ Pipeline Complete! Generated:" -ForegroundColor Green
Write-Host "  -> Cloud-Optimized GeoTIFF: $CogTif" -ForegroundColor Green
Write-Host "  -> PMTiles Archive:         $PmtilesFile" -ForegroundColor Green
Write-Host "Ready for deployment to Cloudflare R2 or offline mobile bundle.`n"
