/**
 * Equipe: quem tem acesso ao painel de gestor, e o cadastro de uma nova
 * gestora. Substitui o "Criar conta" público da tela de login — criar
 * acesso passa a ser um ato de quem já está dentro.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const C = {
  card: "oklch(0.16 0.012 255)", borda: "oklch(0.24 0.012 255)", campo: "oklch(0.13 0.012 255)",
  texto: "#fff", suave: "oklch(0.70 0.010 240)", fraco: "oklch(0.50 0.010 240)", marca: "#e63946",
};

export function Equipe({ managerToken }: { managerToken: string }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState(""); const [email, setEmail] = useState(""); const [senha, setSenha] = useState("");
  const lista = trpc.managers.listarGestoras.useQuery({ token: managerToken }, { enabled: !!managerToken });
  const criar = trpc.managers.criarGestora.useMutation({
    onSuccess: (r) => { toast.success(`Acesso criado para ${r.email}.`); setNome(""); setEmail(""); setSenha(""); setAberto(false); lista.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const campo = "w-full text-sm rounded-lg px-3 py-2 outline-none";
  const estilo = { background: C.campo, border: `1px solid ${C.borda}`, color: C.texto };

  return (
    <section className="rounded-xl p-4 mb-5" style={{ background: C.card, border: `1px solid ${C.borda}` }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">👥</span>
          <h2 className="text-sm font-semibold" style={{ color: C.texto }}>Equipe</h2>
          <span className="text-xs" style={{ color: C.fraco }}>{lista.data ? `${lista.data.length} ${lista.data.length === 1 ? "acesso" : "acessos"}` : ""}</span>
        </div>
        <button onClick={() => setAberto((a) => !a)} className="text-xs font-semibold px-3 py-1.5 rounded-md"
          style={{ background: `color-mix(in oklch, ${C.marca} 15%, transparent)`, color: "#ff8a94", border: `1px solid color-mix(in oklch, ${C.marca} 40%, transparent)` }}>
          {aberto ? "Cancelar" : "+ Nova gestora"}
        </button>
      </div>

      {lista.data && (
        <ul className="mt-3 space-y-1">
          {lista.data.map((g) => (
            <li key={g.id} className="text-xs flex items-center gap-2" style={{ color: C.suave }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: g.active ? "oklch(0.72 0.17 150)" : C.fraco }} />
              <span className="font-semibold" style={{ color: C.texto }}>{g.name}</span>
              <span style={{ color: C.fraco }}>{g.email}</span>
            </li>
          ))}
        </ul>
      )}

      {aberto && (
        <form className="mt-4 grid gap-2 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); criar.mutate({ token: managerToken, name: nome, email, password: senha }); }}>
          <input className={campo} style={estilo} placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} required minLength={2} />
          <input className={campo} style={estilo} placeholder="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className={campo} style={estilo} placeholder="Senha (mín. 8)" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required minLength={8} />
          <div className="sm:col-span-3 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] m-0" style={{ color: C.fraco }}>A nova gestora entra sem clientes; os vínculos são feitos depois, cliente a cliente.</p>
            <button type="submit" disabled={criar.isPending} className="text-xs font-semibold px-3 py-1.5 rounded-md disabled:opacity-50" style={{ background: C.marca, color: "#fff" }}>
              {criar.isPending ? "Criando..." : "Criar acesso"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
