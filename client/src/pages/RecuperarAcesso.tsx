/**
 * Redefinição da senha de um gestor.
 *
 * O acesso administrativo dependia do login da plataforma antiga, que não
 * existe mais, e criar uma conta nova não resolve: as atribuições de clientes
 * apontam para o cadastro original.
 *
 * A rota só existe enquanto RECOVERY_TOKEN estiver no ambiente.
 */
import { useEffect, useState } from "react";

type Gestor = { id: number; nome: string; email: string; ativo: number };

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

export default function RecuperarAcesso() {
  const [habilitada, setHabilitada] = useState<boolean | null>(null);
  const [token, setToken] = useState("");
  const [gestores, setGestores] = useState<Gestor[] | null>(null);
  const [email, setEmail] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<{ nome: string; email: string } | null>(null);

  useEffect(() => {
    fetch("/api/recuperar/status").then((r) => r.json())
      .then((d) => setHabilitada(Boolean(d?.habilitada)))
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
      const d = await chamar("/api/recuperar/gestores", { senha: token });
      setGestores(d.gestores as Gestor[]);
      if (d.gestores?.length === 1) setEmail(d.gestores[0].email);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha.");
    } finally { setOcupado(false); }
  }

  async function redefinir() {
    setOcupado(true); setErro(null);
    try {
      const d = await chamar("/api/recuperar/senha", { senha: token, email, novaSenha });
      setPronto({ nome: d.nome, email: d.email });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha.");
    } finally { setOcupado(false); }
  }

  const caixa: React.CSSProperties = {
    background: T.card, border: `1px solid ${T.borda}`, borderRadius: 14, padding: "24px 26px",
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.texto,
      fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "56px 20px 70px" }}>
        <p style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase",
          color: T.marca, fontWeight: 700, margin: "0 0 10px" }}>Digital Escarlate</p>
        <h1 style={{ fontSize: 28, margin: "0 0 10px", letterSpacing: "-.02em" }}>
          Recuperar acesso
        </h1>
        <p style={{ color: T.suave, fontSize: 15, margin: "0 0 30px", lineHeight: 1.6 }}>
          Define uma nova senha para um gestor já cadastrado. As clínicas atribuídas
          a ele continuam as mesmas — por isso recuperar é melhor do que criar
          uma conta nova.
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
              onChange={(e) => { setToken(e.target.value); setErro(null); }} />

            {!gestores && (
              <button onClick={listar} disabled={!token || ocupado}
                style={{ width: "100%", marginTop: 20, padding: 13, borderRadius: 10, border: "none",
                  fontSize: 14.5, fontWeight: 650,
                  background: !token || ocupado ? T.campo : T.marca,
                  color: !token || ocupado ? T.fraco : "#fff",
                  cursor: !token || ocupado ? "not-allowed" : "pointer" }}>
                {ocupado ? "Verificando…" : "Continuar"}
              </button>
            )}

            {gestores && (
              <>
                <label style={{ ...rotulo, marginTop: 24 }}>Gestor</label>
                {gestores.length === 0 ? (
                  <p style={{ color: T.suave, fontSize: 14, margin: 0 }}>
                    Nenhum gestor cadastrado no banco.
                  </p>
                ) : (
                  <select value={email} onChange={(e) => setEmail(e.target.value)} style={campo}>
                    {gestores.map((g) => (
                      <option key={g.id} value={g.email}>
                        {g.nome} — {g.email}{g.ativo ? "" : " (inativo)"}
                      </option>
                    ))}
                  </select>
                )}

                <label style={{ ...rotulo, marginTop: 22 }}>Nova senha</label>
                <input type="password" value={novaSenha} autoComplete="new-password" style={campo}
                  placeholder="ao menos 8 caracteres"
                  onChange={(e) => { setNovaSenha(e.target.value); setErro(null); }} />

                <button onClick={redefinir}
                  disabled={!email || novaSenha.length < 8 || ocupado}
                  style={{ width: "100%", marginTop: 24, padding: 13, borderRadius: 10, border: "none",
                    fontSize: 14.5, fontWeight: 650,
                    background: !email || novaSenha.length < 8 || ocupado ? T.campo : T.marca,
                    color: !email || novaSenha.length < 8 || ocupado ? T.fraco : "#fff",
                    cursor: !email || novaSenha.length < 8 || ocupado ? "not-allowed" : "pointer" }}>
                  {ocupado ? "Salvando…" : "Definir nova senha"}
                </button>
              </>
            )}

            {erro && (
              <p style={{ color: T.marca, fontSize: 13.5, margin: "18px 0 0", lineHeight: 1.6 }}>{erro}</p>
            )}
          </div>
        )}

        {pronto && (
          <div style={caixa}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Senha redefinida.</p>
            <p style={{ color: T.suave, fontSize: 14, margin: "9px 0 22px", lineHeight: 1.6 }}>
              {pronto.nome} · {pronto.email}
            </p>
            <div style={{ paddingTop: 20, borderTop: `1px solid ${T.borda}` }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>Agora faça isto:</p>
              <p style={{ margin: "9px 0 0", color: T.suave, fontSize: 14, lineHeight: 1.7 }}>
                1. Remova a variável <code>RECOVERY_TOKEN</code> do ambiente, para desligar
                esta tela.<br />
                2. Entre em <a href="/manager/login" style={{ color: T.marca }}>/manager/login</a> com
                o e-mail acima e a senha nova.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
