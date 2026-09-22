import { useState, useEffect } from "react";
import { TokenAgencia } from "@/components/report/TokenAgencia";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { ArrowLeft, Search, Trash2 } from "lucide-react";

export default function ManagerSettings() {
  const [token, setToken] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const t = localStorage.getItem("manager_token");
    if (!t) { setLocation("/manager/login"); return; }
    setToken(t);
  }, [setLocation]);

  const { data: clientsData, isLoading, refetch } = trpc.managers.myClients.useQuery(
    { token: token! },
    { enabled: !!token }
  );

  const deleteClient = trpc.managers.deleteClientAsManager.useMutation({
    onSuccess: async () => {
      setDeleteTarget(null);
      await refetch();
    },
  });

  const clients = clientsData?.clients ?? [];
  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Initials helper
  const initials = (name: string) =>
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();

  // Color palette for avatars
  const colors = [
    "#E63946", "#457B9D", "#2A9D8F", "#E9C46A", "#F4A261",
    "#A8DADC", "#6D6875", "#B5838D", "#E76F51", "#264653",
  ];
  const avatarColor = (name: string) => colors[name.charCodeAt(0) % colors.length];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "oklch(0.12 0.012 255)", height: "100vh", overflow: "hidden" }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-4 px-5 py-3.5 border-b flex-shrink-0"
        style={{ borderColor: "oklch(0.22 0.012 255)", background: "oklch(0.13 0.012 255)" }}
      >
        <button
          onClick={() => setLocation("/manager/dashboard")}
          className="flex items-center gap-1.5 text-sm font-medium transition-all"
          style={{ color: "oklch(0.55 0.010 240)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "oklch(0.80 0.18 240)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "oklch(0.55 0.010 240)"; }}
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <div className="h-4 w-px" style={{ background: "oklch(0.26 0.012 255)" }} />
        <span className="text-base font-semibold text-white">Configurações</span>
        <div className="ml-auto text-xs" style={{ color: "oklch(0.45 0.010 240)" }}>
          {clients.length} clientes
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 max-w-6xl mx-auto">

          <TokenAgencia managerToken={token ?? ""} />

          {/* Search bar */}
          <div className="relative mb-5">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "oklch(0.45 0.010 240)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg outline-none transition-all"
              style={{
                background: "oklch(0.16 0.012 255)",
                border: "1px solid oklch(0.26 0.012 255)",
                color: "oklch(0.90 0.005 220)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "oklch(0.60 0.18 240 / 0.6)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "oklch(0.26 0.012 255)"; }}
            />
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl p-4 animate-pulse"
                  style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.22 0.012 255)", height: 90 }}
                />
              ))}
            </div>
          )}

          {/* Grid */}
          {!isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((client) => (
                <div
                  key={client.id}
                  className="rounded-xl text-left transition-all group relative"
                  style={{
                    background: "oklch(0.16 0.012 255)",
                    border: "1px solid oklch(0.22 0.012 255)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.60 0.18 240 / 0.5)";
                    (e.currentTarget as HTMLElement).style.background = "oklch(0.18 0.015 255)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.22 0.012 255)";
                    (e.currentTarget as HTMLElement).style.background = "oklch(0.16 0.012 255)";
                  }}
                >
                  <button onClick={() => setLocation(`/manager/client/${client.id}`)} className="w-full p-4 pr-10 text-left flex flex-col gap-3">
                    {/* Avatar + name */}
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: avatarColor(client.name) }}
                      >
                        {initials(client.name)}
                      </div>
                      <span
                        className="text-xs font-semibold leading-tight line-clamp-2"
                        style={{ color: "oklch(0.88 0.005 220)" }}
                      >
                        {client.name}
                      </span>
                    </div>

                    {/* Status dots */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: "oklch(0.65 0.22 25 / 0.15)", color: "oklch(0.75 0.18 25)" }}
                      >
                        Meta
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: "oklch(0.60 0.18 240 / 0.15)", color: "oklch(0.70 0.15 240)" }}
                      >
                        Monday
                      </span>
                      {client.whatsappGroupId && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ background: "oklch(0.72 0.18 145 / 0.15)", color: "oklch(0.72 0.18 145)" }}
                        >
                          WA ✓
                        </span>
                      )}
                    </div>
                  </button>
                  <button onClick={() => setDeleteTarget({ id: client.id, name: client.name })} title={`Excluir ${client.name}`} className="absolute top-3 right-3 p-1.5 rounded-md opacity-80 hover:opacity-100 transition-opacity" style={{ color: "oklch(0.72 0.18 25)", background: "oklch(0.65 0.22 25 / 0.12)" }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {filtered.length === 0 && !isLoading && (
                <div
                  className="col-span-full py-12 text-center text-sm"
                  style={{ color: "oklch(0.45 0.010 240)" }}
                >
                  Nenhum cliente encontrado
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl p-5" style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.55 0.18 25 / 0.45)" }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.65 0.22 25 / 0.15)", color: "oklch(0.75 0.18 25)" }}><Trash2 className="w-5 h-5" /></div>
              <div><h2 className="font-semibold text-white">Excluir cliente?</h2><p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.010 240)" }}>Esta ação é permanente.</p></div>
            </div>
            <p className="text-sm mt-4 leading-relaxed" style={{ color: "oklch(0.72 0.010 240)" }}>Você está prestes a excluir <strong className="text-white">{deleteTarget.name}</strong>, incluindo integrações, dados comerciais, snapshots e histórico de relatórios.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteTarget(null)} disabled={deleteClient.isPending} className="flex-1 h-10 rounded-lg text-sm border" style={{ borderColor: "oklch(0.28 0.012 255)", color: "oklch(0.76 0.010 240)" }}>Cancelar</button>
              <button onClick={() => { if (token) deleteClient.mutate({ token, clientId: deleteTarget.id }); }} disabled={deleteClient.isPending} className="flex-1 h-10 rounded-lg text-sm font-semibold text-white" style={{ background: "oklch(0.58 0.21 25)", opacity: deleteClient.isPending ? 0.65 : 1 }}>{deleteClient.isPending ? "Excluindo..." : "Excluir definitivamente"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
