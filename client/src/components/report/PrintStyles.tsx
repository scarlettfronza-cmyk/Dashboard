/**
 * Regras de impressão do relatório — o "salvar em PDF" do navegador e o
 * PDF que o servidor gera para o WhatsApp passam por aqui.
 *
 * O que a tela precisa e o papel não: seletor de período e indicadores de
 * carregamento. Sem escondê-los, aparecem no PDF como enfeite inútil.
 *
 * A margem fica na própria página (@page), não dentro do conteúdo: com
 * margem zero e recuo interno, só a primeira folha tinha respiro em cima e
 * as seguintes começavam com o título cortado na borda. O fundo escuro
 * preenche a área de conteúdo de todas as folhas; a moldura clara em volta
 * é a margem de impressão, igual em todas.
 *
 * Seções podem quebrar entre folhas (uma seção inteira sem quebra deixava
 * meia folha em branco); o que não quebra é cada indicador, cartão e o par
 * rótulo + frase de abertura, que fica junto do que apresenta.
 */
export function PrintStyles({ fundo }: { fundo: string }) {
  return (
    <style>{`
      [data-print="only"] { display: none; }
      @media print {
        @page { margin: 11mm 10mm 12mm; size: A4; }
        html, body {
          background: ${fundo} !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        [data-print="hide"] { display: none !important; }
        [data-print="only"] { display: block !important; }
        [data-print="page"] { padding: 0 !important; max-width: none !important; }
        header { position: static !important; }
        .rounded-2xl, .rounded-xl, [data-print="keep"] { break-inside: avoid; }
        [data-print="lead"] { break-after: avoid; }
        a { text-decoration: none !important; }
        /* Endereço de links não interessa no papel. */
        a[href]::after { content: none !important; }
      }
    `}</style>
  );
}
