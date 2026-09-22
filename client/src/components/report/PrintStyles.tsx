/**
 * Regras de impressão do relatório, para o cliente salvar em PDF.
 *
 * O que a tela precisa e o papel não: barra fixa, abas, seletor de período e
 * o próprio botão de baixar. Sem escondê-los, eles aparecem no PDF como
 * enfeite inútil.
 *
 * A margem da página vai a zero e o recuo passa para dentro do conteúdo:
 * caso contrário o fundo escuro não alcança a borda e sobra uma moldura
 * branca em volta de cada folha, que parece defeito.
 */
export function PrintStyles({ fundo }: { fundo: string }) {
  return (
    <style>{`
      [data-print="only"] { display: none; }
      @media print {
        @page { margin: 0; size: A4; }
        html, body {
          background: ${fundo} !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        [data-print="hide"] { display: none !important; }
        [data-print="only"] { display: block !important; }
        [data-print="page"] { padding: 12mm 11mm !important; max-width: none !important; }
        section, .rounded-2xl, .rounded-xl { break-inside: avoid; }
        a { text-decoration: none !important; }
        /* Endereço de links não interessa no papel. */
        a[href]::after { content: none !important; }
      }
    `}</style>
  );
}
