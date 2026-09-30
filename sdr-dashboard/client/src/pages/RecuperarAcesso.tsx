/**
 * Definição de senha de emergência (/recuperar).
 *
 * As contas que entravam pelo login do Manus não têm senha própria. Criar
 * uma conta nova não resolve: clientes e relatórios apontam para o cadastro
 * original. Aqui se define a senha do cadastro existente.
 *
 * A rota só existe enquanto RECOVERY_TOKEN estiver no ambiente.
 */
import { useEffect, useState } from "react";

type Conta = { id: number; nome: string | null; email: string | null; papel: "user" | "admin"; temSenha: boolean };

const T = {
  bg: "#0d0d0d", card: "#161615", borda: "#262624", campo: "#1e1e1c",
  texto: "#f2f2f0", suave: "#a8a8a2", fraco: "#87877f", marca: "#e63946",
};

const campo: React.CSSProperties = {
  width: "100%", padding: "11px 13px", background: T.campo,
  border: `1px solid ${T.borda}`, borderRadius: 10, color: T.texto,
  fontSize: 14, outline: "none",
};
const rotulo: React.CSSProperties = {
  display: "block", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase",
  color: T.fraco, fontWeight: 600, marginBottom: 8,
};

function botao(desligado: boolean): React.CSSProperties {
  return {
    width: "100%", marginTop: 22, padding: 13, borderRadius: 10, border: "none",
    fontSize: 14.5, fontWeight: 650,
    background: desligado ? T.campo : T.marca,
    color: desligado ? T.fraco : "#fff",
    cursor: desligado ? "not-allowed" : "pointer",
  };
}

