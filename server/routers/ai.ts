import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { reportConfig, reportChatHistory, clients } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOrCreateReportConfig(clientId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const existing = await db
    .select()
    .from(reportConfig)
    .where(eq(reportConfig.clientId, clientId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  // Create default config
  await db.insert(reportConfig).values({
    clientId,
    tone: "profissional",
    introText: null,
    customInstructions: null,
    showSections: null,
  });

  const created = await db
    .select()
    .from(reportConfig)
    .where(eq(reportConfig.clientId, clientId))
    .limit(1);

  return created[0];
}

async function getChatHistory(clientId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select()
    .from(reportChatHistory)
    .where(eq(reportChatHistory.clientId, clientId))
    .orderBy(desc(reportChatHistory.createdAt))
    .limit(limit);

  return rows.reverse(); // Oldest first for display
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const aiRouter = router({
  // Get current report config for a client
  getReportConfig: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Verify client belongs to user
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const client = await db
        .select()
        .from(clients)
        .where(eq(clients.id, input.clientId))
        .limit(1);

      if (!client.length || client[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const config = await getOrCreateReportConfig(input.clientId);
      const history = await getChatHistory(input.clientId);

      return { config, history };
    }),

  // Send a chat message to customize the report format
  chat: protectedProcedure
    .input(
      z.object({
        clientId: z.number(),
        message: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify client belongs to user
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const client = await db
        .select()
        .from(clients)
        .where(eq(clients.id, input.clientId))
        .limit(1);

      if (!client.length || client[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Get current config
      const config = await getOrCreateReportConfig(input.clientId);

      // Get recent chat history for context
      const history = await getChatHistory(input.clientId, 10);

      // Save user message
      await db.insert(reportChatHistory).values({
        clientId: input.clientId,
        role: "user",
        content: input.message,
      });

      // Build messages for LLM
      const systemPrompt = `Você é uma assistente especializada em personalizar relatórios de tráfego pago para gestoras de marketing digital.

Você ajuda a Scarlett a customizar o formato e o texto dos relatórios que ela envia para seus clientes (médicos, clínicas, etc.) via WhatsApp.

Configuração atual do relatório do cliente "${client[0].name}":
- Tom: ${config.tone || "profissional"}
- Texto de introdução: ${config.introText || "(padrão)"}
- Instruções customizadas: ${config.customInstructions || "(nenhuma)"}

Quando o usuário pedir uma mudança, você deve:
1. Confirmar o que vai mudar de forma clara e amigável
2. Retornar um JSON com as alterações no campo "changes" (apenas os campos que mudaram)
3. Dar uma resposta amigável explicando o que foi alterado

Campos disponíveis para alterar:
- tone: "profissional" | "descontraido" | "motivacional" | "formal"
- introText: texto de introdução do relatório (pode ter emojis)
- customInstructions: instruções gerais para a IA ao gerar o relatório (ex: "sempre mencionar o nome do médico", "usar emojis nos títulos", "destacar o ROAS em negrito")

Responda SEMPRE em JSON com este formato:
{
  "message": "resposta amigável para o usuário",
  "changes": {
    "tone": "...",  // apenas se mudou
    "introText": "...",  // apenas se mudou
    "customInstructions": "..."  // apenas se mudou
  }
}

Se o usuário estiver apenas conversando ou perguntando (sem pedir mudança), retorne "changes": {} vazio.`;

      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map((h) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user" as const, content: input.message },
      ];

      const llmResponse = await invokeLLM({
        messages,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "report_chat_response",
            strict: true,
            schema: {
              type: "object",
              properties: {
                message: { type: "string" },
                changes: {
                  type: "object",
                  properties: {
                    tone: { type: "string" },
                    introText: { type: "string" },
                    customInstructions: { type: "string" },
                  },
                  required: [],
                  additionalProperties: false,
                },
              },
              required: ["message", "changes"],
              additionalProperties: false,
            },
          },
        },
      });

      let parsed: { message: string; changes: Record<string, string> };
      try {
        const raw = llmResponse.choices[0].message.content;
        parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
      } catch {
        parsed = {
          message: "Entendido! Posso ajudar a personalizar o relatório. O que você gostaria de mudar?",
          changes: {},
        };
      }

      // Apply changes if any
      const hasChanges = Object.keys(parsed.changes).length > 0;
      if (hasChanges) {
        await db
          .update(reportConfig)
          .set({
            ...(parsed.changes.tone && { tone: parsed.changes.tone }),
            ...(parsed.changes.introText !== undefined && { introText: parsed.changes.introText }),
            ...(parsed.changes.customInstructions !== undefined && {
              customInstructions: parsed.changes.customInstructions,
            }),
            lastUpdatedBy: ctx.user.name ?? ctx.user.openId,
          })
          .where(eq(reportConfig.clientId, input.clientId));
      }

      // Save assistant response
      await db.insert(reportChatHistory).values({
        clientId: input.clientId,
        role: "assistant",
        content: parsed.message,
      });

      // Return updated config
      const updatedConfig = await getOrCreateReportConfig(input.clientId);

      return {
        message: parsed.message,
        changes: parsed.changes,
        hasChanges,
        config: updatedConfig,
      };
    }),

  // Clear chat history for a client
  clearHistory: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const client = await db
        .select()
        .from(clients)
        .where(eq(clients.id, input.clientId))
        .limit(1);

      if (!client.length || client[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db
        .delete(reportChatHistory)
        .where(eq(reportChatHistory.clientId, input.clientId));

      return { ok: true };
    }),

  // Reset report config to defaults
  resetConfig: protectedProcedure
    .input(z.object({ clientId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const client = await db
        .select()
        .from(clients)
        .where(eq(clients.id, input.clientId))
        .limit(1);

      if (!client.length || client[0].userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await db
        .update(reportConfig)
        .set({
          tone: "profissional",
          introText: null,
          customInstructions: null,
          lastUpdatedBy: ctx.user.name ?? ctx.user.openId,
        })
        .where(eq(reportConfig.clientId, input.clientId));

      return { ok: true };
    }),
});
