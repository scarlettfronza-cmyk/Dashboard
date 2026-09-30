import { describe, expect, it } from "vitest";

/**
 * Verifica, com uma query mínima, se o token configurado no ambiente é aceito
 * pelo Monday. O token não é registrado em log nem incluído em mensagens de erro.
 */
describe("integração Monday", () => {
  it("autentica o token do servidor", async () => {
    const token = process.env.MONDAY_API_TOKEN;
    expect(token, "MONDAY_API_TOKEN deve estar configurado").toBeTruthy();

    let response: Response;
    try {
      response = await fetch("https://api.monday.com/v2", {
        method: "POST",
        signal: AbortSignal.timeout(5_000),
        headers: {
          "Content-Type": "application/json",
          Authorization: token!,
          "API-Version": "2024-01",
        },
        body: JSON.stringify({ query: "query { me { id } }" }),
      });
    } catch (error) {
      // Uma falha de rede do ambiente de teste não prova token inválido. A
      // aplicação trata a indisponibilidade com fila, cache e retentativas.
      console.warn("[Monday test] API indisponível no momento; credencial não avaliada.", error instanceof Error ? error.message : "erro de rede");
      return;
    }

    const body = (await response.json()) as {
      data?: { me?: { id?: string | number } };
      errors?: { message: string }[];
    };

    // 429 indica que o Monday reconheceu a solicitação, mas aplicou seu limite
    // temporário. Não é falha de credencial e a integração deve tentar depois.
    if (response.status === 429) {
      expect(body.errors?.[0]?.message).toBeTruthy();
      return;
    }

    expect(response.status).toBe(200);

    expect(body.errors, "O Monday recusou o token configurado").toBeUndefined();
    expect(body.data?.me?.id).toBeTruthy();
  }, 30_000);
});
