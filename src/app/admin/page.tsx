"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Orcamento = {
  id: string;
  tipo: string;
  tamanho_imovel: string;
  frequencia: string | null;
  status: string;
  mensagem: string;
  created_at: string;
  data_escolhida: string | null;
  periodo_escolhido: string | null;
  telefone: string | null;
  nome_cliente: string | null;
};

type Agendamento = {
  id: string;
  orcamento_id: string;
  data_hora: string;
  status: string;
};

function extrairValor(mensagem: string): number {
  const match = mensagem.match(/Estimativa:\s*\$([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

const statusLabel: Record<string, string> = {
  pendente: "Pendente",
  aguardando_pagamento: "Aguardando Pagamento",
  agendado: "Agendado",
  recusado: "Recusado",
};

export default function AdminPage() {
  const router = useRouter();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<Record<string, string>>({});

  async function carregarDados() {
    setLoading(true);
    const { data: orcData } = await supabase
      .from("orcamentos")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: agData } = await supabase
      .from("agendamentos")
      .select("*");

    if (orcData) setOrcamentos(orcData as Orcamento[]);
    if (agData) setAgendamentos(agData as Agendamento[]);
    setLoading(false);
  }

  async function checkAuthAndLoad() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/admin/login");
      return;
    }

    setCheckingAuth(false);
    carregarDados();
  }

  useEffect(() => {
    checkAuthAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function recusar(id: string) {
    await supabase.from("orcamentos").update({ status: "recusado" }).eq("id", id);
    carregarDados();
  }

  async function confirmarOrcamento(id: string) {
    setProcessando(id);
    setErro((prev) => ({ ...prev, [id]: "" }));

    const res = await fetch("/api/confirm-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orcamentoId: id }),
    });

    const result = await res.json();
    setProcessando(null);

    if (!res.ok) {
      setErro((prev) => ({ ...prev, [id]: result.error || "Erro ao confirmar orçamento." }));
      return;
    }

    carregarDados();
  }

  async function confirmarPagamento(id: string) {
    setProcessando(id);
    setErro((prev) => ({ ...prev, [id]: "" }));

    const res = await fetch("/api/confirm-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orcamentoId: id }),
    });

    const result = await res.json();
    setProcessando(null);

    if (!res.ok) {
      setErro((prev) => ({ ...prev, [id]: result.error || "Erro ao confirmar pagamento." }));
      return;
    }

    carregarDados();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/admin/login");
  }

  if (checkingAuth) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  // Cálculos do dashboard
  const pendentes = orcamentos.filter((o) => o.status === "pendente").length;

  const hoje = new Date();
  const em7dias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
  const agendamentosSemana = agendamentos.filter((a) => {
    const data = new Date(a.data_hora);
    return data >= hoje && data <= em7dias && a.status === "confirmado";
  }).length;

  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();
  const receitaMes = orcamentos
    .filter((o) => {
      const data = new Date(o.created_at);
      return (
        o.status === "agendado" &&
        data.getMonth() === mesAtual &&
        data.getFullYear() === anoAtual
      );
    })
    .reduce((soma, o) => soma + extrairValor(o.mensagem), 0);

  const totalOrcamentos = orcamentos.length;
  const totalAgendados = orcamentos.filter((o) => o.status === "agendado").length;
  const taxaConversao =
    totalOrcamentos > 0 ? Math.round((totalAgendados / totalOrcamentos) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#FBFCFF] px-8 py-10">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-[#233041]">
            Painel
          </h1>
          <button
            onClick={logout}
            className="text-sm text-[#6B7480] border border-[#E6EAF2] rounded-full px-4 py-2"
          >
            Sair
          </button>
        </div>

        {/* Cards do Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E6EAF2] rounded-2xl p-5 flex flex-col gap-1">
            <span className="text-xs text-[#6B7480] font-medium">Orçamentos Pendentes</span>
            <span className="font-[family-name:var(--font-fraunces)] text-3xl text-[#8C6EE8]">
              {pendentes}
            </span>
          </div>

          <div className="bg-white border border-[#E6EAF2] rounded-2xl p-5 flex flex-col gap-1">
            <span className="text-xs text-[#6B7480] font-medium">Esta Semana</span>
            <span className="font-[family-name:var(--font-fraunces)] text-3xl text-[#69A9F4]">
              {agendamentosSemana}
            </span>
          </div>

          <div className="bg-white border border-[#E6EAF2] rounded-2xl p-5 flex flex-col gap-1">
            <span className="text-xs text-[#6B7480] font-medium">Receita (mês)</span>
            <span className="font-[family-name:var(--font-fraunces)] text-3xl text-[#71D7CF]">
              ${receitaMes.toFixed(0)}
            </span>
          </div>

          <div className="bg-white border border-[#E6EAF2] rounded-2xl p-5 flex flex-col gap-1">
            <span className="text-xs text-[#6B7480] font-medium">Taxa de Conversão</span>
            <span className="font-[family-name:var(--font-fraunces)] text-3xl text-[#F39BC5]">
              {taxaConversao}%
            </span>
          </div>
        </div>

        {/* Lista de orçamentos */}
        <div className="flex flex-col gap-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-xl text-[#233041]">
            Solicitações de Orçamento
          </h2>

          {loading && <p className="text-[#6B7480]">Carregando...</p>}

          {!loading && orcamentos.length === 0 && (
            <p className="text-[#6B7480]">Nenhuma solicitação ainda.</p>
          )}

          {orcamentos.map((o) => (
            <div
              key={o.id}
              className="bg-white border border-[#E6EAF2] rounded-2xl p-6 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#8C6EE8]">
                  {o.tipo} {o.frequencia ? `— ${o.frequencia}` : ""}
                </span>
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    o.status === "pendente"
                      ? "bg-[#F5EFFF] text-[#8C6EE8]"
                      : o.status === "agendado"
                      ? "bg-[#E6F8F6] text-[#2A9D8F]"
                      : o.status === "aguardando_pagamento"
                      ? "bg-amber-50 text-amber-600"
                      : "bg-red-50 text-red-500"
                  }`}
                >
                  {statusLabel[o.status] || o.status}
                </span>
              </div>

              <div className="text-sm text-[#233041]">
                {o.nome_cliente} — {o.tamanho_imovel || "Carpet/Upholstery"}
              </div>
              {o.data_escolhida && (
                <div className="text-sm text-[#233041]">
                  📅 {o.data_escolhida} — {o.periodo_escolhido === "manha" ? "Manhã (8h-12h)" : "Tarde (13h-17h)"}
                </div>
              )}
              <div className="text-sm text-[#6B7480]">{o.mensagem}</div>
              <div className="text-xs text-[#6B7480]">
                {new Date(o.created_at).toLocaleString("pt-BR")}
              </div>

              {erro[o.id] && <p className="text-sm text-red-600">{erro[o.id]}</p>}

              {o.status === "pendente" && (
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => confirmarOrcamento(o.id)}
                    disabled={processando === o.id}
                    className="flex-1 bg-[#71D7CF] text-white rounded-full py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {processando === o.id ? "Enviando..." : "Confirmar Orçamento"}
                  </button>
                  <button
                    onClick={() => recusar(o.id)}
                    className="flex-1 border border-red-300 text-red-500 rounded-full py-2 text-sm font-semibold"
                  >
                    Recusar
                  </button>
                </div>
              )}

              {o.status === "aguardando_pagamento" && (
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => confirmarPagamento(o.id)}
                    disabled={processando === o.id}
                    className="flex-1 bg-[#8C6EE8] text-white rounded-full py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {processando === o.id ? "Confirmando..." : "Pagamento Confirmado"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}