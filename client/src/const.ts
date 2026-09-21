export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
export { MANAGER_LOGIN_PATH } from "@/lib/loginUrl";

import { buildLoginUrl, MANAGER_LOGIN_PATH } from "@/lib/loginUrl";

/**
 * URL de login do portal OAuth, montada em tempo de execução para que o
 * endereço de retorno reflita a origem atual.
 *
 * Devolve null quando o portal não está configurado — fora da plataforma
 * Manus ele não existe.
 */
export const getLoginUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  return buildLoginUrl(
    import.meta.env.VITE_OAUTH_PORTAL_URL,
    import.meta.env.VITE_APP_ID,
    `${window.location.origin}/api/oauth/callback`,
  );
};

/** Destino de login utilizável: o portal, ou o painel de gestor. */
export const getLoginUrlOrManager = (): string =>
  getLoginUrl() ?? MANAGER_LOGIN_PATH;
