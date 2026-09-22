/**
 * Análise do perfil no Instagram para o relatório público.
 *
 * Os dados vêm de `public.getPublicInstagramInsights`, que já existia no
 * servidor sem nenhuma tela consumindo.
 */
import { Eyebrow, Statement } from "./ReportNarrative";

export type IgTotals = {
  novosSeguidores: number;
  totalSeguidores: number;
  views: number;
  reach: number;
  /** Na origem é `website_clicks`: cliques no link do perfil. */
  interactions: number;
  profileVisits: number;
};

type Theme = {
  bgCard: string; bgBorder: string; bgInput: string;
  textPrimary: string; textSecondary: string; textMuted: string;
};

const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");

/** Base do período anterior, para expressar o ganho como percentual. */
function growthPct(total: number, novos: number) {
  const base = total - novos;
  if (base <= 0 || novos <= 0) return null;
  return (novos / base) * 100;
}

export function InstagramProfile({ totals, username, accentColor, periodLabel, t }: {
  totals: IgTotals;
  username?: string | null;
  accentColor: string;
  periodLabel: string;
  t: Theme;
}) {
  const pct = growthPct(totals.totalSeguidores, totals.novosSeguidores);
  const ganhou = totals.novosSeguidores > 0;
  const perdeu = totals.novosSeguidores < 0;

  const secundarios = [
    { label: "Alcance", value: n(totals.reach), hint: "contas distintas alcançadas" },
    { label: "Visualizações", value: n(totals.views), hint: "total de exibições" },
    { label: "Visitas ao perfil", value: n(totals.profileVisits), hint: "abriram o perfil" },
    { label: "Cliques no link", value: n(totals.interactions), hint: "clicaram no link da bio" },
  ];

  return (
    <section data-print="keep">
      <Eyebrow accentColor={accentColor}>Perfil no Instagram</Eyebrow>
      <Statement t={t}>
        {n(totals.novosSeguidores)} novos seguidores e {n(totals.profileVisits)} visitas ao perfil.
      </Statement>
      {username && (
        <p className="text-[12.5px] m-0 mb-4" style={{ color: t.textMuted, marginTop: -6 }}>
          @{username} · dados do perfil, não dos anúncios. Não somar com o alcance do tráfego.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-3 mb-3">
        {/* Seguidores — o número que a clínica acompanha */}
        <div
          className="rounded-2xl p-5 md:col-span-1 flex flex-col justify-center"
          style={{ background: t.bgCard, border: `1px solid ${t.bgBorder}` }}
        >
          <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: t.textMuted }}>
            Seguidores
          </p>
          <p className="text-3xl font-bold tracking-tight mt-1.5" style={{ color: t.textPrimary }}>
            {n(totals.totalSeguidores)}
          </p>
          {(ganhou || perdeu) && (
            <p className="text-sm font-semibold mt-2" style={{ color: ganhou ? accentColor : t.textSecondary }}>
              {ganhou ? "+" : ""}{n(totals.novosSeguidores)}
              {pct !== null && (
                <span className="font-normal"> · {ganhou ? "+" : ""}{pct.toFixed(1).replace(".", ",")}%</span>
              )}
            </p>
          )}
          <p className="text-[11px] mt-1" style={{ color: t.textMuted }}>
            {ganhou || perdeu ? `variação em ${periodLabel}` : `sem variação em ${periodLabel}`}
          </p>
        </div>

        {/* Alcance e atenção */}
        <div className="grid grid-cols-2 gap-3 md:col-span-2">
          {secundarios.map((m) => (
            <div
              key={m.label}
              className="rounded-2xl p-4 flex flex-col"
              style={{ background: t.bgCard, border: `1px solid ${t.bgBorder}` }}
            >
              <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: t.textMuted }}>
                {m.label}
              </p>
              <p className="text-xl font-bold tracking-tight mt-1" style={{ color: t.textPrimary }}>
                {m.value}
              </p>
              <p className="text-[10px] mt-auto pt-1" style={{ color: t.textMuted }}>{m.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed" style={{ color: t.textMuted }}>
        Números do perfil no período selecionado, direto da API do Instagram.
        Alcance conta cada pessoa uma vez; visualizações contam todas as exibições,
        por isso são sempre maiores.
      </p>
    </section>
  );
}
