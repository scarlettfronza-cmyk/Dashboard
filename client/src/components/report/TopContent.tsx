/**
 * Conteúdos que mais performaram, para o relatório público.
 *
 * A tela antiga mostrava só curtidas, comentários e salvamentos num grid
 * uniforme. A API já devolve alcance, compartilhamentos, legenda e data — e o
 * ranking usa um score que a clínica não tinha como interpretar. Aqui os três
 * primeiros ganham destaque com a leitura completa, e o critério fica explícito.
 */

export type IgPost = {
  id: string;
  mediaType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string;
  caption: string | null;
  timestamp: string;
  insights: Record<string, number>;
  engagementScore: number;
};

type Theme = {
  bgCard: string; bgBorder: string; bgInput: string;
  textPrimary: string; textSecondary: string; textMuted: string;
};

const n = (v: number | null | undefined) => (v ?? 0).toLocaleString("pt-BR");

const TIPO: Record<string, string> = {
  VIDEO: "Reel",
  CAROUSEL_ALBUM: "Carrossel",
  IMAGE: "Imagem",
};

function dataCurta(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Alcance para feed, visualizações para vídeo — a API não devolve os dois. */
function alcanceDe(p: IgPost) {
  const v = p.insights.reach ?? p.insights.views ?? 0;
  return { valor: v, rotulo: p.insights.reach != null ? "alcance" : "visualizações" };
}

function Metrica({ label, value, t }: { label: string; value: string; t: Theme }) {
  return (
    <div>
      <p className="text-[13px] font-bold leading-none" style={{ color: t.textPrimary }}>{value}</p>
      <p className="text-[10px] mt-0.5" style={{ color: t.textMuted }}>{label}</p>
    </div>
  );
}

function Thumb({ post, t, className = "" }: { post: IgPost; t: Theme; className?: string }) {
  const src = post.thumbnailUrl ?? post.mediaUrl;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: t.bgInput }}>
      {src ? (
        <img
          src={src}
          alt={post.caption?.slice(0, 80) ?? "Publicação do Instagram"}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: t.textMuted }}>
          sem prévia
        </div>
      )}
    </div>
  );
}

export function TopContent({ posts, accentColor, t }: {
  posts: IgPost[];
  accentColor: string;
  t: Theme;
}) {
  if (!posts.length) return null;
  const destaque = posts.slice(0, 3);
  const resto = posts.slice(3);

  return (
    <section>
      <div className="mb-4">
        <h3 className="text-base font-bold" style={{ color: t.textPrimary }}>
          Conteúdos que mais performaram
        </h3>
        <p className="text-xs mt-0.5" style={{ color: t.textMuted }}>
          Ordenados por engajamento ponderado: salvamentos contam 3×,
          compartilhamentos 2×, curtidas e comentários 1×.
        </p>
      </div>

      {/* Top 3 — leitura completa */}
      <div className="grid gap-3 md:grid-cols-3 mb-3">
        {destaque.map((post, i) => {
          const a = alcanceDe(post);
          return (
            <a
              key={post.id}
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-2xl overflow-hidden flex flex-col transition-opacity hover:opacity-95"
              style={{ background: t.bgCard, border: `1px solid ${t.bgBorder}` }}
            >
              <div className="relative">
                <Thumb post={post} t={t} className="aspect-[4/5]" />
                <span
                  className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                  style={{ background: accentColor }}
                >
                  #{i + 1}
                </span>
                <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/65 text-white">
                  {TIPO[post.mediaType] ?? "Publicação"}
                </span>
              </div>

              <div className="p-3.5 flex flex-col gap-3 flex-1">
                {post.caption && (
                  <p className="text-[11.5px] leading-snug line-clamp-2" style={{ color: t.textSecondary }}>
                    {post.caption}
                  </p>
                )}
                <div className="grid grid-cols-3 gap-2 mt-auto">
                  <Metrica label={a.rotulo} value={n(a.valor)} t={t} />
                  <Metrica label="salvamentos" value={n(post.insights.saved)} t={t} />
                  <Metrica label="compart." value={n(post.insights.shares)} t={t} />
                  <Metrica label="curtidas" value={n(post.insights.likes)} t={t} />
                  <Metrica label="comentários" value={n(post.insights.comments)} t={t} />
                  <div>
                    <p className="text-[13px] font-bold leading-none" style={{ color: accentColor }}>
                      {n(post.engagementScore)}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: t.textMuted }}>score</p>
                  </div>
                </div>
                <p className="text-[10px]" style={{ color: t.textMuted }}>{dataCurta(post.timestamp)}</p>
              </div>
            </a>
          );
        })}
      </div>

      {/* Demais publicações */}
      {resto.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {resto.map((post, i) => {
            const a = alcanceDe(post);
            return (
              <a
                key={post.id}
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl overflow-hidden block transition-opacity hover:opacity-95"
                style={{ background: t.bgCard, border: `1px solid ${t.bgBorder}` }}
              >
                <div className="relative">
                  <Thumb post={post} t={t} className="aspect-square" />
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-black/65 text-white">
                    #{i + 4}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="text-[11px] font-bold leading-none" style={{ color: t.textPrimary }}>
                    {n(a.valor)}
                  </p>
                  <p className="text-[9.5px] mt-0.5" style={{ color: t.textMuted }}>
                    {a.rotulo} · {n(post.insights.saved)} salvos
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </section>
  );
}
