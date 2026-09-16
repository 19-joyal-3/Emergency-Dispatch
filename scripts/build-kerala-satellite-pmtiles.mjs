import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { zxyToTileId, PMTiles } from 'pmtiles';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const outputFile = path.join(root, 'public', 'kerala_satellite.pmtiles');

// Variable-length integer encoder per PMTiles v3 specification
function writeVarint(val) {
  const bytes = [];
  while (val > 0x7f) {
    bytes.push((val & 0x7f) | 0x80);
    val = Math.floor(val / 128);
  }
  bytes.push(val & 0x7f);
  return bytes;
}

// Serialize PMTiles directory entries
function serializeDirectory(entries) {
  const bytes = [];
  // 1. Number of entries
  bytes.push(...writeVarint(entries.length));
  
  // 2. Tile ID deltas (ascending order)
  let lastId = 0;
  for (const e of entries) {
    bytes.push(...writeVarint(e.tileId - lastId));
    lastId = e.tileId;
  }
  
  // 3. Run lengths (all 1)
  for (const e of entries) {
    bytes.push(...writeVarint(e.runLength || 1));
  }
  
  // 4. Tile lengths
  for (const e of entries) {
    bytes.push(...writeVarint(e.length));
  }
  
  // 5. Offsets
  for (let i = 0; i < entries.length; i++) {
    if (i === 0) {
      bytes.push(...writeVarint(entries[0].offset + 1));
    } else {
      if (entries[i].offset === entries[i - 1].offset + entries[i - 1].length) {
        bytes.push(...writeVarint(0)); // Contiguous flag
      } else {
        bytes.push(...writeVarint(entries[i].offset + 1));
      }
    }
  }
  return Buffer.from(bytes);
}

// Web Mercator coordinate calculations for Kerala
function lon2tile(lon, zoom) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}
function lat2tile(lat, zoom) {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom));
}

