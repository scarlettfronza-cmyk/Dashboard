/**
 * Elementos de narrativa do relatório: capa, títulos de seção e os blocos de
 * leitura em texto.
 *
 * O relatório mostrava os números sem dizer o que significam, e cabia ao
 * cliente interpretar. Aqui cada seção abre com uma frase de leitura, e o
 * período termina com análise, recomendação e próximos passos.
 */

type Theme = {
  bgCard: string; bgBorder: string; bgInput: string;
  textPrimary: string; textSecondary: string; textMuted: string;
};

/** Rótulo de seção: risco curto na cor da marca e texto em caixa alta. */
export function Eyebrow({ children, accentColor }: { children: React.ReactNode; accentColor: string }) {
  return (
    <p className="flex items-center gap-3 text-[10.5px] uppercase font-bold m-0 mb-2.5" data-print="lead"
       style={{ color: accentColor, letterSpacing: ".2em" }}>
      <span aria-hidden="true" style={{ width: 26, height: 2, background: accentColor, borderRadius: 2 }} />
      {children}
    </p>
  );
}

/** Frase de leitura que abre a seção, antes dos números. */
export function Statement({ children, t }: { children: React.ReactNode; t: Theme }) {
  return (
    <p className="text-[21px] md:text-[23px] font-bold m-0 mb-4 max-w-[680px]" data-print="lead"
       style={{ color: t.textPrimary, letterSpacing: "-.015em", lineHeight: 1.25 }}>
      {children}
    </p>
  );
}

export function Capa({ manchete, destaque, subtitulo, cliente, periodo, accentColor, t }: {
  manchete: string;
  destaque: string;
  subtitulo: string;
  cliente: string;
  periodo: string;
  accentColor: string;
  t: Theme;
}) {
  return (
    <section className="mb-10" data-print="keep">
      <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-5 text-[10.5px] uppercase font-semibold"
        style={{ border: `1px solid ${t.bgBorder}`, color: t.textSecondary, letterSpacing: ".18em" }}>
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: accentColor }} />
        Relatório de performance
      </span>

      <h1 className="text-[30px] md:text-[40px] font-bold m-0 mb-4"
        style={{ color: t.textPrimary, letterSpacing: "-.025em", lineHeight: 1.12 }}>
        {manchete}<br />
        <em className="not-italic" style={{ color: accentColor }}>{destaque}</em>
      </h1>

      <p className="text-[15px] md:text-base max-w-[640px] m-0 mb-7" style={{ color: t.textSecondary }}>
        {subtitulo}
      </p>

      <div style={{ borderTop: `1px solid ${t.bgBorder}`, paddingTop: 18 }}>
        <p className="text-[10px] uppercase font-semibold m-0 mb-1.5"
           style={{ color: t.textMuted, letterSpacing: ".2em" }}>Preparado para</p>
        <p className="text-[19px] md:text-[21px] font-bold m-0" style={{ color: t.textPrimary }}>{cliente}</p>
        <p className="text-xs mt-1 m-0" style={{ color: t.textMuted }}>{periodo}</p>
      </div>
    </section>
  );
}

export function Texto({ paragrafos, t }: { paragrafos: string[]; t: Theme }) {
  return (
    <div>
      {paragrafos.map((p, i) => (
        <p key={i} className="text-[14.5px] m-0 mb-3 max-w-[700px]" data-print="keep"
           style={{ color: t.textSecondary, lineHeight: 1.65 }}>{p}</p>
      ))}
    </div>
  );
}

export function Destaque({ paragrafos, accentColor, t }: {
  paragrafos: string[]; accentColor: string; t: Theme;
}) {
  return (
    <div className="rounded-xl px-5 py-5" data-print="keep"
      style={{ background: t.bgCard, border: `1px solid ${t.bgBorder}`, borderLeft: `3px solid ${accentColor}` }}>
      {paragrafos.map((p, i) => (
        <p key={i} className="text-[14.5px] m-0" style={{
          color: t.textSecondary, lineHeight: 1.65,
          marginBottom: i === paragrafos.length - 1 ? 0 : 11,
        }}>{p}</p>
      ))}
    </div>
  );
}
