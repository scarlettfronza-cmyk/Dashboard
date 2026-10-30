/**
 * Relatório de demonstração: /r/demo.
 *
 * Serve para mostrar a um cliente em potencial como o relatório chega, sem
 * expor nenhum cliente real. Os números são inventados, coerentes entre si,
 * e a página avisa que é um exemplo. Não toca no servidor: a tela usa estes
 * dados no lugar das consultas.
 */

export const TOKEN_DEMO = "demo";

export function ehDemo(token: string | undefined): boolean {
  return token === TOKEN_DEMO;
}

/** Miniatura em SVG com gradiente escuro e um rótulo — sem usar foto de ninguém. */
function miniatura(rotulo: string, tom: number): string {
  // Quadrado com o texto no centro: sobrevive ao recorte em qualquer proporção.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${tom},45%,26%)"/><stop offset="1" stop-color="hsl(${tom + 20},60%,12%)"/>
  </linearGradient></defs>
  <rect width="600" height="600" fill="url(#g)"/>
  <circle cx="470" cy="140" r="90" fill="rgba(230,57,70,0.35)"/>
  <circle cx="150" cy="460" r="130" fill="rgba(255,255,255,0.06)"/>
  <text x="300" y="300" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="700" fill="rgba(255,255,255,0.85)">${rotulo}</text>
  <text x="300" y="336" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="17" fill="rgba(255,255,255,0.45)">exemplo ilustrativo</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const AGORA = new Date();
const diasAtras = (n: number) => new Date(AGORA.getTime() - n * 86_400_000).toISOString();

export const DEMO_CLIENTE = {
  id: 0,
  name: "Clínica Exemplo",
  hasMetaAds: true,
  igUsername: "clinicaexemplo",
  whatsappNumber: null as string | null,
  mondayBoardId: null as string | null,
  logoUrl: null as string | null,
  brandColor: null as string | null,
  reportTheme: "dark",
  ajustes: [
    { acao: "Trocamos os dois criativos de imagem por vídeos curtos com depoimento.", resultado: "o custo por lead caiu de R$ 19,40 para R$ 11,87." },
    { acao: "Pausamos o público amplo e concentramos a verba no público de interesse em estética.", resultado: null as string | null },
  ],
  proximosPassos: [
    { acao: "Subir campanha de formulário para avaliação gratuita, com verba separada.", prazo: new Date(AGORA.getFullYear(), AGORA.getMonth() + 1, 5).toISOString().slice(0, 10) },
    { acao: "Testar oferta de pacote em vez de procedimento avulso nos anúncios de mensagem.", prazo: null as string | null },
  ],
};

// Investimento R$ 2.919,01 · 246 leads · CPL R$ 11,87 · 31 consultas · 9 vendas.
const INVESTIMENTO = 2919.01;
const LEADS = 246;
const CONSULTAS = 31;
const VENDAS = 9;
const RECEITA_CONSULTAS = 4650;
const RECEITA_FECHAMENTOS = 38400;
const RECEITA = RECEITA_CONSULTAS + RECEITA_FECHAMENTOS;

export const DEMO_KPIS = {
  investimento: INVESTIMENTO,
  leads: LEADS,
  consultas: CONSULTAS,
  vendas: VENDAS,
  totalConsultas: RECEITA_CONSULTAS,
  totalCirurgias: RECEITA_FECHAMENTOS,
  totalEmVendas: RECEITA,
  receitaTotal: RECEITA,
  roas: RECEITA / INVESTIMENTO,
  ticketMedio: RECEITA / CONSULTAS,
  custoPorLead: INVESTIMENTO / LEADS,
  custoPorVenda: INVESTIMENTO / VENDAS,
  custoPorConsulta: INVESTIMENTO / CONSULTAS,
  taxaConversao: (CONSULTAS / LEADS) * 100,
  novosSeguidores: 184,
  novosContatos: 205,
  alcance: 12480,
  cliquesEstimados: 318,
  custoPorClique: 1.42,
  mediaDataAvailable: true,
  metaApiSuccess: true,
  campanhas: {
    mensagens: { investimento: 1740.5, leads: 171, custoPorLead: 1740.5 / 171 },
    formulario: { investimento: 690.26, cliques: 318, custoPorClique: 690.26 / 318, leads: 75, custoPorLead: 690.26 / 75 },
    visitas: { investimento: 312.25, alcance: 12480, custoPorVisita: 312.25 / 12480 },
    video: { investimento: 176, visualizacoes: 22900, custoPorVisualizacao: 176 / 22900 },
  },
  revenueLineage: { label: "CRM da clínica (exemplo)", updatedAt: AGORA.toISOString(), roasFormula: "(Receita de consultas + receita de fechamentos) ÷ investimento" },
};

export const DEMO_INSTAGRAM = {
  connected: true,
  username: "clinicaexemplo",
  totals: { novosSeguidores: 184, totalSeguidores: 12640, views: 98400, reach: 41200, interactions: 212, profileVisits: 3180 },
};

const post = (id: number, tipo: string, rotulo: string, tom: number, legenda: string, ins: { saved: number; shares: number; likes: number; comments: number; views?: number; reach?: number }, dias: number) => ({
  id: `demo-${id}`,
  mediaType: tipo,
  mediaUrl: miniatura(rotulo, tom),
  thumbnailUrl: null as string | null,
  permalink: "#",
  caption: legenda,
  timestamp: diasAtras(dias),
  insights: ins,
  engagementScore: ins.saved * 3 + ins.shares * 2 + ins.likes + ins.comments,
});

export const DEMO_POSTS = {
  posts: [
    post(1, "VIDEO", "Reels · bastidores", 350, "Bastidores de um dia na clínica: como preparamos cada atendimento.", { saved: 412, shares: 288, likes: 1930, comments: 64, views: 38400 }, 6),
    post(2, "CAROUSEL_ALBUM", "Carrossel · dúvidas", 20, "5 dúvidas que mais chegam no nosso direct, respondidas.", { saved: 356, shares: 141, likes: 1210, comments: 48, reach: 14900 }, 11),
    post(3, "VIDEO", "Reels · depoimento", 300, "O que mudou na rotina da paciente depois do tratamento.", { saved: 198, shares: 176, likes: 1480, comments: 92, views: 27100 }, 15),
    post(4, "IMAGE", "Post · equipe", 200, "Nossa equipe, pronta para te receber.", { saved: 44, shares: 23, likes: 860, comments: 31, reach: 9800 }, 19),
    post(5, "VIDEO", "Reels · dica", 330, "Dica rápida: o que evitar nas 24 horas antes da avaliação.", { saved: 171, shares: 98, likes: 940, comments: 27, views: 16300 }, 23),
    post(6, "IMAGE", "Post · agenda", 10, "Agenda de novembro aberta. Chama no direct para agendar.", { saved: 38, shares: 19, likes: 610, comments: 22, reach: 7200 }, 27),
  ],
};

const anuncio = (n: number, format: "video" | "image" | "carousel", tom: number, spend: number) => ({
  adId: `demo-ad-${n}`,
  adName: `Anúncio ${n}`,
  format,
  thumbnailUrl: miniatura(`Anúncio ${n}`, tom),
  spend,
});

export const DEMO_CRIATIVOS = {
  creatives: [
    anuncio(1, "video", 350, 980.4),
    anuncio(2, "video", 300, 760.1),
    anuncio(3, "image", 20, 512.25),
    anuncio(4, "carousel", 200, 420.26),
    anuncio(5, "image", 330, 246),
  ],
};
