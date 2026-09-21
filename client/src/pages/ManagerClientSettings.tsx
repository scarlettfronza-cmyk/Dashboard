import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { getNextPrePaidStatus } from "@/lib/prePaid";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, X, Search } from "lucide-react";

// ─── Shared styles ─────────────────────────────────────────────────────────────
const inputCls = "w-full px-3 py-2 text-sm rounded-md outline-none transition-all";
const inputStyle = {
  background: "oklch(0.18 0.012 255)",
  border: "1px solid oklch(0.30 0.012 255)",
  color: "oklch(0.90 0.005 220)",
};

function StyledInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
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

function SectionCard({ title, icon, children, accentColor = "oklch(0.60 0.18 240)" }: { title: string; icon?: string; children: React.ReactNode; accentColor?: string }) {
  return (
    <div
      className="rounded-xl flex flex-col gap-4 p-5"
      style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.26 0.012 255)" }}
    >
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-5 rounded-full flex-shrink-0" style={{ background: accentColor }} />
        <span className="text-sm font-semibold text-white">{icon && `${icon} `}{title}</span>
      </div>
      {children}
    </div>
  );
}

function ActionBtn({ onClick, disabled, children, variant = "primary", color }: { onClick: () => void; disabled?: boolean; children: React.ReactNode; variant?: "primary" | "secondary" | "danger"; color?: string }) {
  const bg = color || (variant === "primary" ? "oklch(0.60 0.18 240)" : variant === "danger" ? "oklch(0.65 0.22 25)" : "transparent");
  const textColor = variant === "secondary" ? "oklch(0.65 0.010 240)" : "white";
  const border = variant === "secondary" ? "1px solid oklch(0.30 0.012 255)" : "none";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-4 py-2 text-xs font-semibold rounded-md transition-all"
      style={{ background: bg, color: textColor, border, opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </button>
  );
}

// ── Report Theme Card ──────────────────────────────────────────────────────
function ReportThemeCard({ token, clientId }: { token: string; clientId: number }) {
  const themeQuery = trpc.managers.getReportThemeAsManager.useQuery(
    { token, clientId },
    { enabled: !!token && !!clientId }
  );
  const saveTheme = trpc.managers.saveReportThemeAsManager.useMutation({
    onSuccess: () => { toast.success("Tema do relatório salvo!"); themeQuery.refetch(); },
    onError: (e) => toast.error(e.message || "Erro ao salvar tema"),
  });
  const current = themeQuery.data?.reportTheme ?? "dark";

  return (
    <SectionCard title="Tema do Relatório Público" icon="🎨" accentColor="oklch(0.72 0.18 320)">
      <p className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>
        Escolha o visual do relatório que o cliente vai ver ao acessar o link.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => saveTheme.mutate({ token, clientId, reportTheme: "dark" })}
          className="relative rounded-xl p-3 text-left transition-all"
          style={{ border: current === "dark" ? "2px solid oklch(0.65 0.22 25)" : "2px solid oklch(0.28 0.012 255)" }}
        >
          <div className="rounded-lg p-2 mb-2 space-y-1" style={{ background: "oklch(0.10 0.012 255)" }}>
            <div className="h-2 w-16 rounded" style={{ background: "oklch(0.65 0.22 25)" }} />
            <div className="h-1.5 w-12 rounded" style={{ background: "oklch(0.22 0.012 255)" }} />
            <div className="grid grid-cols-3 gap-1 mt-1">
              {[0,1,2].map(i => <div key={i} className="h-4 rounded" style={{ background: "oklch(0.65 0.22 25 / 0.3)" }} />)}
            </div>
          </div>
          <p className="text-xs font-semibold text-white">🔴 Escarlate (Escuro)</p>
          <p className="text-xs" style={{ color: "oklch(0.45 0.010 240)" }}>Fundo preto + vermelho</p>
          {current === "dark" && <span className="absolute top-2 right-2 text-xs rounded-full px-1.5 py-0.5" style={{ background: "oklch(0.65 0.22 25)", color: "white" }}>Ativo</span>}
        </button>
        <button
          onClick={() => saveTheme.mutate({ token, clientId, reportTheme: "light" })}
          className="relative rounded-xl p-3 text-left transition-all"
          style={{ border: current === "light" ? "2px solid oklch(0.60 0.18 240)" : "2px solid oklch(0.28 0.012 255)" }}
        >
          <div className="rounded-lg p-2 mb-2 space-y-1" style={{ background: "oklch(0.97 0.005 220)" }}>
            <div className="h-2 w-16 rounded" style={{ background: "oklch(0.60 0.18 240)" }} />
            <div className="h-1.5 w-12 rounded" style={{ background: "oklch(0.85 0.005 220)" }} />
            <div className="grid grid-cols-3 gap-1 mt-1">
              {[0,1,2].map(i => <div key={i} className="h-4 rounded" style={{ background: "oklch(0.60 0.18 240 / 0.15)" }} />)}
            </div>
          </div>
          <p className="text-xs font-semibold text-white">☀️ Claro (Light)</p>
          <p className="text-xs" style={{ color: "oklch(0.45 0.010 240)" }}>Fundo branco + cores suaves</p>
          {current === "light" && <span className="absolute top-2 right-2 text-xs rounded-full px-1.5 py-0.5" style={{ background: "oklch(0.60 0.18 240)", color: "white" }}>Ativo</span>}
        </button>
      </div>
      {saveTheme.isPending && <p className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>Salvando...</p>}
    </SectionCard>
  );
}

