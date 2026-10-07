"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Orc = { status: string; mensagem: string; created_at: string };
type Ag = { data_hora: string; status: string };

function extrairValor(mensagem: string): number {
  const match = mensagem.match(/Estimativa:\s*\$([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

export default function AgendaPage() {
  const [orcs, setOrcs] = useState<Orc[]>([]);
  const [ags, setAgs] = useState<Ag[]>([]);

  useEffect(() => {
    async function carregar() {
      const { data: o } = await supabase
        .from("orcamentos")
        .select("status, mensagem, created_at");
      const { data: a } = await supabase
        .from("agendamentos")
        .select("data_hora, status");
      if (o) setOrcs(o as Orc[]);
      if (a) setAgs(a as Ag[]);
    }
    carregar();
  }, []);

  const hoje = new Date();
  const em7dias = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);

  const pendentes = orcs.filter((o) => o.status === "pendente").length;
  const semana = ags.filter((a) => {
    const d = new Date(a.data_hora);
    return d >= hoje && d <= em7dias && a.status === "confirmado";
  }).length;
  const receitaMes = orcs
    .filter((o) => {
      const d = new Date(o.created_at);
      return (
        o.status === "agendado" &&
        d.getMonth() === hoje.getMonth() &&
        d.getFullYear() === hoje.getFullYear()
      );
    })
    .reduce((soma, o) => soma + extrairValor(o.mensagem), 0);
  const agendados = orcs.filter((o) => o.status === "agendado").length;
  const conversao = orcs.length > 0 ? Math.round((agendados / orcs.length) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl">Agenda</h1>
        <p className="text-[#5B6573]">
          A agenda da semana chega na próxima etapa. Por enquanto, o resumo.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E6EAF2] rounded-2xl p-5 flex flex-col gap-1">
          <span className="text-xs text-[#5B6573] font-medium">Orçamentos pendentes</span>
          <span className="font-[family-name:var(--font-fraunces)] text-3xl text-[#6B4FD1]">
            {pendentes}
          </span>
        </div>
        <div className="bg-white border border-[#E6EAF2] rounded-2xl p-5 flex flex-col gap-1">
          <span className="text-xs text-[#5B6573] font-medium">Esta semana</span>
          <span className="font-[family-name:var(--font-fraunces)] text-3xl text-[#3B82D6]">
            {semana}
          </span>
        </div>
        <div className="bg-white border border-[#E6EAF2] rounded-2xl p-5 flex flex-col gap-1">
          <span className="text-xs text-[#5B6573] font-medium">Receita (mês)</span>
          <span className="font-[family-name:var(--font-fraunces)] text-3xl text-[#17695F]">
            ${receitaMes.toFixed(0)}
          </span>
        </div>
        <div className="bg-white border border-[#E6EAF2] rounded-2xl p-5 flex flex-col gap-1">
          <span className="text-xs text-[#5B6573] font-medium">Taxa de conversão</span>
          <span className="font-[family-name:var(--font-fraunces)] text-3xl text-[#A32F6C]">
            {conversao}%
          </span>
        </div>
      </div>
    </div>
  );
}