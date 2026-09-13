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
  const mapUrl = (incident.lat && incident.lng) ? `https://maps.google.com/?q=${incident.lat},${incident.lng}` : 'Coordinates pending';
  const reportedTime = incident.reportedAt ? new Date(incident.reportedAt).toLocaleString() : new Date().toLocaleString();
  return [
    'EMERGENCY ALERT',
    `Type: ${incident.type?.toUpperCase() || 'GENERAL EMERGENCY'}`,
    `Priority: ${incident.priority?.toUpperCase() || 'MEDIUM'}`,
    `Details: ${incident.description || 'Immediate emergency assistance requested'}`,
    `Location: ${incident.lat ?? 'N/A'}, ${incident.lng ?? 'N/A'}`,
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
  const mapUrl = `https://maps.google.com/?q=${incident.lat},${incident.lng}`;
  const lines = [
    '🚨 *KERALA TACTICAL DISPATCH ALERT*',
    `*Type:* ${incident.type?.toUpperCase() || 'EMERGENCY'}`,
    `*Priority:* ${incident.priority?.toUpperCase() || 'MEDIUM'}`,
    `*Details:* ${incident.description || 'Immediate emergency response requested'}`,
    `*Location:* ${incident.lat.toFixed(4)}, ${incident.lng.toFixed(4)}`,
    `*Live Pin:* ${mapUrl}`,
    responderName ? `*Assigned Unit:* ${responderName}` : null,
    shelterName ? `*Nearest Camp:* ${shelterName}` : null,
    `*Reported:* ${new Date(incident.reportedAt || Date.now()).toLocaleTimeString()}`,
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
