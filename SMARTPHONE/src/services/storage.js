import { get, set, del } from 'idb-keyval';

const QUEUE_KEY = 'csu_rotc_offline_scans_queue';
const ADMIN_IP_KEY = 'csu_rotc_admin_ip';
const SESSION_NAME_KEY = 'csu_rotc_session_name';
const DUTY_OFFICER_KEY = 'csu_rotc_duty_officer';

/**
 * Returns YYYY-MM-DD date formatted according to Philippine Standard Time (PST UTC+8).
 * Prevents UTC midnight boundary shifts (e.g. 12:00 AM - 7:59 AM evaluating as yesterday).
 */
export function getLocalPhilippineDate(d = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d instanceof Date ? d : new Date(d));
  } catch (_) {
    const dateObj = d instanceof Date ? d : new Date(d);
    if (isNaN(dateObj.getTime())) return '';
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

// Dynamic Storage Key generator based on Philippine date YYYY-MM-DD
export function getDailyScansStorageKey(dateStr = getLocalPhilippineDate()) {
  const cleanDate = dateStr || getLocalPhilippineDate();
  return `rotc_scans_${cleanDate}`;
}

/**
 * Purges legacy scan queues from previous days.
 * Ensures that when the calendar date rolls over, old day queues are cleared
 * and only today's key rotc_scans_${todayDate} remains.
 */
export function purgeLegacyScanQueues(todayDate = getLocalPhilippineDate()) {
  try {
    const todayKey = getDailyScansStorageKey(todayDate);
    const keysToRemove = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      // Purge any rotc_scans_* key that doesn't match today's date
      if (key.startsWith('rotc_scans_') && key !== todayKey) {
        keysToRemove.push(key);
      }
      // Purge legacy non-date-keyed offline queues
      if (key === 'csu_rotc_offline_scans_queue' || key === 'csu_mobile_local_scans' || key === 'csu_rotc_offline_queue') {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(k => {
      try {
        localStorage.removeItem(k);
        del(k).catch(() => {});
      } catch (_) {}
    });
  } catch (err) {
    console.warn("Purge legacy scan queues warning:", err);
  }
}

/**
 * Loads today's split scan queues from localStorage / IDB.
 * Returns { timeInQueue: [], timeOutQueue: [] }.
 */
export async function getDailyQueues(dateStr = getLocalPhilippineDate()) {
  const targetDate = dateStr || getLocalPhilippineDate();
  purgeLegacyScanQueues(targetDate);

  const storageKey = getDailyScansStorageKey(targetDate);
  let parsed = null;

  // 1. Check localStorage first (synchronous & reliable on mobile)
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      parsed = JSON.parse(raw);
    }
  } catch (err) {
    console.warn("localStorage parse error for daily scans:", err);
  }

  // 2. IDB fallback
  if (!parsed) {
    try {
      parsed = await get(storageKey);
    } catch (_) {}
  }

  // 3. Normalize into strict { timeInQueue: [], timeOutQueue: [] } shape
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return {
      timeInQueue: Array.isArray(parsed.timeInQueue) ? parsed.timeInQueue : [],
      timeOutQueue: Array.isArray(parsed.timeOutQueue) ? parsed.timeOutQueue : []
    };
  } else if (Array.isArray(parsed)) {
    // In case an array was stored, split into Time-In and Time-Out
    const timeInQueue = parsed.filter(item => (item.scanMode || 'Time-In') !== 'Time-Out');
    const timeOutQueue = parsed.filter(item => item.scanMode === 'Time-Out');
    return { timeInQueue, timeOutQueue };
  }

  return { timeInQueue: [], timeOutQueue: [] };
}

/**
 * Saves both timeInQueue and timeOutQueue under rotc_scans_${todayDate}.
 */
