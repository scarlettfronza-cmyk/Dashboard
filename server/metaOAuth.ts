import type { Express, Request, Response } from "express";
import axios from "axios";
import crypto from "crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { oauthStates } from "../drizzle/schema";
import * as db from "./db";
import { listInstagramProfiles } from "./metaApi";

const META_API_VERSION = "v26.0";
const STATE_TTL_MS = 10 * 60 * 1000;

const VARIAVEIS_OAUTH = [
  "META_APP_ID", "META_APP_SECRET", "OAUTH_STATE_SECRET", "PUBLIC_BASE_URL",
] as const;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[metaOAuth] Variável obrigatória ausente: ${name}`);
  return value;
}

/**
 * As variáveis são lidas sob demanda, não na carga do módulo.
 *
 * Validá-las no escopo do módulo derrubava o processo inteiro na
 * inicialização quando o OAuth do Meta não estava configurado, embora o
 * restante do sistema — painel de gestor, relatório público e a conexão do
 * Meta por token colado — não dependa delas. Agora só o próprio fluxo de
 * OAuth falha, e com mensagem clara.
 */
const metaAppId = () => required("META_APP_ID");
const metaAppSecret = () => required("META_APP_SECRET");
const oauthStateSecret = () => required("OAUTH_STATE_SECRET");
const publicBaseUrl = () => required("PUBLIC_BASE_URL");

/** Permite às rotas responderem sem erro quando o OAuth não foi configurado. */
export function isMetaOAuthConfigured(): boolean {
  return VARIAVEIS_OAUTH.every((n) => !!process.env[n]);
}

/** Nomes das variáveis que faltam, para mensagem de diagnóstico. */
export function missingMetaOAuthVars(): string[] {
  return VARIAVEIS_OAUTH.filter((n) => !process.env[n]);
}

function hashNonce(nonce: string) {
  return crypto.createHash("sha256").update(nonce).digest("hex");
}

function signState(payload: object) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", oauthStateSecret()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

async function consumeNonce(nonce: string): Promise<void> {
  const conn = await db.getDb();
  if (!conn) throw new Error("Banco indisponível");
  const result: any = await conn.update(oauthStates).set({ consumedAt: new Date() }).where(and(
    eq(oauthStates.nonceHash, hashNonce(nonce)),
    isNull(oauthStates.consumedAt),
    gt(oauthStates.expiresAt, new Date()),
  ));
  const affected = result?.[0]?.affectedRows ?? result?.affectedRows ?? 0;
  if (!affected) throw new Error("state expirado ou já utilizado");
}

async function verifyState(raw: string): Promise<{ clientId: number; managerId: number | null; returnPath: string }> {
  const [body, signature] = raw.split(".");
  if (!body || !signature) throw new Error("state malformado");
  const expected = crypto.createHmac("sha256", oauthStateSecret()).update(body).digest("base64url");
  const supplied = Buffer.from(signature);
  const signed = Buffer.from(expected);
  if (supplied.length !== signed.length || !crypto.timingSafeEqual(supplied, signed)) throw new Error("state inválido");

  const decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (typeof decoded.clientId !== "number" || typeof decoded.iat !== "number" || typeof decoded.nonce !== "string") throw new Error("state incompleto");
  if (Date.now() - decoded.iat > STATE_TTL_MS || decoded.iat > Date.now() + 30_000) throw new Error("state expirado");
  await consumeNonce(decoded.nonce);
  return {
    clientId: decoded.clientId,
    managerId: typeof decoded.managerId === "number" ? decoded.managerId : null,
    returnPath: decoded.returnPath === "manager" ? `/manager/client/${decoded.clientId}` : "/settings",
  };
}

export async function buildMetaOAuthUrl(clientId: number, managerId: number | null = null): Promise<string> {
  const conn = await db.getDb();
  if (!conn) throw new Error("Banco indisponível");
  const nonce = crypto.randomBytes(32).toString("hex");
  await conn.insert(oauthStates).values({
    nonceHash: hashNonce(nonce), clientId, managerId,
    expiresAt: new Date(Date.now() + STATE_TTL_MS),
  });
  const state = signState({ clientId, managerId, iat: Date.now(), nonce, returnPath: managerId ? "manager" : "admin" });
  const redirectUri = `${publicBaseUrl()}/api/meta/callback`;
  const scope = ["instagram_basic", "instagram_manage_insights", "pages_show_list", "pages_read_engagement", "business_management", "ads_read"].join(",");
  return `https://www.facebook.com/${META_API_VERSION}/dialog/oauth?client_id=${metaAppId()}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&response_type=code`;
}

export async function purgeExpiredOAuthStates(): Promise<void> {
  const conn = await db.getDb();
  if (conn) await conn.delete(oauthStates).where(lt(oauthStates.expiresAt, new Date()));
}

export function registerMetaOAuthRoutes(app: Express) {
  app.get("/api/meta/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;
    const stateRaw = req.query.state as string | undefined;
    if (req.query.error) return res.redirect(`${publicBaseUrl()}/settings?meta_error=access_denied`);
    if (!code || !stateRaw) return res.status(400).json({ error: "code e state são obrigatórios" });

    let state: { clientId: number; managerId: number | null; returnPath: string };
    try { state = await verifyState(stateRaw); }
    catch (error: any) {
      console.warn("[Meta OAuth] state rejeitado:", error?.message);
      return res.redirect(`${publicBaseUrl()}/settings?meta_error=state_expirado`);
    }

    try {
      const redirectUri = `${publicBaseUrl()}/api/meta/callback`;
      const shortToken = await axios.get(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`, { params: { client_id: metaAppId(), client_secret: metaAppSecret(), redirect_uri: redirectUri, code }, timeout: 15_000 });
      const longToken = await axios.get(`https://graph.facebook.com/${META_API_VERSION}/oauth/access_token`, { params: { grant_type: "fb_exchange_token", client_id: metaAppId(), client_secret: metaAppSecret(), fb_exchange_token: shortToken.data.access_token }, timeout: 15_000 });
      const token = longToken.data.access_token as string;
      const me = await axios.get(`https://graph.facebook.com/${META_API_VERSION}/me`, { params: { access_token: token, fields: "id,name" }, timeout: 15_000 });
      const profiles = await listInstagramProfiles(token);
      await db.upsertIntegration({
        clientId: state.clientId,
        provider: "instagram_oauth",
        accessToken: token,
        adAccountId: null,
        boardId: null,
        metaUserId: me.data.id,
        metaIgUserId: null,
        metaIgUsername: null,
        extraConfig: { pendingOAuthProfiles: profiles, pendingOAuthSelection: true },
      });
      return res.redirect(`${publicBaseUrl()}${state.returnPath}?meta_connected=pending&client=${state.clientId}`);
    } catch (error: any) {
      console.error("[Meta OAuth] callback falhou:", error?.message);
      return res.redirect(`${publicBaseUrl()}${state.returnPath}?meta_error=callback_failed`);
    }
  });
}
