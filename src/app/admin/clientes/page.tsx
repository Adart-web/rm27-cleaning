"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatHora12 } from "@/lib/time";
import {
  CAPACIDADE_SEMANAL,
  DIA_CURTO,
  FREQUENCIA_LABEL,
  diaSemana,
  formatarDataCurta,
  proximasVisitas,
  visitasPorSemana,
  type ClienteFixo,
  type Frequencia,
} from "@/lib/clientes";

type Filtro = "todos" | Frequencia | "pausados";

const GRID =
  "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,1.1fr)]";

export default function ClientesPage() {
  const [clientes, setClientes] = useState<ClienteFixo[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  useEffect(() => {
    async function carregar() {
      const { data, error } = await supabase
        .from("clientes_fixos")
        .select("*")
        .neq("status", "encerrado")
        .order("nome");
      if (error) setErro(error.message);
      else setClientes((data ?? []) as ClienteFixo[]);
      setLoading(false);
    }
    carregar();
  }, []);

  const ativos = clientes.filter((c) => c.status === "ativo");
  const visitas = Math.round(visitasPorSemana(clientes) * 10) / 10;

  const abas: { key: Filtro; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: clientes.length },
    { key: "semanal", label: "Semanais", count: ativos.filter((c) => c.frequencia === "semanal").length },
    { key: "quinzenal", label: "Quinzenais", count: ativos.filter((c) => c.frequencia === "quinzenal").length },
    { key: "mensal", label: "Mensais", count: ativos.filter((c) => c.frequencia === "mensal").length },
    { key: "pausados", label: "Pausados", count: clientes.filter((c) => c.status === "pausado").length },
  ];

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDigitos = q.replace(/\D/g, "");
    return clientes.filter((c) => {
      if (filtro === "pausados" && c.status !== "pausado") return false;
      if (filtro !== "todos" && filtro !== "pausados") {
        if (c.frequencia !== filtro || c.status !== "ativo") return false;
      }
      if (!q) return true;
      return (
        c.nome.toLowerCase().includes(q) ||
        (c.endereco ?? "").toLowerCase().includes(q) ||
        (qDigitos.length > 0 && c.telefone.replace(/\D/g, "").includes(qDigitos))
      );
    });
  }, [clientes, busca, filtro]);

  function proxima(c: ClienteFixo): string {
    return formatarDataCurta(proximasVisitas(c.primeira_visita, c.frequencia, 1)[0]);
  }

  function diaEHora(c: ClienteFixo): string {
    return `${DIA_CURTO[diaSemana(c.primeira_visita)]} · ${formatHora12(c.hora_inicio)}`;
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl">
            Clientes fixos
          </h1>
          <p className="text-[#5B6573]">
            {ativos.length} {ativos.length === 1 ? "cliente ativo" : "clientes ativos"} · cerca
            de {visitas} visitas por semana (capacidade com 1 equipe: {CAPACIDADE_SEMANAL})
          </p>
        </div>
        <Link
          href="/admin/clientes/novo"
          className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-full bg-[#6B4FD1] text-white font-semibold"
        >
          <span aria-hidden="true">+</span> Novo cliente fixo
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        <input
          aria-label="Buscar cliente"
          placeholder="Buscar por nome, telefone ou endereço"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="min-h-[48px] px-4 w-full rounded-xl border border-[#7F8999] bg-white text-base"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {abas.map((a) => (
            <button
              key={a.key}
              onClick={() => setFiltro(a.key)}
              className={`shrink-0 whitespace-nowrap min-h-[44px] px-4 rounded-full border text-sm font-semibold ${
                filtro === a.key
                  ? "bg-[#6B4FD1] text-white border-[#6B4FD1]"
                  : "bg-white text-[#233041] border-[#E6EAF2]"
              }`}
            >
              {a.label} {a.count}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="text-[#5B6573]">Carregando...</p>}
      {erro && <p className="text-sm text-red-600">Erro ao carregar: {erro}</p>}
      {!loading && !erro && clientes.length === 0 && (
        <p className="text-[#5B6573]">
          Nenhum cliente fixo ainda. Use o botão &quot;Novo cliente fixo&quot; pra cadastrar o primeiro.
        </p>
      )}
      {!loading && clientes.length > 0 && visiveis.length === 0 && (
        <p className="text-[#5B6573]">Nenhum cliente encontrado.</p>
      )}

      {visiveis.length > 0 && (
        <div className="flex flex-col gap-2 md:gap-0 md:bg-white md:border md:border-[#E6EAF2] md:rounded-2xl md:overflow-hidden">
          <div
            className={`hidden md:grid ${GRID} gap-3 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#5B6573]`}
          >
            <span>Cliente</span>
            <span>Frequência</span>
            <span>Dia e hora</span>
            <span>Valor</span>
            <span>Próxima visita</span>
          </div>

          {visiveis.map((c) => (
            <Link
              key={c.id}
              href={`/admin/clientes/${c.id}`}
              className="block bg-white border border-[#E6EAF2] rounded-2xl md:border-0 md:border-t md:rounded-none"
            >
              <div className={`hidden md:grid ${GRID} gap-3 items-center min-h-[56px] px-4`}>
                <span className="font-semibold">{c.nome}</span>
                <span className="text-sm">{FREQUENCIA_LABEL[c.frequencia]}</span>
                <span className="text-sm">{diaEHora(c)}</span>
                <span className="text-sm">${Number(c.valor)}</span>
                <span className="text-sm text-[#5B6573]">
                  {c.status === "pausado" ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#FFE9B8] text-[#6B4300] text-xs font-semibold">
                      Pausado
                    </span>
                  ) : (
                    proxima(c)
                  )}
                </span>
              </div>

              <div className="md:hidden flex items-center justify-between gap-3 min-h-[64px] px-3.5 py-2.5">
                <span className="flex flex-col">
                  <span className="font-bold">{c.nome}</span>
                  <span className="text-[13px] text-[#5B6573]">
                    {FREQUENCIA_LABEL[c.frequencia]} · {diaEHora(c)}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-0.5">
                  <span className="font-bold">${Number(c.valor)}</span>
                  {c.status === "pausado" ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#FFE9B8] text-[#6B4300] text-xs font-semibold">
                      Pausado
                    </span>
                  ) : (
                    <span className="text-xs text-[#5B6573]">próx. {proxima(c)}</span>
                  )}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}