export default function ManagerClientSettings() {
  const params = useParams<{ id: string }>();
  const clientId = parseInt(params.id || "0");
  const [token, setToken] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  // Meta token state
  const [metaToken, setMetaToken] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [adAccountName, setAdAccountName] = useState("");
  const [adAccounts, setAdAccounts] = useState<Array<{ id: string; name: string; currency: string }>>([]);
  const [metaStep, setMetaStep] = useState<"idle" | "validating" | "listing" | "saving">("idle");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [addAccountSearch, setAddAccountSearch] = useState("");
  // Manual account ID entry
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualAccountId, setManualAccountId] = useState("");
  const [verifyingManual, setVerifyingManual] = useState(false);
  const [accountsListed, setAccountsListed] = useState(false);

  // Instagram state
  const [igUsername, setIgUsername] = useState("");
  const [igUserId, setIgUserId] = useState("");
  const [igProfiles, setIgProfiles] = useState<Array<{ igUserId: string; username: string; name: string; followersCount: number; profilePictureUrl?: string }>>([]);
  const [loadingIgProfiles, setLoadingIgProfiles] = useState(false);
  const getOAuthUrlAsManager = trpc.instagram.getOAuthUrlAsManager.useMutation({
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (error) => toast.error(error.message || "Erro ao gerar URL de reconexão"),
  });

  // Sales XLSX state
  const [uploadingXlsx, setUploadingXlsx] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Monday API sync state
  const [mondayBoardId, setMondayBoardId] = useState("");
  const [syncingMonday, setSyncingMonday] = useState(false);
  const [mondaySyncStart, setMondaySyncStart] = useState("");
  const [mondaySyncEnd, setMondaySyncEnd] = useState("");

  // CAPI state
  const [metaPixelId, setMetaPixelId] = useState("");
  const [metaCAPIToken, setMetaCAPIToken] = useState("");

  // Campaign types state
  const [campaignTypes, setCampaignTypes] = useState<string[]>([]);
  const [savingCampaignTypes, setSavingCampaignTypes] = useState(false);
  const [isPrePaid, setIsPrePaid] = useState(false);

  // WhatsApp group state
  const [whatsappGroupId, setWhatsappGroupId] = useState("");
  const [savingGroupId, setSavingGroupId] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  // Load existing whatsappGroupId from server when token and clientId are available
  const campaignTypesQuery = trpc.managers.getCampaignTypesAsManager.useQuery(
    { token: token!, clientId },
    { enabled: !!token && !!clientId }
  );
  const campaignTypesRef = useRef<any>(null);
  if (campaignTypesQuery.data && campaignTypesQuery.data !== campaignTypesRef.current) {
    campaignTypesRef.current = campaignTypesQuery.data;
    setCampaignTypes(campaignTypesQuery.data.campaignTypes || []);
  }

  const saveCampaignTypesMutation = trpc.managers.saveCampaignTypesAsManager.useMutation({
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

  const clientDataQuery = trpc.managers.myClients.useQuery(
    { token: token! },
    { enabled: !!token }
  );
  useEffect(() => {
    if (clientDataQuery.data?.clients) {
      const thisClient = clientDataQuery.data.clients.find((c: { id: number }) => c.id === Number(clientId));
      if (thisClient?.whatsappGroupId && !whatsappGroupId) {
        setWhatsappGroupId(thisClient.whatsappGroupId);
      }
      if (thisClient) setIsPrePaid(Boolean(thisClient.isPrePaid));
    }
  }, [clientDataQuery.data, clientId]);

  const setPrePaidMutation = trpc.managers.setPrePaidAsManager.useMutation({
    onSuccess: (data) => {
      setIsPrePaid(data.isPrePaid);
      toast.success(data.isPrePaid ? "Conta marcada como pré-paga" : "Conta marcada como pós-paga");
    },
    onError: (error) => {
      setIsPrePaid((current) => !current);
      toast.error(error.message || "Não foi possível atualizar a conta");
    },
  });

  const { data: zapGroups, isLoading: loadingGroups, refetch: refetchGroups } = trpc.whatsapp.listGroups.useQuery(
    undefined,
    { enabled: false }
  );

  const filteredGroups = (zapGroups || []).filter((g: { id: string; name: string }) =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase()) || g.id.includes(groupSearch)
  );

  const selectedGroupName = (zapGroups || []).find((g: { id: string; name: string }) => g.id === whatsappGroupId)?.name;

  // Slug state
  const [slug, setSlug] = useState("");
  const [slugError, setSlugError] = useState<string | null>(null);

  const updateSlug = trpc.managers.updateClientSlugAsManager.useMutation({
    onSuccess: (data) => { toast.success(`Identificador atualizado: ${data.slug}`); setSlugError(null); },
    onError: (e) => setSlugError(e.message),
  });

  const regeneratePublicToken = trpc.managers.regeneratePublicReportTokenAsManager.useMutation({
    onSuccess: () => toast.success("Link seguro regenerado. O link anterior deixou de funcionar."),
    onError: (e) => toast.error(e.message || "Não foi possível regenerar o link"),
  });

  const handleSaveSlug = () => {
    if (!token) return;
    const cleaned = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{2,60}$/.test(cleaned)) {
      setSlugError("Use apenas letras minúsculas, números e hífens (2-60 caracteres)");
      return;
    }
    setSlugError(null);
    updateSlug.mutate({ token, clientId, slug: cleaned });
  };

  const saveGroupIdMutation = trpc.whatsapp.saveGroupIdAsManager.useMutation({
    onSuccess: () => { toast.success("Grupo de WhatsApp salvo!"); setSavingGroupId(false); },
    onError: (e) => { toast.error(e.message || "Erro ao salvar grupo"); setSavingGroupId(false); },
  });

  const capiConfig = trpc.managers.getCAPIConfigAsManager.useQuery(
    { token: token!, clientId },
    { enabled: !!token && !!clientId }
  );

  const saveCAPI = trpc.managers.saveCAPIConfigAsManager.useMutation({
    onSuccess: () => { toast.success("Configuração CAPI salva!"); capiConfig.refetch(); setMetaCAPIToken(""); },
    onError: (e) => toast.error(e.message || "Erro ao salvar CAPI"),
  });

  useEffect(() => {
    const t = localStorage.getItem("manager_token");
    if (!t) { setLocation("/manager/login"); return; }
    setToken(t);
  }, [setLocation]);

  const metaStatus = trpc.managers.getClientMetaStatus.useQuery(
    { token: token!, clientId },
    { enabled: !!token && !!clientId }
  );

  const igStatus = trpc.managers.getClientInstagramProfile.useQuery(
    { token: token!, clientId },
    { enabled: !!token && !!clientId }
  );

  const listAccountsMutation = trpc.managers.listAdAccountsAsManager.useMutation({
    onSuccess: (data) => { setAdAccounts(data || []); setAccountsListed(true); setMetaStep("idle"); },
    onError: (err) => { toast.error(err.message); setAccountsListed(true); setMetaStep("idle"); },
  });

  const validateTokenMutation = trpc.managers.validateMetaTokenAsManager.useMutation({
    onSuccess: (r) => {
      if (r.valid) {
        toast.success(`Token válido! Conta: ${r.name}`);
        setMetaStep("listing");
        listAccountsMutation.mutate({ token: token!, accessToken: metaToken.trim() });
      } else {
        toast.error(`Token inválido: ${r.error}`);
        setMetaStep("idle");
      }
    },
    onError: () => { toast.error("Erro ao validar token"); setMetaStep("idle"); },
  });

  const verifyManualAccountMutation = trpc.managers.verifyAdAccountAsManager.useMutation({
    onSuccess: (data) => {
      setVerifyingManual(false);
      if (data.valid) {
        const cleanId = manualAccountId.trim().replace(/^act_/, "");
        setAdAccountId(`act_${cleanId}`);
        toast.success(`Conta verificada: ${data.name || cleanId}`);
        setShowManualEntry(false);
        setManualAccountId("");
      } else {
        toast.error(`Conta não encontrada: ${data.error || "Sem acesso a esta conta"}`);
      }
    },
    onError: (err) => { toast.error(err.message); setVerifyingManual(false); },
  });

  const additionalAccountsQuery = trpc.managers.getAdditionalAccountsAsManager.useQuery(
    { token: token!, clientId },
    { enabled: !!token && !!clientId && !!metaStatus.data?.connected }
  );

  const addAccountMutation = trpc.managers.addAdditionalAccountAsManager.useMutation({
    onSuccess: () => { toast.success("Conta adicionada!"); additionalAccountsQuery.refetch(); setShowAddAccount(false); setAddAccountSearch(""); },
    onError: (err) => toast.error(err.message),
  });

  const removeAccountMutation = trpc.managers.removeAdditionalAccountAsManager.useMutation({
    onSuccess: () => { toast.success("Conta removida!"); additionalAccountsQuery.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const listAccountsForClientMutation = trpc.managers.listAdAccountsForClientAsManager.useMutation({
    onSuccess: (data) => { setAdAccounts(data || []); setMetaStep("idle"); },
    onError: (err) => { toast.error(err.message); setMetaStep("idle"); },
  });

  const linkedAccountIds = new Set([
    additionalAccountsQuery.data?.primaryAccount?.id,
    ...(additionalAccountsQuery.data?.additionalAccounts ?? []).map((account) => account.id),
  ].filter(Boolean));
  const availableAdditionalAccounts = adAccounts.filter((account) =>
    !linkedAccountIds.has(account.id)
    && (account.name.toLowerCase().includes(addAccountSearch.toLowerCase()) || account.id.includes(addAccountSearch))
  );

  const saveMetaToken = trpc.managers.saveClientMetaToken.useMutation({
    onSuccess: () => {
      toast.success("Token Meta salvo com sucesso!");
      metaStatus.refetch();
      setMetaToken("");
      setAdAccounts([]);
      setAdAccountId("");
    },
    onError: (err) => toast.error(err.message),
  });

  const listIgProfilesMutation = trpc.managers.listClientInstagramProfiles.useMutation({
    onSuccess: (data) => { setIgProfiles(data || []); setLoadingIgProfiles(false); },
    onError: (err) => { toast.error(err.message); setLoadingIgProfiles(false); },
  });

  const saveInstagram = trpc.managers.saveClientInstagram.useMutation({
    onSuccess: () => { toast.success("Instagram configurado!"); igStatus.refetch(); setIgUsername(""); setIgUserId(""); setIgProfiles([]); },
    onError: (err) => toast.error(err.message),
  });

  const handleListAccounts = () => {
    if (!metaToken.trim() || !token) return;
    setMetaStep("listing");
    listAccountsMutation.mutate({ token, accessToken: metaToken.trim() });
  };

  const handleListIgProfiles = () => {
    if (!token) return;
    setLoadingIgProfiles(true);
    listIgProfilesMutation.mutate({ token, clientId });
  };

  const uploadInfo = trpc.sales.getUploadInfoAsManager.useQuery(
    { clientId, managerToken: token! },
    { enabled: !!token && !!clientId }
  );

  const mondayStatus = trpc.monday.getStatusAsManager.useQuery(
    { clientId, managerToken: token! },
    { enabled: !!token && !!clientId }
  );

  const saveBoardId = trpc.monday.saveBoardIdAsManager.useMutation({
    onSuccess: () => { toast.success("Board ID salvo!"); mondayStatus.refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const syncBoardMutation = trpc.monday.syncBoardAsManager.useMutation({
    onSuccess: (data) => {
      if (data.reason === "no_token") toast.warning("Token do Monday.com não configurado.");
      else if (data.reason === "no_board_id") toast.warning("Este cliente não tem Board ID configurado.");
      else if (data.reason) toast.warning("Sync não realizado: " + data.reason);
      else toast.success(`Sincronizado! ${data.imported} registros importados.`);
      mondayStatus.refetch();
      uploadInfo.refetch();
      setSyncingMonday(false);
    },
    onError: (err) => { toast.error("Erro ao sincronizar: " + err.message); setSyncingMonday(false); },
  });

  const handleSyncMonday = () => {
    if (!token) return;
    const boardId = mondayStatus.data?.boardId || mondayBoardId.trim();
    if (!boardId) { toast.error("Informe o Board ID do Monday.com"); return; }
    setSyncingMonday(true);
    syncBoardMutation.mutate({
      clientId, boardId, managerToken: token,
      startDate: mondaySyncStart ? new Date(mondaySyncStart + "T00:00:00") : undefined,
      endDate: mondaySyncEnd ? new Date(mondaySyncEnd + "T23:59:59") : undefined,
    });
  };

  const handleXlsxUpload = async (file: File) => {
    if (!token) return;
    setUploadingXlsx(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);
      const res = await fetch(`/api/upload-sales/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ fileBase64: base64, fileName: file.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao fazer upload");
      toast.success(`${data.imported} registros importados com sucesso!`);
      uploadInfo.refetch();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao fazer upload");
    } finally {
      setUploadingXlsx(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!token || !clientId) return null;

  const isIgExpired = igStatus.data?.tokenExpired;
  const isIgWarning = igStatus.data?.tokenWarning;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "oklch(0.12 0.012 255)", height: "100vh", overflow: "hidden" }}>
      {/* Header */}
      <header
        className="flex items-center gap-4 px-5 py-3.5 border-b flex-shrink-0"
        style={{ borderColor: "oklch(0.22 0.012 255)", background: "oklch(0.13 0.012 255)" }}
      >
        <button
          onClick={() => setLocation("/manager/settings")}
          className="flex items-center gap-1.5 text-sm font-medium transition-all"
          style={{ color: "oklch(0.55 0.010 240)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "oklch(0.80 0.18 240)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "oklch(0.55 0.010 240)"; }}
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <div className="h-4 w-px" style={{ background: "oklch(0.26 0.012 255)" }} />
        <span className="text-base font-semibold text-white">Configurar Cliente</span>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 flex flex-col gap-4 max-w-2xl mx-auto">

          {/* ─── Meta Ads ─────────────────────────────────────────────────── */}
          <div className="p-4 rounded-xl flex flex-col gap-3" style={{ background: "oklch(0.16 0.012 255)", border: `1px solid ${metaStatus.data?.connected ? "oklch(0.60 0.18 240 / 0.4)" : "oklch(0.26 0.012 255)"}` }}>
            <div className="flex items-center gap-2">
              <span style={{ color: "oklch(0.75 0.18 60)", fontSize: "1rem" }}>⚡</span>
              <span className="text-sm font-semibold text-white">Meta Ads API</span>
              {metaStatus.data?.connected && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "oklch(0.60 0.18 240 / 0.15)", color: "oklch(0.70 0.18 240)" }}>Ativo</span>}
            </div>
            {metaStatus.data?.connected && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" style={{ color: "oklch(0.68 0.16 160)" }} />
                <span className="text-xs" style={{ color: "oklch(0.68 0.16 160)" }}>Conta ativa: <span className="font-semibold text-white">{metaStatus.data.adAccountId}</span></span>
              </div>
            )}
            {!metaStatus.data?.connected && <p className="text-xs" style={{ color: "oklch(0.55 0.010 240)" }}>Conecte diretamente com a API do Meta. Sem planilha — dados puxados automaticamente.</p>}

            {metaStatus.data?.connected && (
              <div className="rounded-lg p-3 flex flex-col gap-3" style={{ background: "oklch(0.14 0.012 255)", border: "1px solid oklch(0.24 0.012 255)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-white">Contas de anúncios</p>
                    <p className="text-xs mt-0.5" style={{ color: "oklch(0.50 0.010 240)" }}>
                      Os indicadores do dashboard somam a conta principal e as contas adicionais selecionadas.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={listAccountsForClientMutation.isPending || !token}
                    onClick={() => {
                      const nextOpen = !showAddAccount;
                      setShowAddAccount(nextOpen);
                      setAddAccountSearch("");
                      if (nextOpen && token) listAccountsForClientMutation.mutate({ token, clientId });
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-all"
                    style={{ background: "oklch(0.60 0.18 240)", color: "white", opacity: listAccountsForClientMutation.isPending ? 0.6 : 1 }}
                  >
                    {listAccountsForClientMutation.isPending ? "Buscando..." : showAddAccount ? "Fechar" : "+ Adicionar conta"}
                  </button>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2" style={{ background: "oklch(0.18 0.012 255)" }}>
                    <span className="text-xs text-white">Conta principal</span>
                    <span className="text-xs font-medium" style={{ color: "oklch(0.70 0.18 240)" }}>{additionalAccountsQuery.data?.primaryAccount?.id ?? metaStatus.data.adAccountId}</span>
                  </div>
                  {(additionalAccountsQuery.data?.additionalAccounts ?? []).map((account) => (
                    <div key={account.id} className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2" style={{ background: "oklch(0.18 0.012 255)" }}>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white truncate">{account.name}</p>
                        <p className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>{account.id}</p>
                      </div>
                      <button
                        type="button"
                        disabled={removeAccountMutation.isPending}
                        onClick={() => { if (token) removeAccountMutation.mutate({ token, clientId, accountId: account.id }); }}
                        className="px-2 py-1 text-xs rounded-md transition-all"
                        style={{ border: "1px solid oklch(0.65 0.22 25 / 0.5)", color: "oklch(0.72 0.22 25)", background: "transparent", opacity: removeAccountMutation.isPending ? 0.6 : 1 }}
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>

                {showAddAccount && (
                  <div className="flex flex-col gap-2 pt-1" style={{ borderTop: "1px solid oklch(0.24 0.012 255)" }}>
                    <input
                      autoFocus
                      type="text"
                      value={addAccountSearch}
                      onChange={(event) => setAddAccountSearch(event.target.value)}
                      placeholder="Buscar por nome ou ID da conta..."
                      className="w-full px-3 py-2 text-xs rounded-md outline-none"
                      style={{ background: "oklch(0.18 0.012 255)", border: "1px solid oklch(0.30 0.012 255)", color: "oklch(0.90 0.005 220)" }}
                    />
                    <div className="max-h-44 overflow-y-auto rounded-md" style={{ border: "1px solid oklch(0.24 0.012 255)" }}>
                      {availableAdditionalAccounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between gap-3 px-3 py-2" style={{ borderBottom: "1px solid oklch(0.24 0.012 255)" }}>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white truncate">{account.name}</p>
                            <p className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>{account.id} · {account.currency}</p>
                          </div>
                          <button
                            type="button"
                            disabled={addAccountMutation.isPending}
                            onClick={() => { if (token) addAccountMutation.mutate({ token, clientId, accountId: account.id, accountName: account.name }); }}
                            className="px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all"
                            style={{ background: "oklch(0.68 0.16 160)", color: "white", opacity: addAccountMutation.isPending ? 0.6 : 1 }}
                          >
                            Adicionar
                          </button>
                        </div>
                      ))}
                      {!listAccountsForClientMutation.isPending && availableAdditionalAccounts.length === 0 && (
                        <p className="px-3 py-4 text-xs text-center" style={{ color: "oklch(0.50 0.010 240)" }}>
                          Nenhuma nova conta acessível foi encontrada com este token.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Step 1: Token + Validar */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.65 0.010 240)" }}>1. Token de acesso (começa com EAA...)</label>
              <div className="flex gap-2">
                <input type="password" value={metaToken} onChange={(e) => setMetaToken(e.target.value)} placeholder="EAAxxxxxxxxxx..."
                  className="flex-1 px-3 py-2 text-sm rounded-md outline-none transition-all"
                  style={{ background: "oklch(0.18 0.012 255)", border: "1px solid oklch(0.30 0.012 255)", color: "oklch(0.90 0.005 220)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "oklch(0.60 0.18 240 / 0.6)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "oklch(0.30 0.012 255)"; }}
                />
                <button
                  onClick={() => { if (!metaToken.trim() || !token) return; setMetaStep("validating"); validateTokenMutation.mutate({ token, accessToken: metaToken.trim() }); }}
                  disabled={!metaToken || metaStep === "validating" || metaStep === "listing" || !token}
                  className="px-4 py-2 text-xs font-semibold rounded-md whitespace-nowrap transition-all"
                  style={{ background: "oklch(0.60 0.18 240)", color: "white", opacity: !metaToken || metaStep === "validating" || metaStep === "listing" ? 0.5 : 1 }}
                >
                  {metaStep === "validating" ? "Validando..." : metaStep === "listing" ? "Buscando..." : "Validar"}
                </button>
              </div>
              <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs mt-1.5 transition-all"
                style={{ color: "oklch(0.55 0.18 240)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "oklch(0.70 0.18 240)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "oklch(0.55 0.18 240)"; }}
              >
                <Search className="w-3 h-3" /> Gerar token no Graph API Explorer
              </a>
            </div>
            {/* Step 2: Conta de anúncio — dropdown pesquisável */}
            {(adAccounts.length > 0 || accountsListed) && (
              <div className="relative">
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "oklch(0.65 0.010 240)" }}>2. Conta de anúncio</label>
                <button type="button" onClick={() => { setDropdownOpen(!dropdownOpen); setAccountSearch(""); }}
                  className="w-full px-3 py-2 text-sm rounded-md outline-none transition-all flex items-center justify-between"
                  style={{ background: "oklch(0.18 0.012 255)", border: "1px solid oklch(0.30 0.012 255)", color: adAccountId ? "oklch(0.90 0.005 220)" : "oklch(0.45 0.010 240)", cursor: "pointer" }}
                >
                  <span>{adAccountId ? `${adAccountName || adAccountId} (${adAccountId})` : "Selecione a conta..."}</span>
                  <svg className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.50 0.010 240)", transform: dropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {dropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 rounded-lg overflow-hidden shadow-2xl" style={{ background: "oklch(0.20 0.012 255)", border: "1px solid oklch(0.35 0.012 255)", maxHeight: "260px", display: "flex", flexDirection: "column" }}>
                    <div className="p-2" style={{ borderBottom: "1px solid oklch(0.28 0.012 255)" }}>
                      <input autoFocus type="text" value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} placeholder="Buscar conta..."
                        className="w-full px-3 py-1.5 text-sm rounded-md outline-none"
                        style={{ background: "oklch(0.15 0.012 255)", border: "1px solid oklch(0.32 0.012 255)", color: "oklch(0.90 0.005 220)" }}
                      />
                    </div>
                    <div className="overflow-y-auto" style={{ maxHeight: "200px" }}>
                      {adAccounts.filter((acc) => acc.name.toLowerCase().includes(accountSearch.toLowerCase()) || acc.id.includes(accountSearch)).map((acc) => (
                        <button key={acc.id} type="button"
                          onClick={() => { setAdAccountId(acc.id); setAdAccountName(acc.name); setDropdownOpen(false); setAccountSearch(""); }}
                          className="w-full text-left px-3 py-2 text-xs transition-all"
                          style={{ background: adAccountId === acc.id ? "oklch(0.60 0.18 240 / 0.15)" : "transparent", color: adAccountId === acc.id ? "oklch(0.80 0.18 240)" : "oklch(0.75 0.005 220)", borderBottom: "1px solid oklch(0.24 0.012 255)" }}
                          onMouseEnter={(e) => { if (adAccountId !== acc.id) { e.currentTarget.style.background = "oklch(0.60 0.18 240 / 0.08)"; e.currentTarget.style.color = "white"; } }}
                          onMouseLeave={(e) => { if (adAccountId !== acc.id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "oklch(0.75 0.005 220)"; } }}
                        >
                          <div className="font-medium">{acc.name}</div>
                          <div style={{ color: "oklch(0.45 0.010 240)" }}>{acc.id} — {acc.currency}</div>
                        </button>
                      ))}
                      {adAccounts.filter((acc) => acc.name.toLowerCase().includes(accountSearch.toLowerCase()) || acc.id.includes(accountSearch)).length === 0 && (
                        <div className="px-3 py-4 text-xs text-center" style={{ color: "oklch(0.45 0.010 240)" }}>Nenhuma conta encontrada</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Manual account ID entry */}
            <div>
              {!showManualEntry ? (
                <button type="button" onClick={() => { setShowManualEntry(true); setManualAccountId(""); }}
                  className="text-xs transition-all"
                  style={{ color: "oklch(0.55 0.18 240)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "oklch(0.70 0.18 240)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "oklch(0.55 0.18 240)"; }}
                >
                  Inserir ID da conta manualmente
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium" style={{ color: "oklch(0.65 0.010 240)" }}>ID da conta (ex: act_1742675450389428 ou 1742675450389428)</label>
                  <p className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>Cole o token acima, informe o ID e clique em Verificar.</p>
                  <div className="flex gap-2">
                    <input type="text" value={manualAccountId} onChange={(e) => setManualAccountId(e.target.value)} placeholder="act_XXXXXXXXXXXXXXX"
                      className="flex-1 px-3 py-2 text-xs rounded-md outline-none"
                      style={{ background: "oklch(0.15 0.012 255)", border: "1px solid oklch(0.32 0.012 255)", color: "oklch(0.90 0.005 220)" }}
                    />
                    <button type="button" disabled={!manualAccountId.trim() || verifyingManual || !token || !metaToken.trim()}
                      onClick={() => { if (!manualAccountId.trim() || !token || !metaToken.trim()) return; setVerifyingManual(true); verifyManualAccountMutation.mutate({ token, clientId, adAccountId: manualAccountId.trim(), accessToken: metaToken.trim() }); }}
                      className="px-3 py-2 text-xs font-semibold rounded-md transition-all"
                      style={{ background: "oklch(0.55 0.18 240)", color: "white", opacity: !manualAccountId.trim() || verifyingManual || !metaToken.trim() ? 0.5 : 1 }}
                    >
                      {verifyingManual ? "Verificando..." : "Verificar"}
                    </button>
                    <button type="button" onClick={() => { setShowManualEntry(false); setManualAccountId(""); }}
                      className="px-3 py-2 text-xs rounded-md transition-all"
                      style={{ border: "1px solid oklch(0.30 0.012 255)", color: "oklch(0.55 0.010 240)", background: "transparent" }}
                    >Cancelar</button>
                  </div>
                </div>
              )}
            </div>
            {/* Actions: Salvar conexão / Cancelar */}
            {(adAccounts.length > 0 || adAccountId) && (
              <div className="flex gap-2">
                <button
                  onClick={() => { if (!adAccountId || !token) return; setMetaStep("saving"); saveMetaToken.mutate({ token, clientId, accessToken: metaToken.trim(), adAccountId }); }}
                  disabled={!adAccountId || metaStep === "saving" || !metaToken.trim()}
                  className="flex-1 py-2 text-xs font-semibold rounded-md transition-all"
                  style={{ background: "oklch(0.68 0.16 160)", color: "white", opacity: !adAccountId || metaStep === "saving" || !metaToken.trim() ? 0.5 : 1 }}
                >
                  {metaStep === "saving" ? "Salvando..." : "Salvar conexão"}
                </button>
                <button
                  onClick={() => { setMetaToken(""); setAdAccountId(""); setAdAccountName(""); setAdAccounts([]); setAccountsListed(false); setMetaStep("idle"); }}
                  className="flex-1 py-2 text-xs font-medium rounded-md transition-all"
                  style={{ border: "1px solid oklch(0.30 0.012 255)", color: "oklch(0.55 0.010 240)", background: "transparent" }}
                >Cancelar</button>
              </div>
            )}
            {/* Instructions */}
            <div className="p-3 rounded-lg text-xs" style={{ background: "oklch(0.14 0.012 255)", border: "1px solid oklch(0.24 0.012 255)" }}>
              <div className="font-semibold mb-2 text-white flex items-center gap-1.5">
                <span style={{ color: "oklch(0.75 0.18 60)" }}>⚠</span> Como gerar o token
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

          <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: "oklch(0.16 0.012 255)", border: "1px solid oklch(0.26 0.012 255)" }}>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-white">Conta Pré-paga (PIX/boleto)</span>
              <span className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>Ativa alertas no Telegram quando saldo ≤ R$ 100</span>
            </div>
            <button
              type="button"
              disabled={setPrePaidMutation.isPending || !token}
              onClick={() => {
                if (!token) return;
                const next = getNextPrePaidStatus(isPrePaid);
                setIsPrePaid(next);
                setPrePaidMutation.mutate({ token, clientId, isPrePaid: next });
              }}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50"
              style={{ background: isPrePaid ? "oklch(0.68 0.16 160)" : "oklch(0.26 0.012 255)" }}
              aria-pressed={isPrePaid}
              aria-label="Marcar conta como pré-paga"
            >
              <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform" style={{ transform: isPrePaid ? "translateX(24px)" : "translateX(4px)" }} />
            </button>
          </div>

          {/* ─── Instagram ────────────────────────────────────────────────── */}
          <SectionCard
            title="Instagram Business"
            icon="📸"
            accentColor={isIgExpired ? "oklch(0.65 0.22 25)" : isIgWarning ? "oklch(0.75 0.18 60)" : "oklch(0.72 0.18 320)"}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                {igStatus.data?.connected ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" style={{ color: isIgExpired ? "oklch(0.65 0.22 25)" : "oklch(0.72 0.18 320)" }} />
                    <span className="text-sm" style={{ color: isIgExpired ? "oklch(0.65 0.22 25)" : "oklch(0.72 0.18 320)" }}>@{igStatus.data.username}</span>
                    {igStatus.data.daysSince !== undefined && (
                      <span className="text-xs" style={{ color: "oklch(0.45 0.010 240)" }}>· token há {igStatus.data.daysSince} dias</span>
                    )}
                    {isIgExpired && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.65 0.22 25 / 0.15)", color: "oklch(0.75 0.22 25)" }}>Token expirado</span>}
                    {isIgWarning && !isIgExpired && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.75 0.18 60 / 0.15)", color: "oklch(0.80 0.18 60)" }}>Expira em breve</span>}
                  </>
                ) : (
                  <p className="text-sm" style={{ color: "oklch(0.50 0.010 240)" }}>
                    {igStatus.data?.pending
                      ? "Autorização recebida. Detecte e escolha o perfil correto antes de ativar."
                      : "Instagram não configurado."}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  if (!token) return toast.error("Sessão de gestor expirada. Entre novamente.");
                  getOAuthUrlAsManager.mutate({ clientId, token });
                }}
                disabled={getOAuthUrlAsManager.isPending}
                className="text-xs font-semibold px-3 py-1.5 rounded-md transition-all flex-shrink-0"
                style={{
                  background: isIgExpired ? "oklch(0.65 0.22 25 / 0.15)" : "oklch(0.72 0.18 320 / 0.15)",
                  color: isIgExpired ? "oklch(0.75 0.22 25)" : "oklch(0.80 0.18 320)",
                  border: `1px solid ${isIgExpired ? "oklch(0.65 0.22 25 / 0.4)" : "oklch(0.72 0.18 320 / 0.35)"}`,
                }}
              >
                {igStatus.data?.connected ? (isIgExpired ? "🔄 Reconectar" : "🔄 Renovar token") : "🔗 Conectar via OAuth"}
              </button>
            </div>

            {/* Auto-detect from Meta token */}
            {metaStatus.data?.connected && (
              <div className="flex flex-col gap-3 pt-3" style={{ borderTop: "1px solid oklch(0.22 0.012 255)" }}>
                <p className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>Ou detecte o perfil pelo token Meta Ads salvo:</p>
                <button
                  onClick={handleListIgProfiles}
                  disabled={loadingIgProfiles}
                  className="text-xs font-semibold px-3 py-1.5 rounded-md w-fit transition-all"
                  style={{ background: "oklch(0.72 0.18 320 / 0.15)", color: "oklch(0.80 0.18 320)", border: "1px solid oklch(0.72 0.18 320 / 0.35)", opacity: loadingIgProfiles ? 0.6 : 1 }}
                >
                  {loadingIgProfiles ? "Buscando perfis..." : "🔍 Detectar perfis Instagram"}
                </button>

                {igProfiles.length > 0 && (
                  <div className="rounded-lg overflow-hidden" style={{ border: "1px solid oklch(0.28 0.012 255)" }}>
                    <div className="overflow-y-auto" style={{ maxHeight: "200px" }}>
                      {igProfiles.map((p) => (
                        <button
                          key={p.igUserId}
                          onClick={() => { setIgUserId(p.igUserId); setIgUsername(p.username); }}
                          className="w-full text-left px-3 py-2.5 text-xs transition-all"
                          style={{
                            borderBottom: "1px solid oklch(0.22 0.012 255)",
                            background: igUserId === p.igUserId ? "oklch(0.72 0.18 320 / 0.15)" : "transparent",
                            color: igUserId === p.igUserId ? "oklch(0.80 0.18 320)" : "oklch(0.75 0.005 220)",
                          }}
                          onMouseEnter={(e) => { if (igUserId !== p.igUserId) e.currentTarget.style.background = "oklch(0.20 0.012 255)"; }}
                          onMouseLeave={(e) => { if (igUserId !== p.igUserId) e.currentTarget.style.background = "transparent"; }}
                        >
                          <span className="font-semibold">@{p.username}</span>
                          {p.name && <span className="ml-2 opacity-60">{p.name}</span>}
                          {p.followersCount > 0 && <span className="ml-2 opacity-50">{p.followersCount.toLocaleString("pt-BR")} seguidores</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {igUserId && igUsername && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3 py-2 rounded-lg text-xs" style={{ background: "oklch(0.72 0.18 320 / 0.10)", border: "1px solid oklch(0.72 0.18 320 / 0.30)" }}>
                      <span className="font-semibold" style={{ color: "oklch(0.80 0.18 320)" }}>@{igUsername}</span>
                      <span className="ml-2" style={{ color: "oklch(0.50 0.010 240)" }}>selecionado</span>
                    </div>
                    <ActionBtn onClick={() => saveInstagram.mutate({ token: token!, clientId, igUserId: igUserId.trim(), igUsername: igUsername.trim() })} disabled={saveInstagram.isPending}>
                      {saveInstagram.isPending ? "Salvando..." : "Salvar"}
                    </ActionBtn>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* ─── Dados de Vendas (Monday.com) ─────────────────────────────── */}
          <SectionCard title="Dados de Vendas (Monday.com)" icon="📋" accentColor="oklch(0.72 0.18 145)">
            {uploadInfo.data ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" style={{ color: "oklch(0.72 0.18 145)" }} />
                <span className="text-sm" style={{ color: "oklch(0.72 0.18 145)" }}>
                  {uploadInfo.data.totalRecords} registros importados
                  {uploadInfo.data.uploadedAt && (
                    <span className="ml-2 text-xs" style={{ color: "oklch(0.45 0.010 240)" }}>
                      — atualizado em {new Date(uploadInfo.data.uploadedAt).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <p className="text-sm" style={{ color: "oklch(0.50 0.010 240)" }}>Nenhuma planilha importada ainda.</p>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "oklch(0.65 0.010 240)" }}>Importar planilha do Monday.com (.xlsx)</label>
              <p className="text-xs" style={{ color: "oklch(0.45 0.010 240)" }}>
                Exporte o board do cliente no Monday.com e faça upload aqui. O sistema lê as colunas
                <strong className="text-white"> Data da Consulta</strong>, <strong className="text-white">Fechou</strong> e <strong className="text-white">Valor Cirurgia</strong>.
              </p>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleXlsxUpload(file); }} />
              <ActionBtn onClick={() => fileInputRef.current?.click()} disabled={uploadingXlsx} variant="secondary">
                {uploadingXlsx ? "Importando..." : "📂 Selecionar arquivo .xlsx"}
              </ActionBtn>
            </div>
          </SectionCard>

          {/* ─── Sincronização Direta Monday.com ─────────────────────────── */}
          <SectionCard title="Sincronização Direta Monday.com" icon="🔄" accentColor="oklch(0.72 0.18 145)">
            <p className="text-xs" style={{ color: "oklch(0.50 0.010 240)" }}>
              Sincronize os dados de vendas diretamente do board do Monday.com, sem precisar exportar planilha. Informe o ID do board (número na URL do Monday).
            </p>

            {mondayStatus.data?.boardId && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" style={{ color: "oklch(0.72 0.18 145)" }} />
                <span className="text-sm" style={{ color: "oklch(0.72 0.18 145)" }}>
                  Board configurado: <span className="font-mono text-xs">{mondayStatus.data.boardId}</span>
                  {mondayStatus.data.lastSync && (
                    <span className="ml-2 text-xs" style={{ color: "oklch(0.45 0.010 240)" }}>
                      — última sync: {new Date(mondayStatus.data.lastSync).toLocaleString("pt-BR")}
                    </span>
                  )}
                </span>
              </div>
            )}

            <div className="flex gap-2 items-end">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "oklch(0.65 0.010 240)" }}>Board ID do Monday.com</label>
                <StyledInput
                  placeholder="Ex: 7171531533"
                  value={mondayBoardId || mondayStatus.data?.boardId || ""}
                  onChange={setMondayBoardId}
                />
              </div>
              {mondayBoardId.trim() && mondayBoardId !== mondayStatus.data?.boardId && (
                <ActionBtn onClick={() => saveBoardId.mutate({ clientId, boardId: mondayBoardId.trim(), managerToken: token! })} disabled={saveBoardId.isPending}>
                  {saveBoardId.isPending ? "Salvando..." : "Salvar ID"}
                </ActionBtn>
              )}
            </div>
            <p className="text-xs" style={{ color: "oklch(0.40 0.010 240)" }}>
              O Board ID está na URL do Monday.com: monday.com/boards/<strong className="text-white">7171531533</strong>
            </p>

            {mondayStatus.data && !mondayStatus.data.hasToken && (
              <div className="rounded-lg p-3 text-xs" style={{ background: "oklch(0.75 0.18 60 / 0.08)", border: "1px solid oklch(0.75 0.18 60 / 0.25)", color: "oklch(0.75 0.18 60)" }}>
                <strong>Integração Monday.com não configurada.</strong> Use o upload de planilha XLSX para importar dados de vendas.
              </div>
            )}

            {(!mondayStatus.data || mondayStatus.data.hasToken) && (
              <ActionBtn onClick={handleSyncMonday} disabled={syncingMonday || (!mondayStatus.data?.boardId && !mondayBoardId.trim())} color="oklch(0.72 0.18 145)">
                {syncingMonday ? "Sincronizando..." : "🔄 Sincronizar tudo agora"}
              </ActionBtn>
            )}
          </SectionCard>

          {/* ─── Meta CAPI ─────────────────────────────────────────────────── */}
          {/* ─── Tipos de campanha ─────────────────────────────────────────── */}
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
              disabled={savingCampaignTypes || !token}
              onClick={() => { if (!token) return; setSavingCampaignTypes(true); saveCampaignTypesMutation.mutate({ token, clientId, campaignTypes }); }}
              className="self-start px-3 py-1.5 text-xs font-semibold rounded-md transition-all"
              style={{ background: "oklch(0.60 0.18 240)", color: "white", opacity: savingCampaignTypes ? 0.6 : 1 }}
            >
              {savingCampaignTypes ? "Salvando..." : "Salvar tipos"}
            </button>
          </div>
          <SectionCard title="Rastreamento de Campanha (Meta CAPI)" icon="🎯" accentColor="oklch(0.65 0.22 25)">
            <p className="text-sm" style={{ color: "oklch(0.50 0.010 240)" }}>
              Configure o Pixel ID e o Token da Conversions API para rastrear de qual campanha cada lead veio e enviar fechamentos de volta para o Meta.
            </p>
            {capiConfig.data?.configured && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" style={{ color: "oklch(0.72 0.18 145)" }} />
                <span className="text-sm" style={{ color: "oklch(0.72 0.18 145)" }}>CAPI configurado — Pixel ID: {capiConfig.data.metaPixelId}</span>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "oklch(0.65 0.010 240)" }}>Pixel ID</label>
              <StyledInput placeholder="Ex: 123456789012345" value={metaPixelId} onChange={setMetaPixelId} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "oklch(0.65 0.010 240)" }}>Token de Acesso da Conversions API</label>
              <StyledInput type="password" placeholder="Token gerado em Gerenciador de Eventos > Pixel > Configurações > API de Conversões" value={metaCAPIToken} onChange={setMetaCAPIToken} />
            </div>
            <ActionBtn onClick={() => saveCAPI.mutate({ token: token!, clientId, metaPixelId, metaCAPIToken })} disabled={saveCAPI.isPending || !metaPixelId} color="oklch(0.65 0.22 25)">
              {saveCAPI.isPending ? "Salvando..." : "Salvar CAPI"}
            </ActionBtn>
            <p className="text-xs" style={{ color: "oklch(0.40 0.010 240)" }}>
              Após configurar, vá em CRM &gt; Leads e clique em "Sincronizar Lead Ads" para identificar de qual anúncio cada lead veio.
            </p>
          </SectionCard>

          {/* ─── Tema do Relatório ─────────────────────────────────────────── */}
          {token && clientId ? <ReportThemeCard token={token} clientId={clientId} /> : null}

          {/* ─── Identificador interno ─────────────────────────────────────── */}
          <SectionCard title="Identificador interno" icon="🔒" accentColor="oklch(0.60 0.18 240)">
            <p className="text-sm" style={{ color: "oklch(0.50 0.010 240)" }}>
              Este nome organiza o cliente internamente. O link compartilhável usa um token seguro e não pode ser previsível.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "oklch(0.65 0.010 240)" }}>Identificador (ex: drtatiana)</label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <StyledInput
                    placeholder="ex: drtatiana"
                    value={slug}
                    onChange={(v) => setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  />
                </div>
                <ActionBtn onClick={handleSaveSlug} disabled={updateSlug.isPending}>
                  {updateSlug.isPending ? "Salvando..." : "Salvar"}
                </ActionBtn>
              </div>
              {slugError && <p className="text-xs" style={{ color: "oklch(0.65 0.22 25)" }}>{slugError}</p>}
              <div className="pt-3" style={{ borderTop: "1px solid oklch(0.26 0.012 255)" }}>
                <p className="text-xs mb-2" style={{ color: "oklch(0.50 0.010 240)" }}>Caso o link tenha sido enviado à pessoa errada, gere outro para invalidar o anterior.</p>
                <ActionBtn
                  variant="danger"
                  disabled={regeneratePublicToken.isPending || !token}
                  onClick={() => {
                    if (token && window.confirm("Regenerar o link seguro? O link anterior vai parar de funcionar.")) {
                      regeneratePublicToken.mutate({ token, clientId });
                    }
                  }}
                >
                  {regeneratePublicToken.isPending ? "Regenerando..." : "Regenerar link seguro"}
                </ActionBtn>
              </div>
            </div>
          </SectionCard>

          {/* ─── Grupo de WhatsApp (Z-API) ─────────────────────────────────────── */}
          <SectionCard title="Grupo de WhatsApp" icon="💬" accentColor="oklch(0.72 0.18 145)">
            <p className="text-sm" style={{ color: "oklch(0.50 0.010 240)" }}>
              Selecione o grupo de WhatsApp para envio automático de relatórios.
            </p>

            {/* Selected group display */}
            {whatsappGroupId && (
              <div className="px-3 py-2 rounded-md text-xs flex items-center gap-2" style={{ background: "oklch(0.72 0.18 145 / 0.10)", color: "oklch(0.75 0.14 145)" }}>
                <span>✓ Grupo atual:</span>
                <span className="font-semibold">{selectedGroupName || whatsappGroupId}</span>
              </div>
            )}

            {/* Dropdown trigger */}
            {!showGroupDropdown ? (
              <ActionBtn
                onClick={() => { setShowGroupDropdown(true); refetchGroups(); }}
                color="oklch(0.72 0.18 145)"
              >
                {whatsappGroupId ? "🔄 Trocar grupo" : "📱 Selecionar grupo"}
              </ActionBtn>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <StyledInput
                    placeholder="Buscar grupo..."
                    value={groupSearch}
                    onChange={(v) => setGroupSearch(v)}
                  />
                  <ActionBtn variant="secondary" onClick={() => { setShowGroupDropdown(false); setGroupSearch(""); }}>X</ActionBtn>
                </div>
                {loadingGroups ? (
                  <p className="text-xs text-center py-2" style={{ color: "oklch(0.55 0.010 240)" }}>Carregando grupos...</p>
                ) : filteredGroups.length === 0 ? (
                  <p className="text-xs text-center py-2" style={{ color: "oklch(0.55 0.010 240)" }}>Nenhum grupo encontrado</p>
                ) : (
                  <div className="flex flex-col gap-1 max-h-48 overflow-y-auto rounded-md" style={{ border: "1px solid oklch(0.26 0.012 255)" }}>
                    {filteredGroups.map((g: { id: string; name: string }) => (
                      <button
                        key={g.id}
                        onClick={() => { setWhatsappGroupId(g.id); setShowGroupDropdown(false); setGroupSearch(""); }}
                        className="text-left px-3 py-2 text-xs transition-all"
                        style={{
                          background: g.id === whatsappGroupId ? "oklch(0.72 0.18 145 / 0.20)" : "transparent",
                          color: g.id === whatsappGroupId ? "oklch(0.75 0.14 145)" : "oklch(0.80 0.005 220)",
                        }}
                      >
                        <span className="font-semibold">{g.name}</span>
                        <span className="ml-2 font-mono opacity-50 text-[10px]">{g.id.split('@')[0]}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Save button */}
            {whatsappGroupId && !showGroupDropdown && (
              <ActionBtn
                onClick={() => {
                  if (!token || !clientId || !whatsappGroupId.trim()) return;
                  setSavingGroupId(true);
                  saveGroupIdMutation.mutate({ clientId: Number(clientId), groupId: whatsappGroupId.trim(), managerToken: token });
                }}
                disabled={savingGroupId}
                color="oklch(0.55 0.18 145)"
              >
                {savingGroupId ? "Salvando..." : "Salvar grupo"}
              </ActionBtn>
            )}
          </SectionCard>

        </div>
      </div>
    </div>
  );
}
