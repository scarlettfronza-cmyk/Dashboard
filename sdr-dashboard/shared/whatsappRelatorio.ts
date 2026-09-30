/**
 * Mensagem de WhatsApp que leva o relatório à clínica.
 *
 * Mesma ideia do dashboard de tráfego: a tela mostra a prévia com a mesma
 * função que o servidor usa para enviar, e o link do portal vai no fim.
 */

export const VARIAVEIS_ZAPI = ["ZAPI_INSTANCE_ID", "ZAPI_TOKEN", "ZAPI_CLIENT_TOKEN"] as const;

/** Quais variáveis do Z-API ainda faltam no ambiente. Vazio = configurado. */
export function zapVarsFaltando(env: Record<string, string | undefined>): string[] {
  return VARIAVEIS_ZAPI.filter(v => !env[v]?.trim());
}

/** Link do portal da clínica, com o domínio público configurado no servidor. */
export function linkPortal(origem: string, clientToken: string): string {
  return `${origem.replace(/\/+$/, "")}/portal/${encodeURIComponent(clientToken)}`;
}

/** Texto do relatório + link do portal. */
export function montarMensagemWhatsApp(texto: string, link: string | null): string {
  const corpo = texto.trim();
  return link ? `${corpo}\n\n📊 Relatório completo: ${link}` : corpo;
}

/**
 * Link que abre o WhatsApp (celular ou WhatsApp Web) com a mensagem pronta,
 * para a SDR escolher a conversa. Funciona sem Z-API.
 */
export function linkAbrirWhatsApp(mensagem: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
}
