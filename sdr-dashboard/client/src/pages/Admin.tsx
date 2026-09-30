/**
 * Admin — painel da gestora.
 *
 * Duas colunas: as pessoas cadastradas de um lado, a busca de boards do Monday
 * do outro. Seleciona a SDR, busca o board pelo nome do médico, clica em
 * vincular. Nenhum ID de board precisa ser digitado à mão.
 */
import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Search, RefreshCw, Link2, Users, ShieldCheck, Trash2, Loader2, Check } from "lucide-react";

/**
 * Deduz o nome do cliente a partir dos nomes dos boards marcados.
 *
 * Os boards seguem o padrão "Agendamentos Ellora- Dra Tatiana Patruni" ou
 * "(1) Atendimento - Dra Tatiana Patruni". Tirando o prefixo, sobra o nome do
 * médico — que é justamente o que ia ser digitado à mão. O campo continua
 * editável; isto é só o palpite inicial.
 */
const PREFIXO_BOARD = /^\s*(\(\d+\)\s*)?(agendamentos?|atendimentos?)\s*(ellora)?\s*[-–—:]?\s*/i;

export function deduzirNomeCliente(nomesDeBoards: string[]): string {
  const candidatos = nomesDeBoards
    .map(n => n.replace(PREFIXO_BOARD, "").trim())
    .filter(n => n.length >= 3);
  if (candidatos.length === 0) return "";

  // O nome que mais se repete entre os boards marcados é o do médico; os
  // sufixos avulsos (um board chamado só "Ellora", por exemplo) ficam de fora.
  const contagem = new Map<string, number>();
  for (const c of candidatos) contagem.set(c, (contagem.get(c) ?? 0) + 1);
  return Array.from(contagem.entries()).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0];
}

