/**
 * Home — shell do dashboard: sidebar de clientes + sub-abas + filtro de período.
 *
 * Correções em relação à versão anterior:
 *  - O cliente ativo era uma STRING com o nome, e o token do portal era achado
 *    procurando esse nome na lista do banco. Agora o estado guarda o registro
 *    completo do cliente (id, nome, boardId, token), vindo de `sdr.clients`.
 *  - A lista da sidebar vinha de uma constante ALL_BOARDS no frontend, que
 *    podia divergir da tabela `clients` — clientes apareciam sem token e o
 *    botão "Link do cliente" não tinha o que copiar. A fonte agora é o banco.
 *  - Os atalhos de data usavam toISOString(), que é UTC: depois das 21h no
 *    horário de Brasília o atalho "Hoje" filtrava o dia seguinte.
 *  - As métricas eram recalculadas aqui com fórmulas diferentes das do hook e
 *    das do Overview. Agora existe um cálculo só, em shared/metrics.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useMemo, useCallback, useEffect } from "react";
import { X as XIcon, ShieldCheck, LogOut, AlertTriangle, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Sidebar } from "@/components/Sidebar";
import Overview from "@/pages/Overview";
import Agendamentos from "@/pages/Agendamentos";
import Atendimentos from "@/pages/Atendimentos";
import GestaoVendas from "@/pages/GestaoVendas";
import Relatorio from "@/pages/Relatorio";
import { useClientData, toDashboardStats } from "@/hooks/useMondayData";
import { filterLeadsByDate, resolvePreset, todayInTz, type DateRange, type Preset } from "@shared/metrics";

const PRESETS: { label: string; preset: Preset }[] = [
  { label: "Hoje", preset: "hoje" },
  { label: "7 dias", preset: "7d" },
  { label: "30 dias", preset: "30d" },
  { label: "Mês", preset: "mes" },
  { label: "3 meses", preset: "3m" },
];

const inputStyle = {
  background: "oklch(0.970 0.015 265.0)",
  border: "1px solid oklch(0.890 0.015 265.0)",
  color: "oklch(0.300 0.012 265.0)",
  colorScheme: "light" as const,
};

export default function Home() {
  const { user, loading: authLoading, isAuthenticated, authSettled, logout } = useAuth();
  const isAdmin = (user as { role?: string } | null)?.role === "admin";
  const [activeTab, setActiveTab] = useState("overview");
  const [activeClientId, setActiveClientId] = useState<number | null>(null);
  const [range, setRange] = useState<DateRange | null>(null);
  const [activePreset, setActivePreset] = useState<Preset | null>(null);

  const utils = trpc.useUtils();
  const {
    data: clientsList,
    isLoading: clientsLoading,
    error: clientsError,
    refetch: refetchClients,
  } = trpc.sdr.clients.useQuery(undefined, { enabled: isAuthenticated, retry: 1, staleTime: 30_000 });

  const refresh = trpc.sdr.refreshClientData.useMutation({
    onSuccess: (result) => {
      void utils.sdr.clientData.invalidate();
      void utils.sdr.allClientsData.invalidate();
      toast.success(
        result.falhas > 0
          ? "Atualização concluída, mas alguns boards ainda aguardam o Monday."
          : "Dados atualizados com sucesso.",
      );
    },
    onError: () => toast.error("Não foi possível atualizar agora. Tente novamente em alguns instantes."),
  });

  const atualizarDados = useCallback(() => {
    if (activeClientId === null) {
      toast.info("Selecione um cliente na sidebar para atualizar os dados dele.");
      return;
    }
    refresh.mutate({ clientId: activeClientId });
  }, [activeClientId, refresh]);

  // O cliente ativo é sempre o registro do banco, nunca um nome solto.
  const activeClient = useMemo(
    () => clientsList?.find(c => c.id === activeClientId) ?? null,
    [clientsList, activeClientId],
  );

  const { leads, atendimentos, metrics, loading, error, indisponiveis, lastUpdated, refetch } = useClientData(
    activeClientId,
    range,
    // A consulta ao Monday só começa depois que a lista de clientes (banco)
    // resolver, e só se existir cliente.
    { authenticated: isAuthenticated, clientCount: clientsList?.length },
  );
  const stats = metrics ? toDashboardStats(metrics) : null;
  const leadsDoPeriodo = useMemo(
    () => filterLeadsByDate(leads, "dataConversao", range, "dataConsulta"),
    [leads, range],
  );

  const applyPreset = useCallback((preset: Preset) => {
    if (activePreset === preset) {
      setRange(null);
      setActivePreset(null);
      return;
    }
    setRange(resolvePreset(preset));
    setActivePreset(preset);
  }, [activePreset]);

  const setBound = useCallback((which: "from" | "to", value: string) => {
    setActivePreset(null);
    setRange(prev => {
      const today = todayInTz();
      const next = { from: prev?.from ?? value, to: prev?.to ?? today, [which]: value } as DateRange;
      if (!next.from || !next.to) return next;
      // impede intervalo invertido, que o servidor rejeitaria
      return next.from > next.to ? { from: next.to, to: next.from } : next;
    });
  }, []);

  const clearRange = useCallback(() => {
    setRange(null);
    setActivePreset(null);
  }, []);

  const handleSelectClient = useCallback((id: string) => {
    setActiveClientId(Number(id));
    setActiveTab("overview");
  }, []);

  const sidebarBoards = useMemo(
    () => (clientsList ?? []).map(c => ({ id: String(c.id), name: c.name })),
    [clientsList],
  );

  useEffect(() => {
    if (authSettled && !isAuthenticated) window.location.href = "/entrar";
  }, [authSettled, isAuthenticated]);

  if (authLoading || !authSettled) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.985 0.015 265.0)" }}>
        <div
          className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "oklch(0.62 0.19 280)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  // Sem sessão: manda para a tela de entrar/criar conta.
  if (!isAuthenticated) return null;

  const tabTitles: Record<string, string> = {
    overview: "Visão Geral",
    agendamentos: "Agendamentos",
    atendimentos: "Atendimentos",
    gestao: "Gestão de Vendas",
    analise: "Relatório",
  };

  return (
    <div className="min-h-screen" style={{ background: "oklch(0.985 0.015 265.0)" }}>
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        boards={sidebarBoards}
        loading={clientsLoading}
        onRefresh={() => {
          // Limpa o cache do servidor primeiro e só então reconsulta; invalidar
          // antes traria os mesmos dados guardados.
          if (activeClientId !== null) atualizarDados();
          else refetch();
        }}
        lastUpdated={lastUpdated}
        selectedBoardId={activeClientId !== null ? String(activeClientId) : undefined}
        onSelectBoard={handleSelectClient}
        onClearClient={() => {
          setActiveClientId(null);
          setActiveTab("overview");
        }}
      />

      <main className="ml-60 min-h-screen">
        <header
          className="sticky top-0 z-10 px-6 py-2.5 flex items-center justify-between gap-4"
          style={{
            background: "oklch(0.985 0.015 265.0/ 0.95)",
            borderBottom: "1px solid oklch(0.925 0.015 265.0)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="min-w-0">
            <h1
              className="text-lg font-extrabold tracking-tight"
              style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.190 0.008 265.0)", letterSpacing: "-0.02em" }}
            >
              {activeTab === "overview" && activeClient ? activeClient.name : tabTitles[activeTab]}
            </h1>
            <p className="text-sm mt-0.5 truncate" style={{ color: "oklch(0.560 0.012 265.0)" }}>
              {user?.name && (
                <span className="mr-2" style={{ color: "oklch(0.62 0.19 280)" }}>
                  {user.name}
                </span>
              )}
              {metrics?.leadsRecebidos ?? leads.length} leads
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {activeClient && (
              <>
                <span
                  className="text-sm px-3 py-1.5 rounded-full font-medium"
                  style={{
                    background: "oklch(0.62 0.19 280 / 0.15)",
                    color: "oklch(0.470 0.15 280.0)",
                    border: "1px solid oklch(0.62 0.19 280 / 0.3)",
                  }}
                >
                  {activeClient.name}
                </span>
                <button
                  onClick={() => {
                    setActiveClientId(null);
                    setActiveTab("overview");
                  }}
                  className="text-sm px-2.5 py-1.5 rounded-md transition-all hover:text-white"
                  style={{ background: "oklch(0.975 0.015 265.0)", border: "1px solid oklch(0.890 0.015 265.0)", color: "oklch(0.480 0.012 265.0)" }}
                >
                  ← Todos
                </button>
                <button
                  onClick={atualizarDados}
                  disabled={refresh.isPending}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-semibold transition-all disabled:opacity-60"
                  style={{ background: "oklch(0.62 0.19 280)", color: "white", border: "1px solid oklch(0.53 0.17 280)" }}
                  title="Fazer uma nova leitura dos boards deste cliente no Monday"
                >
                  <RefreshCw size={15} className={refresh.isPending ? "animate-spin" : ""} />
                  {refresh.isPending ? "Atualizando..." : "Atualizar dados"}
                </button>
              </>
            )}
            {isAdmin && (
              <a
                href="/admin"
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium transition-all"
                style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
              >
                <ShieldCheck size={15} />
                Painel
              </a>
            )}
            <button
              onClick={() => void logout().then(() => (window.location.href = "/entrar"))}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg transition-all"
              style={{ background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
              title="Sair"
            >
              <LogOut size={15} />
            </button>
            {error && (
              <div
                className="text-sm px-3 py-1.5 rounded-md max-w-xs truncate"
                title={error}
                style={{ background: "oklch(0.22 0.10 25 / 0.3)", color: "#ef4444", border: "1px solid oklch(0.30 0.10 25 / 0.4)" }}
              >
                {error}
              </div>
            )}
          </div>
        </header>

        <div className="px-6 py-5 max-w-[1400px] mx-auto">
          {/* Falha ao listar clientes precisa virar erro visível, não spinner
              eterno: sem isto a tela ficava "Carregando..." sem nunca explicar
              o motivo. */}
          {clientsError ? (
            <div
              className="rounded-2xl px-8 py-12 text-center max-w-xl mx-auto"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <p className="text-base font-medium" style={{ color: "oklch(0.50 0.20 25)" }}>
                Não foi possível carregar seus clientes.
              </p>
              <p className="text-sm mt-2" style={{ color: "var(--muted-foreground)" }}>
                {clientsError.message}
              </p>
              <button
                onClick={() => void refetchClients()}
                className="mt-5 px-4 py-2.5 rounded-xl text-base font-medium"
                style={{ background: "var(--primary)", color: "white" }}
              >
                Tentar de novo
              </button>
            </div>
          ) : !clientsLoading && (clientsList ?? []).length === 0 ? (
            <div
              className="rounded-2xl px-8 py-16 text-center max-w-xl mx-auto"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <h2
                className="text-xl font-bold mb-3"
                style={{ fontFamily: "'DM Sans', sans-serif", color: "var(--foreground)" }}
              >
                Sua conta está pronta
              </h2>
              <p className="text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                Ainda não há clientes atribuídos a você. Avise a gestora com o
                e-mail que você usou no cadastro — assim que ela distribuir os
                clientes, eles aparecem aqui na barra lateral.
              </p>
              {isAdmin && (
                <a
                  href="/admin"
                  className="inline-block mt-6 px-5 py-3 rounded-xl text-base font-semibold"
                  style={{ background: "var(--primary)", color: "white" }}
                >
                  Abrir painel da gestora
                </a>
              )}
            </div>
          ) : (
          <>
          {/* Filtro de período — aplica-se a todos os KPIs, gráficos e ao relatório */}
          <div
            className="flex items-center gap-1.5 mb-5 flex-wrap"
            style={{
              background: "oklch(1.000 0.015 265.0)",
              border: "1px solid oklch(0.915 0.015 265.0)",
              borderRadius: "8px",
              padding: "6px 10px",
            }}
          >
            {PRESETS.map(({ label, preset }) => (
              <button
                key={preset}
                onClick={() => applyPreset(preset)}
                className="text-sm px-3 py-1.5 rounded-md font-medium transition-all"
                style={
                  activePreset === preset
                    ? {
                        background: "oklch(0.62 0.19 280 / 0.2)",
                        color: "oklch(0.450 0.14 280.0)",
                        border: "1px solid oklch(0.62 0.19 280 / 0.4)",
                      }
                    : { background: "transparent", color: "oklch(0.440 0.012 265.0)", border: "1px solid oklch(0.890 0.015 265.0)" }
                }
              >
                {label}
              </button>
            ))}

            <div className="w-px h-5 mx-1" style={{ background: "oklch(0.890 0.015 265.0)" }} />

            <input
              type="date"
              value={range?.from ?? ""}
              max={range?.to || undefined}
              onChange={e => setBound("from", e.target.value)}
              className="text-sm px-2.5 py-1.5 rounded-md outline-none cursor-pointer"
              style={inputStyle}
            />
            <span className="text-sm" style={{ color: "oklch(0.600 0.012 265.0)" }}>
              →
            </span>
            <input
              type="date"
              value={range?.to ?? ""}
              min={range?.from || undefined}
              onChange={e => setBound("to", e.target.value)}
              className="text-sm px-2.5 py-1.5 rounded-md outline-none cursor-pointer"
              style={inputStyle}
            />

            {range && (
              <button
                onClick={clearRange}
                className="ml-1 p-1 rounded-md transition-all hover:text-white"
                style={{ color: "oklch(0.560 0.012 265.0)" }}
                title="Limpar filtro"
              >
                <XIcon size={13} />
              </button>
            )}
          </div>

          {indisponiveis.length > 0 && (
            <div
              className="mb-4 px-4 py-3 rounded-xl text-sm flex items-start gap-2.5"
              style={{ background: "oklch(0.97 0.05 75)", border: "1px solid oklch(0.88 0.08 70)", color: "oklch(0.42 0.12 55)" }}
            >
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">
                  {indisponiveis.every(b => b.usouCache)
                    ? "Mostrando a última cópia salva dos dados."
                    : "Alguns boards ainda estão sendo copiados do Monday."}
                </p>
                <p className="mt-0.5">
                {indisponiveis.every(b => b.usouCache)
                  ? "Você pode continuar consultando os números enquanto uma nova atualização é tentada."
                  : activeClient
                    ? "Use Atualizar dados para tentar copiar somente os boards desta clínica. Enquanto isso, o relatório fica bloqueado para não enviar números incompletos."
                    : `${indisponiveis.filter(b => !b.usouCache).length} board(s) ainda aguardam a primeira cópia. Selecione uma clínica e use Atualizar dados para tentar novamente.`}
                </p>
              </div>
            </div>
          )}

          {activeTab === "overview" && (
            <Overview
              metrics={metrics}
              leads={leads}
              atendimentos={atendimentos}
              displayLeads={leadsDoPeriodo}
              range={range}
              loading={loading}
              error={error}
              onRetry={refetch}
              clientName={activeClient?.name}
            />
          )}
          {activeTab === "agendamentos" && (
            <Agendamentos leads={leads} metrics={metrics} range={range} />
          )}
          {activeTab === "atendimentos" && (
            <Atendimentos leads={leads} atendimentos={atendimentos} range={range} />
          )}
          {activeTab === "gestao" && (
            <GestaoVendas stats={stats} leads={leads} range={range} />
          )}
          {activeTab === "analise" && (
            <Relatorio
              clientId={activeClientId}
              clientName={activeClient?.name}
              range={range}
              metrics={metrics}
              bloqueado={indisponiveis.length > 0}
            />
          )}
          </>
          )}
        </div>
      </main>

    </div>
  );
}
