"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { avisarAtualizacao, useAtualizacaoAuto } from "@/lib/useAtualizacao";
import { orlandoToDate } from "@/lib/time";
import { DIA_CURTO, addDias, diaSemana, formatarDataCurta, hojeOrlando, semanaDe } from "@/lib/clientes";
import { hhmmParaMin, minParaHora12, partesOrlando } from "@/lib/agenda";

type Pedido = {
  id: string;
  nome: string;
  atual: string; // "Sex 13/11 · 1:30 PM"
  pedidoData: string;
  pedidoHora: string;
  novo: string;
  nota: string | null;
};
type Cancelou = { id: string; nome: string; quando: string };

const CHAVE_VISTOS = "rm27-atencao-vistos";

function lerVistos(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_VISTOS) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function quandoDe(iso: string): string {
  const p = partesOrlando(iso);
  return `${DIA_CURTO[diaSemana(p.data)]} ${formatarDataCurta(p.data)} · ${minParaHora12(p.min)}`;
}

async function chamar(corpo: unknown) {
  const { data: sess } = await supabase.auth.getSession();
  const res = await fetch("/api/agendamentos/acao", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess.session?.access_token ?? ""}` },
    body: JSON.stringify(corpo),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

// Quadro no topo da Agenda: só aparece quando há algo para a dona resolver
export default function PainelAtencao({ onMudou }: { onMudou: () => void }) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cancelou, setCancelou] = useState<Cancelou[]>([]);
  const [fila, setFila] = useState(0);
  const [orcamentos, setOrcamentos] = useState(0);
  const [semResposta, setSemResposta] = useState(0);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    const agora = new Date().toISOString();
    const hoje = hojeOrlando();
    const desde = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    const inicioProx = addDias(semanaDe(hoje).inicio, 7);
    const ehFimDeSemana = diaSemana(hoje) === 6 || diaSemana(hoje) === 0;

    const [pedRes, canRes, filaRes, orcRes, semRes] = await Promise.all([
      supabase
        .from("agendamentos")
        .select("id, data_hora, cliente_fixo_id, pedido_data, pedido_hora, pedido_nota")
        .eq("tipo", "fixo")
        .eq("status", "confirmado")
        .eq("confirmacao", "remarcar")
        .gte("data_hora", agora)
        .order("data_hora"),
      supabase
        .from("agendamentos")
        .select("id, data_hora, cliente_fixo_id")
        .eq("tipo", "fixo")
        .eq("status", "cancelado")
        .eq("confirmacao", "cancelada")
        .gte("respondido_em", desde)
        .gte("data_hora", agora)
        .order("data_hora"),
      supabase.from("mensagens").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      supabase.from("orcamentos").select("id", { count: "exact", head: true }).eq("status", "pendente"),
      ehFimDeSemana
        ? supabase
            .from("agendamentos")
            .select("id", { count: "exact", head: true })
            .eq("tipo", "fixo")
            .eq("status", "confirmado")
            .eq("confirmacao", "pendente")
            .gte("data_hora", orlandoToDate(inicioProx, "00:00").toISOString())
            .lt("data_hora", orlandoToDate(addDias(inicioProx, 6), "00:00").toISOString())
        : Promise.resolve({ count: 0 }),
    ]);

    const ped = pedRes.data ?? [];
    const can = canRes.data ?? [];
    const ids = [...new Set([...ped, ...can].map((a) => a.cliente_fixo_id).filter((x): x is string => Boolean(x)))];
    const nomes = new Map<string, string>();
    if (ids.length) {
      const { data } = await supabase.from("clientes_fixos").select("id, nome").in("id", ids);
      (data ?? []).forEach((c) => nomes.set(c.id as string, c.nome as string));
    }

    setPedidos(
      ped
        .filter((a) => a.pedido_data && a.pedido_hora)
        .map((a) => ({
          id: a.id as string,
          nome: nomes.get(a.cliente_fixo_id as string) ?? "Cliente",
          atual: quandoDe(a.data_hora as string),
          pedidoData: a.pedido_data as string,
          pedidoHora: a.pedido_hora as string,
          novo: `${DIA_CURTO[diaSemana(a.pedido_data as string)]} ${formatarDataCurta(a.pedido_data as string)} · ${minParaHora12(hhmmParaMin(a.pedido_hora as string))}`,
          nota: (a.pedido_nota as string | null) ?? null,
        }))
    );
    const vistos = lerVistos();
    setCancelou(
      can
        .filter((a) => !vistos.includes(a.id as string))
        .map((a) => ({
          id: a.id as string,
          nome: nomes.get(a.cliente_fixo_id as string) ?? "Cliente",
          quando: quandoDe(a.data_hora as string),
        }))
    );
    setFila(filaRes.count ?? 0);
    setOrcamentos(orcRes.count ?? 0);
    setSemResposta(semRes.count ?? 0);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);
  useAtualizacaoAuto(carregar, 30000);

  async function aceitar(p: Pedido, forcar = false) {
    setOcupado(p.id);
    setErro("");
    const { ok, json } = await chamar({ id: p.id, acao: "remarcar", data: p.pedidoData, hora: p.pedidoHora, forcar });
    setOcupado(null);
    if (!ok) {
      if (json.conflito && !forcar) {
        if (window.confirm(`${json.error as string} Remarcar mesmo assim?`)) aceitar(p, true);
        return;
      }
      setErro((json.error as string) || "Não consegui remarcar.");
      return;
    }
    await carregar();
    avisarAtualizacao();
    onMudou();
  }

  async function manter(p: Pedido) {
    setOcupado(p.id);
    setErro("");
    const { ok, json } = await chamar({ id: p.id, acao: "confirmou" });
    setOcupado(null);
    if (!ok) {
      setErro((json.error as string) || "Não consegui salvar.");
      return;
    }
    await carregar();
    onMudou();
  }

  function marcarVisto(id: string) {
    try {
      localStorage.setItem(CHAVE_VISTOS, JSON.stringify([...lerVistos(), id].slice(-100)));
    } catch {}
    setCancelou((l) => l.filter((c) => c.id !== id));
  }

  const total = pedidos.length + cancelou.length + (fila > 0 ? 1 : 0) + (orcamentos > 0 ? 1 : 0) + (semResposta > 0 ? 1 : 0);
  if (total === 0) return null;

  const linha = "flex flex-wrap items-center justify-between gap-2 py-2 border-t border-[#EEE9FB] first:border-t-0";
  const btnP = "min-h-[40px] px-4 rounded-full bg-[#6B4FD1] text-white text-sm font-semibold disabled:opacity-50";
  const btnS = "min-h-[40px] px-4 rounded-full border border-[#D9CFF7] bg-white text-[#4B34A8] text-sm font-semibold disabled:opacity-50";

  return (
    <section className="rounded-2xl border border-[#D9CFF7] bg-[#FBF9FF] p-4 flex flex-col">
      <div className="flex items-center gap-2 pb-1">
        <h2 className="font-semibold text-[#4B34A8]">Precisa da sua atenção</h2>
        <span className="px-2 rounded-full text-xs font-bold bg-[#A32F6C] text-white">{total}</span>
      </div>

      {erro && <p className="text-sm text-[#8A1F1F] bg-[#FDE8E8] rounded-lg px-3 py-2 mt-1">{erro}</p>}

      {pedidos.map((p) => (
        <div key={p.id} className={linha}>
          <div className="flex flex-col min-w-[200px] flex-1">
            <span className="text-sm">
              <b>{p.nome}</b> pediu outro horário
            </span>
            <span className="text-xs text-[#5B6573]">
              {p.atual} → <b>{p.novo}</b>
              {p.nota ? ` — “${p.nota}”` : ""}
            </span>
          </div>
          <div className="flex gap-2">
            <button disabled={ocupado === p.id} onClick={() => aceitar(p)} className={btnP}>
              {ocupado === p.id ? "Remarcando…" : "Aceitar"}
            </button>
            <button disabled={ocupado === p.id} onClick={() => manter(p)} className={btnS}>
              Manter o atual
            </button>
          </div>
        </div>
      ))}

      {cancelou.map((c) => (
        <div key={c.id} className={linha}>
          <div className="flex flex-col min-w-[200px] flex-1">
            <span className="text-sm">
              <b>{c.nome}</b> cancelou a visita
            </span>
            <span className="text-xs text-[#5B6573]">{c.quando} · horário liberado</span>
          </div>
          <button onClick={() => marcarVisto(c.id)} className={btnS}>
            Ok, vi
          </button>
        </div>
      ))}

      {orcamentos > 0 && (
        <div className={linha}>
          <span className="text-sm">
            <b>{orcamentos}</b> {orcamentos > 1 ? "orçamentos aguardando" : "orçamento aguardando"} sua resposta
          </span>
          <Link href="/admin/solicitacoes" className={btnS + " inline-flex items-center"}>
            Abrir
          </Link>
        </div>
      )}

      {fila > 0 && (
        <div className={linha}>
          <span className="text-sm">
            <b>{fila}</b> {fila > 1 ? "mensagens para enviar" : "mensagem para enviar"}
          </span>
          <Link href="/admin/mensagens" className={btnS + " inline-flex items-center"}>
            Abrir
          </Link>
        </div>
      )}

      {semResposta > 0 && (
        <div className={linha}>
          <span className="text-sm">
            <b>{semResposta}</b> {semResposta > 1 ? "clientes ainda não responderam" : "cliente ainda não respondeu"} a
            confirmação da semana que vem
          </span>
          <Link href="/admin/mensagens" className={btnS + " inline-flex items-center"}>
            Ver
          </Link>
        </div>
      )}
    </section>
  );
}