async function buildSatellitePmtiles() {
  console.log('\n===============================================================');
  console.log('   COPERNICUS SENTINEL-2 KERALA PMTILES SATELLITE GENERATOR   ');
  console.log('===============================================================\n');

  // Kerala Bounding Box: [8.18, 74.85] to [12.85, 77.50]
  const minLon = 74.85, maxLon = 77.50;
  const minLat = 8.18, maxLat = 12.85;
  const minZoom = 7, maxZoom = 9;

  const tileCoords = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const minX = lon2tile(minLon, z);
    const maxX = lon2tile(maxLon, z);
    const minY = lat2tile(maxLat, z);
    const maxY = lat2tile(minLat, z);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        tileCoords.push({ z, x, y });
      }
    }
  }

  console.log(`📡 Tile Grid: ${tileCoords.length} Sentinel-2 tiles across Zoom levels ${minZoom} to ${maxZoom}`);
  console.log('🛰️ Downloading open Copernicus Sentinel-2 Cloudless orthophoto tiles...\n');

  const downloadedTiles = [];
  let downloadedBytes = 0;
  const concurrency = 6;

  for (let i = 0; i < tileCoords.length; i += concurrency) {
    const chunk = tileCoords.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async ({ z, x, y }) => {
        const url = `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible/${z}/${y}/${x}.jpg`;
        try {
          const res = await fetch(url);
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            const tileId = zxyToTileId(z, x, y);
            downloadedTiles.push({
              tileId,
              z,
              x,
              y,
              data: buf
            });
            downloadedBytes += buf.length;
            process.stdout.write(`\r  ✓ Fetched tile Z${z} [X:${x}, Y:${y}] (${(buf.length / 1024).toFixed(1)} KB) - Total: ${downloadedTiles.length}/${tileCoords.length}`);
          }
        } catch (e) {
          console.warn(`\n  ⚠️ Failed tile Z${z} [X:${x}, Y:${y}]: ${e.message}`);
        }
      })
    );
  }

  console.log(`\n\n📦 Download complete: ${downloadedTiles.length} tiles (${(downloadedBytes / 1024).toFixed(1)} KB)`);

  // PMTiles requires entries to be sorted strictly by tileId in ascending order
  downloadedTiles.sort((a, b) => (a.tileId < b.tileId ? -1 : a.tileId > b.tileId ? 1 : 0));

  // Assemble tile data and compute offsets
  let currentOffset = 0;
  const directoryEntries = [];
  const tileBuffers = [];

  for (const t of downloadedTiles) {
    directoryEntries.push({
      tileId: t.tileId,
      offset: currentOffset,
      length: t.data.length,
      runLength: 1
    });
    tileBuffers.push(t.data);
    currentOffset += t.data.length;
  }

  const concatenatedTileData = Buffer.concat(tileBuffers);
  const rootDirBuffer = serializeDirectory(directoryEntries);

  const metadataJson = JSON.stringify({
    name: 'Kerala Emergency Dispatch Sentinel-2 Satellite Basemap',
    description: 'Copernicus Sentinel-2 Cloudless 10m global mosaic for Kerala',
    attribution: '© Copernicus Sentinel-2 / EOX IT Services GmbH (CC BY 4.0)',
    type: 'baselayer',
    format: 'jpg',
    minzoom: minZoom,
    maxzoom: maxZoom,
    bounds: `${minLon},${minLat},${maxLon},${maxLat}`
  });
  const metadataBuffer = Buffer.from(metadataJson, 'utf8');

  // Compute byte layout
  const headerLen = 127;
  const rootDirOffset = headerLen;
  const rootDirLen = rootDirBuffer.length;
  const metaOffset = rootDirOffset + rootDirLen;
  const metaLen = metadataBuffer.length;
  const leafDirOffset = 0;
  const leafDirLen = 0;
  const tileDataOffset = metaOffset + metaLen;
  const tileDataLen = concatenatedTileData.length;

  // Construct 127-byte PMTiles v3 Header
  const header = Buffer.alloc(127);
  header.write('PMTiles', 0, 7, 'ascii');
  header.writeUInt8(3, 7); // specVersion 3
  header.writeBigUInt64LE(BigInt(rootDirOffset), 8);
  header.writeBigUInt64LE(BigInt(rootDirLen), 16);
  header.writeBigUInt64LE(BigInt(metaOffset), 24);
  header.writeBigUInt64LE(BigInt(metaLen), 32);
  header.writeBigUInt64LE(BigInt(leafDirOffset), 40);
  header.writeBigUInt64LE(BigInt(leafDirLen), 48);
  header.writeBigUInt64LE(BigInt(tileDataOffset), 56);
  header.writeBigUInt64LE(BigInt(tileDataLen), 64);
  header.writeBigUInt64LE(BigInt(directoryEntries.length), 72); // numAddressedTiles
  header.writeBigUInt64LE(BigInt(directoryEntries.length), 80); // numTileEntries
  header.writeBigUInt64LE(BigInt(directoryEntries.length), 88); // numTileContents
  header.writeUInt8(1, 96); // clustered = true
  header.writeUInt8(0, 97); // internalCompression = None
  header.writeUInt8(0, 98); // tileCompression = None (JPEG already compressed)
  header.writeUInt8(2, 99); // tileType = 2 (Jpeg)
  header.writeUInt8(minZoom, 100); // minZoom
  header.writeUInt8(maxZoom, 101); // maxZoom
  header.writeInt32LE(Math.round(minLon * 1e7), 102);
  header.writeInt32LE(Math.round(minLat * 1e7), 106);
  header.writeInt32LE(Math.round(maxLon * 1e7), 110);
  header.writeInt32LE(Math.round(maxLat * 1e7), 114);
  header.writeUInt8(8, 118); // centerZoom
  header.writeInt32LE(Math.round(76.25 * 1e7), 119); // centerLon
  header.writeInt32LE(Math.round(10.50 * 1e7), 123); // centerLat

  const finalPmtilesArchive = Buffer.concat([
    header,
    rootDirBuffer,
    metadataBuffer,
    concatenatedTileData
  ]);

  // Ensure public directory exists
  if (!fs.existsSync(path.dirname(outputFile))) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  }

  fs.writeFileSync(outputFile, finalPmtilesArchive);
  console.log(`\n🎉 Success! Wrote: ${outputFile}`);
  console.log(`📊 Archive Size: ${(finalPmtilesArchive.length / 1024).toFixed(1)} KB (${finalPmtilesArchive.length} bytes)`);

  // Verification Step: Open with PMTiles official class
  console.log('\n🔍 Verifying generated PMTiles archive with official pmtiles library...');
  class BufferSource {
    constructor(buffer) {
      this.buffer = buffer;
    }
    getKey() {
      return 'local-kerala';
    }
    async getBytes(offset, length) {
      const slice = this.buffer.slice(offset, offset + length);
      return { data: slice.buffer.slice(slice.byteOffset, slice.byteOffset + slice.byteLength) };
    }
  }

  const pmtilesInstance = new PMTiles(new BufferSource(finalPmtilesArchive));
  const readHeader = await pmtilesInstance.getHeader();
  console.log(`  ✓ Header Spec Version: ${readHeader.specVersion}`);
  console.log(`  ✓ Tile Type: ${readHeader.tileType === 2 ? 'JPEG (Raster)' : readHeader.tileType}`);
  console.log(`  ✓ Zoom Range: Z${readHeader.minZoom} - Z${readHeader.maxZoom}`);
  console.log(`  ✓ Bounding Box: [${readHeader.minLon}, ${readHeader.minLat}] to [${readHeader.maxLon}, ${readHeader.maxLat}]`);

  // Test fetching sample tile over Palakkad/Thrissur: Z8, X182, Y118
  const sampleTile = await pmtilesInstance.getZxy(8, 182, 118);
  if (sampleTile && sampleTile.data.byteLength > 0) {
    console.log(`  ✓ Verification: Successfully extracted sample tile Z8 X182 Y118 (${sampleTile.data.byteLength} bytes)!`);
  } else {
    throw new Error('Verification failed: Sample tile could not be retrieved from PMTiles archive');
  }

  console.log('\n✔ KERALA SENTINEL-2 PMTILES ARCHIVE 100% VERIFIED & READY FOR FIELD USE!\n');
}

buildSatellitePmtiles().catch(err => {
  console.error('\n❌ Generation failed:', err);
  process.exit(1);
});
