import { get, set, del } from 'idb-keyval';

const QUEUE_KEY = 'csu_rotc_offline_scans_queue';
const ADMIN_IP_KEY = 'csu_rotc_admin_ip';
const SESSION_NAME_KEY = 'csu_rotc_session_name';
const DUTY_OFFICER_KEY = 'csu_rotc_duty_officer';

// Get unsynced scans queue
export async function getOfflineQueue() {
  try {
    const queue = await get(QUEUE_KEY);
    return queue || [];
  } catch (err) {
    const fallback = localStorage.getItem(QUEUE_KEY);
    return fallback ? JSON.parse(fallback) : [];
  }
}

// Save scan to offline queue (updates existing entry on re-scan, or prepends new)
export async function saveOfflineScan(scanRecord) {
  const currentQueue = await getOfflineQueue();
  const normalizedId = String(scanRecord.cadetId || '').trim().toUpperCase();
  const scanMode = scanRecord.scanMode || 'Time-In';
  const scanDate = scanRecord.timestamp ? new Date(scanRecord.timestamp).toDateString() : new Date().toDateString();

  let updatedQueue = [...currentQueue];
  const existingIndex = updatedQueue.findIndex(item => {
    const itemDate = item.timestamp ? new Date(item.timestamp).toDateString() : new Date().toDateString();
    return String(item.cadetId || '').trim().toUpperCase() === normalizedId &&
      (item.scanMode || 'Time-In') === scanMode &&
      itemDate === scanDate;
  });

  if (existingIndex !== -1) {
    // OVERWRITE: Update with latest Duty Officer, timestamp, and details
    updatedQueue[existingIndex] = {
      ...updatedQueue[existingIndex],
      ...scanRecord,
      dutyOfficer: scanRecord.dutyOfficer || updatedQueue[existingIndex].dutyOfficer,
      timestamp: scanRecord.timestamp,
      sessionName: scanRecord.sessionName || updatedQueue[existingIndex].sessionName
    };
  } else {
    // NEW RECORD: Prepend
    updatedQueue.unshift(scanRecord);
  }

  try {
    await set(QUEUE_KEY, updatedQueue);
  } catch (err) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(updatedQueue));
  }
  return updatedQueue;
}

// Clear offline queue after successful sync
export async function clearOfflineQueue() {
  try {
    await del(QUEUE_KEY);
  } catch (err) {
    console.warn("IDB clear failed:", err);
  }
  try {
    localStorage.removeItem(QUEUE_KEY);
    localStorage.removeItem('csu_mobile_local_scans');
    localStorage.removeItem('csu_rotc_offline_queue');
  } catch (_) {}
}

// Admin Laptop IP Settings
export function getAdminIp() {
  return localStorage.getItem(ADMIN_IP_KEY) || 'http://192.168.1.39:8080';
}

export function setAdminIp(ip) {
  let formattedIp = ip.trim();
  if (!formattedIp.startsWith('http://') && !formattedIp.startsWith('https://')) {
    formattedIp = `http://${formattedIp}`;
  }
  localStorage.setItem(ADMIN_IP_KEY, formattedIp);
  return formattedIp;
}

// Session Settings
export function getSessionName() {
  return localStorage.getItem(SESSION_NAME_KEY) || 'Saturday Field Training';
}

export function setSessionName(name) {
  localStorage.setItem(SESSION_NAME_KEY, name);
}

export function getDutyOfficer() {
  return localStorage.getItem(DUTY_OFFICER_KEY) || 'C/CPT Duty Officer';
}

export function setDutyOfficer(name) {
  localStorage.setItem(DUTY_OFFICER_KEY, name);
}
