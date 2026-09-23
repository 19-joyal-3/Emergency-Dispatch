import QRCode from 'qrcode';

/**
 * Generates an offline data-URL QR code representing a navigation route.
 * Supports both exact geographic coordinates (for all 1,207 hamlets) and legacy node IDs.
 */
export async function generateRouteQr(start, end, transport = 'car') {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    let payload = '';

    const hasStartCoords = start && typeof start === 'object' && typeof start.lat === 'number' && typeof start.lng === 'number';
    const hasEndCoords = end && typeof end === 'object' && typeof end.lat === 'number' && typeof end.lng === 'number';

    if (hasStartCoords && hasEndCoords) {
      const sLat = Number(start.lat.toFixed(5));
      const sLng = Number(start.lng.toFixed(5));
      const sName = encodeURIComponent(start.name || 'Origin');
      const eLat = Number(end.lat.toFixed(5));
      const eLng = Number(end.lng.toFixed(5));
      const eName = encodeURIComponent(end.name || 'Destination');
      payload = `${origin}/#route=geo:${sLat},${sLng},${sName}|${eLat},${eLng},${eName}|${encodeURIComponent(transport)}`;
    } else {
      const sNode = typeof start === 'string' ? start : (start?.id || start?.name || 'start');
      const eNode = typeof end === 'string' ? end : (end?.id || end?.name || 'end');
      payload = `${origin}/#route=${encodeURIComponent(sNode)},${encodeURIComponent(eNode)},${encodeURIComponent(transport)}`;
    }

    return await QRCode.toDataURL(payload, {
      width: 240,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#f8fafc'
      }
    });
  } catch (err) {
    console.error('Failed to generate route QR:', err);
    return null;
  }
}

/**
 * Generates an offline data-URL QR code representing an emergency incident.
 */
export async function generateIncidentQr(incident) {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const desc = (incident.description || '').slice(0, 80);
    const payload = `${origin}/#incident=${incident.lat},${incident.lng},${encodeURIComponent(incident.type || 'emergency')},${encodeURIComponent(desc)}`;
    return await QRCode.toDataURL(payload, {
      width: 240,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#f8fafc'
      }
    });
  } catch (err) {
    console.error('Failed to generate incident QR:', err);
    return null;
  }
}

/**
 * Parses URL hash on app load to auto-import shared QR routes/incidents.
 */
export function parseQrHash(hash) {
  if (!hash || !hash.startsWith('#')) return null;
  const content = hash.slice(1);

  if (content.startsWith('route=')) {
    // Check if new coordinate-based format with pipe delimiters
    if (content.includes('|')) {
      const raw = content.replace(/^route=(?:geo:)?/, '');
      const parts = raw.split('|');
      if (parts.length >= 2) {
        const startParts = parts[0].split(',');
        const endParts = parts[1].split(',');
        const transport = parts[2] ? decodeURIComponent(parts[2]) : 'car';

        const startLat = parseFloat(startParts[0]);
        const startLng = parseFloat(startParts[1]);
        const startName = startParts[2] ? decodeURIComponent(startParts[2]) : 'Origin';

        const endLat = parseFloat(endParts[0]);
        const endLng = parseFloat(endParts[1]);
        const endName = endParts[2] ? decodeURIComponent(endParts[2]) : 'Destination';

        if (!isNaN(startLat) && !isNaN(startLng) && !isNaN(endLat) && !isNaN(endLng)) {
          return {
            type: 'route',
            isCoordinates: true,
            start: { lat: startLat, lng: startLng, name: startName },
            end: { lat: endLat, lng: endLng, name: endName },
            transport
          };
        }
      }
    }

    // Legacy node-based format
    const parts = content.replace('route=', '').split(',');
    if (parts.length >= 2) {
      return {
        type: 'route',
        isCoordinates: false,
        startNode: decodeURIComponent(parts[0]),
        endNode: decodeURIComponent(parts[1]),
        transport: parts[2] ? decodeURIComponent(parts[2]) : 'car'
      };
    }
  }

  if (content.startsWith('incident=')) {
    const parts = content.replace('incident=', '').split(',');
    if (parts.length >= 3) {
      return {
        type: 'incident',
        lat: parseFloat(parts[0]),
        lng: parseFloat(parts[1]),
        incidentType: decodeURIComponent(parts[2]),
        desc: parts[3] ? decodeURIComponent(parts[3]) : ''
      };
    }
  }

  return null;
}
