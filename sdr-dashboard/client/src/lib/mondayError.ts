export function getMondayErrorGuidance(message: string): string {
  if (/limite de requisi|rate limit|429/i.test(message)) {
    return "O Monday limita consultas por minuto. Espere um pouco e tente de novo. Os dados já carregados continuam valendo.";
  }
  if (/MONDAY_API_TOKEN/i.test(message)) {
    return "Defina MONDAY_API_TOKEN nas variáveis de ambiente do servidor.";
  }
  return "Se persistir, confira se o board ainda existe no Monday.";
}