export async function saveDailyQueues(queues, dateStr = getLocalPhilippineDate()) {
  const targetDate = dateStr || getLocalPhilippineDate();
  const storageKey = getDailyScansStorageKey(targetDate);

  const payload = {
    timeInQueue: Array.isArray(queues?.timeInQueue) ? queues.timeInQueue : [],
    timeOutQueue: Array.isArray(queues?.timeOutQueue) ? queues.timeOutQueue : []
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (err) {
    console.warn("Failed to write daily queues to localStorage:", err);
  }

  try {
    await set(storageKey, payload);
  } catch (_) {}

  return payload;
}

/**
 * Get unsynced scans queue.
 * If mode is specified ('Time-In' or 'Time-Out'), returns only that queue.
 * If mode is omitted, returns combined array.
 */
export async function getOfflineQueue(mode = null, dateStr = getLocalPhilippineDate()) {
  const queues = await getDailyQueues(dateStr);
  if (mode === 'Time-Out') return queues.timeOutQueue;
  if (mode === 'Time-In') return queues.timeInQueue;
  return [...queues.timeInQueue, ...queues.timeOutQueue];
}

/**
 * Save scan to offline queue routed strictly to timeInQueue or timeOutQueue.
 * Stored in localStorage keyed with rotc_scans_${todayDate}.
 * Returns the updated { timeInQueue, timeOutQueue } object.
 */
export async function saveOfflineScan(scanRecord, dateStr = getLocalPhilippineDate()) {
  const targetDate = dateStr || getLocalPhilippineDate();
  const queues = await getDailyQueues(targetDate);

  const scanMode = (scanRecord.scanMode || 'Time-In') === 'Time-Out' ? 'Time-Out' : 'Time-In';
  const targetQueueKey = scanMode === 'Time-Out' ? 'timeOutQueue' : 'timeInQueue';
  const targetQueue = [...queues[targetQueueKey]];

  const normalizedId = String(scanRecord.cadetId || scanRecord.id || '').trim().toUpperCase();
  const scanDate = scanRecord.timestamp ? new Date(scanRecord.timestamp).toDateString() : new Date().toDateString();

  const existingIndex = targetQueue.findIndex(item => {
    const itemDate = item.timestamp ? new Date(item.timestamp).toDateString() : new Date().toDateString();
    const itemId = String(item.cadetId || item.id || '').trim().toUpperCase();
    return itemId === normalizedId && itemDate === scanDate;
  });

  const enriched = {
    ...scanRecord,
    scanMode,
    timestamp: scanRecord.timestamp || new Date().toISOString()
  };

  if (existingIndex !== -1) {
    // OVERWRITE: Update with latest Duty Officer, timestamp, and details
    targetQueue[existingIndex] = {
      ...targetQueue[existingIndex],
      ...enriched,
      dutyOfficer: enriched.dutyOfficer || targetQueue[existingIndex].dutyOfficer,
      sessionName: enriched.sessionName || targetQueue[existingIndex].sessionName
    };
  } else {
    // NEW RECORD: Prepend
    targetQueue.unshift(enriched);
  }

  const updatedQueues = {
    ...queues,
    [targetQueueKey]: targetQueue
  };

  await saveDailyQueues(updatedQueues, targetDate);
  return updatedQueues;
}

/**
 * Remove a single scan from the appropriate daily queue.
 * Returns the updated { timeInQueue, timeOutQueue } object.
 */
export async function removeOfflineScan(scanRecord, dateStr = getLocalPhilippineDate()) {
  const targetDate = dateStr || getLocalPhilippineDate();
  const queues = await getDailyQueues(targetDate);

  const scanMode = (scanRecord?.scanMode || 'Time-In') === 'Time-Out' ? 'Time-Out' : 'Time-In';
  const targetQueueKey = scanMode === 'Time-Out' ? 'timeOutQueue' : 'timeInQueue';
  const targetQueue = [...queues[targetQueueKey]];

  const targetId = String(scanRecord?.cadetId || scanRecord?.id || '').trim().toUpperCase();
  const targetTimestamp = scanRecord?.timestamp;

  let removed = false;
  const filteredQueue = targetQueue.filter(item => {
    if (removed) return true;
    const itemId = String(item.cadetId || item.id || '').trim().toUpperCase();
    if (targetTimestamp && item.timestamp) {
      if (itemId === targetId && item.timestamp === targetTimestamp) {
        removed = true;
        return false;
      }
    } else if (itemId === targetId) {
      removed = true;
      return false;
    }
    return true;
  });

  const updatedQueues = {
    ...queues,
    [targetQueueKey]: filteredQueue
  };

  await saveDailyQueues(updatedQueues, targetDate);
  return updatedQueues;
}

export const deleteOfflineScan = removeOfflineScan;

/**
 * Clear daily queues after sync or reset.
 * If mode is 'Time-In', clears only timeInQueue.
 * If mode is 'Time-Out', clears only timeOutQueue.
 * If mode is null or 'ALL', clears both queues.
 * Returns updated { timeInQueue, timeOutQueue }.
 */
export async function clearDailyQueues(mode = null, dateStr = getLocalPhilippineDate()) {
  const targetDate = dateStr || getLocalPhilippineDate();
  const queues = await getDailyQueues(targetDate);

  let updatedQueues;
  if (mode === 'Time-In') {
    updatedQueues = { ...queues, timeInQueue: [] };
  } else if (mode === 'Time-Out') {
    updatedQueues = { ...queues, timeOutQueue: [] };
  } else {
    updatedQueues = { timeInQueue: [], timeOutQueue: [] };
  }

  await saveDailyQueues(updatedQueues, targetDate);
  return updatedQueues;
}

export const clearOfflineQueue = clearDailyQueues;

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
