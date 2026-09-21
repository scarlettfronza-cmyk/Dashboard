import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { BarChart3, TrendingUp, Users, Zap, Target, Instagram, CheckCircle2, ArrowRight, ChevronRight } from "lucide-react";

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  // Check if manager token exists in localStorage
  const hasManagerToken = typeof window !== "undefined" && !!localStorage.getItem("manager_token");

  useEffect(() => {
    // If manager token exists, go to manager dashboard
    if (hasManagerToken) {
      navigate("/manager/dashboard");
      return;
    }
    // Only redirect to Manus dashboard if explicitly authenticated via Manus OAuth
    if (!loading && isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, loading, navigate, hasManagerToken]);

  const features = [
    {
      icon: BarChart3,
      title: "Meta Ads em Tempo Real",
      desc: "Investimento, leads, CPL, ROAS e cliques atualizados automaticamente via API do Meta.",
    },
    {
      icon: Target,
      title: "CRM com Monday.com",
      desc: "Sincronize leads, agendamentos e fechamentos direto do Monday sem copiar nada manualmente.",
    },
    {
      icon: Instagram,
      title: "Instagram Insights",
      desc: "Views, alcance, interações, seguidores e visitas ao perfil em um único painel.",
    },
    {
      icon: TrendingUp,
      title: "Rastreamento de Campanha",
      desc: "Descubra de qual anúncio veio cada lead e envie conversões para a Meta CAPI automaticamente.",
    },
    {
      icon: Users,
      title: "Relatório para o Cliente",
      desc: "Link público personalizado com o logo e cor da clínica. Compartilhe em segundos.",
    },
    {
      icon: Zap,
      title: "Relatório com IA",
      desc: "Análise automática dos dados com insights e recomendações prontos para enviar ao cliente.",
    },
  ];

  const steps = [
    { num: "01", title: "Crie sua conta", desc: "Cadastro gratuito em menos de 1 minuto." },
    { num: "02", title: "Adicione seu cliente", desc: "Conecte o Meta Ads e o Monday.com do cliente." },
    { num: "03", title: "Compartilhe o relatório", desc: "Envie o link público para o cliente ver os resultados." },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4"
        style={{ background: "oklch(0.08 0.006 20 / 0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid oklch(0.18 0.008 20)" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#E63946" }}>
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-sm tracking-wide">ESCARLATE DASHBOARD</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/manager/login"
            className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            style={{ color: "oklch(0.70 0.010 60)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "white")}
            onMouseLeave={e => (e.currentTarget.style.color = "oklch(0.70 0.010 60)")}>
            Entrar
          </a>
          <a href="/manager/login?tab=register"
            className="text-sm font-semibold px-5 py-2 rounded-lg transition-all"
            style={{ background: "#E63946", color: "white" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#c1121f"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px #E6394640"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#E63946"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
            Começar grátis
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 pt-24 pb-16 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `radial-gradient(ellipse 80% 50% at 50% 0%, #E6394618 0%, transparent 70%)`,
        }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none"
          style={{ background: "#E6394608", filter: "blur(80px)" }} />

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8"
            style={{ background: "#E6394615", border: "1px solid #E6394640", color: "#E63946" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Para gestores de tráfego pago
          </div>

          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-6 leading-tight">
            Relatórios que impressionam.<br />
            <span style={{ color: "#E63946" }}>Resultados que vendem.</span>
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10" style={{ color: "oklch(0.60 0.010 60)" }}>
            Dashboard profissional para gestores de tráfego. Conecte Meta Ads, Monday.com e Instagram em um único painel e entregue relatórios que encantam seus clientes.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/manager/login?tab=register"
              className="flex items-center gap-2 px-8 py-4 rounded-xl text-base font-bold transition-all"
              style={{ background: "#E63946", color: "white", boxShadow: "0 8px 32px #E6394640" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#c1121f"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#E63946"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
              Criar conta grátis
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href="/manager/login"
              className="flex items-center gap-2 px-8 py-4 rounded-xl text-base font-semibold transition-all"
              style={{ background: "oklch(0.14 0.008 20)", border: "1px solid oklch(0.22 0.008 20)", color: "oklch(0.80 0.010 60)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E6394660"; (e.currentTarget as HTMLElement).style.color = "white"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.22 0.008 20)"; (e.currentTarget as HTMLElement).style.color = "oklch(0.80 0.010 60)"; }}>
              Já tenho conta
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-6 mt-12 flex-wrap">
            {[
              { value: "100%", label: "Dados em tempo real" },
              { value: "Meta API", label: "Integração oficial" },
              { value: "IA", label: "Análise automática" },
            ].map(({ value, label }) => (
              <div key={label} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" style={{ color: "#E63946" }} />
                <span className="text-sm font-semibold text-white">{value}</span>
                <span className="text-sm" style={{ color: "oklch(0.50 0.010 60)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 md:px-12 py-24" style={{ background: "oklch(0.10 0.006 20)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#E63946" }}>Funcionalidades</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Tudo que você precisa em um lugar</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title}
                className="p-6 rounded-2xl transition-all group"
                style={{ background: "oklch(0.13 0.008 20)", border: "1px solid oklch(0.20 0.008 20)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#E6394640"; (e.currentTarget as HTMLElement).style.background = "oklch(0.15 0.010 20)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.20 0.008 20)"; (e.currentTarget as HTMLElement).style.background = "oklch(0.13 0.008 20)"; }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: "#E6394618", border: "1px solid #E6394630" }}>
                  <Icon className="w-5 h-5" style={{ color: "#E63946" }} />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "oklch(0.55 0.010 60)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 md:px-12 py-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#E63946" }}>Como funciona</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Comece em 3 passos simples</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map(({ num, title, desc }) => (
              <div key={num} className="flex flex-col items-center text-center">
                <div className="text-5xl font-black mb-4 leading-none" style={{ color: "#E6394630", fontFamily: "'Playfair Display', serif" }}>{num}</div>
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm" style={{ color: "oklch(0.55 0.010 60)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-12 py-24" style={{ background: "oklch(0.10 0.006 20)" }}>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Pronto para impressionar<br />seus clientes?
          </h2>
          <p className="text-base mb-8" style={{ color: "oklch(0.55 0.010 60)" }}>
            Crie sua conta agora e comece a entregar relatórios profissionais em minutos.
          </p>
          <a href="/manager/login?tab=register"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl text-base font-bold transition-all"
            style={{ background: "#E63946", color: "white", boxShadow: "0 8px 32px #E6394640" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#c1121f"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#E63946"; (e.currentTarget as HTMLElement).style.transform = "none"; }}>
            Criar conta grátis
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-8 text-center border-t" style={{ borderColor: "oklch(0.16 0.008 20)" }}>
        <p className="text-xs" style={{ color: "oklch(0.38 0.010 60)" }}>
          Escarlate Dashboard · Relatórios de Tráfego Pago · {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
