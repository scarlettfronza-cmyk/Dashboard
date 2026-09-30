/**
 * password.ts — cadastro e login com e-mail e senha.
 *
 * Não adiciona dependência nova: usa `crypto.scrypt` do próprio Node para o
 * hash e `jose` (já no projeto) para assinar o cookie de sessão.
 *
 * Convive com o login Manus OAuth: `createContext` tenta primeiro a sessão
 * local e cai para o OAuth se não houver.
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

// Custo do scrypt. N=16384 leva ~50-100ms por hash num servidor comum: rápido
// o bastante para o login, lento o bastante para atrapalhar força bruta offline.
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export const LOCAL_SESSION_COOKIE = "sdr_session";
export const SESSION_TTL_DAYS = 30;

function secretKey(): Uint8Array {
  if (!ENV.cookieSecret) {
    throw new Error("JWT_SECRET não configurado — a sessão não pode ser assinada.");
  }
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEYLEN);
  return `scrypt$${N}$${R}$${P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, , , , saltHex, hashHex] = parts;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scrypt(password, salt, expected.length);
    // timingSafeEqual evita que o tempo de resposta revele quantos bytes bateram
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export async function createSessionToken(userId: number): Promise<string> {
  return new SignJWT({ uid: userId, kind: "local" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(secretKey());
}

export async function readSessionToken(token: string | undefined): Promise<number | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.kind !== "local") return null;
    const uid = payload.uid;
    return typeof uid === "number" ? uid : null;
  } catch {
    return null;
  }
}

// ─── Validação ───────────────────────────────────────────────────────────────

/**
 * Regra de senha deliberadamente curta: 8 caracteres, sem exigência de símbolo
 * ou maiúscula. Regras complexas empurram as pessoas para "Senha@123" e para o
 * post-it na mesa. O que protege de verdade aqui é o limite de tentativas.
 */
export const MIN_PASSWORD_LENGTH = 8;

export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (password.length > 200) return "Senha longa demais.";
  const comuns = ["12345678", "senha123", "password", "qwertyui", "11111111"];
  if (comuns.includes(password.toLowerCase())) return "Escolha uma senha menos comum.";
  return null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ─── Limite de tentativas ────────────────────────────────────────────────────

/**
 * Contador em memória por e-mail + IP. Some se o servidor reiniciar, o que é
 * aceitável para o volume atual; se o app crescer para várias instâncias, isso
 * precisa ir para o banco ou para um Redis.
 */
const attempts = new Map<string, { count: number; firstAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function tooManyAttempts(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function registerFailure(key: string): void {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count++;
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}
