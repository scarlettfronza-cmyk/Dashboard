import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ErroDeBusca } from "./Admin";

describe("estado de recuperação do painel da gestora", () => {
  it("exibe orientação correta e ação de nova tentativa após limite 429", () => {
    const onRetry = vi.fn();
    const html = renderToStaticMarkup(
      <ErroDeBusca mensagem="Limite de requisições do Monday atingido." onTentarDeNovo={onRetry} recarregando={false} />,
    );

    expect(html).toContain("Espere um pouco e tente de novo");
    expect(html).toContain("Tentar de novo");
    expect(html).not.toContain("Defina MONDAY_API_TOKEN");
  });

  it("aciona a nova tentativa ao clicar no botão", () => {
    const onRetry = vi.fn();
    const element = ErroDeBusca({
      mensagem: "Limite de requisições do Monday atingido.",
      onTentarDeNovo: onRetry,
      recarregando: false,
    });
    const children = React.Children.toArray(
      (element as React.ReactElement<{ children?: React.ReactNode }>).props.children,
    );
    const button = children[2] as React.ReactElement<{ onClick?: () => void }>;

    button.props.onClick?.();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
