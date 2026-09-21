import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { ArrowLeft, Plus, ChevronDown, ChevronUp, Zap, CheckCircle2, AlertCircle, ExternalLink, Users, Copy, Trash2, Link, X, Settings2, Instagram, BarChart2, Layers, Globe, Search, ShoppingCart, Cpu, RefreshCw } from "lucide-react";

// ─── Shared input style ───────────────────────────────────────────────────────
const inputCls = "w-full px-3 py-2 text-sm rounded-md outline-none transition-all";
const inputStyle = {
  background: "oklch(0.18 0.012 255)",
  border: "1px solid oklch(0.30 0.012 255)",
  color: "oklch(0.90 0.005 220)",
};

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputCls}
      style={inputStyle}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "oklch(0.60 0.18 240 / 0.6)";
        e.currentTarget.style.boxShadow = "0 0 0 3px oklch(0.60 0.18 240 / 0.08)";
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "oklch(0.30 0.012 255)";
        e.currentTarget.style.boxShadow = "none";
      }}
    />
  );
}

// ─── Integration Sheet Row ────────────────────────────────────────────────────
function SheetRow({
  label,
  accentColor,
  columns,
  columnNote,
  sheetUrl,
  onSheetUrlChange,
  onSave,
  onTest,
  onRemove,
  saving,
  testing,
}: {
  label: string;
  accentColor: string;
  columns: string;
  columnNote?: string;
  sheetUrl: string;
  onSheetUrlChange: (v: string) => void;
  onSave: () => void;
  onTest: () => void;
  onRemove?: () => void;
  saving: boolean;
  testing: boolean;
}) {
  return (
    <div
      className="p-4 rounded-xl flex flex-col gap-3"
      style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.26 0.012 255)" }}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accentColor }} />
        <span className="text-sm font-semibold text-white">{label}</span>
      </div>

      <div>
        <Input
          value={sheetUrl}
          onChange={onSheetUrlChange}
          placeholder="https://docs.google.com/spreadsheets/d/..."
        />
        <p className="text-xs mt-1.5" style={{ color: "oklch(0.45 0.010 240)" }}>
          Colunas: {columns}
          {columnNote && <span className="ml-1 opacity-70">— {columnNote}</span>}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={!sheetUrl || saving}
          className="flex-1 py-2 text-xs font-semibold rounded-md transition-all"
          style={{
            background: accentColor,
            color: "white",
            opacity: !sheetUrl || saving ? 0.5 : 1,
          }}
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
        <button
          onClick={onTest}
          disabled={testing}
          className="flex-1 py-2 text-xs font-medium rounded-md transition-all"
          style={{
            border: "1px solid oklch(0.30 0.012 255)",
            color: "oklch(0.65 0.010 240)",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "oklch(0.60 0.18 240 / 0.4)";
            e.currentTarget.style.color = "oklch(0.80 0.18 240)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "oklch(0.30 0.012 255)";
            e.currentTarget.style.color = "oklch(0.65 0.010 240)";
          }}
        >
          {testing ? "Testando..." : "Testar conexão"}
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            className="px-3 py-2 text-xs font-medium rounded-md transition-all"
            style={{
              border: "1px solid oklch(0.55 0.18 25 / 0.4)",
              color: "oklch(0.65 0.18 25)",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "oklch(0.55 0.18 25 / 0.12)";
              e.currentTarget.style.color = "oklch(0.75 0.18 25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "oklch(0.65 0.18 25)";
            }}
            title="Desvincular planilha"
          >
            Desvincular
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Instagram Profile Selector ──────────────────────────────────────────────
function InstagramProfileSection({ client }: { client: any }) {
  const [profiles, setProfiles] = useState<Array<{ igUserId: string; username: string; name: string; followersCount: number }>>([]);
  const [igSearch, setIgSearch] = useState("");
  const [igDropdownOpen, setIgDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const { data: igProfile, refetch: refetchIgProfile } = trpc.dashboard.getInstagramProfile.useQuery({ clientId: client.id });
  const getOAuthUrl = trpc.instagram.getOAuthUrl.useMutation({
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (error) => toast.error(error.message || "Erro ao gerar URL de reconexão"),
  });

  const listProfiles = trpc.dashboard.listInstagramProfiles.useMutation({
    onSuccess: (r) => { setProfiles(r ?? []); setLoading(false); setIgDropdownOpen(true); },
    onError: (e) => { toast.error(`Erro ao listar perfis: ${e.message}`); setLoading(false); },
  });

  const saveProfile = trpc.dashboard.saveInstagramProfile.useMutation({
    onSuccess: () => { toast.success("Perfil Instagram vinculado!"); refetchIgProfile(); setIgDropdownOpen(false); },
    onError: () => toast.error("Erro ao salvar perfil"),
  });

  const handleListProfiles = () => {
    setLoading(true);
    setIgSearch("");
    listProfiles.mutate({ clientId: client.id });
  };

  const handleReconnect = async () => {
    getOAuthUrl.mutate({ clientId: client.id });
  };

  const filteredProfiles = profiles.filter(p =>
    p.username.toLowerCase().includes(igSearch.toLowerCase()) ||
    p.name.toLowerCase().includes(igSearch.toLowerCase())
  );

  const isExpired = igProfile?.tokenExpired;
  const isWarning = igProfile?.tokenWarning;
  const borderColor = isExpired ? "oklch(0.65 0.22 25 / 0.6)" : isWarning ? "oklch(0.75 0.18 60 / 0.5)" : igProfile?.connected ? "oklch(0.72 0.18 320 / 0.4)" : "oklch(0.26 0.012 255)";

  return (
    <div
      className="p-4 rounded-xl flex flex-col gap-3"
      style={{ background: "oklch(0.16 0.012 255)", border: `1px solid ${borderColor}` }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, oklch(0.72 0.18 320), oklch(0.72 0.18 40))" }}>
            <span className="text-white" style={{ fontSize: "9px", fontWeight: 700 }}>IG</span>
          </div>
          <span className="text-sm font-semibold text-white">Instagram Business</span>
          {igProfile?.connected && !isExpired && !isWarning && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(0.72 0.18 320 / 0.15)", color: "oklch(0.80 0.18 320)" }}>
              Vinculado
            </span>
          )}
          {isExpired && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(0.65 0.22 25 / 0.15)", color: "oklch(0.75 0.22 25)" }}>
              Token expirado
            </span>
          )}
          {isWarning && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(0.75 0.18 60 / 0.15)", color: "oklch(0.80 0.18 60)" }}>
              Expira em breve
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {igProfile?.connected && (
            <button
              onClick={handleReconnect}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all"
              style={{
                background: isExpired ? "oklch(0.65 0.22 25 / 0.15)" : "oklch(0.55 0.18 240 / 0.15)",
                color: isExpired ? "oklch(0.75 0.22 25)" : "oklch(0.70 0.18 240)",
                border: `1px solid ${isExpired ? "oklch(0.65 0.22 25 / 0.4)" : "oklch(0.55 0.18 240 / 0.35)"}`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              🔄 {isExpired ? "Reconectar" : "Renovar token"}
            </button>
          )}
          <button
            onClick={handleListProfiles}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all"
            style={{
              background: "oklch(0.72 0.18 320 / 0.15)",
              color: "oklch(0.80 0.18 320)",
              border: "1px solid oklch(0.72 0.18 320 / 0.35)",
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(0.72 0.18 320 / 0.25)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "oklch(0.72 0.18 320 / 0.15)"; }}
          >
            {loading ? "Buscando..." : igProfile?.connected ? "Trocar perfil" : "Selecionar perfil"}
          </button>
        </div>
      </div>

      {igProfile?.connected && (
        <div className="flex items-center gap-2 flex-wrap">
          <CheckCircle2 className="w-4 h-4" style={{ color: isExpired ? "oklch(0.65 0.22 25)" : "oklch(0.72 0.18 320)" }} />
          <span className="text-xs" style={{ color: isExpired ? "oklch(0.65 0.22 25)" : "oklch(0.72 0.18 320)" }}>@{igProfile.username}</span>
          {igProfile.daysSince !== undefined && (
            <span className="text-xs" style={{ color: "oklch(0.45 0.010 240)" }}>· token há {igProfile.daysSince} dias</span>
          )}
          {isExpired && (
            <span className="text-xs" style={{ color: "oklch(0.65 0.22 25)" }}>· Clique em Reconectar para renovar o acesso</span>
          )}
        </div>
      )}

      {!igProfile?.connected && !igDropdownOpen && (
        <div className="flex flex-col gap-2">
          <p className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>
            {igProfile?.pending
              ? "Autorização recebida. Selecione abaixo o perfil Instagram correto antes de ativar a integração."
              : "Selecione o perfil Instagram deste cliente para puxar métricas automaticamente."}
          </p>
          <button
            onClick={handleReconnect}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md w-fit transition-all"
            style={{
              background: "oklch(0.72 0.18 320 / 0.15)",
              color: "oklch(0.80 0.18 320)",
              border: "1px solid oklch(0.72 0.18 320 / 0.35)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(0.72 0.18 320 / 0.25)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "oklch(0.72 0.18 320 / 0.15)"; }}
          >
            🔗 Conectar via OAuth
          </button>
        </div>
      )}

      {/* Dropdown de perfis */}
      {igDropdownOpen && profiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <div
            className="rounded-lg overflow-hidden"
            style={{ background: "oklch(0.20 0.012 255)", border: "1px solid oklch(0.35 0.012 255)" }}
          >
            {/* Search */}
            <div className="p-2" style={{ borderBottom: "1px solid oklch(0.28 0.012 255)" }}>
              <input
                autoFocus
                type="text"
                value={igSearch}
                onChange={(e) => setIgSearch(e.target.value)}
                placeholder="Buscar @username..."
                className="w-full px-3 py-1.5 text-sm rounded-md outline-none"
                style={{ background: "oklch(0.15 0.012 255)", border: "1px solid oklch(0.32 0.012 255)", color: "oklch(0.90 0.005 220)" }}
              />
            </div>
            {/* List */}
            <div className="overflow-y-auto" style={{ maxHeight: "220px" }}>
              {filteredProfiles.length === 0 ? (
                <div className="px-3 py-4 text-xs text-center" style={{ color: "oklch(0.45 0.010 240)" }}>Nenhum perfil encontrado</div>
              ) : filteredProfiles.map((p) => (
                <button
                  key={p.igUserId}
                  type="button"
                  onClick={() => saveProfile.mutate({ clientId: client.id, igUserId: p.igUserId, igUsername: p.username })}
                  className="w-full text-left px-3 py-2.5 text-xs transition-all"
                  style={{ borderBottom: "1px solid oklch(0.24 0.012 255)", background: "transparent", color: "oklch(0.80 0.005 220)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(0.72 0.18 320 / 0.10)"; e.currentTarget.style.color = "white"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "oklch(0.80 0.005 220)"; }}
                >
                  <div className="font-semibold">@{p.username}</div>
                  <div style={{ color: "oklch(0.50 0.010 240)" }}>{p.name} · {p.followersCount.toLocaleString("pt-BR")} seguidores</div>
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => { setIgDropdownOpen(false); setProfiles([]); }}
            className="text-xs py-1.5 rounded-md"
            style={{ color: "oklch(0.50 0.010 240)", border: "1px solid oklch(0.28 0.012 255)" }}
          >
            Cancelar
          </button>
        </div>
      )}

      {igDropdownOpen && profiles.length === 0 && !loading && (
        <p className="text-xs" style={{ color: "oklch(0.65 0.18 20)" }}>
          Nenhum perfil Instagram Business encontrado. Certifique-se de que as contas estão vinculadas a Páginas do Facebook.
        </p>
      )}
    </div>
  );
}

// ─── Meta Token Section ───────────────────────────────────────────────────────
function MetaTokenSection({ client, onConnected }: { client: any; onConnected: () => void }) {
  const [token, setToken] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [adAccountName, setAdAccountName] = useState("");
  const [step, setStep] = useState<"idle" | "validating" | "listing" | "saving" | "switching">("idle");
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; currency: string }>>([])
  const [showForm, setShowForm] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // State for switching ad account when already connected
  const [switchMode, setSwitchMode] = useState(false);
  const [switchAccounts, setSwitchAccounts] = useState<Array<{ id: string; name: string; currency: string }>>([])
  const [switchSearch, setSwitchSearch] = useState("");
  const [switchDropdownOpen, setSwitchDropdownOpen] = useState(false);
  const [switchAdAccountId, setSwitchAdAccountId] = useState("");
  const [switchAdAccountName, setSwitchAdAccountName] = useState("");
  // Additional accounts state
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [extraSearch, setExtraSearch] = useState("");
  // Manual account ID entry (for accounts in client BMs not listed in me/adaccounts)
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualAccountId, setManualAccountId] = useState("");
  const [verifyingManual, setVerifyingManual] = useState(false);
  const [accountsListed, setAccountsListed] = useState(false);

  const { data: status, refetch: refetchStatus } = trpc.dashboard.getMetaTokenStatus.useQuery({ clientId: client.id });

  const validateToken = trpc.dashboard.validateMetaToken.useMutation({
    onSuccess: (r) => {
      if (r.valid) {
        toast.success(`Token válido! Conta: ${r.name}`);
        // Now list ad accounts
        setStep("listing");
        listAccounts.mutate({ accessToken: token });
      } else {
        toast.error(`Token inválido: ${r.error}`);
        setStep("idle");
      }
    },
    onError: () => { toast.error("Erro ao validar token"); setStep("idle"); },
  });

  const listAccounts = trpc.dashboard.listAdAccounts.useMutation({
    onSuccess: (r) => {
      setAccounts(r ?? []);
      setAccountsListed(true);
      if (r?.length === 1) {
        setAdAccountId(r[0].id);
      }
      setStep("idle");
    },
    onError: () => { toast.error("Erro ao listar contas de anúncio"); setAccountsListed(true); setStep("idle"); },
  });

  // List accounts using the saved token (for switching)
  const listAccountsForClient = trpc.dashboard.listAdAccountsForClient.useMutation({
    onSuccess: (r) => {
      setSwitchAccounts(r ?? []);
      setSwitchDropdownOpen(true);
      setStep("idle");
    },
    onError: (e) => { toast.error(`Erro ao listar contas: ${e.message}`); setStep("idle"); },
  });

  // Update only the ad account (token stays the same)
  const updateAdAccount = trpc.dashboard.updateClientAdAccount.useMutation({
    onSuccess: () => {
      toast.success(`Conta de anúncio atualizada para ${switchAdAccountName || switchAdAccountId}!`);
      setSwitchMode(false);
      setSwitchAccounts([]);
      setSwitchAdAccountId("");
      setSwitchAdAccountName("");
      refetchStatus();
      onConnected();
    },
    onError: () => { toast.error("Erro ao atualizar conta de anúncio"); },
  });

  const saveToken = trpc.dashboard.saveMetaToken.useMutation({
    onSuccess: () => {
      toast.success("Token Meta salvo! Dados serão puxados automaticamente.");
      setShowForm(false);
      setToken("");
      setAdAccountId("");
      setAccounts([]);
      refetchStatus();
      onConnected();
    },
    onError: () => { toast.error("Erro ao salvar token"); setStep("idle"); },
  });

  const removeToken = trpc.dashboard.removeMetaToken.useMutation({
    onSuccess: () => {
      toast.success("Token removido.");
      refetchStatus();
      onConnected();
    },
  });

  // Additional accounts
  const additionalAccounts = trpc.dashboard.getAdditionalAccounts.useQuery(
    { clientId: client.id },
    { enabled: !!status?.connected }
  );

  const addExtraAccount = trpc.dashboard.addAdditionalAccount.useMutation({
    onSuccess: () => {
      toast.success("Conta adicionada!");
      additionalAccounts.refetch();
      setShowAddExtra(false);
      setExtraSearch("");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeExtraAccount = trpc.dashboard.removeAdditionalAccount.useMutation({
    onSuccess: () => {
      toast.success("Conta removida!");
      additionalAccounts.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const verifyManualAccount = trpc.dashboard.verifyAdAccountAccess.useMutation({
    onSuccess: (r) => {
      setVerifyingManual(false);
      if (r.valid) {
        const normalizedId = manualAccountId.startsWith("act_") ? manualAccountId : `act_${manualAccountId}`;
        setAdAccountId(normalizedId);
        setAdAccountName(r.name ?? normalizedId);
        setShowManualEntry(false);
        toast.success(`Conta encontrada: ${r.name}`);
      } else {
        toast.error(`Sem acesso a esta conta: ${r.error}`);
      }
    },
    onError: (e) => { setVerifyingManual(false); toast.error(`Erro ao verificar conta: ${e.message}`); },
  });

  const listAccountsForExtra = trpc.dashboard.listAdAccountsForClient.useMutation({
    onSuccess: (r) => { setSwitchAccounts(r ?? []); },
    onError: (e) => toast.error(`Erro ao listar contas: ${e.message}`),
  });

  const handleValidate = () => {
    if (!token.trim()) { toast.error("Cole o token de acesso"); return; }
    setStep("validating");
    validateToken.mutate({ accessToken: token.trim() });
  };

  const handleSave = () => {
    if (!adAccountId) { toast.error("Selecione a conta de anúncio"); return; }
    setStep("saving");
    saveToken.mutate({ clientId: client.id, accessToken: token.trim(), adAccountId });
  };

  const handleStartSwitch = () => {
    setSwitchMode(true);
    setSwitchSearch("");
    setSwitchDropdownOpen(false);
    setSwitchAdAccountId("");
    setSwitchAdAccountName("");
    setStep("switching");
    listAccountsForClient.mutate({ clientId: client.id });
  };

  const handleSaveSwitch = () => {
    if (!switchAdAccountId) { toast.error("Selecione a conta de anúncio"); return; }
    updateAdAccount.mutate({ clientId: client.id, adAccountId: switchAdAccountId, adAccountName: switchAdAccountName });
  };

  const isConnected = status?.connected;

  return (
    <div
      className="p-4 rounded-xl flex flex-col gap-3"
      style={{ background: "oklch(0.16 0.012 255)", border: `1px solid ${isConnected ? "oklch(0.60 0.18 240 / 0.4)" : "oklch(0.26 0.012 255)"}` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4" style={{ color: "oklch(0.75 0.18 60)" }} />
          <span className="text-sm font-semibold text-white">Meta Ads API</span>
          {isConnected && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(0.60 0.18 240 / 0.15)", color: "oklch(0.70 0.18 240)" }}>
              Ativo
            </span>
          )}
        </div>
        {isConnected && (
          <button
            onClick={() => removeToken.mutate({ clientId: client.id })}
            className="text-xs px-3 py-1.5 rounded-md transition-all"
            style={{ color: "oklch(0.55 0.010 240)", border: "1px solid oklch(0.28 0.012 255)" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "oklch(0.70 0.18 20)"; e.currentTarget.style.borderColor = "oklch(0.70 0.18 20 / 0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "oklch(0.55 0.010 240)"; e.currentTarget.style.borderColor = "oklch(0.28 0.012 255)"; }}
          >
            Remover
          </button>
        )}
      </div>

      {isConnected ? (
        <div className="flex flex-col gap-3">
          {/* Connected status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" style={{ color: "oklch(0.68 0.16 160)" }} />
              <span className="text-xs" style={{ color: "oklch(0.68 0.16 160)" }}>
                Conta ativa: <span className="font-semibold text-white">{status?.adAccountId}</span>
              </span>
            </div>
            {!switchMode && (
              <button
                onClick={handleStartSwitch}
                disabled={step === "switching"}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all"
                style={{
                  background: "oklch(0.60 0.18 240 / 0.12)",
                  color: "oklch(0.70 0.18 240)",
                  border: "1px solid oklch(0.60 0.18 240 / 0.30)",
                  opacity: step === "switching" ? 0.6 : 1,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(0.60 0.18 240 / 0.22)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "oklch(0.60 0.18 240 / 0.12)"; }}
              >
                {step === "switching" ? "Buscando contas..." : "Trocar conta"}
              </button>
            )}
          </div>

          {/* Additional accounts section */}
          {!switchMode && (
            <div style={{ borderTop: "1px solid oklch(0.26 0.012 255)", paddingTop: "12px" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: "oklch(0.65 0.010 240)" }}>Contas Adicionais</span>
                <button
                  onClick={() => {
                    const newShow = !showAddExtra;
                    setShowAddExtra(newShow);
                    if (newShow && switchAccounts.length === 0) {
                      listAccountsForExtra.mutate({ clientId: client.id });
                    }
                  }}
                  className="text-xs px-2 py-1 rounded-md transition-all"
                  style={{ background: "oklch(0.60 0.18 240 / 0.10)", color: "oklch(0.70 0.18 240)", border: "1px solid oklch(0.60 0.18 240 / 0.25)" }}
                >
                  {showAddExtra ? "Cancelar" : "+ Adicionar"}
                </button>
              </div>

              {/* List existing additional accounts */}
              {additionalAccounts.data?.additionalAccounts && additionalAccounts.data.additionalAccounts.length > 0 ? (
                <div className="flex flex-col gap-1 mb-2">
                  {additionalAccounts.data.additionalAccounts.map((acc) => (
                    <div key={acc.id} className="flex items-center justify-between px-2 py-1.5 rounded-md text-xs" style={{ background: "oklch(0.20 0.012 255)", border: "1px solid oklch(0.28 0.012 255)" }}>
                      <div>
                        <span className="font-medium text-white">{acc.name}</span>
                        <span className="ml-2 font-mono" style={{ color: "oklch(0.50 0.010 240)" }}>{acc.id}</span>
                      </div>
                      <button
                        onClick={() => removeExtraAccount.mutate({ clientId: client.id, accountId: acc.id })}
                        disabled={removeExtraAccount.isPending}
                        className="text-xs px-2 py-0.5 rounded transition-all"
                        style={{ color: "oklch(0.60 0.18 20)", border: "1px solid oklch(0.60 0.18 20 / 0.3)" }}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs mb-2" style={{ color: "oklch(0.45 0.010 240)" }}>Apenas a conta principal ativa. Adicione contas extras para consolidar dados.</p>
              )}

              {/* Add extra account panel */}
              {showAddExtra && (
                <div className="flex flex-col gap-2 p-2 rounded-lg" style={{ background: "oklch(0.18 0.012 255)", border: "1px solid oklch(0.28 0.012 255)" }}>
                  <input
                    type="text"
                    placeholder="Filtrar contas..."
                    value={extraSearch}
                    onChange={(e) => setExtraSearch(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-md outline-none"
                    style={{ background: "oklch(0.15 0.012 255)", border: "1px solid oklch(0.32 0.012 255)", color: "oklch(0.90 0.005 220)" }}
                  />
                  {listAccountsForExtra.isPending ? (
                    <p className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>Buscando contas...</p>
                  ) : switchAccounts.length === 0 ? (
                    <p className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>Nenhuma conta encontrada.</p>
                  ) : (
                    <div className="flex flex-col gap-0.5" style={{ maxHeight: "160px", overflowY: "auto" }}>
                      {switchAccounts
                        .filter((acc) =>
                          !additionalAccounts.data?.additionalAccounts.find((a) => a.id === acc.id) &&
                          acc.id !== status?.adAccountId &&
                          (extraSearch === "" || acc.name.toLowerCase().includes(extraSearch.toLowerCase()) || acc.id.includes(extraSearch))
                        )
                        .map((acc) => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => addExtraAccount.mutate({ clientId: client.id, accountId: acc.id, accountName: acc.name })}
                            disabled={addExtraAccount.isPending}
                            className="w-full text-left px-2 py-1.5 text-xs rounded-md transition-all"
                            style={{ background: "oklch(0.22 0.012 255)", color: "oklch(0.80 0.005 220)" }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(0.60 0.18 240 / 0.15)"; e.currentTarget.style.color = "white"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "oklch(0.22 0.012 255)"; e.currentTarget.style.color = "oklch(0.80 0.005 220)"; }}
                          >
                            <span className="font-medium">{acc.name}</span>
                            <span className="ml-2 font-mono" style={{ color: "oklch(0.50 0.010 240)" }}>{acc.id}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Switch mode: account selector */}
          {switchMode && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium" style={{ color: "oklch(0.65 0.010 240)" }}>
                Selecione a nova conta de anúncio:
              </label>
              <div className="relative">
                {/* Trigger */}
                <button
                  type="button"
                  onClick={() => { setSwitchDropdownOpen(!switchDropdownOpen); setSwitchSearch(""); }}
                  className={`${inputCls} flex items-center justify-between`}
                  style={{ ...inputStyle, cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ color: switchAdAccountId ? "oklch(0.90 0.005 220)" : "oklch(0.45 0.010 240)" }}>
                    {switchAdAccountId ? `${switchAdAccountName} (${switchAdAccountId})` : "Selecione a conta..."}
                  </span>
                  <svg className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.50 0.010 240)", transform: switchDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>

                {/* Dropdown */}
                {switchDropdownOpen && (
                  <div
                    className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden shadow-2xl"
                    style={{ background: "oklch(0.20 0.012 255)", border: "1px solid oklch(0.35 0.012 255)", maxHeight: "260px", display: "flex", flexDirection: "column" }}
                  >
                    <div className="p-2" style={{ borderBottom: "1px solid oklch(0.28 0.012 255)" }}>
                      <input
                        autoFocus
                        type="text"
                        value={switchSearch}
                        onChange={(e) => setSwitchSearch(e.target.value)}
                        placeholder="Buscar conta..."
                        className="w-full px-3 py-1.5 text-sm rounded-md outline-none"
                        style={{ background: "oklch(0.15 0.012 255)", border: "1px solid oklch(0.32 0.012 255)", color: "oklch(0.90 0.005 220)" }}
                      />
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: "200px" }}>
                      {switchAccounts
                        .filter((acc) =>
                          acc.name.toLowerCase().includes(switchSearch.toLowerCase()) ||
                          acc.id.includes(switchSearch)
                        )
                        .map((acc) => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              setSwitchAdAccountId(acc.id);
                              setSwitchAdAccountName(acc.name);
                              setSwitchDropdownOpen(false);
                              setSwitchSearch("");
                            }}
                            className="w-full text-left px-3 py-2 text-xs transition-all"
                            style={{
                              background: switchAdAccountId === acc.id ? "oklch(0.60 0.18 240 / 0.15)" : "transparent",
                              color: switchAdAccountId === acc.id ? "oklch(0.80 0.18 240)" : "oklch(0.75 0.005 220)",
                              borderBottom: "1px solid oklch(0.24 0.012 255)",
                            }}
                            onMouseEnter={(e) => { if (switchAdAccountId !== acc.id) { e.currentTarget.style.background = "oklch(0.60 0.18 240 / 0.08)"; e.currentTarget.style.color = "white"; } }}
                            onMouseLeave={(e) => { if (switchAdAccountId !== acc.id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "oklch(0.75 0.005 220)"; } }}
                          >
                            <div className="font-medium">{acc.name}</div>
                            <div style={{ color: "oklch(0.45 0.010 240)" }}>{acc.id} — {acc.currency}</div>
                          </button>
                        ))
                      }
                      {switchAccounts.filter((acc) =>
                        acc.name.toLowerCase().includes(switchSearch.toLowerCase()) ||
                        acc.id.includes(switchSearch)
                      ).length === 0 && (
                        <div className="px-3 py-4 text-xs text-center" style={{ color: "oklch(0.45 0.010 240)" }}>Nenhuma conta encontrada</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveSwitch}
                  disabled={!switchAdAccountId || updateAdAccount.isPending}
                  className="flex-1 py-2 text-xs font-semibold rounded-md transition-all"
                  style={{
                    background: "oklch(0.68 0.16 160)",
                    color: "white",
                    opacity: !switchAdAccountId || updateAdAccount.isPending ? 0.5 : 1,
                  }}
                >
                  {updateAdAccount.isPending ? "Salvando..." : "Confirmar troca"}
                </button>
                <button
                  onClick={() => { setSwitchMode(false); setSwitchAccounts([]); setSwitchAdAccountId(""); setSwitchAdAccountName(""); setSwitchDropdownOpen(false); }}
                  className="flex-1 py-2 text-xs font-medium rounded-md transition-all"
                  style={{ border: "1px solid oklch(0.30 0.012 255)", color: "oklch(0.55 0.010 240)", background: "transparent" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs" style={{ color: "oklch(0.55 0.010 240)" }}>
            Conecte diretamente com a API do Meta. Sem planilha — dados puxados automaticamente.
          </p>
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="py-2 text-xs font-semibold rounded-md transition-all"
              style={{ background: "oklch(0.75 0.18 60 / 0.15)", color: "oklch(0.80 0.18 60)", border: "1px solid oklch(0.75 0.18 60 / 0.3)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(0.75 0.18 60 / 0.25)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "oklch(0.75 0.18 60 / 0.15)"; }}
            >
              + Conectar com token Meta
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Step 1: Token */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.65 0.010 240)" }}>
                  1. Token de acesso (começa com EAA...)
                </label>
                <div className="flex gap-2">
                  <Input
                    value={token}
                    onChange={setToken}
                    placeholder="EAAxxxxxxxxxx..."
                    type="password"
                  />
                  <button
                    onClick={handleValidate}
                    disabled={!token || step === "validating" || step === "listing"}
                    className="px-4 py-2 text-xs font-semibold rounded-md whitespace-nowrap transition-all"
                    style={{
                      background: "oklch(0.60 0.18 240)",
                      color: "white",
                      opacity: !token || step === "validating" || step === "listing" ? 0.5 : 1,
                    }}
                  >
                    {step === "validating" ? "Validando..." : step === "listing" ? "Buscando..." : "Validar"}
                  </button>
                </div>
                <a
                  href="https://developers.facebook.com/tools/explorer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs mt-1.5 transition-all"
                  style={{ color: "oklch(0.55 0.18 240)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "oklch(0.70 0.18 240)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "oklch(0.55 0.18 240)"; }}
                >
                  <ExternalLink className="w-3 h-3" />
                  Gerar token no Graph API Explorer
                </a>
              </div>

              {/* Step 2: Ad Account — searchable dropdown */}
              {(accounts.length > 0 || accountsListed) && (
                <div className="relative">
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.65 0.010 240)" }}>
                    2. Conta de anúncio
                  </label>
                  {/* Trigger */}
                  <button
                    type="button"
                    onClick={() => { setDropdownOpen(!dropdownOpen); setAccountSearch(""); }}
                    className={`${inputCls} flex items-center justify-between`}
                    style={{ ...inputStyle, cursor: "pointer", textAlign: "left" }}
                  >
                    <span style={{ color: adAccountId ? "oklch(0.90 0.005 220)" : "oklch(0.45 0.010 240)" }}>
                      {adAccountId ? `${adAccountName} (${adAccountId})` : "Selecione a conta..."}
                    </span>
                    <svg className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.50 0.010 240)", transform: dropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>

                  {/* Dropdown panel */}
                  {dropdownOpen && (
                    <div
                      className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden shadow-2xl"
                      style={{ background: "oklch(0.20 0.012 255)", border: "1px solid oklch(0.35 0.012 255)", maxHeight: "260px", display: "flex", flexDirection: "column" }}
                    >
                      {/* Search input */}
                      <div className="p-2" style={{ borderBottom: "1px solid oklch(0.28 0.012 255)" }}>
                        <input
                          autoFocus
                          type="text"
                          value={accountSearch}
                          onChange={(e) => setAccountSearch(e.target.value)}
                          placeholder="Buscar conta..."
                          className="w-full px-3 py-1.5 text-sm rounded-md outline-none"
                          style={{ background: "oklch(0.15 0.012 255)", border: "1px solid oklch(0.32 0.012 255)", color: "oklch(0.90 0.005 220)" }}
                        />
                      </div>
                      {/* List */}
                      <div className="overflow-y-auto" style={{ maxHeight: "200px" }}>
                        {accounts
                          .filter((acc) =>
                            acc.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
                            acc.id.includes(accountSearch)
                          )
                          .map((acc) => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => {
                                setAdAccountId(acc.id);
                                setAdAccountName(acc.name);
                                setDropdownOpen(false);
                                setAccountSearch("");
                              }}
                              className="w-full text-left px-3 py-2 text-xs transition-all"
                              style={{
                                background: adAccountId === acc.id ? "oklch(0.60 0.18 240 / 0.15)" : "transparent",
                                color: adAccountId === acc.id ? "oklch(0.80 0.18 240)" : "oklch(0.75 0.005 220)",
                                borderBottom: "1px solid oklch(0.24 0.012 255)",
                              }}
                              onMouseEnter={(e) => { if (adAccountId !== acc.id) { e.currentTarget.style.background = "oklch(0.60 0.18 240 / 0.08)"; e.currentTarget.style.color = "white"; } }}
                              onMouseLeave={(e) => { if (adAccountId !== acc.id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "oklch(0.75 0.005 220)"; } }}
                            >
                              <div className="font-medium">{acc.name}</div>
                              <div style={{ color: "oklch(0.45 0.010 240)" }}>{acc.id} — {acc.currency}</div>
                            </button>
                          ))
                        }
                        {accounts.filter((acc) =>
                          acc.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
                          acc.id.includes(accountSearch)
                        ).length === 0 && (
                          <div className="px-3 py-4 text-xs text-center" style={{ color: "oklch(0.45 0.010 240)" }}>
                            Nenhuma conta encontrada
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Manual account ID entry — for accounts in client BMs */}
              {(accounts.length > 0 || accountsListed) && (
                <div>
                  {!showManualEntry ? (
                    <button
                      type="button"
                      onClick={() => { setShowManualEntry(true); setManualAccountId(""); }}
                      className="text-xs transition-all"
                      style={{ color: "oklch(0.55 0.18 240)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "oklch(0.70 0.18 240)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "oklch(0.55 0.18 240)"; }}
                    >
                      Não encontrou sua conta? Inserir ID manualmente
                    </button>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium" style={{ color: "oklch(0.65 0.010 240)" }}>
                        ID da conta (ex: act_1625411728898223 ou 1625411728898223)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={manualAccountId}
                          onChange={(e) => setManualAccountId(e.target.value)}
                          placeholder="act_XXXXXXXXXXXXXXX"
                          className="flex-1 px-3 py-2 text-xs rounded-md outline-none"
                          style={{ background: "oklch(0.15 0.012 255)", border: "1px solid oklch(0.32 0.012 255)", color: "oklch(0.90 0.005 220)" }}
                        />
                        <button
                          type="button"
                          disabled={!manualAccountId.trim() || verifyingManual}
                          onClick={() => {
                            if (!manualAccountId.trim() || !token.trim()) return;
                            setVerifyingManual(true);
                            verifyManualAccount.mutate({ accessToken: token.trim(), adAccountId: manualAccountId.trim() });
                          }}
                          className="px-3 py-2 text-xs font-semibold rounded-md transition-all"
                          style={{ background: "oklch(0.55 0.18 240)", color: "white", opacity: !manualAccountId.trim() || verifyingManual ? 0.5 : 1 }}
                        >
                          {verifyingManual ? "Verificando..." : "Verificar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowManualEntry(false); setManualAccountId(""); }}
                          className="px-3 py-2 text-xs rounded-md transition-all"
                          style={{ border: "1px solid oklch(0.30 0.012 255)", color: "oklch(0.55 0.010 240)", background: "transparent" }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {(accounts.length > 0 || adAccountId) && (
                  <button
                    onClick={handleSave}
                    disabled={!adAccountId || step === "saving"}
                    className="flex-1 py-2 text-xs font-semibold rounded-md transition-all"
                    style={{
                      background: "oklch(0.68 0.16 160)",
                      color: "white",
                      opacity: !adAccountId || step === "saving" ? 0.5 : 1,
                    }}
                  >
                    {step === "saving" ? "Salvando..." : "Salvar conexão"}
                  </button>
                )}
                <button
                  onClick={() => { setShowForm(false); setToken(""); setAdAccountId(""); setAccounts([]); setStep("idle"); }}
                  className="flex-1 py-2 text-xs font-medium rounded-md transition-all"
                  style={{ border: "1px solid oklch(0.30 0.012 255)", color: "oklch(0.55 0.010 240)", background: "transparent" }}
                >
                  Cancelar
                </button>
              </div>

              {/* Instructions */}
              <div className="p-3 rounded-lg text-xs" style={{ background: "oklch(0.14 0.012 255)", border: "1px solid oklch(0.24 0.012 255)" }}>
                <div className="font-semibold mb-2 text-white flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" style={{ color: "oklch(0.75 0.18 60)" }} />
                  Como gerar o token
                </div>
                <ol className="flex flex-col gap-1 list-decimal list-inside" style={{ color: "oklch(0.55 0.010 240)" }}>
                  <li>Acesse o <span className="text-white">Graph API Explorer</span> (link acima)</li>
                  <li>Selecione o app <span className="text-white">Monitor Ads Escarlate</span></li>
                  <li>Clique em <span className="text-white">Generate Access Token</span></li>
                  <li>Marque: <span className="text-white">ads_read, ads_management, instagram_basic, instagram_manage_insights, pages_read_engagement</span></li>
                  <li>Copie o token gerado e cole acima</li>
                </ol>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Client Detail Panel with Tabs ───────────────────────────────────────────
  function ClientDetailPanel({ client }: { client: any }) {
  const [activeTab, setActiveTab] = useState<"meta" | "instagram" | "vendas" | "avancado">("meta");
  const [salesSheetUrl, setSalesSheetUrl] = useState("");
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [xlsxUploading, setXlsxUploading] = useState(false);
  const [mondayBoardId, setMondayBoardId] = useState("");
  const [syncingMonday, setSyncingMonday] = useState(false);
  const [mondaySyncStart, setMondaySyncStart] = useState("");
  const [mondaySyncEnd, setMondaySyncEnd] = useState("");
  const [isPrePaid, setIsPrePaid] = useState<boolean>(!!client.isPrePaid);
  // Campaign types state
  const [campaignTypes, setCampaignTypes] = useState<string[]>([]);
  const [savingCampaignTypes, setSavingCampaignTypes] = useState(false);
  const [capiPixelId, setCapiPixelId] = useState("");
  const [capiToken, setCapiToken] = useState("");
  const [capiSaving, setCapiSaving] = useState(false);

  // WhatsApp group state
  const [whatsappGroupId, setWhatsappGroupId] = useState<string>(client.whatsappGroupId || "");
  const [savingGroupId, setSavingGroupId] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  const { data: zapGroups, isLoading: loadingGroups, refetch: refetchGroups } = trpc.whatsapp.listGroups.useQuery(
    undefined,
    { enabled: false }
  );

  const saveGroupIdMutation = trpc.whatsapp.saveGroupId.useMutation({
    onSuccess: () => { toast.success("Grupo de WhatsApp salvo!"); setSavingGroupId(false); },
    onError: (e: any) => { toast.error(e.message || "Erro ao salvar grupo"); setSavingGroupId(false); },
  });

  const filteredGroups = (zapGroups || []).filter((g: { id: string; name: string }) =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase()) || g.id.includes(groupSearch)
  );

  const selectedGroupName = (zapGroups || []).find((g: { id: string; name: string }) => g.id === whatsappGroupId)?.name;

  const { data: capiConfig, refetch: refetchCapiConfig } = trpc.leadTracking.getCAPIConfig.useQuery({ clientId: client.id });
  const capiConfigRef = useRef<any>(null);
  if (capiConfig && capiConfig !== capiConfigRef.current) {
    capiConfigRef.current = capiConfig;
    setCapiPixelId((capiConfig as any).metaPixelId || "");
    setCapiToken("");
  }

  const { data: campaignTypesData } = trpc.dashboard.getCampaignTypes.useQuery({ clientId: client.id });
  const campaignTypesRef = useRef<any>(null);
  if (campaignTypesData && campaignTypesData !== campaignTypesRef.current) {
    campaignTypesRef.current = campaignTypesData;
    setCampaignTypes(campaignTypesData.campaignTypes || []);
  }

  const saveCampaignTypesMutation = trpc.dashboard.saveCampaignTypes.useMutation({
    onSuccess: () => { toast.success("Tipos de campanha salvos!"); setSavingCampaignTypes(false); },
    onError: (e: any) => { toast.error(e.message || "Erro ao salvar"); setSavingCampaignTypes(false); },
  });

  const CAMPAIGN_TYPE_OPTIONS = [
    { id: "lead", label: "Engajamento / Lead", emoji: "🎯" },
    { id: "profile_visit", label: "Visitas ao Perfil", emoji: "👤" },
    { id: "awareness", label: "Reconhecimento", emoji: "📢" },
  ];

  const toggleCampaignType = (id: string) => {
    setCampaignTypes((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  const saveCAPIConfig = trpc.leadTracking.saveCAPIConfig.useMutation({
    onSuccess: () => { toast.success("Configuração CAPI salva!"); refetchCapiConfig(); setCapiSaving(false); },
    onError: (e: any) => { toast.error(e.message || "Erro ao salvar CAPI"); setCapiSaving(false); },
  });

  const setPrePaid = trpc.dashboard.setPrePaid.useMutation({
    onSuccess: () => toast.success(isPrePaid ? "Marcado como pré-pago!" : "Removido pré-pago"),
    onError: (e) => toast.error(e.message),
  });

  const { data: uploadInfo, refetch: refetchUploadInfo } = trpc.sales.getUploadInfoAsAdmin.useQuery({ clientId: client.id });

  async function handleXlsxUpload() {
    if (!xlsxFile) return;
    setXlsxUploading(true);
    try {
      const buffer = await xlsxFile.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const res = await fetch(`/api/upload-sales/${client.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileBase64: base64, fileName: xlsxFile.name }),
      });
      const data = await res.json();
      if (data.success) {
        setXlsxFile(null);
        refetchUploadInfo();
        toast.success(`${data.imported} registros importados com sucesso!`);
      } else {
        toast.error(data.error || "Erro ao importar planilha");
      }
    } catch {
      toast.error("Erro ao processar arquivo");
    } finally {
      setXlsxUploading(false);
    }
  }

  const { data: integrations, refetch: refetchIntegrations } = trpc.dashboard.getIntegrations.useQuery({ clientId: client.id });

  const saveIntegration = trpc.dashboard.saveIntegration.useMutation({
    onSuccess: () => { toast.success("Integração salva!"); refetchIntegrations(); },
    onError: () => toast.error("Erro ao salvar integração"),
  });

  const removeIntegration = trpc.dashboard.removeIntegration.useMutation({
    onSuccess: () => { toast.success("Integração removida!"); refetchIntegrations(); },
    onError: () => toast.error("Erro ao remover integração"),
  });

  const clearSalesRecords = trpc.dashboard.clearSalesRecords.useMutation({
    onSuccess: () => { toast.success("Dados do Monday removidos!"); refetchUploadInfo(); },
    onError: () => toast.error("Erro ao limpar dados"),
  });

  const mondayStatus = trpc.monday.getStatus.useQuery({ clientId: client.id });

  const saveBoardId = trpc.monday.saveBoardId.useMutation({
    onSuccess: () => { toast.success("Board ID salvo!"); mondayStatus.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const syncBoardMutation = trpc.monday.syncBoard.useMutation({
    onSuccess: (data) => {
      if (data.reason === "no_token") toast.warning("Token do Monday.com não configurado.");
      else if (data.reason === "no_board_id") toast.warning("Este cliente não tem Board ID configurado.");
      else if (data.reason) toast.warning("Sync não realizado: " + data.reason);
      else toast.success(`Sincronizado! ${data.imported} registros importados.`);
      mondayStatus.refetch();
      refetchUploadInfo();
      setSyncingMonday(false);
    },
    onError: (err) => { toast.error("Erro ao sincronizar: " + err.message); setSyncingMonday(false); },
  });

  const handleSyncMonday = () => {
    const boardId = mondayStatus.data?.boardId || mondayBoardId.trim();
    if (!boardId) { toast.error("Informe o Board ID do Monday.com"); return; }
    setSyncingMonday(true);
    syncBoardMutation.mutate({
      clientId: client.id,
      boardId,
      startDate: mondaySyncStart ? new Date(mondaySyncStart + "T00:00:00") : undefined,
      endDate: mondaySyncEnd ? new Date(mondaySyncEnd + "T23:59:59") : undefined,
    });
  };

  const testIntegration = trpc.dashboard.testIntegration.useMutation({
    onSuccess: (r) => {
      if (r.success) toast.success(`Conexão OK — ${r.message}`);
      else toast.error(`Falha — ${r.message}`);
    },
  });

  useEffect(() => {
    if (integrations) {
      const sales = integrations.find((i: any) => i.provider === "sales_sheet");
      setSalesSheetUrl(sales?.accessToken ?? "");
    }
  }, [integrations]);

  const tabs = [
    { id: "meta" as const, label: "Meta Ads", icon: <Zap className="w-3.5 h-3.5" /> },
    { id: "instagram" as const, label: "Instagram", icon: <Instagram className="w-3.5 h-3.5" /> },
    { id: "vendas" as const, label: "Vendas", icon: <ShoppingCart className="w-3.5 h-3.5" /> },
    { id: "avancado" as const, label: "Avançado", icon: <Cpu className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "oklch(0.16 0.012 255)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: activeTab === tab.id ? "oklch(0.60 0.18 240 / 0.18)" : "transparent",
              color: activeTab === tab.id ? "oklch(0.80 0.18 240)" : "oklch(0.50 0.010 240)",
              border: activeTab === tab.id ? "1px solid oklch(0.60 0.18 240 / 0.35)" : "1px solid transparent",
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Meta Ads */}
      {activeTab === "meta" && (
        <div className="flex flex-col gap-3">
          <MetaTokenSection client={client} onConnected={refetchIntegrations} />
          {/* Conta Pré-paga */}
          <div
            className="flex items-center justify-between p-3 rounded-xl"
            style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.26 0.012 255)" }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-white">Conta Pré-paga (PIX/boleto)</span>
              <span className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>Ativa alertas no Telegram quando saldo ≤ R$ 100</span>
            </div>
            <button
            onClick={() => { const next = !isPrePaid; setIsPrePaid(next); setPrePaid.mutate({ clientId: client.id, isPrePaid: next }); }}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
              style={{ background: isPrePaid ? "oklch(0.68 0.16 160)" : "oklch(0.26 0.012 255)" }}
            >
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{ transform: isPrePaid ? "translateX(24px)" : "translateX(4px)" }} />
            </button>
          </div>
          {/* Tipos de campanha */}
          <div className="p-3 rounded-xl flex flex-col gap-2" style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.26 0.012 255)" }}>
            <span className="text-xs font-semibold text-white">Tipos de campanha</span>
            <div className="flex gap-2 flex-wrap">
              {CAMPAIGN_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleCampaignType(opt.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: campaignTypes.includes(opt.id) ? "oklch(0.60 0.18 240 / 0.20)" : "oklch(0.20 0.012 255)",
                    border: `1px solid ${campaignTypes.includes(opt.id) ? "oklch(0.60 0.18 240 / 0.5)" : "oklch(0.30 0.012 255)"}`,
                    color: campaignTypes.includes(opt.id) ? "oklch(0.80 0.18 240)" : "oklch(0.55 0.010 240)",
                  }}
                >
                  <span>{opt.emoji}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={savingCampaignTypes}
              onClick={() => { setSavingCampaignTypes(true); saveCampaignTypesMutation.mutate({ clientId: client.id, campaignTypes }); }}
              className="self-start px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
              style={{ background: "oklch(0.60 0.18 240)", color: "white", opacity: savingCampaignTypes ? 0.6 : 1 }}
            >
              {savingCampaignTypes ? "Salvando..." : "Salvar tipos"}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Instagram */}
      {activeTab === "instagram" && (
        <InstagramProfileSection client={client} />
      )}

      {/* Tab: Vendas */}
      {activeTab === "vendas" && (
        <div className="flex flex-col gap-4">
          <SheetRow
            label="Planilha de Vendas"
            accentColor="oklch(0.68 0.16 160)"
            columns="DATA · VENDAS · TOTAL EM VENDAS"
            columnNote="Formato DD/MM/AAAA"
            sheetUrl={salesSheetUrl}
            onSheetUrlChange={setSalesSheetUrl}
            onSave={() => saveIntegration.mutate({ clientId: client.id, provider: "sales_sheet", sheetUrl: salesSheetUrl })}
            onTest={() => testIntegration.mutate({ clientId: client.id, provider: "sales_sheet" })}
            onRemove={salesSheetUrl ? () => {
              if (confirm("Desvincular a planilha de vendas?")) {
                removeIntegration.mutate({ clientId: client.id, provider: "sales_sheet" });
                setSalesSheetUrl("");
              }
            } : undefined}
            saving={saveIntegration.isPending}
            testing={testIntegration.isPending}
          />

          {/* XLSX Upload */}
          <div className="p-4 rounded-xl flex flex-col gap-3" style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.26 0.012 255)" }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "oklch(0.68 0.16 160)" }} />
              <span className="text-sm font-semibold text-white">Dados de Vendas (Monday.com)</span>
            </div>
            {uploadInfo && (
              <div className="text-xs px-3 py-2 rounded-md" style={{ background: "oklch(0.68 0.16 160 / 0.10)", color: "oklch(0.75 0.14 160)" }}>
                Último upload: {new Date(uploadInfo.uploadedAt).toLocaleDateString("pt-BR")} · {uploadInfo.totalRecords} registros
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label
                className="flex items-center justify-center gap-2 py-2.5 rounded-md cursor-pointer text-xs font-medium transition-all"
                style={{ border: "2px dashed oklch(0.35 0.012 255)", color: "oklch(0.60 0.010 240)", background: xlsxFile ? "oklch(0.68 0.16 160 / 0.08)" : "transparent" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "oklch(0.68 0.16 160 / 0.5)"; e.currentTarget.style.color = "oklch(0.75 0.14 160)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "oklch(0.35 0.012 255)"; e.currentTarget.style.color = "oklch(0.60 0.010 240)"; }}
              >
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setXlsxFile(e.target.files?.[0] ?? null)} />
                {xlsxFile ? `📄 ${xlsxFile.name}` : "Selecionar arquivo XLSX"}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleXlsxUpload}
                  disabled={!xlsxFile || xlsxUploading}
                  className="flex-1 py-2 text-xs font-semibold rounded-md transition-all"
                  style={{ background: !xlsxFile || xlsxUploading ? "oklch(0.30 0.012 255)" : "oklch(0.68 0.16 160)", color: !xlsxFile || xlsxUploading ? "oklch(0.50 0.010 240)" : "white", cursor: !xlsxFile || xlsxUploading ? "not-allowed" : "pointer" }}
                >
                  {xlsxUploading ? "Importando..." : "Fazer Upload"}
                </button>
                {uploadInfo && (
                  <button
                    onClick={() => { if (confirm("Remover todos os dados importados do Monday.com para este cliente?")) clearSalesRecords.mutate({ clientId: client.id }); }}
                    className="px-3 py-2 text-xs font-medium rounded-md transition-all"
                    style={{ border: "1px solid oklch(0.55 0.18 25 / 0.4)", color: "oklch(0.65 0.18 25)", background: "transparent" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(0.55 0.18 25 / 0.12)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    Limpar dados
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs" style={{ color: "oklch(0.45 0.010 240)" }}>Exporte o board do Monday.com como XLSX e faça upload aqui.</p>
          </div>

          {/* Monday API Sync */}
          <div className="p-4 rounded-xl flex flex-col gap-3" style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.26 0.012 255)" }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "oklch(0.68 0.20 280)" }} />
              <span className="text-sm font-semibold text-white">Sincronização Direta Monday.com</span>
            </div>
            {mondayStatus.data?.boardId && (
              <div className="text-xs px-3 py-2 rounded-md" style={{ background: "oklch(0.68 0.20 280 / 0.10)", color: "oklch(0.75 0.18 280)" }}>
                Board: <span className="font-mono">{mondayStatus.data.boardId}</span>
                {mondayStatus.data.lastSync && <span className="ml-2 opacity-70">— última sync: {new Date(mondayStatus.data.lastSync).toLocaleString("pt-BR")}</span>}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Board ID (ex: 7171531533)"
                value={mondayBoardId || mondayStatus.data?.boardId || ""}
                onChange={(e) => setMondayBoardId(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-md outline-none"
                style={{ background: "oklch(0.22 0.012 255)", border: "1px solid oklch(0.30 0.012 255)", color: "white" }}
              />
              {mondayBoardId.trim() && mondayBoardId !== mondayStatus.data?.boardId && (
                <button
                  onClick={() => saveBoardId.mutate({ clientId: client.id, boardId: mondayBoardId.trim() })}
                  disabled={saveBoardId.isPending}
                  className="px-3 py-2 text-xs font-medium rounded-md transition-all"
                  style={{ background: "oklch(0.68 0.20 280 / 0.20)", color: "oklch(0.75 0.18 280)", border: "1px solid oklch(0.68 0.20 280 / 0.30)" }}
                >
                  {saveBoardId.isPending ? "..." : "Salvar"}
                </button>
              )}
            </div>
            <button
              onClick={handleSyncMonday}
              disabled={syncingMonday || (!mondayStatus.data?.boardId && !mondayBoardId.trim())}
              className="py-2.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2"
              style={{
                background: syncingMonday || (!mondayStatus.data?.boardId && !mondayBoardId.trim()) ? "oklch(0.30 0.012 255)" : "oklch(0.68 0.20 280)",
                color: syncingMonday || (!mondayStatus.data?.boardId && !mondayBoardId.trim()) ? "oklch(0.50 0.010 240)" : "white",
              }}
            >
              {syncingMonday ? (<><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Sincronizando...</>) : "Sincronizar tudo"}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Avançado */}
      {activeTab === "avancado" && (
        <div className="flex flex-col gap-4">
          {/* CAPI */}
          <div className="rounded-xl p-4" style={{ border: "1px solid oklch(0.45 0.18 280 / 0.3)", background: "oklch(0.45 0.18 280 / 0.05)" }}>
            <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.80 0.15 280)" }}>Rastreamento de Campanha (Meta CAPI)</p>
            <p className="text-xs mb-3" style={{ color: "oklch(0.50 0.010 240)" }}>Configure o Pixel ID e o Token da Conversions API para enviar eventos diretamente para o Meta.</p>
            <div className="flex flex-col gap-2">
              <div>
                <label className="text-xs font-medium" style={{ color: "oklch(0.65 0.010 240)" }}>Pixel ID</label>
                <input className="mt-1 w-full rounded-lg px-3 py-2 text-sm text-white" style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.26 0.012 255)" }} placeholder="Ex: 1234567890123456" value={capiPixelId} onChange={e => setCapiPixelId(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium" style={{ color: "oklch(0.65 0.010 240)" }}>Token da Conversions API</label>
                <input className="mt-1 w-full rounded-lg px-3 py-2 text-sm text-white" style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.26 0.012 255)" }} placeholder="EAAxxxxxxx..." value={capiToken} onChange={e => setCapiToken(e.target.value)} />
              </div>
              <button
                className="mt-1 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ background: capiSaving ? "oklch(0.35 0.12 280)" : "oklch(0.55 0.18 280)", opacity: capiSaving ? 0.7 : 1 }}
                disabled={capiSaving}
                onClick={() => { setCapiSaving(true); saveCAPIConfig.mutate({ clientId: client.id, pixelId: capiPixelId, capiToken }); }}
              >
                {capiSaving ? "Salvando..." : "Salvar"}
              </button>
              {(capiConfig as any)?.configured && (
                <p className="text-xs mt-1" style={{ color: "oklch(0.60 0.15 145)" }}>✓ Pixel configurado: {(capiConfig as any).metaPixelId}</p>
              )}
            </div>
          </div>
          {/* URL pública */}
          <SlugSection client={client} />

          {/* Grupo de WhatsApp */}
          <div className="mt-4 rounded-xl p-4" style={{ border: "1px solid oklch(0.45 0.18 145 / 0.3)", background: "oklch(0.45 0.18 145 / 0.05)" }}>
            <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.72 0.18 145)" }}>💬 Grupo de WhatsApp</p>
            <p className="text-xs mb-3" style={{ color: "oklch(0.50 0.010 240)" }}>Selecione o grupo de WhatsApp para envio automático de relatórios.</p>

            {/* Selected group display */}
            {whatsappGroupId && (
              <div className="mb-2 px-3 py-2 rounded-md text-xs flex items-center gap-2" style={{ background: "oklch(0.72 0.18 145 / 0.10)", color: "oklch(0.75 0.14 145)" }}>
                <span>✓ Grupo atual:</span>
                <span className="font-semibold">{selectedGroupName || whatsappGroupId}</span>
              </div>
            )}

            {/* Dropdown trigger */}
            {!showGroupDropdown ? (
              <button
                onClick={() => { setShowGroupDropdown(true); refetchGroups(); }}
                className="w-full py-2 text-xs font-semibold rounded-md transition-all"
                style={{ background: "oklch(0.72 0.18 145 / 0.15)", color: "oklch(0.72 0.18 145)", border: "1px solid oklch(0.72 0.18 145 / 0.3)" }}
              >
                {whatsappGroupId ? "🔄 Trocar grupo" : "📱 Selecionar grupo"}
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Buscar grupo..."
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    autoFocus
                    className="flex-1 px-3 py-2 text-xs rounded-md"
                    style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.30 0.012 255)", color: "white", outline: "none" }}
                  />
                  <button onClick={() => { setShowGroupDropdown(false); setGroupSearch(""); }} className="text-xs px-2 py-2 rounded-md" style={{ color: "oklch(0.55 0.010 240)" }}>X</button>
                </div>
                {loadingGroups ? (
                  <p className="text-xs text-center py-2" style={{ color: "oklch(0.55 0.010 240)" }}>Carregando grupos...</p>
                ) : filteredGroups.length === 0 ? (
                  <p className="text-xs text-center py-2" style={{ color: "oklch(0.55 0.010 240)" }}>Nenhum grupo encontrado</p>
                ) : (
                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                    {filteredGroups.map((g: { id: string; name: string }) => (
                      <button
                        key={g.id}
                        onClick={() => { setWhatsappGroupId(g.id); setShowGroupDropdown(false); setGroupSearch(""); }}
                        className="text-left px-3 py-2 rounded-md text-xs transition-all"
                        style={{
                          background: g.id === whatsappGroupId ? "oklch(0.72 0.18 145 / 0.20)" : "oklch(0.18 0.012 255)",
                          color: g.id === whatsappGroupId ? "oklch(0.75 0.14 145)" : "oklch(0.80 0.005 220)",
                          border: g.id === whatsappGroupId ? "1px solid oklch(0.72 0.18 145 / 0.4)" : "1px solid transparent",
                        }}
                      >
                        <span className="font-semibold">{g.name}</span>
                        <span className="ml-2 font-mono opacity-50">{g.id.split('@')[0]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Save button */}
            {whatsappGroupId && !showGroupDropdown && (
              <button
                onClick={() => { setSavingGroupId(true); saveGroupIdMutation.mutate({ clientId: client.id, groupId: whatsappGroupId }); }}
                disabled={savingGroupId}
                className="mt-2 w-full py-2 text-xs font-semibold rounded-md transition-all"
                style={{ background: savingGroupId ? "oklch(0.35 0.12 145)" : "oklch(0.55 0.18 145)", color: "white", opacity: savingGroupId ? 0.7 : 1 }}
              >
                {savingGroupId ? "Salvando..." : "Salvar grupo"}
              </button>
            )}
          </div>

          {/* Branding */}
          <BrandingSection client={client} />
          {/* Danger zone */}
          <div className="rounded-xl p-4" style={{ border: "1px solid oklch(0.55 0.18 25 / 0.25)", background: "oklch(0.55 0.18 25 / 0.04)" }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: "oklch(0.75 0.18 25)" }}>Remover cliente</p>
                <p className="text-xs mt-0.5" style={{ color: "oklch(0.50 0.010 240)" }}>Remove o cliente e todos os dados (integrações, sincronizações, histórico)</p>
              </div>
              <DeleteClientButton clientId={client.id} clientName={client.name} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Client Row with inline accordion (legacy, kept for reference) ────────────
function ClientRow({ client, userId }: { client: any; userId?: number }) {
  const [open, setOpen] = useState(false);
  const [salesSheetUrl, setSalesSheetUrl] = useState("");
  const [xlsxFile, setXlsxFile] = useState<File | null>(null);
  const [xlsxUploading, setXlsxUploading] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const [mondayBoardId, setMondayBoardId] = useState("");
  const [syncingMonday, setSyncingMonday] = useState(false);
  const [mondaySyncStart, setMondaySyncStart] = useState("");
  const [mondaySyncEnd, setMondaySyncEnd] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState(client.whatsappNumber ?? "");
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [isPrePaid, setIsPrePaid] = useState<boolean>(!!client.isPrePaid);
  const [capiPixelId, setCapiPixelId] = useState("");
  const [capiToken, setCapiToken] = useState("");
  const [capiSaving, setCapiSaving] = useState(false);

  const { data: capiConfig, refetch: refetchCapiConfig } = trpc.leadTracking.getCAPIConfig.useQuery(
    { clientId: client.id },
    { enabled: open }
  );
  // Sync CAPI config data into local state when loaded
  const capiConfigRef = useRef<any>(null);
  if (capiConfig && capiConfig !== capiConfigRef.current) {
    capiConfigRef.current = capiConfig;
    setCapiPixelId((capiConfig as any).metaPixelId || "");
    setCapiToken(""); // Token is masked, don't prefill
  }

  const saveCAPIConfig = trpc.leadTracking.saveCAPIConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuração CAPI salva!");
      refetchCapiConfig();
      setCapiSaving(false);
    },
    onError: (e: any) => {
      toast.error(e.message || "Erro ao salvar CAPI");
      setCapiSaving(false);
    },
  });

  const setPrePaid = trpc.dashboard.setPrePaid.useMutation({
    onSuccess: () => toast.success(isPrePaid ? "Marcado como pré-pago!" : "Removido pré-pago"),
    onError: (e) => toast.error(e.message),
  });

  const updateWhatsapp = trpc.dashboard.updateWhatsapp.useMutation({
    onSuccess: () => toast.success("WhatsApp salvo!"),
    onError: (e) => toast.error(e.message || "Erro ao salvar WhatsApp"),
  });

  const { data: uploadInfo, refetch: refetchUploadInfo } = trpc.sales.getUploadInfoAsAdmin.useQuery(
    { clientId: client.id },
    { enabled: open }
  );

  async function handleXlsxUpload() {
    if (!xlsxFile) return;
    setXlsxUploading(true);
    try {
      const buffer = await xlsxFile.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const res = await fetch(`/api/upload-sales/${client.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fileBase64: base64, fileName: xlsxFile.name }),
      });
      const data = await res.json();
      if (data.success) {
        setXlsxFile(null);
        refetchUploadInfo();
        toast.success(`${data.imported} registros importados com sucesso!`);
      } else {
        toast.error(data.error || "Erro ao importar planilha");
      }
    } catch {
      toast.error("Erro ao processar arquivo");
    } finally {
      setXlsxUploading(false);
    }
  }

  const { data: integrations, refetch: refetchIntegrations } = trpc.dashboard.getIntegrations.useQuery(
    { clientId: client.id },
    { enabled: open }
  );

  const saveIntegration = trpc.dashboard.saveIntegration.useMutation({
    onSuccess: () => { toast.success("Integração salva!"); refetchIntegrations(); },
    onError: () => toast.error("Erro ao salvar integração"),
  });

  const removeIntegration = trpc.dashboard.removeIntegration.useMutation({
    onSuccess: () => { toast.success("Integração removida!"); refetchIntegrations(); },
    onError: () => toast.error("Erro ao remover integração"),
  });

  const clearSalesRecords = trpc.dashboard.clearSalesRecords.useMutation({
    onSuccess: () => { toast.success("Dados do Monday removidos!"); refetchUploadInfo(); },
    onError: () => toast.error("Erro ao limpar dados"),
  });

  const mondayStatus = trpc.monday.getStatus.useQuery(
    { clientId: client.id },
    { enabled: open }
  );

  const saveBoardId = trpc.monday.saveBoardId.useMutation({
    onSuccess: () => { toast.success("Board ID salvo!"); mondayStatus.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const syncBoardMutation = trpc.monday.syncBoard.useMutation({
    onSuccess: (data) => {
      if (data.reason === "no_token") {
        toast.warning("Token do Monday.com não configurado. Vá em Configurações > Token Monday.com e salve o token.");
      } else if (data.reason === "no_board_id") {
        toast.warning("Este cliente não tem Board ID configurado.");
      } else if (data.reason) {
        toast.warning("Sync não realizado: " + data.reason);
      } else {
        toast.success(`Sincronizado! ${data.imported} registros importados.`);
      }
      mondayStatus.refetch();
      refetchUploadInfo();
      setSyncingMonday(false);
    },
    onError: (err) => {
      toast.error("Erro ao sincronizar: " + err.message);
      setSyncingMonday(false);
    },
  });

  const handleSyncMonday = () => {
    const boardId = mondayStatus.data?.boardId || mondayBoardId.trim();
    if (!boardId) { toast.error("Informe o Board ID do Monday.com"); return; }
    setSyncingMonday(true);
    syncBoardMutation.mutate({
      clientId: client.id,
      boardId,
      startDate: mondaySyncStart ? new Date(mondaySyncStart + "T00:00:00") : undefined,
      endDate: mondaySyncEnd ? new Date(mondaySyncEnd + "T23:59:59") : undefined,
    });
  };

  const testIntegration = trpc.dashboard.testIntegration.useMutation({
    onSuccess: (r) => {
      if (r.success) toast.success(`Conexão OK — ${r.message}`);
      else toast.error(`Falha — ${r.message}`);
    },
  });

  useEffect(() => {
    if (integrations) {
      const sales = integrations.find((i: any) => i.provider === "sales_sheet");
      setSalesSheetUrl(sales?.accessToken ?? "");
    }
  }, [integrations]);

  // Scroll into view when opened
  useEffect(() => {
    if (open && rowRef.current) {
      setTimeout(() => {
        rowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [open]);

  return (
    <div
      ref={rowRef}
      className="rounded-xl overflow-hidden transition-all"
      style={{
        border: `1px solid ${open ? "oklch(0.60 0.18 240 / 0.35)" : "oklch(0.28 0.012 255)"}`,
        background: "oklch(0.20 0.012 255)",
      }}
    >
      {/* Header row */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setOpen(!open)}
        style={{ background: open ? "oklch(0.60 0.18 240 / 0.06)" : "transparent" }}
      >
        <div className="flex items-center gap-3">
          {open && (
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.60 0.18 240)" }} />
          )}
          <span className="text-lg font-semibold" style={{ color: open ? "white" : "oklch(0.85 0.005 220)" }}>
            {client.name}
          </span>
        </div>
        <div
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md"
          style={{
            border: "1px solid oklch(0.30 0.012 255)",
            color: open ? "oklch(0.80 0.18 240)" : "oklch(0.55 0.010 240)",
            background: open ? "oklch(0.60 0.18 240 / 0.12)" : "transparent",
          }}
        >
          {open ? <><ChevronUp className="w-3.5 h-3.5" /> Fechar</> : <><ChevronDown className="w-3.5 h-3.5" /> Configurar</>}
        </div>
      </div>

      {/* Inline integration section */}
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3" style={{ borderTop: "1px solid oklch(0.26 0.012 255)" }}>

          {/* ── Meta API Token (new, recommended) ── */}
          <div className="pt-3 pb-1 text-xs font-semibold uppercase tracking-widest flex items-center gap-2" style={{ color: "oklch(0.75 0.18 60)" }}>
            <Zap className="w-3 h-3" />
            Conexão Automática (Recomendado)
          </div>

          <MetaTokenSection client={client} onConnected={refetchIntegrations} />

          {/* ── Conta Pré-paga (alerta de saldo) ── */}
          <div
            className="flex items-center justify-between p-3 rounded-xl"
            style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.26 0.012 255)" }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-white">Conta Pré-paga (PIX/boleto)</span>
              <span className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>
                Ativa alertas no Telegram quando saldo ≤ R$ 100
              </span>
            </div>
            <button
              onClick={() => {
                const next = !isPrePaid;
                setIsPrePaid(next);
                setPrePaid.mutate({ clientId: client.id, isPrePaid: next });
              }}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
              style={{
                background: isPrePaid ? "oklch(0.68 0.16 160)" : "oklch(0.26 0.012 255)",
              }}
            >
              <span
                className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                style={{ transform: isPrePaid ? "translateX(24px)" : "translateX(4px)" }}
              />
            </button>
          </div>

          <InstagramProfileSection client={client} />

          {/* ── Divider ── */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px" style={{ background: "oklch(0.26 0.012 255)" }} />
            <span className="text-xs" style={{ color: "oklch(0.40 0.010 240)" }}>planilha de vendas (manual)</span>
            <div className="flex-1 h-px" style={{ background: "oklch(0.26 0.012 255)" }} />
          </div>

          <SheetRow
            label="Planilha de Vendas"
            accentColor="oklch(0.68 0.16 160)"
            columns="DATA · VENDAS · TOTAL EM VENDAS"
            columnNote="Formato DD/MM/AAAA"
            sheetUrl={salesSheetUrl}
            onSheetUrlChange={setSalesSheetUrl}
            onSave={() => saveIntegration.mutate({ clientId: client.id, provider: "sales_sheet", sheetUrl: salesSheetUrl })}
            onTest={() => testIntegration.mutate({ clientId: client.id, provider: "sales_sheet" })}
            onRemove={salesSheetUrl ? () => {
              if (confirm("Desvincular a planilha de vendas?")) {
                removeIntegration.mutate({ clientId: client.id, provider: "sales_sheet" });
                setSalesSheetUrl("");
              }
            } : undefined}
            saving={saveIntegration.isPending}
            testing={testIntegration.isPending}
          />

          {/* ── Divider ── */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px" style={{ background: "oklch(0.26 0.012 255)" }} />
            <span className="text-xs" style={{ color: "oklch(0.40 0.010 240)" }}>upload monday.com (xlsx)</span>
            <div className="flex-1 h-px" style={{ background: "oklch(0.26 0.012 255)" }} />
          </div>

          {/* ── XLSX Upload ── */}
          <div
            className="p-4 rounded-xl flex flex-col gap-3"
            style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.26 0.012 255)" }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "oklch(0.68 0.16 160)" }} />
              <span className="text-sm font-semibold text-white">Dados de Vendas (Monday.com)</span>
            </div>

            {uploadInfo && (
              <div className="text-xs px-3 py-2 rounded-md" style={{ background: "oklch(0.68 0.16 160 / 0.10)", color: "oklch(0.75 0.14 160)" }}>
                Último upload: {new Date(uploadInfo.uploadedAt).toLocaleDateString("pt-BR")} · {uploadInfo.totalRecords} registros
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label
                className="flex items-center justify-center gap-2 py-2.5 rounded-md cursor-pointer text-xs font-medium transition-all"
                style={{ border: "2px dashed oklch(0.35 0.012 255)", color: "oklch(0.60 0.010 240)", background: xlsxFile ? "oklch(0.68 0.16 160 / 0.08)" : "transparent" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "oklch(0.68 0.16 160 / 0.5)"; e.currentTarget.style.color = "oklch(0.75 0.14 160)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "oklch(0.35 0.012 255)"; e.currentTarget.style.color = "oklch(0.60 0.010 240)"; }}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setXlsxFile(e.target.files?.[0] ?? null)}
                />
                {xlsxFile ? `📄 ${xlsxFile.name}` : "Selecionar arquivo XLSX"}
              </label>

              <div className="flex gap-2">
                <button
                  onClick={handleXlsxUpload}
                  disabled={!xlsxFile || xlsxUploading}
                  className="flex-1 py-2 text-xs font-semibold rounded-md transition-all"
                  style={{
                    background: !xlsxFile || xlsxUploading ? "oklch(0.30 0.012 255)" : "oklch(0.68 0.16 160)",
                    color: !xlsxFile || xlsxUploading ? "oklch(0.50 0.010 240)" : "white",
                    cursor: !xlsxFile || xlsxUploading ? "not-allowed" : "pointer",
                  }}
                >
                  {xlsxUploading ? "Importando..." : "Fazer Upload"}
                </button>
                {uploadInfo && (
                  <button
                    onClick={() => {
                      if (confirm("Remover todos os dados importados do Monday.com para este cliente?")) {
                        clearSalesRecords.mutate({ clientId: client.id });
                      }
                    }}
                    className="px-3 py-2 text-xs font-medium rounded-md transition-all"
                    style={{
                      border: "1px solid oklch(0.55 0.18 25 / 0.4)",
                      color: "oklch(0.65 0.18 25)",
                      background: "transparent",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "oklch(0.55 0.18 25 / 0.12)";
                      e.currentTarget.style.color = "oklch(0.75 0.18 25)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "oklch(0.65 0.18 25)";
                    }}
                  >
                    Limpar dados
                  </button>
                )}
              </div>
            </div>

            <p className="text-xs" style={{ color: "oklch(0.45 0.010 240)" }}>
              Exporte o board do Monday.com como XLSX e faça upload aqui. Os dados de Consultas e Fechamentos serão atualizados automaticamente.
            </p>
          </div>

          {/* ── Divider ── */}
          <div className="flex items-center gap-3 py-1">
            <div className="flex-1 h-px" style={{ background: "oklch(0.26 0.012 255)" }} />
            <span className="text-xs" style={{ color: "oklch(0.40 0.010 240)" }}>sincronização direta monday api</span>
            <div className="flex-1 h-px" style={{ background: "oklch(0.26 0.012 255)" }} />
          </div>

          {/* ── Monday API Sync ── */}
          <div
            className="p-4 rounded-xl flex flex-col gap-3"
            style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.26 0.012 255)" }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "oklch(0.68 0.20 280)" }} />
              <span className="text-sm font-semibold text-white">🔄 Sincronização Direta Monday.com</span>
            </div>

            {mondayStatus.data?.boardId && (
              <div className="text-xs px-3 py-2 rounded-md" style={{ background: "oklch(0.68 0.20 280 / 0.10)", color: "oklch(0.75 0.18 280)" }}>
                Board: <span className="font-mono">{mondayStatus.data.boardId}</span>
                {mondayStatus.data.lastSync && (
                  <span className="ml-2 opacity-70">— última sync: {new Date(mondayStatus.data.lastSync).toLocaleString("pt-BR")}</span>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Board ID (ex: 7171531533)"
                value={mondayBoardId || mondayStatus.data?.boardId || ""}
                onChange={(e) => setMondayBoardId(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-md font-mono"
                style={{ background: "oklch(0.22 0.012 255)", border: "1px solid oklch(0.30 0.012 255)", color: "white", outline: "none" }}
              />
              {mondayBoardId.trim() && mondayBoardId !== mondayStatus.data?.boardId && (
                <button
                  onClick={() => saveBoardId.mutate({ clientId: client.id, boardId: mondayBoardId.trim() })}
                  disabled={saveBoardId.isPending}
                  className="px-3 py-2 text-xs font-medium rounded-md transition-all"
                  style={{ background: "oklch(0.68 0.20 280 / 0.20)", color: "oklch(0.75 0.18 280)", border: "1px solid oklch(0.68 0.20 280 / 0.30)" }}
                >
                  {saveBoardId.isPending ? "..." : "Salvar"}
                </button>
              )}
            </div>

            <button
              onClick={handleSyncMonday}
              disabled={syncingMonday || (!mondayStatus.data?.boardId && !mondayBoardId.trim())}
              className="py-2.5 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2"
              style={{
                background: syncingMonday || (!mondayStatus.data?.boardId && !mondayBoardId.trim())
                  ? "oklch(0.30 0.012 255)"
                  : "oklch(0.68 0.20 280)",
                color: syncingMonday || (!mondayStatus.data?.boardId && !mondayBoardId.trim())
                  ? "oklch(0.50 0.010 240)"
                  : "white",
                cursor: syncingMonday || (!mondayStatus.data?.boardId && !mondayBoardId.trim()) ? "not-allowed" : "pointer",
              }}
            >
              {syncingMonday ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Sincronizando... (pode levar até 1 min)
                </>
              ) : "🔄 Sincronizar tudo"}
            </button>

            <p className="text-xs" style={{ color: "oklch(0.45 0.010 240)" }}>
              Sincroniza os dados diretamente do board do Monday.com via API. O período é filtrado automaticamente pelo dashboard.
            </p>
          </div>
        </div>
      )}

      {/* ── Meta CAPI: Pixel ID e Token ── */}
      <div className="mt-4 rounded-xl p-4" style={{ border: "1px solid oklch(0.45 0.18 280 / 0.3)", background: "oklch(0.45 0.18 280 / 0.05)" }}>
        <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.80 0.15 280)" }}>📡 Rastreamento de Campanha (Meta CAPI)</p>
        <p className="text-xs mb-3" style={{ color: "oklch(0.50 0.010 240)" }}>Configure o Pixel ID e o Token da Conversions API para enviar eventos de Lead, Agendamento e Fechamento diretamente para o Meta.</p>
        <div className="flex flex-col gap-2">
          <div>
            <label className="text-xs font-medium" style={{ color: "oklch(0.65 0.010 240)" }}>Pixel ID</label>
            <input
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm text-white"
              style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.26 0.012 255)" }}
              placeholder="Ex: 1234567890123456"
              value={capiPixelId}
              onChange={e => setCapiPixelId(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: "oklch(0.65 0.010 240)" }}>Token da Conversions API</label>
            <input
              className="mt-1 w-full rounded-lg px-3 py-2 text-sm text-white"
              style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.26 0.012 255)" }}
              placeholder="EAAxxxxxxx..."
              value={capiToken}
              onChange={e => setCapiToken(e.target.value)}
            />
          </div>
          <button
            className="mt-1 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: capiSaving ? "oklch(0.35 0.12 280)" : "oklch(0.55 0.18 280)", opacity: capiSaving ? 0.7 : 1 }}
            disabled={capiSaving}
            onClick={() => { setCapiSaving(true); saveCAPIConfig.mutate({ clientId: client.id, pixelId: capiPixelId, capiToken }); }}
          >
            {capiSaving ? "Salvando..." : "Salvar"}
          </button>
          {(capiConfig as any)?.configured && (
            <p className="text-xs mt-1" style={{ color: "oklch(0.60 0.15 145)" }}>✓ Pixel configurado: {(capiConfig as any).metaPixelId}</p>
          )}
        </div>
      </div>

      {/* ── Slug: URL amigável do relatório público ── */}
      <SlugSection client={client} />
      {/* ── Danger Zone: Remover cliente ── */}
      <div className="mt-4 rounded-xl p-4" style={{ border: "1px solid oklch(0.55 0.18 25 / 0.25)", background: "oklch(0.55 0.18 25 / 0.04)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: "oklch(0.75 0.18 25)" }}>Remover cliente</p>
            <p className="text-xs mt-0.5" style={{ color: "oklch(0.50 0.010 240)" }}>Remove o cliente e todos os dados (integrações, sincronizações, histórico)</p>
          </div>
          <DeleteClientButton clientId={client.id} clientName={client.name} />
        </div>
      </div>

    </div>
  );
}

// ─── Branding Section ───────────────────────────────────────────────────────────────────
function BrandingSection({ client }: { client: any }) {
  const utils = trpc.useUtils();
  const [previewUrl, setPreviewUrl] = useState<string | null>(client.logoUrl || null);
  const [color, setColor] = useState<string>(client.brandColor || "#7c3aed");
  const [uploading, setUploading] = useState(false);

  const uploadLogo = trpc.dashboard.uploadClientLogo.useMutation({
    onSuccess: (data) => {
      setPreviewUrl(data.url);
      utils.dashboard.getClients.invalidate();
      toast.success("Logo salvo com sucesso!");
    },
    onError: (e) => toast.error("Erro ao salvar logo: " + e.message),
  });

  const updateBranding = trpc.dashboard.updateClientBranding.useMutation({
    onSuccess: () => {
      utils.dashboard.getClients.invalidate();
      toast.success("Cor da marca salva!");
    },
    onError: (e) => toast.error("Erro ao salvar cor: " + e.message),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Imagem muito grande. Máximo 2MB."); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setPreviewUrl(base64);
      await uploadLogo.mutateAsync({ clientId: client.id, base64, mimeType: file.type });
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setPreviewUrl(null);
    updateBranding.mutate({ clientId: client.id, logoUrl: null });
  };

  const handleColorSave = () => {
    updateBranding.mutate({ clientId: client.id, brandColor: color });
  };

  return (
    <div className="mt-4 rounded-xl p-4" style={{ border: "1px solid oklch(0.30 0.012 255)", background: "oklch(0.14 0.008 255)" }}>
      <p className="text-sm font-semibold mb-3" style={{ color: "oklch(0.85 0.010 240)" }}>Identidade Visual do Relatório</p>
      <div className="flex flex-col gap-4">
        {/* Logo */}
        <div>
          <p className="text-xs mb-2" style={{ color: "oklch(0.55 0.010 240)" }}>Logo da clínica (exibido no relatório público)</p>
          <div className="flex items-center gap-3">
            {previewUrl ? (
              <div className="relative w-16 h-16 rounded-lg overflow-hidden" style={{ border: "1px solid oklch(0.30 0.012 255)" }}>
                <img src={previewUrl} alt="Logo" className="w-full h-full object-contain" style={{ background: "white" }} />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg flex items-center justify-center" style={{ border: "1px dashed oklch(0.35 0.012 255)", background: "oklch(0.12 0.008 255)" }}>
                <span className="text-xs" style={{ color: "oklch(0.45 0.010 240)" }}>Sem logo</span>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="cursor-pointer px-3 py-1.5 text-xs font-medium rounded-md transition-all" style={{ background: "oklch(0.22 0.012 255)", color: "oklch(0.75 0.010 240)", border: "1px solid oklch(0.30 0.012 255)" }}>
                {uploading ? "Enviando..." : "Escolher imagem"}
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
              </label>
              {previewUrl && (
                <button onClick={handleRemoveLogo} className="px-3 py-1.5 text-xs rounded-md" style={{ color: "oklch(0.65 0.18 25)", background: "transparent" }}>
                  Remover logo
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Brand Color */}
        <div>
          <p className="text-xs mb-2" style={{ color: "oklch(0.55 0.010 240)" }}>Cor do tema (usada nos cards e destaques do relatório público)</p>
          {/* Preset palette */}
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { hex: "#e63946", label: "Vermelho" },
              { hex: "#7c3aed", label: "Roxo" },
              { hex: "#2563eb", label: "Azul" },
              { hex: "#0891b2", label: "Ciano" },
              { hex: "#059669", label: "Verde" },
              { hex: "#d97706", label: "Âmbar" },
              { hex: "#ea580c", label: "Laranja" },
              { hex: "#db2777", label: "Rosa" },
              { hex: "#7c3aed", label: "Índigo" },
              { hex: "#64748b", label: "Cinza" },
            ].map((preset) => (
              <button
                key={preset.hex}
                title={preset.label}
                onClick={() => setColor(preset.hex)}
                className="w-8 h-8 rounded-lg transition-all flex-shrink-0"
                style={{
                  background: preset.hex,
                  border: color === preset.hex ? "3px solid white" : "2px solid transparent",
                  boxShadow: color === preset.hex ? `0 0 0 2px ${preset.hex}` : "none",
                  transform: color === preset.hex ? "scale(1.15)" : "scale(1)",
                }}
              />
            ))}
          </div>
          {/* Custom color picker + preview */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div
                className="w-10 h-10 rounded-lg cursor-pointer flex items-center justify-center text-white text-xs font-bold"
                style={{ background: color, border: "2px solid oklch(0.35 0.012 255)" }}
                title="Escolher cor personalizada"
              >
                +
              </div>
            </div>
            <span className="text-xs font-mono" style={{ color: "oklch(0.65 0.010 240)" }}>{color}</span>
            {/* Mini preview */}
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "oklch(0.12 0.008 255)", border: "1px solid oklch(0.22 0.012 255)" }}>
              <div className="w-3 h-3 rounded-full" style={{ background: color }} />
              <span className="text-xs" style={{ color: "oklch(0.55 0.010 240)" }}>Preview</span>
              <div className="ml-auto text-xs font-bold" style={{ color }}>R$ 1.452</div>
            </div>
            <button
              onClick={handleColorSave}
              disabled={updateBranding.isPending}
              className="px-3 py-2 text-xs font-semibold rounded-lg transition-all flex-shrink-0"
              style={{ background: color, color: "white", opacity: updateBranding.isPending ? 0.6 : 1 }}
            >
              {updateBranding.isPending ? "..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Slug Section ─────────────────────────────────────────────────────────────────────────────
function SlugSection({ client }: { client: any }) {
  const utils = trpc.useUtils();
  const [slug, setSlug] = useState<string>(client.slug || "");
  const [error, setError] = useState<string | null>(null);

  const updateSlug = trpc.dashboard.updateClientSlug.useMutation({
    onSuccess: (data) => {
      toast.success(`Identificador atualizado: ${data.slug}`);
      utils.dashboard.getClients.invalidate();
      setError(null);
    },
    onError: (e) => setError(e.message),
  });

  const regeneratePublicToken = trpc.dashboard.regeneratePublicReportToken.useMutation({
    onSuccess: () => {
      toast.success("Link seguro regenerado. Qualquer link anterior deixou de funcionar.");
      utils.dashboard.getClients.invalidate();
    },
    onError: (e) => toast.error(e.message || "Não foi possível regenerar o link"),
  });

  const handleSave = () => {
    const cleaned = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,60}$/.test(cleaned)) {
      setError("Use apenas letras minúsculas, números e hífens (2-60 caracteres)");
      return;
    }
    setError(null);
    updateSlug.mutate({ clientId: client.id, slug: cleaned });
  };

  return (
    <div className="mt-4 rounded-xl p-4" style={{ border: "1px solid oklch(0.30 0.012 255)", background: "oklch(0.14 0.008 255)" }}>
      <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.85 0.010 240)" }}>Identificador interno do cliente</p>
      <p className="text-xs mb-3" style={{ color: "oklch(0.50 0.010 240)" }}>Use este nome apenas para organização. O link público compartilhável usa um token seguro e não é previsível.</p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          placeholder="ex: drtatiana"
          className="flex-1 px-3 py-1.5 text-xs font-mono rounded-md"
          style={{ background: "oklch(0.20 0.012 255)", border: "1px solid oklch(0.30 0.012 255)", color: "oklch(0.90 0.005 220)", outline: "none" }}
        />
        <button
          onClick={handleSave}
          disabled={updateSlug.isPending}
          className="px-3 py-1.5 text-xs font-medium rounded-md transition-all shrink-0"
          style={{ background: "oklch(0.22 0.012 255)", color: "oklch(0.75 0.010 240)", border: "1px solid oklch(0.30 0.012 255)" }}
        >
          {updateSlug.isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
      {error && <p className="text-xs mt-2" style={{ color: "oklch(0.65 0.18 25)" }}>{error}</p>}
      <div className="mt-4 pt-4" style={{ borderTop: "1px solid oklch(0.30 0.012 255)" }}>
        <p className="text-xs mb-2" style={{ color: "oklch(0.50 0.010 240)" }}>Se o link tiver sido enviado à pessoa errada, gere outro para invalidar imediatamente o anterior.</p>
        <button
          onClick={() => {
            if (window.confirm("Regenerar o link seguro? O link anterior vai parar de funcionar.")) {
              regeneratePublicToken.mutate({ clientId: client.id });
            }
          }}
          disabled={regeneratePublicToken.isPending}
          className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
          style={{ background: "oklch(0.65 0.22 25 / 0.14)", color: "oklch(0.72 0.18 25)", border: "1px solid oklch(0.65 0.22 25 / 0.4)", opacity: regeneratePublicToken.isPending ? 0.6 : 1 }}
        >
          {regeneratePublicToken.isPending ? "Regenerando..." : "Regenerar link seguro"}
        </button>
      </div>
    </div>
  );
}

// ─── Delete Client Button ─────────────────────────────────────────────────────
function DeleteClientButton({ clientId, clientName }: { clientId: number; clientName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const deleteClient = trpc.dashboard.deleteClient.useMutation({
    onSuccess: () => {
      toast.success(`Cliente "${clientName}" removido com sucesso`);
      utils.dashboard.getClients.invalidate();
      navigate("/settings");
    },
    onError: (e) => toast.error(`Erro ao remover: ${e.message}`),
  });

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: "oklch(0.75 0.18 25)" }}>Tem certeza?</span>
        <button
          onClick={() => deleteClient.mutate({ clientId })}
          disabled={deleteClient.isPending}
          className="px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
          style={{ background: "oklch(0.55 0.22 25)", color: "white" }}
        >
          {deleteClient.isPending ? "Removendo..." : "Sim, remover"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 text-xs font-medium rounded-md transition-all"
          style={{ border: "1px solid oklch(0.30 0.012 255)", color: "oklch(0.60 0.010 240)", background: "transparent" }}
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all"
      style={{ border: "1px solid oklch(0.55 0.18 25 / 0.4)", color: "oklch(0.65 0.18 25)", background: "transparent" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(0.55 0.18 25 / 0.12)"; e.currentTarget.style.color = "oklch(0.75 0.18 25)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "oklch(0.65 0.18 25)"; }}
    >
      <Trash2 className="w-3.5 h-3.5" />
      Remover
    </button>
  );
}

// ─── Monday.com Global Token Section ────────────────────────────────────────────
function MondayTokenSection() {
  const [token, setToken] = useState("");
  const [showInput, setShowInput] = useState(false);

  const { data: tokenData, refetch } = trpc.system.getMondayToken.useQuery();

  const setMondayToken = trpc.system.setMondayToken.useMutation({
    onSuccess: () => {
      toast.success("Token Monday.com salvo! Agora todos os clientes podem sincronizar.");
      setToken("");
      setShowInput(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMondayToken = trpc.system.removeMondayToken.useMutation({
    onSuccess: () => { toast.success("Token removido."); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "oklch(0.55 0.010 240)" }}>
          Integração Monday.com
        </span>
        <div className="flex-1 h-px" style={{ background: "oklch(0.28 0.012 255)" }} />
      </div>

      <div className="p-4 rounded-xl" style={{ background: "oklch(0.17 0.012 255)", border: "1px solid oklch(0.25 0.012 255)" }}>
        <p className="text-sm mb-3" style={{ color: "oklch(0.65 0.010 240)" }}>
          Configure o token de API do Monday.com uma única vez. Ele será usado para sincronizar todos os clientes que tiverem um Board ID configurado.
        </p>

        {tokenData?.hasToken ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-md text-sm" style={{ background: "oklch(0.20 0.012 255)", border: "1px solid oklch(0.30 0.012 255)", color: "oklch(0.70 0.010 240)" }}>
              <span className="text-green-400">&#10003;</span>
              Token configurado: {tokenData.maskedToken}
            </div>
            <button
              onClick={() => removeMondayToken.mutate()}
              className="px-3 py-2 text-xs rounded-md transition-all"
              style={{ background: "oklch(0.22 0.015 20)", color: "oklch(0.70 0.15 20)", border: "1px solid oklch(0.30 0.015 20)" }}
            >
              Remover
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {!showInput ? (
              <button
                onClick={() => setShowInput(true)}
                className="px-4 py-2 text-sm rounded-md font-medium transition-all w-fit"
                style={{ background: "oklch(0.55 0.18 290)", color: "white" }}
              >
                + Configurar Token Monday.com
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Cole o token de API do Monday.com..."
                  className="flex-1 px-3 py-2 text-sm rounded-md outline-none"
                  style={{ background: "oklch(0.18 0.012 255)", border: "1px solid oklch(0.30 0.012 255)", color: "oklch(0.90 0.005 220)" }}
                />
                <button
                  onClick={() => setMondayToken.mutate({ token })}
                  disabled={!token.trim() || setMondayToken.isPending}
                  className="px-4 py-2 text-sm rounded-md font-medium transition-all"
                  style={{ background: "oklch(0.55 0.18 290)", color: "white", opacity: !token.trim() ? 0.5 : 1 }}
                >
                  {setMondayToken.isPending ? "Salvando..." : "Salvar"}
                </button>
                <button
                  onClick={() => { setShowInput(false); setToken(""); }}
                  className="px-3 py-2 text-sm rounded-md"
                  style={{ background: "oklch(0.20 0.012 255)", color: "oklch(0.60 0.010 240)" }}
                >
                  Cancelar
                </button>
              </div>
            )}
            <p className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>
              Obtenha o token em: monday.com → Perfil → Administração → API
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Main Settings ────────────────────────────────────────────────────────────
// ─── Managers Section ────────────────────────────────────────────────────────
function ManagersSection({ clients }: { clients: any[] }) {
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showForm, setShowForm] = useState(false);
  const utils = trpc.useUtils();

  const { data: managers, refetch } = trpc.managers.list.useQuery();

  const createManager = trpc.managers.create.useMutation({
    onSuccess: () => {
      toast.success("Gestor criado com sucesso!");
      setNewName(""); setNewEmail(""); setNewPassword(""); setShowForm(false);
      refetch();
    },
    onError: (e) => toast.error(e.message || "Erro ao criar gestor"),
  });

  const deleteManager = trpc.managers.delete.useMutation({
    onSuccess: () => { toast.success("Gestor removido"); refetch(); },
    onError: () => toast.error("Erro ao remover gestor"),
  });

  const assignClients = trpc.managers.assignClients.useMutation({
    onSuccess: () => { toast.success("Cliente atribuído!"); refetch(); },
    onError: () => toast.error("Erro ao atribuir cliente"),
  });

  const copyPublicLink = (token: string, slug?: string | null) => {
    const identifier = slug || token;
    const url = `${window.location.origin}/r/${identifier}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "oklch(0.55 0.010 240)" }}>
          Gestores ({managers?.length ?? 0})
        </span>
        <div className="flex-1 h-px" style={{ background: "oklch(0.28 0.012 255)" }} />
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-all"
          style={{ background: "oklch(0.60 0.18 240 / 0.15)", color: "oklch(0.75 0.18 240)", border: "1px solid oklch(0.60 0.18 240 / 0.35)" }}
        >
          <Plus className="w-3 h-3" />
          Novo gestor
        </button>
      </div>

      {/* Form to add manager */}
      {showForm && (
        <div className="mb-4 p-4 rounded-xl flex flex-col gap-3" style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.30 0.012 255)" }}>
          <p className="text-xs font-semibold text-white">Novo Gestor</p>
          <div className="grid grid-cols-1 gap-2">
            <Input value={newName} onChange={setNewName} placeholder="Nome completo" />
            <Input value={newEmail} onChange={setNewEmail} placeholder="E-mail" type="email" />
            <Input value={newPassword} onChange={setNewPassword} placeholder="Senha" type="password" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createManager.mutate({ name: newName, email: newEmail, password: newPassword })}
              disabled={!newName || !newEmail || !newPassword || createManager.isPending}
              className="flex-1 py-2 text-xs font-semibold rounded-md"
              style={{ background: "oklch(0.60 0.18 240)", color: "white", opacity: (!newName || !newEmail || !newPassword) ? 0.5 : 1 }}
            >
              {createManager.isPending ? "Criando..." : "Criar gestor"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs rounded-md"
              style={{ border: "1px solid oklch(0.30 0.012 255)", color: "oklch(0.55 0.010 240)" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Manager list */}
      <div className="flex flex-col gap-3">
        {managers?.map((m: any) => (
          <ManagerRow
            key={m.id}
            manager={m}
            allClients={clients}
            onDelete={() => deleteManager.mutate({ managerId: m.id })}
            onAssign={(clientId) => {
              const currentIds = (m.clients ?? []).map((c: any) => c.id);
              assignClients.mutate({ managerId: m.id, clientIds: [...currentIds, clientId] });
            }}
            onRemoveClient={(clientId) => {
              const currentIds = (m.clients ?? []).map((c: any) => c.id).filter((id: number) => id !== clientId);
              assignClients.mutate({ managerId: m.id, clientIds: currentIds });
            }}
            onCopyLink={(token: string, slug?: string | null) => copyPublicLink(token, slug)}
          />
        ))}
        {(!managers || managers.length === 0) && (
          <div className="py-6 text-center text-sm" style={{ color: "oklch(0.40 0.010 240)" }}>
            Nenhum gestor cadastrado. Adicione um para dar acesso à equipe.
          </div>
        )}
      </div>
    </section>
  );
}

function ManagerRow({ manager, allClients, onDelete, onAssign, onRemoveClient, onCopyLink }: {
  manager: any;
  allClients: any[];
  onDelete: () => void;
  onAssign: (clientId: number) => void;
  onRemoveClient: (clientId: number) => void;
  onCopyLink: (token: string, slug?: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const assignedIds = new Set((manager.clients ?? []).map((c: any) => c.id));
  const unassigned = allClients.filter(c => !assignedIds.has(c.id));

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.26 0.012 255)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        style={{ background: "oklch(0.16 0.012 255)" }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "oklch(0.60 0.18 240 / 0.2)", color: "oklch(0.75 0.18 240)" }}>
            {manager.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{manager.name}</p>
            <p className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>{manager.email} · {(manager.clients ?? []).length} cliente(s)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm(`Remover gestor ${manager.name}?`)) onDelete(); }}
            className="p-1.5 rounded-md transition-all"
            style={{ color: "oklch(0.55 0.18 20)", background: "oklch(0.65 0.18 20 / 0.08)" }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4" style={{ color: "oklch(0.50 0.010 240)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "oklch(0.50 0.010 240)" }} />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 pt-3 flex flex-col gap-4" style={{ background: "oklch(0.13 0.012 255)", borderTop: "1px solid oklch(0.22 0.012 255)" }}>
          {/* Assigned clients */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: "oklch(0.55 0.010 240)" }}>Clientes atribuídos</p>
            {(manager.clients ?? []).length === 0 ? (
              <p className="text-xs" style={{ color: "oklch(0.40 0.010 240)" }}>Nenhum cliente atribuído ainda.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {(manager.clients ?? []).map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "oklch(0.17 0.012 255)" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {c.publicToken && (
                        <button
                          onClick={() => onCopyLink(c.publicToken, c.slug)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-md"
                          style={{ background: "oklch(0.60 0.18 195 / 0.12)", color: "oklch(0.72 0.18 195)" }}
                          title="Copiar link do cliente"
                        >
                          <Link className="w-3 h-3" />
                          Copiar link
                        </button>
                      )}
                      <button
                        onClick={() => onRemoveClient(c.id)}
                        className="p-1 rounded-md"
                        style={{ color: "oklch(0.55 0.18 20)", background: "oklch(0.65 0.18 20 / 0.08)" }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add client */}
          {unassigned.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: "oklch(0.55 0.010 240)" }}>Adicionar cliente</p>
              <div className="flex flex-col gap-1">
                {unassigned.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => onAssign(c.id)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-all"
                    style={{ background: "oklch(0.17 0.012 255)", color: "oklch(0.70 0.010 240)", border: "1px dashed oklch(0.30 0.012 255)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "oklch(0.60 0.18 240 / 0.5)"; e.currentTarget.style.color = "white"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "oklch(0.30 0.012 255)"; e.currentTarget.style.color = "oklch(0.70 0.010 240)"; }}
                  >
                    <Plus className="w-3 h-3" />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Client Status Card ───────────────────────────────────────────────────────
function ClientStatusCard({ client, selected, onClick }: { client: any; selected: boolean; onClick: () => void }) {
  const initials = client.name
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  const hasMeta = !!client.adAccountId;
  const hasMonday = !!client.mondayBoardId;
  const hasSlug = !!client.slug;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-3.5 transition-all flex flex-col gap-2.5"
      style={{
        background: selected ? "oklch(0.60 0.18 240 / 0.12)" : "oklch(0.18 0.012 255)",
        border: `1px solid ${selected ? "oklch(0.60 0.18 240 / 0.5)" : "oklch(0.26 0.012 255)"}`,
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden"
          style={{
            background: selected ? "oklch(0.60 0.18 240 / 0.25)" : "oklch(0.24 0.012 255)",
            color: selected ? "oklch(0.85 0.18 240)" : "oklch(0.70 0.010 240)",
          }}
        >
          {client.logoUrl ? <img src={client.logoUrl} alt="" className="w-full h-full object-contain" /> : initials}
        </div>
        <p className="text-sm font-semibold truncate flex-1" style={{ color: selected ? "white" : "oklch(0.88 0.005 220)" }}>
          {client.name}
        </p>
      </div>
      <div className="flex gap-3">
        <div className="flex items-center gap-1" title="Meta Ads">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: hasMeta ? "oklch(0.72 0.18 145)" : "oklch(0.35 0.010 240)" }} />
          <span className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>Meta</span>
        </div>
        <div className="flex items-center gap-1" title="Monday.com">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: hasMonday ? "oklch(0.72 0.18 145)" : "oklch(0.35 0.010 240)" }} />
          <span className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>Monday</span>
        </div>
        <div className="flex items-center gap-1" title="URL pública">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: hasSlug ? "oklch(0.72 0.18 145)" : "oklch(0.35 0.010 240)" }} />
          <span className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>URL</span>
        </div>
      </div>
    </button>
  );
}

export default function Settings() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [newClientName, setNewClientName] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [globalView, setGlobalView] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate("/");
  }, [isAuthenticated, authLoading, navigate]);

  const { data: clients, refetch: refetchClients } = trpc.dashboard.getClients.useQuery(undefined, { enabled: isAuthenticated });

  const createClient = trpc.dashboard.createClient.useMutation({
    onSuccess: () => { toast.success("Cliente criado!"); setNewClientName(""); refetchClients(); },
    onError: () => toast.error("Erro ao criar cliente"),
  });

  const selectedClient = (clients ?? []).find((c: any) => c.id === selectedClientId) ?? null;
  const filteredClients = (clients ?? []).filter((c: any) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm" style={{ color: "oklch(0.60 0.18 240)" }}>Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ height: "100vh", overflow: "hidden" }}>
      {/* Header */}
      <header
        className="flex items-center gap-4 px-5 py-3.5 border-b flex-shrink-0"
        style={{ borderColor: "oklch(0.22 0.012 255)", background: "oklch(0.13 0.012 255)" }}
      >
        <button
          onClick={() => navigate("/dashboard")}
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
        <div className="flex-1" />
        <button
          onClick={() => { setGlobalView(!globalView); setSelectedClientId(null); }}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all"
          style={{
            background: globalView ? "oklch(0.60 0.18 240 / 0.15)" : "transparent",
            color: globalView ? "oklch(0.75 0.18 240)" : "oklch(0.55 0.010 240)",
            border: `1px solid ${globalView ? "oklch(0.60 0.18 240 / 0.35)" : "oklch(0.28 0.012 255)"}`,
          }}
        >
          <Users className="w-3.5 h-3.5" />
          Gestores e Monday
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT PANEL: client grid */}
        {!globalView && (
          <div
            className="flex flex-col border-r flex-shrink-0 overflow-hidden"
            style={{
              width: selectedClient ? "280px" : "100%",
              borderColor: "oklch(0.20 0.012 255)",
              background: "oklch(0.12 0.012 255)",
              transition: "width 0.25s ease",
            }}
          >
            {/* Add + search */}
            <div className="p-3 flex flex-col gap-2 border-b flex-shrink-0" style={{ borderColor: "oklch(0.20 0.012 255)" }}>
              <div className="flex gap-2">
                <input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newClientName) createClient.mutate({ name: newClientName }); }}
                  placeholder="Novo cliente..."
                  className="flex-1 px-3 py-2 text-sm rounded-lg outline-none"
                  style={{ background: "oklch(0.18 0.012 255)", border: "1px solid oklch(0.28 0.012 255)", color: "oklch(0.90 0.005 220)" }}
                />
                <button
                  onClick={() => newClientName && createClient.mutate({ name: newClientName })}
                  disabled={!newClientName || createClient.isPending}
                  className="px-3 py-2 rounded-lg text-sm font-semibold transition-all flex-shrink-0"
                  style={{ background: "oklch(0.60 0.18 240)", color: "white", opacity: !newClientName ? 0.5 : 1 }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "oklch(0.40 0.010 240)" }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg outline-none"
                  style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.22 0.012 255)", color: "oklch(0.80 0.005 220)" }}
                />
              </div>
              <p className="text-xs" style={{ color: "oklch(0.38 0.010 240)" }}>
                {filteredClients.length} cliente{filteredClients.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Grid of cards */}
            <div className="flex-1 overflow-y-auto p-3">
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: selectedClient ? "1fr" : "repeat(auto-fill, minmax(200px, 1fr))" }}
              >
                {filteredClients.map((c: any) => (
                  <ClientStatusCard
                    key={c.id}
                    client={c}
                    selected={selectedClientId === c.id}
                    onClick={() => setSelectedClientId(selectedClientId === c.id ? null : c.id)}
                  />
                ))}
                {filteredClients.length === 0 && (
                  <div className="col-span-full py-12 text-center text-sm" style={{ color: "oklch(0.40 0.010 240)" }}>
                    {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* RIGHT PANEL: client config detail */}
        {!globalView && selectedClient && (
          <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "oklch(0.14 0.012 255)" }}>
            {/* Panel header */}
            <div
              className="flex items-center justify-between px-5 py-3.5 border-b flex-shrink-0"
              style={{ borderColor: "oklch(0.22 0.012 255)", background: "oklch(0.16 0.012 255)" }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold overflow-hidden"
                  style={{ background: "oklch(0.60 0.18 240 / 0.2)", color: "oklch(0.75 0.18 240)" }}
                >
                  {selectedClient.logoUrl
                    ? <img src={selectedClient.logoUrl} alt="" className="w-full h-full object-contain" />
                    : selectedClient.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
                  }
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{selectedClient.name}</p>
                  <p className="text-xs" style={{ color: "oklch(0.45 0.010 240)" }}>Configurações do cliente</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedClientId(null)}
                className="p-1.5 rounded-md transition-all"
                style={{ color: "oklch(0.50 0.010 240)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "oklch(0.22 0.012 255)"; e.currentTarget.style.color = "white"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "oklch(0.50 0.010 240)"; }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable config content */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 py-4 flex flex-col gap-3 max-w-2xl">
                <ClientDetailPanel key={selectedClient.id} client={selectedClient} />
              </div>
            </div>
          </div>
        )}

        {/* Empty state when no client selected */}
        {!globalView && !selectedClient && (
          <div className="hidden" />
        )}

        {/* GLOBAL VIEW: Managers + Monday token */}
        {globalView && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 max-w-2xl mx-auto flex flex-col gap-6">
              <ManagersSection clients={clients ?? []} />
              <MondayTokenSection />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
