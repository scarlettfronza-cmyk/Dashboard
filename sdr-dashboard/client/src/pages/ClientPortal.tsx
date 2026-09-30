/**
 * ClientPortal — o que o médico vê ao abrir o link, sem login.
 *
 * Mostra os números do período em cartões e gráficos, seguidos do texto que a
 * SDR escreveu. Só aparecem relatórios PUBLICADOS.
 *
 * Os gráficos vêm do snapshot gravado com cada relatório, não de uma consulta
 * ao vivo ao Monday: assim os números nunca contradizem o texto que já foi
 * enviado, e recarregar a página não gera chamada a API nenhuma.
 */
import { useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { BarChart3, FileText, Loader2, AlertCircle } from "lucide-react";
import { ReportVisuals } from "@/components/ReportVisuals";

export default function ClientPortal() {
  const [, params] = useRoute("/portal/:token");
  const token = params?.token ?? "";
  const [aberto, setAberto] = useState<number | null>(null);

  const { data, isLoading, error } = trpc.sdr.clientPortal.useQuery({ token }, { enabled: token.length > 15, retry: false });

  if (!token || error || (!isLoading && !data)) return <Aviso texto="Link inválido ou expirado." erro />;
  if (isLoading || !data) return <Aviso texto="Carregando seu relatório..." carregando />;

  const relatorios = data.reports;
  // O mais recente já vem aberto: quem abre o link quer ver o último resultado.
  const expandido = aberto ?? relatorios[0]?.id ?? null;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <header className="px-5 py-5" style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-4xl mx-auto flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, oklch(0.55 0.20 280), oklch(0.50 0.22 300))" }}
          >
            <BarChart3 size={22} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1
              className="text-xl font-extrabold tracking-tight truncate"
              style={{ fontFamily: "'DM Sans', sans-serif", color: "var(--foreground)", letterSpacing: "-0.02em" }}
            >
              {data.client.name}
            </h1>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Relatórios de performance comercial
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-7 space-y-5">
        {relatorios.length === 0 ? (
          <div className="rounded-2xl px-8 py-16 text-center" style={{ background: "var(--card)", border: "1px solid var(--border)" }}>
            <FileText size={34} className="mx-auto mb-4" style={{ color: "var(--muted-foreground)" }} />
            <p className="text-base" style={{ color: "var(--muted-foreground)" }}>
              Nenhum relatório publicado ainda.
            </p>
          </div>
        ) : (
          relatorios.map(r => {
            const isAberto = expandido === r.id;
            return (
              <article
                key={r.id}
                className="rounded-2xl overflow-hidden"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <button
                  onClick={() => setAberto(isAberto ? -1 : r.id)}
                  className="w-full text-left px-6 py-5 flex items-start justify-between gap-4"
                >
                  <div className="min-w-0">
                    <h2
                      className="text-lg font-bold"
                      style={{ fontFamily: "'DM Sans', sans-serif", color: "var(--foreground)" }}
                    >
                      {r.snapshot?.periodo.label ?? r.period ?? "Relatório"}
                    </h2>
                    {r.publishedAt && (
                      <p className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                        Enviado em{" "}
                        {new Date(r.publishedAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <span
                    className="text-sm px-3 py-1.5 rounded-full flex-shrink-0"
                    style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
                  >
                    {isAberto ? "Fechar" : "Ver"}
                  </span>
                </button>

                {isAberto && (
                  <div className="px-6 pb-6 space-y-6">
                    {r.snapshot && <ReportVisuals snapshot={r.snapshot} />}

                    <div className="rounded-2xl p-6" style={{ background: "var(--secondary)", border: "1px solid var(--border)" }}>
                      <h3
                        className="text-base font-bold mb-3"
                        style={{ fontFamily: "'DM Sans', sans-serif", color: "var(--foreground)" }}
                      >
                        Análise do período
                      </h3>
                      {/* Texto puro, renderizado como texto. Nada de markdown ou
                          HTML aqui: é conteúdo público e não vale o risco. */}
                      <div
                        className="text-base leading-relaxed whitespace-pre-wrap"
                        style={{ color: "var(--foreground)" }}
                      >
                        {r.content}
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}

        <p className="text-sm text-center pt-4" style={{ color: "var(--muted-foreground)" }}>
          Este link é exclusivo do seu consultório. Não compartilhe.
        </p>
      </main>
    </div>
  );
}

function Aviso({ texto, erro, carregando }: { texto: string; erro?: boolean; carregando?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--background)" }}>
      <div className="text-center">
        {carregando ? (
          <Loader2 size={28} className="animate-spin mx-auto mb-4" style={{ color: "var(--primary)" }} />
        ) : (
          erro && <AlertCircle size={32} className="mx-auto mb-4" style={{ color: "oklch(0.55 0.20 25)" }} />
        )}
        <p className="text-base" style={{ color: "var(--muted-foreground)" }}>
          {texto}
        </p>
      </div>
    </div>
  );
}
