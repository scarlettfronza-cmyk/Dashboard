/**
 * Z-API WhatsApp integration helper
 * Sends messages to WhatsApp groups via Z-API
 *
 * As credenciais são lidas a cada chamada (não na carga do módulo) para o
 * status refletir o ambiente atual e para o servidor subir mesmo sem Z-API.
 */
import { zapVarsFaltando } from "@shared/whatsappRelatorio";

const ZAPI_BASE = "https://api.z-api.io";

function credenciais() {
  return {
    instanceId: process.env.ZAPI_INSTANCE_ID?.trim(),
    token: process.env.ZAPI_TOKEN?.trim(),
    clientToken: process.env.ZAPI_CLIENT_TOKEN?.trim(),
    faltando: zapVarsFaltando(process.env),
  };
}

function getHeaders(clientToken: string) {
  return {
    "Content-Type": "application/json",
    "Client-Token": clientToken,
  };
}

/**
 * Send a text message to a WhatsApp group
 * @param groupId - The WhatsApp group ID (e.g. "120363XXXXXXXXXX@g.us")
 * @param message - The text message to send
 */
export async function sendGroupMessage(groupId: string, message: string): Promise<{ success: boolean; error?: string }> {
  const c = credenciais();
  if (c.faltando.length) {
    return { success: false, error: `Z-API não configurado no servidor (faltam: ${c.faltando.join(", ")})` };
  }

  try {
    const url = `${ZAPI_BASE}/instances/${c.instanceId}/token/${c.token}/send-text`;
    const resp = await fetch(url, {
      method: "POST",
      headers: getHeaders(c.clientToken!),
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
 * Envia um PDF ao grupo. O Z-API aceita o documento em Base64 (data URI);
 * `caption` é o texto que acompanha o arquivo na mesma mensagem.
 */
export async function sendGroupDocument(groupId: string, pdf: Buffer, fileName: string, caption: string): Promise<{ success: boolean; error?: string }> {
  const c = credenciais();
  if (c.faltando.length) {
    return { success: false, error: `Z-API não configurado no servidor (faltam: ${c.faltando.join(", ")})` };
  }
  try {
    const url = `${ZAPI_BASE}/instances/${c.instanceId}/token/${c.token}/send-document/pdf`;
    const resp = await fetch(url, {
      method: "POST",
      headers: getHeaders(c.clientToken!),
      body: JSON.stringify({
        phone: groupId,
        document: `data:application/pdf;base64,${pdf.toString("base64")}`,
        fileName,
        caption,
      }),
    });
    const data = await resp.json() as { zaapId?: string; messageId?: string; error?: string };
    if (!resp.ok || data.error) return { success: false, error: data.error || `HTTP ${resp.status}` };
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Get all WhatsApp groups the instance has access to (fetches all pages)
 */
export async function listGroups(): Promise<{ id: string; name: string }[]> {
  const c = credenciais();
  if (c.faltando.length) return [];

  const allGroups: { id: string; name: string }[] = [];
  let page = 1;
  const pageSize = 100;

  try {
    while (true) {
      const url = `${ZAPI_BASE}/instances/${c.instanceId}/token/${c.token}/chats?onlyGroups=true&page=${page}&pageSize=${pageSize}`;
      const resp = await fetch(url, { headers: getHeaders(c.clientToken!) });
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
 * Check Z-API connection status.
 * `configurado` diz se as variáveis existem; `connected` se o celular está
 * pareado na instância. São problemas diferentes, com soluções diferentes.
 */
export type StatusZap = { configurado: boolean; faltando: string[]; connected: boolean; error?: string };

export async function checkStatus(): Promise<StatusZap> {
  const c = credenciais();
  if (c.faltando.length) {
    return { configurado: false, faltando: c.faltando, connected: false };
  }

  try {
    const url = `${ZAPI_BASE}/instances/${c.instanceId}/token/${c.token}/status`;
    const resp = await fetch(url, { headers: getHeaders(c.clientToken!) });
    const data = await resp.json() as { connected?: boolean; error?: string };
    return { configurado: true, faltando: [], connected: data.connected === true, error: data.error };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { configurado: true, faltando: [], connected: false, error: message };
  }
}
