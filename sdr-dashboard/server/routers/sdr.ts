/**
 * SDR router — perfis, clientes, dados do Monday e relatórios com IA.
 *
 * Mudanças estruturais em relação à versão anterior:
 *  1. `sdrProcedure` garante o perfil de SDR uma única vez, para todas as
 *     procedures. Antes, cada uma repetia a busca e três delas lançavam
 *     "SDR não encontrado" — a causa do erro relatado no handoff.
 *  2. Todo acesso a cliente passa por `requireClient`, que valida a posse.
 *     Antes, `generateAnalysis` aceitava qualquer clientId vindo do frontend.
 *  3. As métricas são calculadas AQUI, a partir do Monday. Antes, o frontend
 *     mandava os números prontos em `leadsData: string` e o servidor confiava.
 *  4. O portal público só devolve relatórios publicados.
 */
import { nanoid } from "nanoid";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { sdrs, clients, aiReports, chatMessages } from "../../drizzle/schema";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { invokeLLM, type Message } from "../_core/llm";
import { invalidateCache, type BoardRef } from "../monday";
import { lerSnapshots, sincronizarCliente } from "../sync";
import { ENV } from "../_core/env";
import {
  computeMetrics,
  compareMetrics,
  previousRange,
  metricsSummaryForLLM,
  buildReportSnapshot,
  parseReportSnapshot,
  formatRangeBR,
  type DateRange,
} from "../../shared/metrics";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return db;
}

/**
 * Procedure que já entrega `ctx.sdr` pronto. O upsert é idempotente e depende
 * do índice único em sdrs.userId, então duas requisições simultâneas do mesmo
 * usuário recém-logado não criam dois perfis.
 */
const sdrProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const db = await requireDb();

  const found = await db.select().from(sdrs).where(eq(sdrs.userId, ctx.user.id)).limit(1);
  if (found.length > 0) return next({ ctx: { ...ctx, sdr: found[0], db } });

  const name = ctx.user.name || "SDR";
  await db
    .insert(sdrs)
    .values({
      userId: ctx.user.id,
      name,
      email: ctx.user.email || `${ctx.user.openId}@sdr.local`,
      boardIds: "[]",
    })
    .onDuplicateKeyUpdate({ set: { name } });

  const created = await db.select().from(sdrs).where(eq(sdrs.userId, ctx.user.id)).limit(1);
  if (!created.length) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar o perfil de SDR." });
  }

  // Conta nova nasce sem cliente nenhum. O vínculo é feito pela gestora no
  // painel (/admin), que é o único caminho que verifica se o board já pertence
  // a outra SDR. Havia aqui um cadastro automático por nome ("Luana" ganhava 5
  // clientes prontos); ele não fazia essa verificação e criava o mesmo board
  // debaixo de duas pessoas, duplicando os números nos dois dashboards.

  return next({ ctx: { ...ctx, sdr: created[0], db } });
});

/** Só os IDs, para ler a cópia local. */
function boardIdsOf(client: { boardId: string }): string[] {
  return client.boardId.split(",").map(s => s.trim()).filter(Boolean);
}

/** boardId guarda "id" ou "id1,id2". */
function boardRefs(client: { boardId: string; name: string }, sdrName: string): BoardRef[] {
  return client.boardId
    .split(",")
    .map(id => id.trim())
    .filter(Boolean)
    .map(id => ({ id, clientName: client.name, sdrName }));
}

/** Identifica IDs compartilhados entre dois vínculos CSV, ignorando espaços. */
export function overlappingBoardIds(first: string, second: string): string[] {
  const firstIds = new Set(first.split(",").map(id => id.trim()).filter(Boolean));
  return second
    .split(",")
    .map(id => id.trim())
    .filter(id => id.length > 0 && firstIds.has(id));
}

/** Admin acessa qualquer cliente; SDR comum acessa apenas sua própria carteira. */
export function canAccessClient(role: string, requesterSdrId: number, clientSdrId: number): boolean {
  return role === "admin" || requesterSdrId === clientSdrId;
}

type SdrContext = {
  sdr: { id: number; name: string };
  user: { role: string };
  db: Awaited<ReturnType<typeof requireDb>>;
};

/**
 * Carrega o cliente conferindo a posse. Admin acessa qualquer um; SDR, apenas
 * os seus. É esta função que fecha o IDOR: sem ela, trocar o clientId na
 * requisição dava acesso aos dados e relatórios de outro médico.
 */
async function requireClient(ctx: SdrContext, clientId: number) {
  const rows = await ctx.db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const client = rows[0];
  if (!client || !canAccessClient(ctx.user.role, ctx.sdr.id, client.sdrId)) {
    // Mesma mensagem para "não existe" e "não é seu", para não revelar quais
    // ids existem no sistema.
    throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado." });
  }
  return client;
}

