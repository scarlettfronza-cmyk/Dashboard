/**
 * Sidebar — Midnight Operations Dashboard
 * Clicar em um cliente expande sub-abas inline (accordion).
 * Todos os clientes ficam visíveis; o selecionado mostra as abas abaixo.
 */
import { Calendar, Users, TrendingUp, RefreshCw, Activity, Send, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const CLIENT_TABS = [
  { id: "overview",     label: "Visão Geral",     icon: <Activity size={13} /> },
  { id: "agendamentos", label: "Agendamentos",     icon: <Calendar size={13} /> },
  { id: "atendimentos", label: "Atendimentos",     icon: <Users size={13} /> },
  { id: "gestao",       label: "Gestão de Vendas", icon: <TrendingUp size={13} /> },
  { id: "analise",      label: "Relatório",        icon: <Send size={13} /> },
];

interface Board {
  id: string;
  name: string;
}

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  boards: Board[];
  loading: boolean;
  onRefresh: () => void;
  lastUpdated: Date | null;
  selectedBoardId?: string;
  onSelectBoard?: (boardId: string, boardName: string) => void;
  onClearClient?: () => void;
}

export function Sidebar({
  activeTab,
  onTabChange,
  boards,
  loading,
  onRefresh,
  lastUpdated,
  selectedBoardId,
  onSelectBoard,
  onClearClient,
}: SidebarProps) {

  const handleClientClick = (board: Board) => {
    if (selectedBoardId === board.id) {
      // já expandido — fechar (voltar para visão geral)
      onClearClient?.();
    } else {
      // expandir este cliente e ir para Visão Geral dele
      onSelectBoard?.(board.id, board.name);
    }
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 flex flex-col z-20"
      style={{ background: "oklch(1.000 0.015 265.0)", borderRight: "1px solid oklch(0.925 0.015 265.0)" }}>

      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: "oklch(0.925 0.015 265.0)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ background: "linear-gradient(135deg, oklch(0.62 0.19 280), oklch(0.55 0.22 300))" }}>
            S
          </div>
          <div>
            <p className="text-sm font-extrabold leading-none tracking-tight"
              style={{ fontFamily: "'DM Sans', sans-serif", color: "oklch(0.200 0.008 265.0)", letterSpacing: "-0.01em" }}>
              SDR Dashboard
            </p>
            <p className="text-sm mt-0.5 font-medium uppercase tracking-widest"
              style={{ color: "oklch(0.600 0.012 265.0)", fontSize: "9px" }}>
              Gestão de Vendas
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="px-3 py-4 flex-1 overflow-y-auto">
        <div className="px-2 mb-3">
          <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: "oklch(0.600 0.012 265.0)" }}>
            Clientes
          </p>
        </div>

        <ul className="space-y-0.5">
          {boards.map((board) => {
            const isOpen = selectedBoardId === board.id;
            return (
              <li key={board.id}>
                {/* Cabeçalho do cliente */}
                <button
                  onClick={() => handleClientClick(board)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md text-sm transition-all duration-150",
                    isOpen ? "font-semibold" : "hover:text-white"
                  )}
                  style={isOpen
                    ? { background: "oklch(0.62 0.19 280 / 0.15)", color: "oklch(0.450 0.14 280.0)", borderLeft: "2px solid oklch(0.62 0.19 280)" }
                    : { color: "oklch(0.440 0.012 265.0)" }
                  }>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: isOpen ? "oklch(0.470 0.18 280.0)" : "oklch(0.55 0.15 280)" }} />
                    <span className="truncate text-left">{board.name}</span>
                  </div>
                  <ChevronDown size={13} className="flex-shrink-0 transition-transform duration-200"
                    style={{
                      transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
                      color: isOpen ? "oklch(0.65 0.15 280)" : "oklch(0.600 0.012 265.0)"
                    }} />
                </button>

                {/* Sub-abas expandidas */}
                {isOpen && (
                  <ul className="mt-0.5 mb-1 ml-3 space-y-0.5 border-l"
                    style={{ borderColor: "oklch(0.62 0.19 280 / 0.25)" }}>
                    {CLIENT_TABS.map(tab => (
                      <li key={tab.id}>
                        <button
                          onClick={() => onTabChange(tab.id)}
                          className={cn(
                            "w-full flex items-center gap-2 pl-3 pr-2 py-2 rounded-r-md text-sm transition-all duration-150",
                            activeTab === tab.id ? "font-medium" : "hover:text-white"
                          )}
                          style={activeTab === tab.id
                            ? { background: "oklch(0.62 0.19 280 / 0.18)", color: "oklch(0.460 0.15 280.0)" }
                            : { color: "oklch(0.500 0.012 265.0)" }
                          }>
                          <span style={{ color: activeTab === tab.id ? "oklch(0.500 0.17 280.0)" : "oklch(0.580 0.012 265.0)" }}>
                            {tab.icon}
                          </span>
                          {tab.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
          {boards.length === 0 && (
            <li className="px-3 py-2 text-sm italic" style={{ color: "oklch(0.600 0.012 265.0)" }}>
              Nenhum cliente
            </li>
          )}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t" style={{ borderColor: "oklch(0.925 0.015 265.0)" }}>
        <button onClick={onRefresh} disabled={loading}
          className="w-full flex items-center gap-2 text-sm px-3 py-2 rounded-md transition-all"
          style={{ color: "oklch(0.480 0.012 265.0)", background: "oklch(0.975 0.015 265.0)" }}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          {loading ? "Atualizando..." : lastUpdated
            ? `Atualizado ${lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
            : "Atualizar dados"}
        </button>
      </div>
    </aside>
  );
}
