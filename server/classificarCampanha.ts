/**
 * Em que "gaveta" cada campanha entra no relatório.
 *
 * Antes a regra era só o nome: FORMULARIO → formulário, SEGUIDOR → visitas,
 * e todo o resto virava "mensagens" — inclusive campanhas de vídeo e de
 * visitas ao perfil sem essa palavra, que inflavam o investimento em
 * mensagens. Agora a decisão segue três pistas, nesta ordem:
 *
 *  1. o nome, quando a gestora deixou a intenção explícita;
 *  2. o objetivo que o Meta devolve (`objective`);
 *  3. o que a campanha de fato gerou (conversas, leads de formulário, views).
 *
 * Nada casou → "outros", que aparece separado em vez de sujar outra gaveta.
 */

export type TipoCampanha = "mensagens" | "formulario" | "visitas" | "video" | "outros";

export const ROTULO_TIPO: Record<TipoCampanha, string> = {
  mensagens: "Mensagens",
  formulario: "Formulário",
  visitas: "Visitas ao perfil",
  video: "Vídeo",
  outros: "Outras",
};

export type PistasCampanha = {
  nome: string;
  objective?: string | null;
  conversas?: number;
  leadsFormulario?: number;
  visualizacoes?: number;
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** Palavras por gaveta. A ordem entre gavetas resolve nomes com mais de uma pista. */
const PALAVRAS: Array<[TipoCampanha, RegExp]> = [
  ["formulario", /FORMULARIO|\[LINK\]|LINK FORMULARIO|LEAD ?FORM|CADASTRO/],
  ["mensagens", /\bMSG|MENSAGE|WPP|WHATS|ZAP\b|DIRECT|CONVERSA/],
  ["video", /VIDEO|\bVIEWS?\b|VISUALIZA|THRUPLAY|VV\b/],
  ["visitas", /VISITA|SEGUIDOR|PERFIL|FOLLOW/],
];

/** Objetivos do Meta (os atuais OUTCOME_* e os antigos). */
const OBJETIVOS: Array<[TipoCampanha, RegExp]> = [
  ["mensagens", /^MESSAGES$/],
  ["formulario", /^(OUTCOME_LEADS|LEAD_GENERATION)$/],
  ["video", /^VIDEO_VIEWS$/],
  ["visitas", /^(OUTCOME_TRAFFIC|LINK_CLICKS|PROFILE_VISITS)$/],
];

export function tipoPeloNome(nome: string): TipoCampanha | null {
  const n = semAcento(nome);
  for (const [tipo, re] of PALAVRAS) if (re.test(n)) return tipo;
  return null;
}

export function tipoPeloObjetivo(objective: string | null | undefined, p: PistasCampanha): TipoCampanha | null {
  const o = (objective ?? "").toUpperCase();
  if (!o) return null;
  // Leads e engajamento são ambíguos no Meta: a conversa ou o lead diz qual foi.
  if (o === "OUTCOME_LEADS" || o === "OUTCOME_ENGAGEMENT") {
    if ((p.conversas ?? 0) > 0) return "mensagens";
    if ((p.leadsFormulario ?? 0) > 0) return "formulario";
    if (o === "OUTCOME_ENGAGEMENT" && (p.visualizacoes ?? 0) > 0) return "video";
    return o === "OUTCOME_LEADS" ? "formulario" : null;
  }
  for (const [tipo, re] of OBJETIVOS) if (re.test(o)) return tipo;
  return null;
}

export function tipoPeloResultado(p: PistasCampanha): TipoCampanha | null {
  if ((p.conversas ?? 0) > 0) return "mensagens";
  if ((p.leadsFormulario ?? 0) > 0) return "formulario";
  if ((p.visualizacoes ?? 0) > 0) return "video";
  return null;
}

export function classificarCampanha(p: PistasCampanha): TipoCampanha {
  return tipoPeloNome(p.nome) ?? tipoPeloObjetivo(p.objective, p) ?? tipoPeloResultado(p) ?? "outros";
}
