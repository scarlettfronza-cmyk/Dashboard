# Dashboard SDR — Plano de Design

## Abordagens consideradas

### 1. Clean Corporate Slate
**Tema:** Interface profissional em tons de cinza-escuro com acentos em verde-esmeralda, inspirada em ferramentas como Linear e Vercel.
**Probabilidade:** 0.07

### 2. Warm Data Studio
**Tema:** Dashboard com fundo branco quente, tipografia serifada para títulos, acentos em terracota/coral — evoca relatórios de consultoria premium.
**Probabilidade:** 0.04

### 3. Midnight Operations *(escolhida)*
**Tema:** Interface dark com sidebar lateral, acentos em violeta-índigo e detalhes em âmbar dourado. Sensação de "sala de guerra" de vendas — focada, densa de informação, elegante.
**Probabilidade:** 0.03

---

## Abordagem Escolhida: Midnight Operations

### Design Movement
Data-dense dark UI — inspirado em Bloomberg Terminal, Linear e Raycast. Informação densa sem ser caótica.

### Core Principles
1. **Hierarquia por luminosidade** — elementos mais importantes são mais claros; dados secundários ficam em cinza-médio
2. **Densidade intencional** — cards compactos, sem espaço desperdiçado; cada pixel carrega informação
3. **Cor como sinal** — verde = fechado/positivo, vermelho = perdido, âmbar = em negociação, azul = neutro/info
4. **Sidebar fixa** — navegação persistente à esquerda, conteúdo flui à direita

### Color Philosophy
- Background: `#0f1117` (quase-preto azulado)
- Surface cards: `#1a1d27`
- Border sutil: `#2a2d3a`
- Primary accent: `#7c6af7` (violeta-índigo)
- Success: `#22c55e`
- Warning: `#f59e0b`
- Danger: `#ef4444`
- Texto principal: `#e8eaf0`
- Texto secundário: `#8b8fa8`

### Layout Paradigm
Sidebar fixa de 240px à esquerda + área de conteúdo principal. Dentro do conteúdo: grid assimétrico com KPI cards no topo e gráficos abaixo.

### Signature Elements
1. **KPI cards com borda-esquerda colorida** — indicador visual rápido do tipo de métrica
2. **Gráficos de pizza com legenda lateral** — como o layout do Monday mostrado pela usuária
3. **Tabela de leads com status coloridos** — badges com cores semânticas

### Typography System
- Display/títulos: `DM Sans` (bold, 700)
- Corpo/dados: `Inter` (400/500)
- Números grandes (KPIs): `DM Mono` ou `DM Sans` extra-bold

### Brand Essence
Gestão de vendas em tempo real para equipes SDR — preciso, rápido, sem ruído.
Personalidade: **focado**, **confiável**, **profissional**

### Signature Brand Color
Violeta-índigo `#7c6af7` — cor de ação, botões, destaques ativos

## Style Decisions
- Sidebar com logo da agência no topo e navegação por abas
- Seletor de SDR e mês no topo da área de conteúdo
- Gráficos usam recharts com tema dark customizado
- Tabela de leads com paginação e filtros por status
- Sidebar é obrigatória em todas as telas: logo/wordmark no topo, navegação persistente, ativo em violeta-índigo
- KPIs usam números extra-bold/DM Sans com tracking negativo, labels em uppercase tracking-wider secundário
- Violeta `#7c6af7` reservado para ação, seleção e destaque ativo; verde/vermelho/âmbar/azul apenas para status semântico
- Números grandes de KPI: `text-3xl font-extrabold` com `letter-spacing: -0.02em` para estilo técnico/operacional
