/**
 * Para onde vão os avisos de conta (saldo baixo, cartão recusado, conta
 * desativada): WhatsApp da gestora, pelo Z-API que já manda os relatórios,
 * e Telegram quando as variáveis dele existirem. O WhatsApp é o canal
 * principal — é onde a gestora está; o Telegram ficou como opcional.
 *
 * O número fica em system_settings (chave `alerta_whatsapp_numero`), salvo
 * pela tela de Configurações.
 */
import { getSystemSetting, setSystemSetting } from "./_core/systemRouter";
import { sendTelegram, telegramFaltando } from "./budgetCron";
import { sendGroupMessage, zapConfigurado } from "./zapApi";

export const CHAVE_WHATSAPP_ALERTA = "alerta_whatsapp_numero";

/**
 * Só dígitos, com o 55 do Brasil na frente quando vier sem ele.
 * "(41) 99999-8888" → "5541999998888". Null quando não dá para usar.
 */
export function normalizarNumeroWhatsApp(entrada: string | null | undefined): string | null {
  const digitos = (entrada ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  const comPais = digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;
  return comPais.length >= 12 && comPais.length <= 15 ? comPais : null;
}

export function formatarNumeroWhatsApp(numero: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(numero);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${numero}`;
}

export async function obterNumeroAlerta(): Promise<string | null> {
  return normalizarNumeroWhatsApp(await getSystemSetting(CHAVE_WHATSAPP_ALERTA));
}

export async function salvarNumeroAlerta(entrada: string): Promise<string | null> {
  const numero = normalizarNumeroWhatsApp(entrada);
  await setSystemSetting(CHAVE_WHATSAPP_ALERTA, numero ?? "");
  return numero;
}

export type ResultadoCanal = { ok: boolean; erro?: string };
export type ResultadoAlerta = { ok: boolean; whatsapp: ResultadoCanal | null; telegram: ResultadoCanal | null };

/** Manda o mesmo texto nos canais configurados. `*negrito*` vale nos dois. */
export async function enviarAlerta(texto: string): Promise<ResultadoAlerta> {
  const numero = await obterNumeroAlerta();
  const [whatsapp, telegram] = await Promise.all([
    numero && zapConfigurado()
      ? sendGroupMessage(numero, texto).then((r) => ({ ok: r.success, erro: r.error }))
      : Promise.resolve(null),
    telegramFaltando().length === 0 ? sendTelegram(texto) : Promise.resolve(null),
  ]);
  const ok = Boolean(whatsapp?.ok || telegram?.ok);
  if (!whatsapp && !telegram) console.warn("[Alertas] Nenhum canal configurado — aviso não enviado.");
  return { ok, whatsapp, telegram };
}

export async function statusCanais() {
  const numero = await obterNumeroAlerta();
  return {
    whatsapp: { numero, zapConfigurado: zapConfigurado(), ativo: Boolean(numero) && zapConfigurado() },
    telegram: { faltando: telegramFaltando(), ativo: telegramFaltando().length === 0 },
  };
}