export default function RecuperarAcesso() {
  const [habilitada, setHabilitada] = useState<boolean | null>(null);
  const [token, setToken] = useState("");
  const [contas, setContas] = useState<Conta[] | null>(null);
  const [contaId, setContaId] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<{ nome: string | null; email: string } | null>(null);

  useEffect(() => {
    fetch("/api/recuperar/status").then(r => r.json())
      .then(d => setHabilitada(Boolean(d?.habilitada)))
      .catch(() => setHabilitada(false));
  }, []);

  async function chamar(caminho: string, corpo: unknown) {
    const r = await fetch(caminho, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d?.erro ?? "Não foi possível concluir.");
    return d;
  }

  async function listar() {
    setOcupado(true); setErro(null);
    try {
      const d = await chamar("/api/recuperar/contas", { senha: token });
      const lista = (d.contas as Conta[]).sort((a, b) => (a.papel === b.papel ? 0 : a.papel === "admin" ? -1 : 1));
      setContas(lista);
      if (lista.length > 0) setContaId(lista[0].id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha.");
    } finally { setOcupado(false); }
  }

  async function redefinir() {
    setOcupado(true); setErro(null);
    try {
      const d = await chamar("/api/recuperar/senha", { senha: token, id: contaId, email, novaSenha });
      setPronto({ nome: d.nome, email: d.email });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha.");
    } finally { setOcupado(false); }
  }

  const escolhida = contas?.find(c => c.id === contaId);
  const precisaEmail = escolhida && !escolhida.email;
  const podeSalvar = Boolean(contaId) && novaSenha.length >= 8 && (!precisaEmail || email.includes("@")) && !ocupado;
  const caixa: React.CSSProperties = {
    background: T.card, border: `1px solid ${T.borda}`, borderRadius: 14, padding: "24px 26px",
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.texto, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "56px 20px 70px" }}>
        <p style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase",
          color: T.marca, fontWeight: 700, margin: "0 0 10px" }}>Dashboard SDR</p>
        <h1 style={{ fontSize: 28, margin: "0 0 10px", letterSpacing: "-.02em" }}>Recuperar acesso</h1>
        <p style={{ color: T.suave, fontSize: 15, margin: "0 0 30px", lineHeight: 1.6 }}>
          Define a senha de uma conta que já existe. Os clientes e relatórios dela
          continuam os mesmos, por isso recuperar é melhor do que criar outra conta.
        </p>

        {habilitada === null && <p style={{ color: T.fraco, fontSize: 14 }}>Verificando…</p>}

        {habilitada === false && (
          <div style={{ ...caixa, borderLeft: `3px solid ${T.marca}` }}>
            <p style={{ margin: 0, fontWeight: 650 }}>A recuperação está desligada.</p>
            <p style={{ margin: "9px 0 0", color: T.suave, fontSize: 14, lineHeight: 1.65 }}>
              Para habilitar, defina <code>RECOVERY_TOKEN</code> no ambiente com uma senha
              de ao menos 16 caracteres e reinicie o serviço. Se você já recuperou o
              acesso, isto é o esperado.
            </p>
          </div>
        )}

        {habilitada && !pronto && (
          <div style={caixa}>
            <label style={rotulo}>Senha de recuperação</label>
            <input type="password" value={token} autoComplete="off" style={campo}
              placeholder="a mesma definida em RECOVERY_TOKEN"
              onChange={e => { setToken(e.target.value); setErro(null); }} />

            {!contas && (
              <button onClick={listar} disabled={!token || ocupado} style={botao(!token || ocupado)}>
                {ocupado ? "Verificando…" : "Continuar"}
              </button>
            )}

            {contas && (
              <>
                <label style={{ ...rotulo, marginTop: 24 }}>Conta</label>
                {contas.length === 0 ? (
                  <p style={{ color: T.suave, fontSize: 14, margin: 0 }}>
                    Nenhuma conta no banco. Importe o backup em <a href="/importar" style={{ color: T.marca }}>/importar</a> ou
                    crie a primeira conta em <a href="/entrar" style={{ color: T.marca }}>/entrar</a>.
                  </p>
                ) : (
                  <select value={contaId ?? ""} onChange={e => setContaId(Number(e.target.value))} style={campo}>
                    {contas.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nome || "Sem nome"} · {c.email || "sem e-mail"} · {c.papel === "admin" ? "gestora" : "SDR"}
                        {c.temSenha ? "" : " · sem senha"}
                      </option>
                    ))}
                  </select>
                )}

                {precisaEmail && (
                  <>
                    <label style={{ ...rotulo, marginTop: 22 }}>E-mail para entrar</label>
                    <input type="email" value={email} style={campo} placeholder="esta conta ainda não tem e-mail"
                      onChange={e => { setEmail(e.target.value); setErro(null); }} />
                  </>
                )}

                <label style={{ ...rotulo, marginTop: 22 }}>Nova senha</label>
                <input type="password" value={novaSenha} autoComplete="new-password" style={campo}
                  placeholder="ao menos 8 caracteres"
                  onChange={e => { setNovaSenha(e.target.value); setErro(null); }} />

                <button onClick={redefinir} disabled={!podeSalvar} style={botao(!podeSalvar)}>
                  {ocupado ? "Salvando…" : "Definir nova senha"}
                </button>
              </>
            )}

            {erro && <p style={{ color: T.marca, fontSize: 13.5, margin: "18px 0 0", lineHeight: 1.6 }}>{erro}</p>}
          </div>
        )}

        {pronto && (
          <div style={caixa}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Senha definida.</p>
            <p style={{ color: T.suave, fontSize: 14, margin: "9px 0 22px", lineHeight: 1.6 }}>
              {pronto.nome ?? "Conta"} · {pronto.email}
            </p>
            <div style={{ paddingTop: 20, borderTop: `1px solid ${T.borda}` }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>Agora faça isto:</p>
              <p style={{ margin: "9px 0 0", color: T.suave, fontSize: 14, lineHeight: 1.7 }}>
                1. Remova a variável <code>RECOVERY_TOKEN</code> do ambiente, para desligar esta tela.<br />
                2. Entre em <a href="/entrar" style={{ color: T.marca }}>/entrar</a> com o e-mail acima e a senha nova.<br />
                3. No painel da gestora, defina a senha das SDRs que ainda não têm.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