const dateRangeInput = z
  .object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine(r => r.from <= r.to, { message: "A data inicial não pode ser maior que a final." })
  .nullish();

// ─── Router ──────────────────────────────────────────────────────────────────

export const sdrRouter = router({
  me: sdrProcedure.query(({ ctx }) => ctx.sdr),

  clients: sdrProcedure.query(async ({ ctx }) => {
    const rows =
      ctx.user.role === "admin"
        ? await ctx.db.select().from(clients)
        : await ctx.db.select().from(clients).where(eq(clients.sdrId, ctx.sdr.id));
    return rows.filter(c => c.isActive).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }),

  /**
   * Dados normalizados de um cliente. Substitui o hook que chamava o Monday
   * direto do navegador com o token embutido no bundle.
   */
  clientData: sdrProcedure
    .input(z.object({ clientId: z.number().int().positive(), force: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const client = await requireClient(ctx, input.clientId);

      // Lê a cópia local. Nenhuma chamada ao Monday acontece aqui — é o que faz
      // esta tela abrir instantaneamente.
      const snap = await lerSnapshots(boardIdsOf(client));
      return {
        clientId: client.id,
        clientName: client.name,
        leads: snap.leads,
        atendimentos: snap.atendimentos,
        fetchedAt: new Date().toISOString(),
        atualizadoEm: snap.atualizadoEm?.toISOString() ?? null,
        indisponiveis: snap.problemas.map(p => ({
          boardId: p.boardId,
          motivo: p.motivo,
          kind: "api" as const,
          usouCache: p.temDados,
        })),
      };
    }),

  /**
   * Visão agregada de todos os clientes da SDR, para quando nenhum cliente
   * está selecionado na sidebar. Serve do cache dos mesmos boards, então não
   * custa uma segunda rodada de chamadas ao Monday.
   */
  allClientsData: sdrProcedure.query(async ({ ctx }) => {
    const owned =
      ctx.user.role === "admin"
        ? await ctx.db.select().from(clients)
        : await ctx.db.select().from(clients).where(eq(clients.sdrId, ctx.sdr.id));

    const active = owned.filter(c => c.isActive);
    // Sem cliente atribuído não há o que buscar. Evita uma ida ao Monday que só
    // serviria para deixar a tela girando.
    if (active.length === 0) {
      return { leads: [], atendimentos: [], fetchedAt: new Date().toISOString(), indisponiveis: [], atualizadoEm: null };
    }

    const snap = await lerSnapshots(active.flatMap(boardIdsOf));
    return {
      leads: snap.leads,
      atendimentos: snap.atendimentos,
      fetchedAt: new Date().toISOString(),
      atualizadoEm: snap.atualizadoEm?.toISOString() ?? null,
      indisponiveis: snap.problemas.map(p => ({
        boardId: p.boardId,
        motivo: p.motivo,
        kind: "api" as const,
        usouCache: p.temDados,
      })),
    };
  }),

  /** Puxa o Monday na hora para este cliente e regrava a cópia local. */
  refreshClientData: sdrProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const client = await requireClient(ctx, input.clientId);
      for (const ref of boardRefs(client, ctx.sdr.name)) invalidateCache(ref.id);
      const r = await sincronizarCliente(client);
      return { ...r, ok: r.falhas === 0 };
    }),

  /**
   * Gera o relatório. Os números vêm do Monday e são calculados aqui — o
   * frontend não envia mais métricas, apenas o cliente e o período.
   */
  generateAnalysis: sdrProcedure
    .input(
      z.object({
        clientId: z.number().int().positive(),
        range: dateRangeInput,
        /** Contexto livre digitado pela SDR (ex.: "tivemos feriado prolongado"). */
        observacoes: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const client = await requireClient(ctx, input.clientId);
      const range: DateRange | null = input.range ?? null;

      const snap = await lerSnapshots(boardIdsOf(client));

      /*
       * Recusa deliberada. Se um board não respondeu, os leads dele faltam e
       * todos os números sairiam menores do que a realidade — sem nada no texto
       * indicando isso. Um relatório com números errados enviado ao médico é
       * pior do que um relatório não gerado.
       */
      const semDados = snap.problemas.filter(p => !p.temDados);
      if (semDados.length > 0) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: `${semDados.length} board(s) deste cliente ainda não sincronizaram. Clique em atualizar e tente de novo — não vale publicar um relatório com números incompletos.`,
        });
      }

      const leads = snap.leads;

      const metrics = computeMetrics(leads, range, snap.atendimentos);
      const comparison = range
        ? compareMetrics(metrics, computeMetrics(leads, previousRange(range), snap.atendimentos))
        : undefined;
      const summary = metricsSummaryForLLM(client.name, range, metrics, comparison);
      // Snapshot completo: é dele que saem os gráficos do portal do cliente.
      const snapshot = buildReportSnapshot(client.name, range, metrics, comparison);

      const systemPrompt = `Você é uma SDR especialista em gestão comercial para clínicas médicas e estéticas no Brasil.
Escreva um relatório de período como mensagem profissional de WhatsApp: texto corrido, parágrafos curtos, tom acolhedor e objetivo.

REGRAS INEGOCIÁVEIS SOBRE OS NÚMEROS:
- Use exclusivamente os valores do JSON fornecido. Nunca calcule, estime ou invente nenhum número.
- Se um dado não estiver no JSON, não o mencione.
- Não cite pacientes pelo nome. Fale sempre de forma agregada.

FORMATO:
- Comece com "Relatório [período] – [nome do cliente]".
- Um parágrafo sobre volume e qualidade dos leads, um sobre resultados (agendamentos, comparecimentos, fechamentos), um sobre contexto ou pontos de atenção e um sobre perspectivas.
- Encerre com uma frase curta de expectativa positiva.
- Sem markdown: nada de asteriscos, hashtags, títulos em negrito ou bullet points. Apenas parágrafos.`;

      const userMessage = [
        `Dados do período (JSON):\n${JSON.stringify(summary, null, 2)}`,
        input.observacoes ? `\n\nContexto informado pela SDR, incorpore com naturalidade:\n${input.observacoes}` : "",
      ].join("");

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      });

      const raw = response.choices?.[0]?.message?.content;
      const content = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
      if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "A IA não retornou conteúdo." });

      const periodLabel = range ? formatRangeBR(range) : "Todo o período";
      await ctx.db.insert(aiReports).values({
        sdrId: ctx.sdr.id,
        clientId: client.id,
        title: `Relatório ${periodLabel} — ${client.name}`,
        content,
        period: periodLabel,
        periodStart: range?.from ?? null,
        periodEnd: range?.to ?? null,
        metricsSnapshot: JSON.stringify(snapshot),
        status: "draft",
      });

      const [saved] = await ctx.db
        .select()
        .from(aiReports)
        .where(and(eq(aiReports.sdrId, ctx.sdr.id), eq(aiReports.clientId, client.id)))
        .orderBy(desc(aiReports.id))
        .limit(1);

      return { report: saved, metrics, comparison };
    }),

  /**
   * Mini-chat de ajuste. Diferente do `chat` genérico anterior: devolve o
   * relatório REVISADO e atualiza a mesma linha, em vez de responder no chat e
   * deixar o texto original intocado.
   */
  reviseReport: sdrProcedure
    .input(z.object({ reportId: z.number().int().positive(), instruction: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const [report] = await ctx.db.select().from(aiReports).where(eq(aiReports.id, input.reportId)).limit(1);
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Relatório não encontrado." });
      await requireClient(ctx, report.clientId);

      const messages: Message[] = [
        {
          role: "system",
          content: `Você revisa relatórios comerciais para clínicas. Aplique APENAS o ajuste pedido e devolva o relatório completo revisado, sem comentários, sem markdown e sem introdução.
Os números abaixo são os únicos válidos. Não altere nenhum deles e não introduza números novos.
${JSON.stringify(parseReportSnapshot(report.metricsSnapshot)?.kpis ?? {})}`,
        },
        { role: "user", content: `Relatório atual:\n${report.content}\n\nAjuste solicitado: ${input.instruction}` },
      ];

      const response = await invokeLLM({ messages });
      const raw = response.choices?.[0]?.message?.content;
      const revised = typeof raw === "string" ? raw : JSON.stringify(raw ?? "");
      if (!revised) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "A IA não retornou conteúdo." });

      // Revisar um relatório já publicado o devolve para rascunho: o cliente
      // não deve ver o texto mudando embaixo dele sem uma nova publicação.
      await ctx.db
        .update(aiReports)
        .set({ content: revised, status: "draft", publishedAt: null })
        .where(eq(aiReports.id, report.id));

      await ctx.db.insert(chatMessages).values([
        { sdrId: ctx.sdr.id, clientId: report.clientId, role: "user" as const, content: input.instruction },
        { sdrId: ctx.sdr.id, clientId: report.clientId, role: "assistant" as const, content: revised },
      ]);

      return { content: revised };
    }),

  setReportStatus: sdrProcedure
    .input(z.object({ reportId: z.number().int().positive(), status: z.enum(["draft", "published"]) }))
    .mutation(async ({ ctx, input }) => {
      const [report] = await ctx.db.select().from(aiReports).where(eq(aiReports.id, input.reportId)).limit(1);
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Relatório não encontrado." });
      await requireClient(ctx, report.clientId);

      await ctx.db
        .update(aiReports)
        .set({ status: input.status, publishedAt: input.status === "published" ? new Date() : null })
        .where(eq(aiReports.id, report.id));

      return { ok: true, status: input.status };
    }),

  reports: sdrProcedure
    .input(z.object({ clientId: z.number().int().positive().optional() }))
    .query(async ({ ctx, input }) => {
      if (input.clientId) {
        await requireClient(ctx, input.clientId);
        return ctx.db
          .select()
          .from(aiReports)
          .where(eq(aiReports.clientId, input.clientId))
          .orderBy(desc(aiReports.createdAt))
          .limit(20);
      }

      const owned = await ctx.db.select({ id: clients.id }).from(clients).where(eq(clients.sdrId, ctx.sdr.id));
      const allowedIds = owned.map(c => c.id);
      if (allowedIds.length === 0) return [];

      return ctx.db
        .select()
        .from(aiReports)
        .where(inArray(aiReports.clientId, allowedIds))
        .orderBy(desc(aiReports.createdAt))
        .limit(20);
    }),

  /*
   * `addClient` foi REMOVIDO de propósito.
   *
   * A distribuição de clientes é atribuição da gestora, pelo painel (/admin →
   * admin.assignClient), que é o único caminho com a verificação de board já
   * vinculado a outra SDR. Tirar só o botão da barra lateral não bastaria: a
   * rota continuaria existindo no servidor e qualquer SDR poderia chamá-la
   * direto, vinculando a si mesma um board de outra pessoa.
   *
   * Se um dia isso voltar a ser desejável, a versão anterior está no histórico
   * do Git; ela precisa da checagem global de board antes de ser reativada.
   */

  /**
   * Invalida o link antigo do portal. Útil se um link vazar.
   * Continua com a SDR: é ela quem manda o link ao médico e quem percebe se
   * ele foi parar no lugar errado. Só afeta um cliente dela.
   */
  rotateClientToken: sdrProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const client = await requireClient(ctx, input.clientId);
      const token = nanoid(32);
      await ctx.db.update(clients).set({ clientToken: token }).where(eq(clients.id, client.id));
      return { clientToken: token };
    }),

  /** URL pública do portal, montada com o domínio configurado no servidor. */
  portalUrl: sdrProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const client = await requireClient(ctx, input.clientId);
      const base = ENV.publicAppUrl;
      return { url: base ? `${base}/portal/${client.clientToken}` : null, token: client.clientToken };
    }),

  chatHistory: sdrProcedure
    .input(z.object({ clientId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireClient(ctx, input.clientId);
      return ctx.db
        .select()
        .from(chatMessages)
        .where(and(eq(chatMessages.sdrId, ctx.sdr.id), eq(chatMessages.clientId, input.clientId)))
        .orderBy(desc(chatMessages.createdAt))
        .limit(50);
    }),

  // ─── Público ───────────────────────────────────────────────────────────────

  /**
   * Portal do cliente. Devolve apenas relatórios PUBLICADOS e apenas os campos
   * que o médico precisa ver: nada de sdrId, boardId ou snapshot de métricas.
   */
  clientPortal: publicProcedure
    .input(z.object({ token: z.string().min(16).max(64) }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [client] = await db.select().from(clients).where(eq(clients.clientToken, input.token)).limit(1);
      if (!client || !client.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Link inválido ou expirado." });
      }

      const reports = await db
        .select({
          id: aiReports.id,
          title: aiReports.title,
          content: aiReports.content,
          period: aiReports.period,
          publishedAt: aiReports.publishedAt,
          metricsSnapshot: aiReports.metricsSnapshot,
        })
        .from(aiReports)
        .where(and(eq(aiReports.clientId, client.id), eq(aiReports.status, "published")))
        .orderBy(desc(aiReports.publishedAt))
        .limit(12);

      // Só sai daqui o que o médico precisa ver: números agregados e o texto.
      // Nenhum lead, nome de paciente, boardId ou identificador interno.
      return {
        client: { name: client.name },
        reports: reports.map(r => ({
          id: r.id,
          title: r.title,
          content: r.content,
          period: r.period,
          publishedAt: r.publishedAt,
          snapshot: parseReportSnapshot(r.metricsSnapshot),
        })),
      };
    }),
});