export default function Admin() {
  const [busca, setBusca] = useState("");
  const [sdrSelecionada, setSdrSelecionada] = useState<number | null>(null);
  const [boardsSelecionados, setBoardsSelecionados] = useState<string[]>([]);
  const [nomeEditado, setNomeEditado] = useState<string | null>(null);
  const [catalogoPedido, setCatalogoPedido] = useState(false);

  const utils = trpc.useUtils();
  // retry: 1 de propósito. Com o padrão (3 tentativas e recuo exponencial), uma
  // consulta que falha fica em "Carregando..." por quase um minuto antes de
  // finalmente mostrar qualquer coisa — foi o que deixou o painel parecendo
  // travado para sempre.
  const opcoes = { retry: 1, staleTime: 30_000 } as const;

  // Estas duas vêm do banco e devem aparecer na hora, sem nenhuma dependência
  // do Monday. Antes o painel inteiro ficava girando por causa do catálogo.
  const pessoas = trpc.admin.people.useQuery(undefined, opcoes);
  const clientes = trpc.admin.allClients.useQuery(undefined, opcoes);

  /*
   * O catálogo NÃO carrega sozinho ao abrir /admin.
   *
   * São 338 boards em várias páginas; buscar isso na abertura era o que
   * derrubava a tela quando o Monday estava limitado, e na maior parte das
   * vezes a gestora entra aqui só para ver quem tem qual cliente. Ele carrega
   * quando ela digita ao menos 2 caracteres ou clica em "Carregar boards".
   */
  const buscaValida = busca.trim().length >= 2;
  const boards = trpc.admin.searchBoards.useQuery(
    { q: busca.trim() || undefined },
    { ...opcoes, enabled: buscaValida || catalogoPedido },
  );

  const invalidarTudo = () => {
    void utils.admin.people.invalidate();
    void utils.admin.allClients.invalidate();
    void utils.admin.searchBoards.invalidate();
  };

  const criarPerfil = trpc.admin.ensureSdrProfile.useMutation({
    onSuccess: () => invalidarTudo(),
    onError: e => toast.error(e.message),
  });

  const vincular = trpc.admin.assignClient.useMutation({
    onSuccess: c => {
      toast.success(`"${c?.name}" vinculado.`);
      setBoardsSelecionados([]);
      setNomeEditado(null);
      invalidarTudo();
    },
    onError: e => toast.error(e.message),
  });

  const transferir = trpc.admin.reassignClient.useMutation({
    onSuccess: () => {
      toast.success("Cliente transferido.");
      invalidarTudo();
    },
    onError: e => toast.error(e.message),
  });

  const desativar = trpc.admin.deactivateClient.useMutation({
    onSuccess: () => {
      toast.success("Cliente removido do dashboard.");
      invalidarTudo();
    },
    onError: e => toast.error(e.message),
  });

  const promover = trpc.admin.setRole.useMutation({
    onSuccess: () => invalidarTudo(),
    onError: e => toast.error(e.message),
  });

  const atualizarCatalogo = trpc.admin.refreshBoardCatalog.useMutation({
    onSuccess: r => {
      toast.success(`${r.total} boards encontrados no Monday.`);
      void utils.admin.searchBoards.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const sdrs = useMemo(() => (pessoas.data ?? []).filter(p => p.sdrId !== null), [pessoas.data]);
  const semPerfil = useMemo(() => (pessoas.data ?? []).filter(p => p.sdrId === null), [pessoas.data]);

  const alternarBoard = (id: string) =>
    setBoardsSelecionados(prev => (prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]));

  // Enquanto a gestora não digitar nada, o nome acompanha os boards marcados.
  const nomeDeduzido = useMemo(() => {
    const nomes = (boards.data?.results ?? [])
      .filter(b => boardsSelecionados.includes(b.id))
      .map(b => b.name);
    return deduzirNomeCliente(nomes);
  }, [boards.data, boardsSelecionados]);

  const nomeCliente = nomeEditado ?? nomeDeduzido;
  const podeVincular = sdrSelecionada !== null && boardsSelecionados.length > 0 && nomeCliente.trim().length > 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header
        className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
        style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <h1
            className="text-xl font-extrabold tracking-tight"
            style={{ fontFamily: "'DM Sans', sans-serif", color: "var(--foreground)", letterSpacing: "-0.02em" }}
          >
            Painel da gestora
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            Vincule os boards do Monday às SDRs
          </p>
        </div>
        <a
          href="/"
          className="text-base px-4 py-2 rounded-xl font-medium transition-all"
          style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
        >
          ← Dashboard
        </a>
      </header>

      <div className="p-6 grid gap-6 lg:grid-cols-[380px_1fr] items-start">
        {/* Coluna esquerda: pessoas */}
        <div className="space-y-5">
          <Cartao titulo="SDRs" icone={<Users size={17} />} contador={sdrs.length}>
            {pessoas.error ? (
              <ErroSimples mensagem={pessoas.error.message} onTentarDeNovo={() => void pessoas.refetch()} />
            ) : pessoas.isLoading ? (
              <Carregando />
            ) : sdrs.length === 0 ? (
              <Vazio texto="Nenhuma SDR ainda. Peça para criarem a conta no site." />
            ) : (
              <div className="space-y-2">
                {sdrs.map(p => {
                  const ativa = sdrSelecionada === p.sdrId;
                  return (
                    <button
                      key={p.userId}
                      onClick={() => setSdrSelecionada(ativa ? null : p.sdrId)}
                      className="w-full text-left px-4 py-3 rounded-xl transition-all"
                      style={
                        ativa
                          ? { background: "oklch(0.55 0.20 280 / 0.10)", border: "1.5px solid var(--primary)" }
                          : { background: "var(--card)", border: "1px solid var(--border)" }
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base font-semibold truncate" style={{ color: "var(--foreground)" }}>
                          {p.name}
                        </span>
                        {p.role === "admin" && (
                          <ShieldCheck size={15} style={{ color: "var(--primary)" }} aria-label="Administradora" />
                        )}
                      </div>
                      <p className="text-sm mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>
                        {p.email}
                      </p>
                      <p className="text-sm mt-1" style={{ color: ativa ? "var(--primary)" : "var(--muted-foreground)" }}>
                        {p.clientCount} {p.clientCount === 1 ? "cliente" : "clientes"}
                        {ativa && " · selecionada"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </Cartao>

          {semPerfil.length > 0 && (
            <Cartao titulo="Contas novas" contador={semPerfil.length}>
              <p className="text-sm mb-3" style={{ color: "var(--muted-foreground)" }}>
                Criaram conta mas ainda não têm perfil de SDR.
              </p>
              <div className="space-y-2">
                {semPerfil.map(p => (
                  <div
                    key={p.userId}
                    className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl"
                    style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                  >
                    <div className="min-w-0">
                      <p className="text-base font-medium truncate" style={{ color: "var(--foreground)" }}>
                        {p.name}
                      </p>
                      <p className="text-sm truncate" style={{ color: "var(--muted-foreground)" }}>
                        {p.email}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => promover.mutate({ userId: p.userId, role: "admin" })}
                        className="text-sm px-3 py-1.5 rounded-lg"
                        style={{ background: "var(--secondary)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
                        title="Tornar administradora"
                      >
                        Admin
                      </button>
                      <button
                        onClick={() => criarPerfil.mutate({ userId: p.userId })}
                        disabled={criarPerfil.isPending}
                        className="text-sm px-3 py-1.5 rounded-lg font-medium"
                        style={{ background: "var(--primary)", color: "white" }}
                      >
                        Ativar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Cartao>
          )}

          <Cartao titulo="Clientes vinculados" contador={clientes.data?.length ?? 0}>
            {clientes.error ? (
              <ErroSimples mensagem={clientes.error.message} onTentarDeNovo={() => void clientes.refetch()} />
            ) : clientes.isLoading ? (
              <Carregando />
            ) : (clientes.data ?? []).length === 0 ? (
              <Vazio texto="Nenhum cliente vinculado ainda." />
            ) : (
              <div className="space-y-2">
                {clientes.data!.map(c => (
                  <div
                    key={c.id}
                    className="px-4 py-3 rounded-xl space-y-2"
                    style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-medium truncate" style={{ color: "var(--foreground)" }}>
                          {c.name}
                        </p>
                        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                          {c.boardIds.length} {c.boardIds.length === 1 ? "board" : "boards"} · {c.publishedReports}{" "}
                          publicados
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`Remover "${c.name}" do dashboard? Os relatórios já enviados continuam salvos.`)) {
                            desativar.mutate({ clientId: c.id });
                          }
                        }}
                        className="p-2 rounded-lg flex-shrink-0"
                        style={{ color: "oklch(0.55 0.20 25)" }}
                        title="Remover"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {/* Trocar a SDR responsável sem perder relatórios nem o
                        link do portal, que acompanham o cliente. */}
                    <label className="flex items-center gap-2 text-sm">
                      <span style={{ color: "var(--muted-foreground)" }}>SDR</span>
                      <select
                        value={c.sdrId}
                        onChange={e => transferir.mutate({ clientId: c.id, sdrId: Number(e.target.value) })}
                        disabled={transferir.isPending}
                        className="flex-1 px-2.5 py-1.5 rounded-lg text-sm outline-none"
                        style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                      >
                        {sdrs.map(p => (
                          <option key={p.sdrId} value={p.sdrId!}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </Cartao>
        </div>

        {/* Coluna direita: busca de boards */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <div className="p-5 space-y-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--muted-foreground)" }}
                />
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  autoComplete="off"
                  placeholder="Buscar board pelo nome do médico ou da clínica..."
                  className="w-full pl-12 pr-4 py-3 rounded-xl text-base outline-none"
                  style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
              </div>
              <button
                onClick={() => {
                  setCatalogoPedido(true);
                  atualizarCatalogo.mutate();
                }}
                disabled={atualizarCatalogo.isPending}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-base font-medium whitespace-nowrap"
                style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
              >
                <RefreshCw size={16} className={atualizarCatalogo.isPending ? "animate-spin" : ""} />
                {catalogoPedido || buscaValida ? "Atualizar" : "Carregar boards"}
              </button>
            </div>

            {/* Barra de vínculo — só aparece quando há algo selecionado */}
            {boardsSelecionados.length > 0 && (
              <div
                className="flex items-center gap-3 flex-wrap p-4 rounded-xl"
                style={{ background: "oklch(0.55 0.20 280 / 0.08)", border: "1px solid oklch(0.55 0.20 280 / 0.25)" }}
              >
                <span className="text-base font-semibold" style={{ color: "var(--primary)" }}>
                  {boardsSelecionados.length} {boardsSelecionados.length === 1 ? "board" : "boards"}
                </span>
                <label className="flex-1 min-w-[220px]">
                  <span className="text-sm block mb-1" style={{ color: "var(--muted-foreground)" }}>
                    Nome que o cliente verá no relatório
                  </span>
                  <input
                    value={nomeCliente}
                    onChange={e => setNomeEditado(e.target.value)}
                    /* autofill do navegador estava preenchendo com o nome da
                       própria gestora */
                    autoComplete="off"
                    name="nome-do-cliente-vinculado"
                    placeholder="Ex: Dra Tatiana Patruni"
                    className="w-full px-4 py-2.5 rounded-lg text-base outline-none"
                    style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  />
                </label>
                <button
                  onClick={() =>
                    sdrSelecionada !== null &&
                    vincular.mutate({ sdrId: sdrSelecionada, name: nomeCliente, boardIds: boardsSelecionados })
                  }
                  disabled={!podeVincular || vincular.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-base font-semibold disabled:opacity-40"
                  style={{ background: "var(--primary)", color: "white" }}
                >
                  <Link2 size={16} />
                  {vincular.isPending ? "Vinculando..." : "Vincular à SDR"}
                </button>
                {sdrSelecionada === null && (
                  <p className="text-sm w-full" style={{ color: "oklch(0.50 0.16 50)" }}>
                    Escolha primeiro uma SDR na coluna ao lado.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto">
            {!buscaValida && !catalogoPedido ? (
              <div className="px-8 py-12 text-center">
                <Search size={26} className="mx-auto mb-3" style={{ color: "var(--muted-foreground)" }} />
                <p className="text-base" style={{ color: "var(--foreground)" }}>
                  Digite o nome do médico ou da clínica para buscar.
                </p>
                <p className="text-sm mt-2 max-w-sm mx-auto leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  A conta tem centenas de boards. A lista só é buscada quando
                  você pesquisa, para não pesar no limite do Monday.
                </p>
              </div>
            ) : boards.isLoading ? (
              <div className="p-8">
                <Carregando />
              </div>
            ) : boards.error ? (
              <ErroDeBusca mensagem={boards.error.message} onTentarDeNovo={() => void boards.refetch()} recarregando={boards.isFetching} />
            ) : (boards.data?.results ?? []).length === 0 ? (
              <Vazio texto={busca ? `Nenhum board com "${busca}".` : "Nenhum board encontrado."} />
            ) : (
              <>
                <p className="px-5 py-3 text-sm" style={{ color: "var(--muted-foreground)" }}>
                  {boards.data!.results.length} de {boards.data!.total} boards da conta
                </p>
                {boards.data!.results.map(b => {
                  const selecionado = boardsSelecionados.includes(b.id);
                  const jaVinculado = b.assignedTo !== null;
                  return (
                    <button
                      key={b.id}
                      onClick={() => !jaVinculado && alternarBoard(b.id)}
                      disabled={jaVinculado}
                      className="w-full text-left px-5 py-4 flex items-center gap-4 transition-all disabled:cursor-not-allowed"
                      style={{
                        borderTop: "1px solid var(--border)",
                        background: selecionado ? "oklch(0.55 0.20 280 / 0.07)" : "transparent",
                        opacity: jaVinculado ? 0.55 : 1,
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                        style={
                          selecionado
                            ? { background: "var(--primary)" }
                            : { border: "1.5px solid var(--border)", background: "var(--card)" }
                        }
                      >
                        {selecionado && <Check size={13} color="white" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-base font-medium truncate" style={{ color: "var(--foreground)" }}>
                          {b.name}
                        </p>
                        <p className="text-sm truncate" style={{ color: "var(--muted-foreground)" }}>
                          {b.workspace ? `${b.workspace} · ` : ""}
                          {b.itemCount !== null ? `${b.itemCount} itens · ` : ""}
                          ID {b.id}
                        </p>
                      </div>

                      {jaVinculado && (
                        <span
                          className="text-sm px-3 py-1.5 rounded-lg flex-shrink-0"
                          style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
                        >
                          {b.assignedTo!.clientName} · {b.assignedTo!.sdrName}
                        </span>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Cartao({
  titulo,
  icone,
  contador,
  children,
}: {
  titulo: string;
  icone?: React.ReactNode;
  contador?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl p-5" style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-4">
        {icone && <span style={{ color: "var(--primary)" }}>{icone}</span>}
        <h2 className="text-base font-bold" style={{ fontFamily: "'DM Sans', sans-serif", color: "var(--foreground)" }}>
          {titulo}
        </h2>
        {contador !== undefined && (
          <span
            className="text-sm px-2 py-0.5 rounded-full"
            style={{ background: "var(--card)", color: "var(--muted-foreground)", border: "1px solid var(--border)" }}
          >
            {contador}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

const Carregando = () => (
  <div className="flex items-center justify-center gap-2 py-8" style={{ color: "var(--muted-foreground)" }}>
    <Loader2 size={18} className="animate-spin" />
    <span className="text-base">Carregando...</span>
  </div>
);

/**
 * A dica sobre o token só faz sentido quando o erro é de configuração. Antes
 * ela aparecia em qualquer falha, inclusive no limite de requisições — o que
 * mandava procurar problema no lugar errado.
 */
export function ErroDeBusca({
  mensagem,
  onTentarDeNovo,
  recarregando,
}: {
  mensagem: string;
  onTentarDeNovo: () => void;
  recarregando: boolean;
}) {
  const ehLimite = /limite de requisi|rate limit|429/i.test(mensagem);
  const ehConfig = /MONDAY_API_TOKEN/i.test(mensagem);

  return (
    <div className="p-8 text-center">
      <p className="text-base font-medium" style={{ color: "oklch(0.50 0.20 25)" }}>
        {mensagem}
      </p>
      <p className="text-sm mt-2 max-w-md mx-auto leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
        {ehLimite
          ? "O Monday limita quantas consultas a conta pode fazer por minuto. Espere um pouco e tente de novo — os dados já carregados continuam valendo."
          : ehConfig
            ? "Defina MONDAY_API_TOKEN nas variáveis de ambiente do servidor."
            : "Se persistir, confira se o board ainda existe no Monday."}
      </p>
      <button
        onClick={onTentarDeNovo}
        disabled={recarregando}
        className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-base font-medium disabled:opacity-50"
        style={{ background: "var(--secondary)", color: "var(--foreground)", border: "1px solid var(--border)" }}
      >
        <RefreshCw size={15} className={recarregando ? "animate-spin" : ""} />
        {recarregando ? "Tentando..." : "Tentar de novo"}
      </button>
    </div>
  );
}

function ErroSimples({ mensagem, onTentarDeNovo }: { mensagem: string; onTentarDeNovo: () => void }) {
  return (
    <div className="py-6 text-center">
      <p className="text-sm" style={{ color: "oklch(0.50 0.20 25)" }}>
        {mensagem}
      </p>
      <button
        onClick={onTentarDeNovo}
        className="mt-3 text-sm px-3 py-1.5 rounded-lg"
        style={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)" }}
      >
        Tentar de novo
      </button>
    </div>
  );
}

const Vazio = ({ texto }: { texto: string }) => (
  <p className="text-base py-8 text-center" style={{ color: "var(--muted-foreground)" }}>
    {texto}
  </p>
);
