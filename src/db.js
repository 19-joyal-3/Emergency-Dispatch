import Dexie from 'dexie';

export const db = new Dexie('OfflineEmergencyNavDB');

// Declare database tables and indexes
db.version(2).stores({
  incidents: 'id, type, status, reportedAt',
  blockages: 'id, fromNode, toNode, active',
  responders: 'id, name, type, status',
  syncQueue: '++id, action, timestamp',
  audits: '++id, ip, os, browser, device, timestamp'
});

// Helper functions for local-first operations with sync-queuing
export async function addIncidentLocal(incident, isOnline) {
  await db.incidents.add(incident);
  if (!isOnline) {
    await db.syncQueue.add({
      action: 'ADD_INCIDENT',
      payload: incident,
      timestamp: Date.now()
    });
  }
}

export async function updateIncidentStatusLocal(id, status, resolvedAt = null, isOnline) {
  await db.incidents.update(id, { status, resolvedAt });
  if (!isOnline) {
    await db.syncQueue.add({
      action: 'UPDATE_INCIDENT_STATUS',
      payload: { id, status, resolvedAt },
      timestamp: Date.now()
    });
  }
}

export async function addBlockageLocal(blockage, isOnline) {
  await db.blockages.add(blockage);
  if (!isOnline) {
    await db.syncQueue.add({
      action: 'ADD_BLOCKAGE',
      payload: blockage,
      timestamp: Date.now()
    });
  }
}

export async function removeBlockageLocal(id, isOnline) {
  await db.blockages.delete(id);
  if (!isOnline) {
    await db.syncQueue.add({
      action: 'REMOVE_BLOCKAGE',
      payload: { id },
      timestamp: Date.now()
    });
  }
}

export async function updateResponderLocal(id, updates) {
  // Responders positions update frequently in real-time, 
  // so we update locally and sync selectively or just maintain locally.
  await db.responders.update(id, updates);
}

export async function getSyncQueue() {
  return await db.syncQueue.toArray();
}

export async function clearSyncQueue() {
  await db.syncQueue.clear();
}

export async function logVisitorAudit(audit) {
  try {
    await db.audits.add(audit);
  } catch (err) {
    console.error("DB failed to log audit:", err);
  }
}

export async function getVisitorAudits() {
  try {
    if (!db.audits) return [];
    return await db.audits.reverse().sortBy('timestamp');
  } catch (err) {
    console.error("DB failed to read audits:", err);
    return [];
  }
}
