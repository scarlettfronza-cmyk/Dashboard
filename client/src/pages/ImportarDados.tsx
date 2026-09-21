/**
 * Tela de importação do backup.
 *
 * Feita para a carga inicial do banco ser possível sem terminal e sem
 * instalar nada: escolher o arquivo, informar a senha, importar.
 *
 * A rota só existe enquanto RESTORE_TOKEN estiver definida no ambiente.
 * Terminada a carga, a variável deve ser removida — a tela então informa que
 * a importação está desligada.
 */
import { useEffect, useState } from "react";

type Resumo = { tabela: string; registros: number };
type Sucesso = {
  ok: true; comandos: number; aplicados: number;
  falhas: string[]; totalFalhas: number; resumo: Resumo[];
};

const T = {
  bg: "#0d0d0d", card: "#161615", borda: "#262624", campo: "#1e1e1c",
  texto: "#f2f2f0", suave: "#a8a8a2", fraco: "#87877f", marca: "#e63946",
};

export default function ImportarDados() {
  const [habilitada, setHabilitada] = useState<boolean | null>(null);
  const [senha, setSenha] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<Sucesso | null>(null);

  useEffect(() => {
    fetch("/api/importar/status")
      .then((r) => r.json())
      .then((d) => setHabilitada(Boolean(d?.habilitada)))
      .catch(() => setHabilitada(false));
  }, []);

  async function importar() {
    if (!arquivo || !senha) return;
    setEnviando(true); setErro(null); setOk(null);
    try {
      const sql = await arquivo.text();
      const r = await fetch("/api/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha, sql }),
      });
      const d = await r.json();
      if (!r.ok) setErro(d?.erro ?? "Não foi possível importar.");
      else setOk(d as Sucesso);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao enviar o arquivo.");
    } finally {
      setEnviando(false);
    }
  }

  const caixa: React.CSSProperties = {
    background: T.card, border: `1px solid ${T.borda}`, borderRadius: 14,
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.texto,
      fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 620, margin: "0 auto", padding: "56px 20px 70px" }}>

        <p style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase",
          color: T.marca, fontWeight: 700, margin: "0 0 10px" }}>
          Digital Escarlate
        </p>
        <h1 style={{ fontSize: 28, margin: "0 0 10px", letterSpacing: "-.02em" }}>
          Importar dados
        </h1>
        <p style={{ color: T.suave, fontSize: 15, margin: "0 0 30px", lineHeight: 1.6 }}>
          Carrega o backup do banco uma única vez. Depois disso, desligue a
          importação removendo a variável <code>RESTORE_TOKEN</code> do ambiente.
        </p>

        {habilitada === null && <p style={{ color: T.fraco, fontSize: 14 }}>Verificando…</p>}

        {habilitada === false && (
          <div style={{ ...caixa, padding: "22px 24px", borderLeft: `3px solid ${T.marca}` }}>
            <p style={{ margin: 0, fontWeight: 650 }}>A importação está desligada.</p>
            <p style={{ margin: "9px 0 0", color: T.suave, fontSize: 14, lineHeight: 1.65 }}>
              Para habilitar, defina a variável <code>RESTORE_TOKEN</code> no ambiente
              com uma senha de ao menos 16 caracteres e reinicie o serviço. Se os dados
              já foram importados, isto é o esperado — não faça nada.
            </p>
          </div>
        )}

        {habilitada && !ok && (
          <div style={{ ...caixa, padding: "24px 26px" }}>
            <label style={{ display: "block", fontSize: 11, letterSpacing: ".12em",
              textTransform: "uppercase", color: T.fraco, fontWeight: 600, marginBottom: 8 }}>
              Arquivo do backup
            </label>
            <input
              type="file" accept=".sql,text/plain"
              onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setErro(null); }}
              style={{ width: "100%", padding: "11px 13px", background: T.campo,
                border: `1px solid ${T.borda}`, borderRadius: 10, color: T.suave, fontSize: 14 }}
            />
            {arquivo && (
              <p style={{ color: T.fraco, fontSize: 12, margin: "8px 0 0" }}>
                {arquivo.name} · {(arquivo.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}

            <label style={{ display: "block", fontSize: 11, letterSpacing: ".12em",
              textTransform: "uppercase", color: T.fraco, fontWeight: 600,
              margin: "22px 0 8px" }}>
              Senha de importação
            </label>
            <input
              type="password" value={senha} autoComplete="off"
              onChange={(e) => { setSenha(e.target.value); setErro(null); }}
              placeholder="a mesma definida em RESTORE_TOKEN"
              style={{ width: "100%", padding: "11px 13px", background: T.campo,
                border: `1px solid ${T.borda}`, borderRadius: 10, color: T.texto,
                fontSize: 14, outline: "none" }}
            />

            {erro && (
              <p style={{ color: T.marca, fontSize: 13.5, margin: "18px 0 0", lineHeight: 1.6 }}>
                {erro}
              </p>
            )}

            <button
              onClick={importar}
              disabled={!arquivo || !senha || enviando}
              style={{ width: "100%", marginTop: 24, padding: "13px", borderRadius: 10,
                border: "none", fontSize: 14.5, fontWeight: 650,
                background: !arquivo || !senha || enviando ? T.campo : T.marca,
                color: !arquivo || !senha || enviando ? T.fraco : "#fff",
                cursor: !arquivo || !senha || enviando ? "not-allowed" : "pointer" }}
            >
              {enviando ? "Importando… pode levar um minuto" : "Importar dados"}
            </button>

            <p style={{ color: T.fraco, fontSize: 12, margin: "16px 0 0", lineHeight: 1.65 }}>
              A importação é recusada se o banco já tiver registros, para não
              sobrescrever nada.
            </p>
          </div>
        )}

        {ok && (
          <div style={{ ...caixa, padding: "24px 26px" }}>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Dados importados.</p>
            <p style={{ color: T.suave, fontSize: 14, margin: "8px 0 20px" }}>
              {ok.aplicados} de {ok.comandos} comandos aplicados.
            </p>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <tbody>
                {ok.resumo.map((r) => (
                  <tr key={r.tabela}>
                    <td style={{ padding: "7px 0", borderBottom: `1px solid ${T.borda}`,
                      color: T.suave }}>{r.tabela}</td>
                    <td style={{ padding: "7px 0", borderBottom: `1px solid ${T.borda}`,
                      textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {r.registros.toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {ok.totalFalhas > 0 && (
              <div style={{ marginTop: 20, padding: "14px 16px", background: T.campo,
                borderRadius: 10, borderLeft: `3px solid ${T.marca}` }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 650 }}>
                  {ok.totalFalhas} comando(s) falharam
                </p>
                {ok.falhas.map((f, i) => (
                  <p key={i} style={{ margin: "7px 0 0", fontSize: 12, color: T.suave }}>{f}</p>
                ))}
              </div>
            )}

            <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${T.borda}` }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 650 }}>Agora faça isto:</p>
              <p style={{ margin: "9px 0 0", color: T.suave, fontSize: 14, lineHeight: 1.7 }}>
                1. Remova a variável <code>RESTORE_TOKEN</code> do ambiente, para desligar
                esta tela.<br />
                2. Entre em <a href="/manager/login" style={{ color: T.marca }}>/manager/login</a> e
                conecte o Meta.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
