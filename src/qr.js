import QRCode from 'qrcode';

/**
 * Generates an offline data-URL QR code representing a navigation route.
 */
export async function generateRouteQr(startNode, endNode, transport = 'car') {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const payload = `${origin}/#route=${encodeURIComponent(startNode)},${encodeURIComponent(endNode)},${encodeURIComponent(transport)}`;
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
    const parts = content.replace('route=', '').split(',');
    if (parts.length >= 2) {
      return {
        type: 'route',
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
