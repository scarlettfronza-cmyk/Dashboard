/** Aguarda a confirmação de auth.me antes de decidir se deve voltar ao login. */
export function shouldRedirectToEntrar(authSettled: boolean, isAuthenticated: boolean): boolean {
  return authSettled && !isAuthenticated;
}

/** Dá tempo para o navegador persistir o Set-Cookie da mutation de login. */
export const LOCAL_LOGIN_REDIRECT_DELAY_MS = 180;
