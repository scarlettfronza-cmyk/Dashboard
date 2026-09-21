/**
 * Z-API WhatsApp integration helper
 * Sends messages to WhatsApp groups via Z-API
 */

const ZAPI_BASE = "https://api.z-api.io";
const INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const TOKEN = process.env.ZAPI_TOKEN;
const CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "Client-Token": CLIENT_TOKEN || "",
  };
}

/**
 * Send a text message to a WhatsApp group
 * @param groupId - The WhatsApp group ID (e.g. "120363XXXXXXXXXX@g.us")
 * @param message - The text message to send
 */
export async function sendGroupMessage(groupId: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!INSTANCE_ID || !TOKEN || !CLIENT_TOKEN) {
    return { success: false, error: "Z-API credentials not configured" };
  }

  try {
    const url = `${ZAPI_BASE}/instances/${INSTANCE_ID}/token/${TOKEN}/send-text`;
    const resp = await fetch(url, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        phone: groupId,
        message,
      }),
    });

    const data = await resp.json() as { zaapId?: string; messageId?: string; error?: string };

    if (!resp.ok || data.error) {
      return { success: false, error: data.error || `HTTP ${resp.status}` };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Get all WhatsApp groups the instance has access to (fetches all pages)
 */
export async function listGroups(): Promise<{ id: string; name: string }[]> {
  if (!INSTANCE_ID || !TOKEN || !CLIENT_TOKEN) return [];

  const allGroups: { id: string; name: string }[] = [];
  let page = 1;
  const pageSize = 100;

  try {
    while (true) {
      const url = `${ZAPI_BASE}/instances/${INSTANCE_ID}/token/${TOKEN}/chats?onlyGroups=true&page=${page}&pageSize=${pageSize}`;
      const resp = await fetch(url, { headers: getHeaders() });
      if (!resp.ok) break;
      const data = await resp.json() as Array<{ phone?: string; name?: string }>;
      if (!Array.isArray(data) || data.length === 0) break;
      const groups = data.map((g) => ({ id: g.phone || "", name: g.name || "" })).filter((g) => g.id);
      allGroups.push(...groups);
      // If we got less than pageSize, we've reached the last page
      if (data.length < pageSize) break;
      page++;
      // Safety limit: max 20 pages (2000 groups)
      if (page > 20) break;
    }
    return allGroups;
  } catch {
    return allGroups;
  }
}

/**
 * Check Z-API connection status
 */
export async function checkStatus(): Promise<{ connected: boolean; error?: string }> {
  if (!INSTANCE_ID || !TOKEN || !CLIENT_TOKEN) {
    return { connected: false, error: "Credentials not configured" };
  }

  try {
    const url = `${ZAPI_BASE}/instances/${INSTANCE_ID}/token/${TOKEN}/status`;
    const resp = await fetch(url, { headers: getHeaders() });
    const data = await resp.json() as { connected?: boolean; error?: string };
    return { connected: data.connected === true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { connected: false, error: message };
  }
}
