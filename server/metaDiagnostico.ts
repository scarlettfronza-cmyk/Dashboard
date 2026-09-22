/**
 * Diagnóstico da configuração do Meta de um cliente.
 *
 * Quando algo não fecha, o dashboard mostrava zero sem dizer por quê, e a
 * causa podia estar em qualquer uma de várias camadas: token ausente,
 * inválido, sem escopo, conta não atribuída ao usuário do sistema, conta
 * inexistente na listagem, ou simplesmente período sem investimento. Procurar
 * no lugar errado custa horas — inclusive com a conta certa e as permissões
 * corretas, quando o problema era outro.
 *
 * Aqui os fatos coletados viram uma lista de achados legível. A montagem é
 * separada da coleta para poder ser testada sem rede.
 */

export type Nivel = "ok" | "aviso" | "erro";
export type Achado = { nivel: Nivel; titulo: string; detalhe: string };

export type Fatos = {
  origemToken: "agencia" | "cliente" | null;
  tokenValido: boolean;
  nomeToken?: string | null;
  erroToken?: string | null;
  contasVisiveis: number;
  contaConfigurada: string | null;
  contaEncontrada: boolean;
  /** Contas com nome parecido, para sugerir quando a configurada não existe. */
  parecidas?: Array<{ id: string; name: string }>;
  investimentoPeriodo?: number | null;
  erroInsights?: string | null;
  periodo?: string;
};

/** Normaliza para comparar ids com ou sem o prefixo `act_`. */
export function mesmoId(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const limpa = (x: string) => x.trim().replace(/^act_/, "");
  return limpa(a) === limpa(b);
}

export function montarDiagnostico(f: Fatos): Achado[] {
  const achados: Achado[] = [];

  // 1. Token
  if (!f.origemToken) {
    achados.push({
      nivel: "erro",
      titulo: "Nenhum token do Meta configurado",
      detalhe: "Salve o token da agência em Configurações, ou um token só para este cliente.",
    });
    return achados; // Sem token, o resto não tem como ser verificado.
  }

  achados.push({
    nivel: "ok",
    titulo: f.origemToken === "agencia" ? "Usando o token da agência" : "Usando o token deste cliente",
    detalhe: f.origemToken === "agencia"
      ? "O mesmo token vale para todas as clínicas."
      : "Este cliente tem um token próprio, que tem precedência apenas se não houver o da agência.",
  });

  if (!f.tokenValido) {
    achados.push({
      nivel: "erro",
      titulo: "O Meta recusou o token",
      detalhe: f.erroToken ?? "Token inválido ou expirado. Gere um novo no usuário do sistema.",
    });
    return achados;
  }

  achados.push({
    nivel: "ok",
    titulo: "Token aceito pelo Meta",
    detalhe: f.nomeToken ? `Identificado como ${f.nomeToken}.` : "Token válido.",
  });

  // 2. Contas visíveis
  if (f.contasVisiveis === 0) {
    achados.push({
      nivel: "erro",
      titulo: "O token não enxerga nenhuma conta de anúncio",
      detalhe: "Verifique se o usuário do sistema tem contas atribuídas e se o token tem o escopo ads_read.",
    });
    return achados;
  }

  achados.push({
    nivel: "ok",
    titulo: `${f.contasVisiveis} conta(s) de anúncio visíveis`,
    detalhe: "É o que este token alcança no Meta.",
  });

  // 3. Conta configurada
  if (!f.contaConfigurada) {
    achados.push({
      nivel: "aviso",
      titulo: "Nenhuma conta de anúncio escolhida para este cliente",
      detalhe: "Selecione a conta na lista acima e salve.",
    });
    return achados;
  }

  if (!f.contaEncontrada) {
    const sugestao = f.parecidas?.length
      ? ` Contas com nome parecido: ${f.parecidas.slice(0, 3).map((c) => `${c.name} (${c.id})`).join(", ")}.`
      : "";
    achados.push({
      nivel: "erro",
      titulo: `A conta ${f.contaConfigurada} não está entre as visíveis`,
      detalhe:
        "Atribua esta conta ao usuário do sistema que gerou o token, no seu próprio portfólio — " +
        "compartilhar como parceiro não basta." + sugestao,
    });
    return achados;
  }

  achados.push({
    nivel: "ok",
    titulo: "A conta configurada está acessível",
    detalhe: `${f.contaConfigurada} aparece entre as contas deste token.`,
  });

  // 4. Dados do período
  if (f.erroInsights) {
    achados.push({
      nivel: "erro",
      titulo: "O Meta recusou a consulta de desempenho",
      detalhe: f.erroInsights,
    });
    return achados;
  }

  const inv = f.investimentoPeriodo;
  if (inv == null) {
    achados.push({
      nivel: "aviso",
      titulo: "Desempenho não consultado",
      detalhe: "Escolha um período para verificar se há investimento registrado.",
    });
  } else if (inv === 0) {
    achados.push({
      nivel: "aviso",
      titulo: "Sem investimento no período",
      detalhe:
        `A conta responde, mas não houve gasto${f.periodo ? ` em ${f.periodo}` : ""}. ` +
        "A configuração está correta; as campanhas podem estar em outra conta.",
    });
  } else {
    achados.push({
      nivel: "ok",
      titulo: "Investimento encontrado no período",
      detalhe: `${inv.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}${f.periodo ? ` em ${f.periodo}` : ""}.`,
    });
  }

  return achados;
}

/** Resumo de uma linha, para a tela mostrar antes de abrir a lista. */
export function resumir(achados: Achado[]): { nivel: Nivel; texto: string } {
  const erro = achados.find((a) => a.nivel === "erro");
  if (erro) return { nivel: "erro", texto: erro.titulo };
  const aviso = achados.find((a) => a.nivel === "aviso");
  if (aviso) return { nivel: "aviso", texto: aviso.titulo };
  return { nivel: "ok", texto: "Configuração completa e com dados." };
}
