export function getManagerJwtSecret() {
  const secret = process.env.MANAGER_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("MANAGER_JWT_SECRET seguro é obrigatório para autenticação de gestores.");
  }
  return new TextEncoder().encode(secret);
}
