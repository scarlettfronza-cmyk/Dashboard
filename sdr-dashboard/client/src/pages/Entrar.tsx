/**
 * Entrar — login e cadastro com e-mail e senha, na mesma tela.
 *
 * Conta nova entra sem nenhum cliente vinculado: a SDR vê uma tela vazia até a
 * gestora atribuir os clientes dela pelo painel.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { LOCAL_LOGIN_REDIRECT_DELAY_MS } from "@/lib/sessionRedirect";
import { Eye, EyeOff, Loader2 } from "lucide-react";

type Mode = "entrar" | "criar";

export default function Entrar() {
  const [mode, setMode] = useState<Mode>("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const onDone = () => {
    // A resposta da mutation já recebeu o Set-Cookie. Esperamos um instante
    // antes de recarregar para que navegadores mais lentos persistam a sessão.
    window.setTimeout(() => window.location.replace("/"), LOCAL_LOGIN_REDIRECT_DELAY_MS);
  };

  const login = trpc.account.login.useMutation({ onSuccess: onDone, onError: e => setErro(e.message) });
  const signup = trpc.account.signup.useMutation({ onSuccess: onDone, onError: e => setErro(e.message) });

  const pending = login.isPending || signup.isPending;
  const podeEnviar =
    email.trim().length > 3 && password.length >= (mode === "criar" ? 8 : 1) && (mode === "entrar" || name.trim().length >= 2);

  const enviar = () => {
    if (!podeEnviar || pending) return;
    setErro(null);
    if (mode === "entrar") login.mutate({ email, password });
    else signup.mutate({ name, email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, oklch(0.55 0.20 280), oklch(0.50 0.22 300))" }}
          >
            <span className="text-white text-2xl font-bold">S</span>
          </div>
          <div className="text-center">
            <h1
              className="text-2xl font-extrabold tracking-tight"
              style={{ fontFamily: "'DM Sans', sans-serif", color: "var(--foreground)", letterSpacing: "-0.02em" }}
            >
              SDR Dashboard
            </h1>
            <p className="text-base mt-1" style={{ color: "var(--muted-foreground)" }}>
              Gestão comercial das clínicas
            </p>
          </div>
        </div>

        <div
          className="rounded-2xl p-7"
          style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "0 1px 3px oklch(0 0 0 / 0.06)" }}
        >
          {/* Alternador entre entrar e criar conta */}
          <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: "var(--secondary)" }}>
            {(["entrar", "criar"] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setErro(null);
                }}
                className="flex-1 py-2.5 rounded-lg text-base font-semibold transition-all"
                style={
                  mode === m
                    ? { background: "var(--card)", color: "var(--foreground)", boxShadow: "0 1px 2px oklch(0 0 0 / 0.08)" }
                    : { background: "transparent", color: "var(--muted-foreground)" }
                }
              >
                {m === "entrar" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {mode === "criar" && (
              <Campo label="Seu nome">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Luana Ferreira"
                  autoComplete="name"
                  className="w-full px-4 py-3 rounded-xl text-base outline-none transition-all focus:ring-2"
                  style={inputStyle}
                />
              </Campo>
            )}

            <Campo label="E-mail">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && enviar()}
                placeholder="voce@agencia.com"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl text-base outline-none transition-all focus:ring-2"
                style={inputStyle}
              />
            </Campo>

            <Campo label="Senha" hint={mode === "criar" ? "Mínimo de 8 caracteres" : undefined}>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && enviar()}
                  placeholder="••••••••"
                  autoComplete={mode === "criar" ? "new-password" : "current-password"}
                  className="w-full px-4 py-3 pr-12 rounded-xl text-base outline-none transition-all focus:ring-2"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: "var(--muted-foreground)" }}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Campo>

            {erro && (
              <p
                className="text-sm px-4 py-3 rounded-xl"
                style={{ background: "oklch(0.96 0.04 25)", color: "oklch(0.45 0.18 25)", border: "1px solid oklch(0.90 0.06 25)" }}
              >
                {erro}
              </p>
            )}

            <button
              onClick={enviar}
              disabled={!podeEnviar || pending}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-base font-semibold transition-all active:scale-[0.98] disabled:opacity-40"
              style={{ background: "var(--primary)", color: "white", fontFamily: "'DM Sans', sans-serif" }}
            >
              {pending && <Loader2 size={18} className="animate-spin" />}
              {mode === "entrar" ? "Entrar" : "Criar minha conta"}
            </button>
          </div>
        </div>

        {mode === "criar" && (
          <p className="text-sm text-center mt-5 leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            Depois de criar a conta, avise a gestora. Ela vincula os seus clientes
            e eles aparecem aqui na barra lateral.
          </p>
        )}
      </div>
    </div>
  );
}

const inputStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  color: "var(--foreground)",
};

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-semibold block mb-2" style={{ color: "var(--foreground)" }}>
        {label}
        {hint && (
          <span className="font-normal ml-2" style={{ color: "var(--muted-foreground)" }}>
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}
