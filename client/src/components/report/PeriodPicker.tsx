/**
 * Seleção do período do relatório.
 *
 * A fileira de botões ocupava o cabeçalho inteiro e ainda assim não permitia
 * escolher um intervalo qualquer sem abrir dois seletores de data separados.
 * Aqui o período vira um único botão que abre um calendário de intervalo:
 * clica no primeiro dia, clica no último, pronto. Os atalhos continuam
 * disponíveis dentro do painel, onde não competem por espaço.
 */
import React, { useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { ptBR } from "date-fns/locale";
import { PRESETS, resolvePreset, type PresetId } from "@/lib/periodPresets";
import "react-day-picker/style.css";

type Theme = {
  bgCard: string; bgBorder: string; bgInput: string;
  textPrimary: string; textSecondary: string; textMuted: string;
};

/**
 * Variáveis do react-day-picker ajustadas ao tema do relatório.
 *
 * Sem isto o calendário sai com o azul e o fundo claro padrão da biblioteca:
 * no tema escuro o miolo do intervalo vira um bloco branco e os números ficam
 * ilegíveis. Os nomes vêm do style.css da própria biblioteca (v9).
 */
function estiloCalendario(accent: string, t: Theme): React.CSSProperties {
  return {
    ["--rdp-accent-color" as string]: accent,
    ["--rdp-accent-background-color" as string]: `${accent}26`,
    ["--rdp-range_start-date-background-color" as string]: accent,
    ["--rdp-range_end-date-background-color" as string]: accent,
    ["--rdp-range_start-background" as string]: "transparent",
    ["--rdp-range_end-background" as string]: "transparent",
    ["--rdp-range_start-color" as string]: "#fff",
    ["--rdp-range_end-color" as string]: "#fff",
    ["--rdp-range_middle-background-color" as string]: `${accent}26`,
    ["--rdp-range_middle-color" as string]: t.textPrimary,
    ["--rdp-today-color" as string]: accent,
    ["--rdp-day_button-border-radius" as string]: "8px",
    ["--rdp-day_button-border" as string]: "none",
    ["--rdp-selected-border" as string]: "none",
    ["--rdp-day-width" as string]: "36px",
    ["--rdp-day-height" as string]: "34px",
    ["--rdp-day_button-width" as string]: "34px",
    ["--rdp-day_button-height" as string]: "32px",
    ["--rdp-nav_button-width" as string]: "26px",
    ["--rdp-nav_button-height" as string]: "26px",
    ["--rdp-weekday-opacity" as string]: "0.65",
    ["--rdp-outside-opacity" as string]: "0.3",
    color: t.textPrimary,
    fontSize: "12.5px",
  } as React.CSSProperties;
}

function rotulo(from: Date, to: Date) {
  const f = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
  const ano = new Intl.DateTimeFormat("pt-BR", { year: "numeric" });
  const mesmoAno = from.getFullYear() === to.getFullYear();
  const mesmoDia = from.toDateString() === to.toDateString();
  if (mesmoDia) return `${f.format(from)} de ${ano.format(from)}`;
  return mesmoAno
    ? `${f.format(from)} – ${f.format(to)} de ${ano.format(to)}`
    : `${f.format(from)}/${ano.format(from)} – ${f.format(to)}/${ano.format(to)}`;
}

export function PeriodPicker({ from, to, onChange, accentColor, t, maxDate }: {
  from: Date;
  to: Date;
  onChange: (from: Date, to: Date) => void;
  accentColor: string;
  t: Theme;
  maxDate?: Date;
}) {
  const [aberto, setAberto] = useState(false);
  const [parcial, setParcial] = useState<DateRange | undefined>();

  function escolher(r: DateRange | undefined) {
    setParcial(r);
    // Só aplica com o intervalo completo: um clique isolado ainda é meio período.
    if (r?.from && r?.to) {
      onChange(r.from, r.to);
      setParcial(undefined);
      setAberto(false);
    }
  }

  function atalho(id: PresetId) {
    const p = resolvePreset(id, new Date());
    onChange(p.from, p.to);
    setParcial(undefined);
    setAberto(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((o) => !o)}
        aria-expanded={aberto}
        aria-label="Escolher período do relatório"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-opacity hover:opacity-85"
        style={{ background: t.bgInput, border: `1px solid ${t.bgBorder}`, color: t.textSecondary }}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeWidth="2" />
        </svg>
        {rotulo(from, to)}
        <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" strokeWidth="2" />
        </svg>
      </button>

      {aberto && (
        <>
          {/* Clique fora fecha o painel. */}
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div
            className="absolute right-0 mt-2 z-50 rounded-2xl shadow-2xl flex flex-col sm:flex-row overflow-hidden"
            style={{ background: t.bgCard, border: `1px solid ${t.bgBorder}` }}
          >
            <div
              className="flex sm:flex-col gap-1 p-3 flex-wrap sm:w-[130px] sm:flex-nowrap"
              style={{ borderRight: `1px solid ${t.bgBorder}` }}
            >
              <p className="hidden sm:block text-[9px] uppercase tracking-widest font-semibold mb-1"
                 style={{ color: t.textMuted }}>Atalhos</p>
              {PRESETS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => atalho(id)}
                  className="text-left px-2.5 py-1.5 rounded-lg text-[11px] transition-colors hover:opacity-80 whitespace-nowrap"
                  style={{ color: t.textSecondary, background: "transparent" }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-3">
              <DayPicker
                mode="range"
                numberOfMonths={1}
                locale={ptBR}
                defaultMonth={from}
                selected={parcial ?? { from, to }}
                onSelect={escolher}
                disabled={maxDate ? { after: maxDate } : undefined}
                /* As variáveis são declaradas em .rdp-root pela própria
                   biblioteca, então precisam ser aplicadas neste elemento:
                   defini-las no elemento pai não tem efeito algum. */
                style={estiloCalendario(accentColor, t)}
              />
              <p className="text-[10px] px-1 pt-1" style={{ color: t.textMuted }}>
                Clique no primeiro e no último dia do período.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
