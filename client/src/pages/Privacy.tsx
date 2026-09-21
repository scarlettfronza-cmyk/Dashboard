export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#13151a] text-white py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 text-white">Política de Privacidade</h1>
        <p className="text-gray-400 mb-10 text-sm">Última atualização: abril de 2026</p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-blue-400">1. Sobre este aplicativo</h2>
          <p className="text-gray-300 leading-relaxed">
            O <strong>ADS Dashboard — Escarlate</strong> é uma ferramenta interna de gestão de tráfego pago
            utilizada pela agência Escarlate para monitorar métricas de campanhas de marketing digital de seus
            clientes. O aplicativo integra dados do Meta (Facebook e Instagram) para exibir indicadores de
            desempenho de campanhas publicitárias.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-blue-400">2. Dados coletados</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            Ao conectar uma conta do Facebook/Instagram ao sistema, coletamos e armazenamos:
          </p>
          <ul className="list-disc list-inside text-gray-300 space-y-1 ml-2">
            <li>Token de acesso à API do Meta (para buscar métricas)</li>
            <li>ID do usuário Meta e ID da conta do Instagram Business</li>
            <li>Nome de usuário do Instagram (@username)</li>
            <li>Métricas de desempenho: alcance, visualizações, seguidores, interações e cliques</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-blue-400">3. Como usamos os dados</h2>
          <p className="text-gray-300 leading-relaxed">
            Os dados coletados são utilizados exclusivamente para exibir métricas de desempenho no painel
            interno da agência Escarlate. Não compartilhamos, vendemos ou transferimos dados pessoais a
            terceiros. Os tokens de acesso são armazenados de forma segura e utilizados apenas para chamadas
            à API do Meta em nome do usuário autorizado.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-blue-400">4. Retenção de dados</h2>
          <p className="text-gray-300 leading-relaxed">
            Os tokens de acesso são armazenados enquanto a integração estiver ativa. O usuário pode revogar
            o acesso a qualquer momento desconectando a conta nas configurações do aplicativo ou diretamente
            nas configurações de privacidade do Facebook em{" "}
            <a
              href="https://www.facebook.com/settings?tab=applications"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline"
            >
              facebook.com/settings
            </a>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-blue-400">5. Segurança</h2>
          <p className="text-gray-300 leading-relaxed">
            Todos os dados são transmitidos via HTTPS. Os tokens de acesso são armazenados em banco de dados
            seguro com acesso restrito. Não armazenamos senhas de usuários do Facebook ou Instagram.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3 text-blue-400">6. Contato</h2>
          <p className="text-gray-300 leading-relaxed">
            Para dúvidas sobre esta política de privacidade ou para solicitar a exclusão dos seus dados,
            entre em contato pelo e-mail:{" "}
            <a href="mailto:contato@escarlate.com.br" className="text-blue-400 underline">
              contato@escarlate.com.br
            </a>
          </p>
        </section>

        <div className="border-t border-gray-700 pt-6 mt-10">
          <p className="text-gray-500 text-sm text-center">
            © 2026 Escarlate Agência de Marketing Digital · Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
