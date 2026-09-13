const STORAGE_KEY = 'emergency_sos_contacts';

export function getSosContacts() {
  try {
    const contacts = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(contacts) ? contacts : [];
  } catch {
    return [];
  }
}

export function saveSosContacts(contacts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
}

export function formatSosMessage(incident) {
  const hasCoords = typeof incident?.lat === 'number' && typeof incident?.lng === 'number';
  const mapUrl = hasCoords ? `https://maps.google.com/?q=${incident.lat},${incident.lng}` : 'Coordinates pending';
  const reportedDate = incident?.reportedAt ? new Date(incident.reportedAt) : new Date();
  const reportedTime = isNaN(reportedDate.getTime()) ? new Date().toLocaleString() : reportedDate.toLocaleString();
  return [
    'EMERGENCY ALERT',
    `Type: ${incident?.type?.toUpperCase() || 'GENERAL EMERGENCY'}`,
    `Priority: ${incident?.priority?.toUpperCase() || 'MEDIUM'}`,
    `Details: ${incident?.description || 'Immediate emergency assistance requested'}`,
    `Location: ${hasCoords ? `${incident.lat.toFixed(4)}, ${incident.lng.toFixed(4)}` : (incident?.lat ?? 'N/A') + ', ' + (incident?.lng ?? 'N/A')}`,
    `Map: ${mapUrl}`,
    `Time: ${reportedTime}`
  ].join('\n');
}

export function openSosSms(contact, message) {
  const phone = encodeURIComponent(contact.phone);
  const body = encodeURIComponent(message);
  window.location.href = `sms:${phone}?body=${body}`;
}

export function openSosCall(contact) {
  window.location.href = `tel:${encodeURIComponent(contact.phone)}`;
}

export function openWhatsAppShare(message) {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function formatWhatsAppIncident(incident, responderName = null, shelterName = null) {
  const hasCoords = typeof incident?.lat === 'number' && typeof incident?.lng === 'number';
  const mapUrl = hasCoords ? `https://maps.google.com/?q=${incident.lat},${incident.lng}` : 'https://maps.google.com';
  const reportedDate = incident?.reportedAt ? new Date(incident.reportedAt) : new Date();
  const timeStr = isNaN(reportedDate.getTime()) ? new Date().toLocaleTimeString() : reportedDate.toLocaleTimeString();

  const lines = [
    '🚨 *KERALA TACTICAL DISPATCH ALERT*',
    `*Type:* ${incident?.type?.toUpperCase() || 'EMERGENCY'}`,
    `*Priority:* ${incident?.priority?.toUpperCase() || 'MEDIUM'}`,
    `*Details:* ${incident?.description || 'Immediate emergency response requested'}`,
    `*Location:* ${hasCoords ? `${incident.lat.toFixed(4)}, ${incident.lng.toFixed(4)}` : 'Field Location Pending'}`,
    `*Live Pin:* ${mapUrl}`,
    responderName ? `*Assigned Unit:* ${responderName}` : null,
    shelterName ? `*Nearest Camp:* ${shelterName}` : null,
    `*Reported:* ${timeStr}`,
    '— _Dispatched via Kerala Tactical Emergency Hub_'
  ].filter(Boolean);
  return lines.join('\n');
}

export function formatWhatsAppRoute(route, startName, endName, transport = 'car') {
  const lines = [
    '🧭 *KERALA EMERGENCY ROUTE DISPATCH*',
    `*Origin:* ${startName}`,
    `*Destination:* ${endName}`,
    `*Distance:* ${route.distance} km`,
    `*Est. Time:* ${route.travelTimeMinutes} mins (via ${transport.toUpperCase()})`,
    route.nodes?.length ? `*Key Waypoints:* ${route.nodes.join(' ➔ ')}` : null,
    '— _Dispatched via Kerala Tactical Emergency Hub_'
  ].filter(Boolean);
  return lines.join('\n');
}
