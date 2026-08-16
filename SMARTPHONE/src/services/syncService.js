export async function syncToAdminHQ(adminIp, dutyOfficer, sessionName, records) {
  if (!records || records.length === 0) {
    return { success: true, count: 0, message: "No records to sync." };
  }

  const endpoint = `${adminIp.replace(/\/$/, '')}/api/sync`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dutyOfficer: dutyOfficer,
        sessionName: sessionName,
        records: records
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Sync server responded with status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error("Sync to Admin HQ failed:", err);
    throw err;
  }
}
