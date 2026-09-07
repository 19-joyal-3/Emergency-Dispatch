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
  const mapUrl = `https://maps.google.com/?q=${incident.lat},${incident.lng}`;
  return [
    'EMERGENCY ALERT',
    `Type: ${incident.type}`,
    `Priority: ${incident.priority || 'medium'}`,
    `Details: ${incident.description}`,
    `Location: ${incident.lat}, ${incident.lng}`,
    `Map: ${mapUrl}`,
    `Time: ${new Date(incident.reportedAt).toLocaleString()}`
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
