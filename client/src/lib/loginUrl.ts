/**
 * Montagem da URL de login do portal OAuth herdado da plataforma Manus.
 *
 * Fora daquela plataforma as variáveis do portal não existem, e a montagem
 * produzia `new URL("undefined/app-auth")`, que lança `TypeError: Invalid
 * URL`. Como a chamada acontecia na renderização, a página inteira caía com
 * um erro que não diz nada a quem está usando.
 *
 * A montagem agora devolve `null` quando o portal não está configurado, e
 * quem chama decide o que fazer — no caso do produto, mandar para o login de
 * gestor, que tem autenticação própria e funciona sem o portal.
 */

/** Entrada do painel de gestor, usada quando o portal OAuth não existe. */
export const MANAGER_LOGIN_PATH = "/manager/login";

/** Devolve a URL do portal, ou null quando não há configuração utilizável. */
export function buildLoginUrl(
  portalUrl: string | undefined,
  appId: string | undefined,
  redirectUri: string,
): string | null {
  if (!portalUrl || !appId) return null;

  try {
    const url = new URL(`${portalUrl.replace(/\/+$/, "")}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", btoa(redirectUri));
    url.searchParams.set("type", "signIn");
    return url.toString();
  } catch {
    // Portal configurado com valor inválido: tratado como ausente.
    return null;
  }
}
