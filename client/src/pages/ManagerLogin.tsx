import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { BarChart3, Eye, EyeOff, ArrowLeft } from "lucide-react";

export default function ManagerLogin() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [regName, setRegName] = useState("");
  const [regAgency, setRegAgency] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPwd, setShowRegPwd] = useState(false);
  const [regError, setRegError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "register") setTab("register");
    const t = localStorage.getItem("manager_token");
    if (t) setLocation("/manager/dashboard");
  }, [setLocation]);

  const loginMutation = trpc.managers.login.useMutation({
    onSuccess: (data) => {
      localStorage.setItem("manager_token", data.token);
      localStorage.setItem("manager_name", data.name);
      localStorage.setItem("manager_email", data.email);
      setLocation("/manager/dashboard");
    },
    onError: (err) => setLoginError(err.message || "E-mail ou senha incorretos"),
  });

  const registerMutation = trpc.managers.register.useMutation({
    onSuccess: (data) => {
      localStorage.setItem("manager_token", data.token);
      localStorage.setItem("manager_name", data.name);
      localStorage.setItem("manager_email", data.email);
      setLocation("/manager/dashboard");
    },
    onError: (err) => setRegError(err.message || "Erro ao criar conta"),
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: "10px",
    background: "oklch(0.14 0.008 20)", border: "1px solid oklch(0.22 0.008 20)",
    color: "white", fontSize: "14px", outline: "none", transition: "border-color 0.2s",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "12px", fontWeight: 600,
    color: "oklch(0.60 0.010 60)", marginBottom: "6px",
    textTransform: "uppercase", letterSpacing: "0.05em",
  };

  return (
    <div className="min-h-screen flex" style={{ background: "oklch(0.08 0.006 20)" }}>
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 relative overflow-hidden"
        style={{ background: "oklch(0.10 0.006 20)", borderRight: "1px solid oklch(0.16 0.008 20)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(ellipse 60% 40% at 30% 20%, #E6394612 0%, transparent 70%)" }} />
        <a href="/" className="flex items-center gap-2 relative z-10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#E63946" }}>
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white tracking-wide">ESCARLATE DASHBOARD</span>
        </a>
        <div className="relative z-10">
          <div className="text-5xl font-black text-white leading-tight mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            Dados que<br /><span style={{ color: "#E63946" }}>vendem.</span>
          </div>
          <p className="text-base" style={{ color: "oklch(0.55 0.010 60)" }}>
            Dashboard profissional para gestores de tráfego pago. Meta Ads, Monday.com e Instagram em um único painel.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-2 gap-4">
          {[{ value: "Meta Ads", label: "API oficial" }, { value: "Monday", label: "CRM integrado" },
            { value: "Instagram", label: "Insights reais" }, { value: "IA", label: "Relatório automático" }].map(({ value, label }) => (
            <div key={value} className="p-4 rounded-xl"
              style={{ background: "oklch(0.13 0.008 20)", border: "1px solid oklch(0.20 0.008 20)" }}>
              <div className="text-sm font-bold text-white">{value}</div>
              <div className="text-xs mt-0.5" style={{ color: "oklch(0.50 0.010 60)" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#E63946" }}>
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm tracking-wide">ESCARLATE DASHBOARD</span>
          </div>

          <div className="flex rounded-xl p-1 mb-8" style={{ background: "oklch(0.13 0.008 20)", border: "1px solid oklch(0.20 0.008 20)" }}>
            {(["login", "register"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all"
                style={{ background: tab === t ? "#E63946" : "transparent", color: tab === t ? "white" : "oklch(0.55 0.010 60)" }}>
                {t === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          {tab === "login" ? (
            <form onSubmit={(e) => { e.preventDefault(); setLoginError(""); loginMutation.mutate({ email: loginEmail, password: loginPassword }); }} className="flex flex-col gap-5">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Bem-vinda de volta</h2>
                <p className="text-sm" style={{ color: "oklch(0.50 0.010 60)" }}>Entre com seu e-mail e senha para acessar o dashboard.</p>
              </div>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  placeholder="seu@email.com" required autoComplete="email" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "#E6394680")}
                  onBlur={e => (e.target.style.borderColor = "oklch(0.22 0.008 20)")} />
              </div>
              <div>
                <label style={labelStyle}>Senha</label>
                <div className="relative">
                  <input type={showLoginPwd ? "text" : "password"} value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="••••••••" required autoComplete="current-password"
                    style={{ ...inputStyle, paddingRight: "44px" }}
                    onFocus={e => (e.target.style.borderColor = "#E6394680")}
                    onBlur={e => (e.target.style.borderColor = "oklch(0.22 0.008 20)")} />
                  <button type="button" onClick={() => setShowLoginPwd(!showLoginPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "oklch(0.45 0.010 60)" }}>
                    {showLoginPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {loginError && (
                <div className="text-sm px-4 py-3 rounded-lg" style={{ background: "#E6394618", border: "1px solid #E6394640", color: "#ff6b6b" }}>
                  {loginError}
                </div>
              )}
              <button type="submit" disabled={loginMutation.isPending}
                className="w-full py-3.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: "#E63946", color: "white", opacity: loginMutation.isPending ? 0.7 : 1 }}
                onMouseEnter={e => !loginMutation.isPending && ((e.currentTarget as HTMLElement).style.background = "#c1121f")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "#E63946")}>
                {loginMutation.isPending ? "Entrando..." : "Entrar"}
              </button>
              <p className="text-center text-sm" style={{ color: "oklch(0.50 0.010 60)" }}>
                Não tem conta?{" "}
                <button type="button" onClick={() => setTab("register")} style={{ color: "#E63946", fontWeight: 600 }}>Criar agora</button>
              </p>
            </form>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setRegError(""); registerMutation.mutate({ name: regName, email: regEmail, password: regPassword, agencyName: regAgency || undefined }); }} className="flex flex-col gap-5">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Criar sua conta</h2>
                <p className="text-sm" style={{ color: "oklch(0.50 0.010 60)" }}>Comece a entregar relatórios profissionais hoje.</p>
              </div>
              <div>
                <label style={labelStyle}>Seu nome</label>
                <input type="text" value={regName} onChange={e => setRegName(e.target.value)}
                  placeholder="Scarlett Fronza" required minLength={2} style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "#E6394680")}
                  onBlur={e => (e.target.style.borderColor = "oklch(0.22 0.008 20)")} />
              </div>
              <div>
                <label style={labelStyle}>Nome da agência <span style={{ color: "oklch(0.45 0.010 60)", fontWeight: 400 }}>(opcional)</span></label>
                <input type="text" value={regAgency} onChange={e => setRegAgency(e.target.value)}
                  placeholder="Escarlate Digital" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "#E6394680")}
                  onBlur={e => (e.target.style.borderColor = "oklch(0.22 0.008 20)")} />
              </div>
              <div>
                <label style={labelStyle}>E-mail</label>
                <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                  placeholder="seu@email.com" required autoComplete="email" style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "#E6394680")}
                  onBlur={e => (e.target.style.borderColor = "oklch(0.22 0.008 20)")} />
              </div>
              <div>
                <label style={labelStyle}>Senha <span style={{ color: "oklch(0.45 0.010 60)", fontWeight: 400 }}>(mínimo 8 caracteres)</span></label>
                <div className="relative">
                  <input type={showRegPwd ? "text" : "password"} value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="••••••••" required minLength={8} autoComplete="new-password"
                    style={{ ...inputStyle, paddingRight: "44px" }}
                    onFocus={e => (e.target.style.borderColor = "#E6394680")}
                    onBlur={e => (e.target.style.borderColor = "oklch(0.22 0.008 20)")} />
                  <button type="button" onClick={() => setShowRegPwd(!showRegPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "oklch(0.45 0.010 60)" }}>
                    {showRegPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {regError && (
                <div className="text-sm px-4 py-3 rounded-lg" style={{ background: "#E6394618", border: "1px solid #E6394640", color: "#ff6b6b" }}>
                  {regError}
                </div>
              )}
              <button type="submit" disabled={registerMutation.isPending}
                className="w-full py-3.5 rounded-xl text-sm font-bold transition-all"
                style={{ background: "#E63946", color: "white", opacity: registerMutation.isPending ? 0.7 : 1 }}
                onMouseEnter={e => !registerMutation.isPending && ((e.currentTarget as HTMLElement).style.background = "#c1121f")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "#E63946")}>
                {registerMutation.isPending ? "Criando conta..." : "Criar conta grátis"}
              </button>
              <p className="text-center text-sm" style={{ color: "oklch(0.50 0.010 60)" }}>
                Já tem conta?{" "}
                <button type="button" onClick={() => setTab("login")} style={{ color: "#E63946", fontWeight: 600 }}>Entrar</button>
              </p>
            </form>
          )}

          <div className="mt-8 text-center">
            <a href="/" className="inline-flex items-center gap-1.5 text-xs transition-colors"
              style={{ color: "oklch(0.40 0.010 60)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "oklch(0.60 0.010 60)")}
              onMouseLeave={e => (e.currentTarget.style.color = "oklch(0.40 0.010 60)")}>
              <ArrowLeft className="w-3 h-3" />
              Voltar para o início
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
