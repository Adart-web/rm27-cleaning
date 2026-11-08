"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { avisarAtualizacao, useAtualizacaoAuto } from "@/lib/useAtualizacao";
import { orlandoToDate } from "@/lib/time";
import { DIA_CURTO, addDias, diaSemana, formatarDataCurta, hojeOrlando } from "@/lib/clientes";
import {
  faixaDoBloqueio,
  hhmmParaMin,
  minParaHHMM,
  minParaHora12,
  partesOrlando,
  type PeriodoBloqueio,
} from "@/lib/agenda";
import { telParaSms } from "@/lib/mensagensTextos";
import AvulsoForm from "@/components/admin/AvulsoForm";

// ---------- tipos ----------

type Visita = {
  id: string;
  data: string;
  ini: number;
  fim: number;
  tipo: "fixo" | "avulso";
  nome: string;
  detalhe: string;
  telefone: string | null;
  valor: number | null;
  orcamentoId: string | null;
  confirmacao: string | null;
  pedido: { data: string; hora: string; nota: string } | null;
};

type Bloqueio = { id: string; data: string; periodo: PeriodoBloqueio; motivo: string | null };

type AgRow = {
  id: string;
  data_hora: string;
  duracao_min: number | null;
  cliente_fixo_id: string | null;
  orcamento_id: string | null;
  confirmacao: string | null;
  pedido_data: string | null;
  pedido_hora: string | null;
  pedido_nota: string | null;
};
type FixoRow = { id: string; nome: string; endereco: string | null; telefone: string; valor: number };
type OrcRow = { id: string; nome_cliente: string | null; telefone: string | null; tipo: string; mensagem: string };

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

const servicoLabel: Record<string, string> = {
  regular: "Regular",
  deep: "Deep Cleaning",
  move_in_out: "Move In / Out",
  carpet_upholstery: "Carpete e Estofados",
};

const periodoBloqueioLabel: Record<PeriodoBloqueio, string> = {
  dia: "Dia todo",
  manha: "Manhã",
  tarde: "Tarde",
};

function extrairValor(mensagem: string): number {
  const match = mensagem.match(/Estimativa:\s*\$([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function detalheAvulso(oc: { tipo: string; mensagem: string }): string {
  const servico = campoMensagem(oc.mensagem, "Serviço");
  const nome = servicoLabel[servico] || servicoLabel[oc.tipo] || "Avulso";
  const end = campoMensagem(oc.mensagem, "Endereço");
  return end && end !== "não informado" ? `${nome} · ${end}` : nome;
}

function campoMensagem(mensagem: string, chave: string): string {
  const m = mensagem.match(new RegExp(`(?:^|\\| )${chave}: ([^|]+)`));
  return m ? m[1].trim() : "";
}

function diaExtenso(data: string): string {
  const [y, m, d] = data.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

async function chamarApi(url: string, corpo: unknown) {
  const { data: sess } = await supabase.auth.getSession();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sess.session?.access_token ?? ""}`,
    },
    body: JSON.stringify(corpo),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

// ---------- componente principal ----------

export default function AgendaMes({
  onBloquear,
  versao,
  abrirDia,
  onAbriuDia,
}: {
  onBloquear: (data: string) => void;
  versao: number;
  abrirDia?: string | null;
  onAbriuDia?: () => void;
}) {
  const hoje = hojeOrlando();
  const [mes, setMes] = useState<string>(() => hoje.slice(0, 7)); // "YYYY-MM"
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [formAvulso, setFormAvulso] = useState<string | null>(null);

  // abre o painel de um dia quando a página pede (ex.: depois de bloquear um dia com visitas)
  useEffect(() => {
    if (abrirDia) {
      setMes(abrirDia.slice(0, 7));
      setDiaSel(abrirDia);
      onAbriuDia?.();
    }
  }, [abrirDia, onAbriuDia]);

  // primeira célula = domingo da semana do dia 1; última = sábado da semana do último dia
  const celulas = useMemo(() => {
    const primeiro = `${mes}-01`;
    const inicio = addDias(primeiro, -diaSemana(primeiro));
    const [y, m] = mes.split("-").map(Number);
    const ultimo = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const fim = addDias(ultimo, 6 - diaSemana(ultimo));
    const lista: string[] = [];
    for (let d = inicio; d <= fim; d = addDias(d, 1)) lista.push(d);
    return lista;
  }, [mes]);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) {
        setCarregando(true);
        setErro(null);
      }
      const ini = celulas[0];
      const fim = celulas[celulas.length - 1];
      const de = orlandoToDate(ini, "00:00").toISOString();
      const ate = orlandoToDate(addDias(fim, 1), "00:00").toISOString();

      const [agRes, blRes] = await Promise.all([
        supabase
          .from("agendamentos")
          .select("id, data_hora, duracao_min, cliente_fixo_id, orcamento_id, confirmacao, pedido_data, pedido_hora, pedido_nota")
          .eq("status", "confirmado")
          .gte("data_hora", de)
          .lt("data_hora", ate),
        supabase.from("bloqueios").select("id, data, periodo, motivo").gte("data", ini).lte("data", fim),
      ]);

      if (agRes.error || blRes.error) {
        setErro(agRes.error?.message || blRes.error?.message || "Erro ao carregar a agenda");
        setCarregando(false);
        return;
      }

      const ags = (agRes.data ?? []) as AgRow[];
      const fixoIds = [...new Set(ags.map((a) => a.cliente_fixo_id).filter((x): x is string => Boolean(x)))];
      const orcIds = [...new Set(ags.map((a) => a.orcamento_id).filter((x): x is string => Boolean(x)))];

      const [fxRes, ocRes] = await Promise.all([
        fixoIds.length
          ? supabase.from("clientes_fixos").select("id, nome, endereco, telefone, valor").in("id", fixoIds)
          : Promise.resolve({ data: [] as FixoRow[] }),
        orcIds.length
          ? supabase.from("orcamentos").select("id, nome_cliente, telefone, tipo, mensagem").in("id", orcIds)
          : Promise.resolve({ data: [] as OrcRow[] }),
      ]);

      const fixos = new Map(((fxRes.data ?? []) as FixoRow[]).map((f) => [f.id, f]));
      const orcs = new Map(((ocRes.data ?? []) as OrcRow[]).map((o) => [o.id, o]));

      const lista: Visita[] = ags.map((a) => {
        const p = partesOrlando(a.data_hora);
        const dur = a.duracao_min ?? 120;
        const fx = a.cliente_fixo_id ? fixos.get(a.cliente_fixo_id) : undefined;
        const oc = a.orcamento_id ? orcs.get(a.orcamento_id) : undefined;
        if (a.cliente_fixo_id) {
          return {
            id: a.id, data: p.data, ini: p.min, fim: p.min + dur, tipo: "fixo",
            nome: fx?.nome ?? "Cliente fixo", detalhe: fx?.endereco || "Cliente fixo",
            telefone: fx?.telefone ?? null, valor: fx?.valor ?? null,
            orcamentoId: null, confirmacao: a.confirmacao,
            pedido: a.pedido_data ? { data: a.pedido_data, hora: a.pedido_hora ?? "", nota: a.pedido_nota ?? "" } : null,
          };
        }
        return {
          id: a.id, data: p.data, ini: p.min, fim: p.min + dur, tipo: "avulso",
          nome: oc?.nome_cliente || "Cliente",
          detalhe: oc ? detalheAvulso(oc) : "Avulso",
          telefone: oc?.telefone ?? null,
          valor: oc ? extrairValor(oc.mensagem) || null : null,
          orcamentoId: a.orcamento_id, confirmacao: null, pedido: null,
        };
      });

      setVisitas(lista);
      setBloqueios((blRes.data ?? []) as Bloqueio[]);
      setCarregando(false);
    },
    [celulas]
  );

  useEffect(() => {
    carregar();
  }, [carregar, versao]);

  useAtualizacaoAuto(() => carregar(true), 20000);

  const porDia = useMemo(() => {
    const mapa = new Map<string, { visitas: Visita[]; bloqueios: Bloqueio[] }>();
    for (const d of celulas) mapa.set(d, { visitas: [], bloqueios: [] });
    for (const v of visitas) mapa.get(v.data)?.visitas.push(v);
    for (const b of bloqueios) mapa.get(b.data)?.bloqueios.push(b);
    for (const x of mapa.values()) x.visitas.sort((a, b) => a.ini - b.ini);
    return mapa;
  }, [celulas, visitas, bloqueios]);

  function mudarMes(delta: number) {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMes(d.toISOString().slice(0, 7));
  }

  const [anoNum, mesNum] = mes.split("-").map(Number);
  const ehMesAtual = mes === hoje.slice(0, 7);

  function aoMudar() {
    carregar(true);
    avisarAtualizacao();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => mudarMes(-1)}
          className="h-11 w-11 rounded-xl border border-[#E6EAF2] bg-white text-lg"
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <div className="flex-1 min-w-[140px] text-center font-semibold text-lg">
          {MESES[mesNum - 1]} {anoNum}
        </div>
        <button
          onClick={() => mudarMes(1)}
          className="h-11 w-11 rounded-xl border border-[#E6EAF2] bg-white text-lg"
          aria-label="Próximo mês"
        >
          ›
        </button>
        {!ehMesAtual && (
          <button
            onClick={() => setMes(hoje.slice(0, 7))}
            className="h-11 px-4 rounded-xl border border-[#E6EAF2] bg-white text-sm font-semibold"
          >
            Hoje
          </button>
        )}
        <button
          onClick={() => setFormAvulso(hoje)}
          className="h-11 px-4 rounded-xl border border-[#6B4FD1] bg-white text-[#4B34A8] text-sm font-semibold"
        >
          + Avulso
        </button>
        <button
          onClick={() => onBloquear(hoje)}
          className="h-11 px-4 rounded-xl bg-[#6B4FD1] text-white text-sm font-semibold"
        >
          Bloquear data
        </button>
      </div>

      {erro && <div className="bg-[#FDECEC] text-[#A32F2F] rounded-xl p-3 text-sm">{erro}</div>}

      <div className="flex flex-wrap gap-3 text-xs text-[#5B6573]">
        <Legenda cor="bg-[#F5EFFF] border-[#C9B8F5]" texto="Fixo" />
        <Legenda cor="bg-[#E8F1FE] border-[#B5D0F5]" texto="Avulso" />
        <Legenda cor="bg-[#EEF0F4] border-[#C9CED8]" texto="Bloqueado" />
        {carregando && <span>Carregando…</span>}
      </div>

      <div className="bg-white border border-[#E6EAF2] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[#E6EAF2]">
          {DIAS_SEMANA.map((d, i) => (
            <div key={i} className="py-2 text-center text-xs font-semibold text-[#5B6573]">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {celulas.map((data) => {
            const info = porDia.get(data)!;
            const doMes = data.slice(0, 7) === mes;
            const domingo = diaSemana(data) === 0;
            const ehHoje = data === hoje;
            const bloqueado = info.bloqueios.length > 0;
            const maxChips = 3;
            const extras = info.visitas.length - maxChips;
            return (
              <button
                key={data}
                onClick={() => setDiaSel(data)}
                className={`min-h-[84px] md:min-h-[120px] border-t border-l border-[#F0F2F7] p-1 flex flex-col items-stretch gap-1 text-left align-top first:border-l-0 [&:nth-child(7n+1)]:border-l-0 ${
                  bloqueado ? "bg-[#F4F5F8]" : domingo ? "bg-[#FBFCFF]" : "bg-white"
                } ${doMes ? "" : "opacity-45"} active:bg-[#F5EFFF]`}
              >
                <span
                  className={`self-center text-sm w-7 h-7 flex items-center justify-center rounded-full ${
                    ehHoje ? "bg-[#6B4FD1] text-white font-semibold" : domingo ? "text-[#9AA3B2]" : ""
                  }`}
                >
                  {Number(data.slice(8))}
                </span>
                {info.visitas.slice(0, maxChips).map((v) => (
                  <span
                    key={v.id}
                    className={`rounded px-1 py-0.5 text-[10px] md:text-[11px] leading-tight truncate font-medium ${
                      v.tipo === "fixo" ? "bg-[#E7DEFF] text-[#4B34A8]" : "bg-[#D6E6FD] text-[#1F4F95]"
                    } ${v.confirmacao === "cancelada" ? "line-through opacity-60" : ""}`}
                  >
                    <span className="hidden md:inline">{minParaHora12(v.ini)} </span>
                    {primeiroNome(v.nome)}
                  </span>
                ))}
                {extras > 0 && <span className="text-[10px] text-[#5B6573] text-center">+{extras}</span>}
                {bloqueado && info.visitas.length === 0 && (
                  <span className="text-[10px] text-[#5B6573] text-center">bloqueado</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {diaSel && (
        <PainelDia
          data={diaSel}
          hoje={hoje}
          visitas={porDia.get(diaSel)?.visitas ?? []}
          bloqueios={porDia.get(diaSel)?.bloqueios ?? []}
          onFechar={() => setDiaSel(null)}
          onBloquear={() => onBloquear(diaSel)}
          onNovoAvulso={() => setFormAvulso(diaSel)}
          onMudou={aoMudar}
        />
      )}

      {formAvulso && (
        <AvulsoForm
          dataInicial={formAvulso}
          onFechar={() => setFormAvulso(null)}
          onConcluido={aoMudar}
        />
      )}
    </div>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded border ${cor}`} />
      {texto}
    </span>
  );
}

// ---------- painel do dia ----------

function PainelDia({
  data,
  hoje,
  visitas,
  bloqueios,
  onFechar,
  onBloquear,
  onNovoAvulso,
  onMudou,
}: {
  data: string;
  hoje: string;
  visitas: Visita[];
  bloqueios: Bloqueio[];
  onFechar: () => void;
  onBloquear: () => void;
  onNovoAvulso: () => void;
  onMudou: () => void;
}) {
  const passado = data < hoje;
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function removerBloqueio(id: string) {
    setRemovendo(id);
    setErro(null);
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch(`/api/bloqueios?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${sess.session?.access_token ?? ""}` },
    });
    setRemovendo(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErro(j.error || "Não consegui remover o bloqueio");
      return;
    }
    onMudou();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
    >
      <div className="bg-white w-full md:max-w-lg rounded-t-2xl md:rounded-2xl p-5 flex flex-col gap-4 max-h-[88vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg capitalize">{diaExtenso(data)}</h2>
            <p className="text-xs text-[#5B6573]">
              {visitas.length === 0
                ? "Sem visitas"
                : `${visitas.length} ${visitas.length === 1 ? "visita" : "visitas"}`}
              {data === hoje ? " · hoje" : ""}
            </p>
          </div>
          <button onClick={onFechar} className="h-9 px-3 rounded-lg border border-[#E6EAF2] text-sm">
            Fechar
          </button>
        </div>

        {visitas.map((v) => (
          <VisitaCard key={v.id} v={v} passado={passado} onMudou={onMudou} />
        ))}

        {bloqueios.map((b) => (
          <div
            key={b.id}
            className="rounded-xl border border-[#C9CED8] bg-[#EEF0F4] p-3 flex items-center justify-between gap-2"
          >
            <span className="text-sm">
              <span className="font-semibold">Bloqueado · {periodoBloqueioLabel[b.periodo]}</span>
              {b.motivo ? ` — ${b.motivo}` : ""}
              <span className="block text-xs text-[#5B6573]">
                {minParaHora12(faixaDoBloqueio(b.periodo).ini)}–{minParaHora12(faixaDoBloqueio(b.periodo).fim)}
              </span>
            </span>
            <button
              onClick={() => removerBloqueio(b.id)}
              disabled={removendo === b.id}
              className="h-9 px-3 rounded-lg bg-white border border-[#C9CED8] text-xs font-semibold"
            >
              {removendo === b.id ? "…" : "Liberar"}
            </button>
          </div>
        ))}

        {erro && <p className="text-xs text-[#A32F2F]">{erro}</p>}

        {!passado && diaSemana(data) !== 0 && (
          <div className="flex flex-col gap-2">
            <button
              onClick={onNovoAvulso}
              className="h-11 rounded-xl border border-[#6B4FD1] text-[#4B34A8] text-sm font-semibold"
            >
              + Novo avulso neste dia
            </button>
            {!bloqueios.some((b) => b.periodo === "dia") && (
              <button
                onClick={onBloquear}
                className="h-11 rounded-xl border border-[#E6EAF2] text-sm font-semibold"
              >
                Bloquear este dia
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- cartão da visita com atalhos ----------

function VisitaCard({ v, passado, onMudou }: { v: Visita; passado: boolean; onMudou: () => void }) {
  const [modo, setModo] = useState<null | "remarcar" | "cancelar">(null);
  const [novaData, setNovaData] = useState(v.data);
  const [novaHora, setNovaHora] = useState(minParaHHMM(v.ini));
  const [sinal, setSinal] = useState<"devolver" | "manter" | "">("");
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);

  function abrir(m: "remarcar" | "cancelar") {
    setModo(m);
    // se o cliente pediu outro horário pelo link, já vem preenchido
    setNovaData(m === "remarcar" && v.pedido?.data ? v.pedido.data : v.data);
    setNovaHora(m === "remarcar" && v.pedido?.hora ? v.pedido.hora : minParaHHMM(v.ini));
    setSinal("");
    setErro(null);
    setConflito(false);
  }

  async function executar(url: string, corpo: Record<string, unknown>) {
    setProcessando(true);
    setErro(null);
    setConflito(false);
    const r = await chamarApi(url, corpo);
    setProcessando(false);
    if (!r.ok) {
      if (r.json?.conflito) setConflito(true);
      setErro(r.json?.error || "Não consegui concluir. Tente de novo.");
      return;
    }
    setModo(null);
    onMudou();
  }

  function remarcar(forcar = false) {
    if (!novaData || !novaHora) {
      setErro("Escolha a nova data e o horário.");
      return;
    }
    if (v.tipo === "fixo") {
      executar("/api/agendamentos/acao", { id: v.id, acao: "remarcar", data: novaData, hora: novaHora, forcar });
    } else if (v.orcamentoId) {
      executar("/api/agendamentos/avulso", {
        orcamentoId: v.orcamentoId, acao: "remarcar", data: novaData, hora: novaHora, forcar,
      });
    }
  }

  function cancelar() {
    if (v.tipo === "fixo") {
      if (
        !window.confirm(
          `Cancelar a visita de ${v.nome} neste dia? Ela sai da agenda e do Google Calendar. As próximas semanas continuam normais.`
        )
      )
        return;
      executar("/api/agendamentos/acao", { id: v.id, acao: "liberar" });
    } else if (v.orcamentoId) {
      if (!sinal) {
        setErro("Escolha: devolver ou manter o sinal.");
        return;
      }
      executar("/api/agendamentos/avulso", { orcamentoId: v.orcamentoId, acao: "cancelar", sinal });
    }
  }

  const fixo = v.tipo === "fixo";
  const podeAgir = !passado && (fixo || v.orcamentoId);
  const btn = "h-10 px-4 rounded-full text-sm font-semibold border";

  return (
    <div
      className={`rounded-xl border p-3 flex flex-col gap-2 ${
        fixo ? "bg-[#F5EFFF] border-[#C9B8F5]" : "bg-[#E8F1FE] border-[#B5D0F5]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{v.nome}</span>
        <span className="text-sm font-semibold">
          {minParaHora12(v.ini)}–{minParaHora12(v.fim)}
        </span>
      </div>
      <span className="text-xs text-[#5B6573]">
        {fixo ? "Fixo" : "Avulso"} · {v.detalhe}
        {v.valor ? ` · $${v.valor}` : ""}
      </span>
      {fixo && (
        <span
          className={`text-xs font-semibold ${
            v.confirmacao === "confirmada"
              ? "text-[#1B6B3A]"
              : v.confirmacao === "cancelada"
                ? "text-[#A32F2F]"
                : v.confirmacao === "remarcar"
                  ? "text-[#4B34A8]"
                  : "text-[#7A5A00]"
          }`}
        >
          {v.confirmacao === "confirmada"
            ? "Cliente confirmou"
            : v.confirmacao === "cancelada"
              ? "Cliente disse que cancela"
              : v.confirmacao === "remarcar"
                ? "Cliente pediu outro horário"
                : "Aguardando confirmação"}
        </span>
      )}
      {fixo && v.confirmacao === "remarcar" && v.pedido && (
        <span className="text-xs text-[#4B34A8]">
          Quer: {DIA_CURTO[diaSemana(v.pedido.data)]} {formatarDataCurta(v.pedido.data)}
          {v.pedido.hora ? ` · ${minParaHora12(hhmmParaMin(v.pedido.hora))}` : ""}
          {v.pedido.nota ? ` — “${v.pedido.nota}”` : ""}
        </span>
      )}

      {v.telefone && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-[#5B6573]">{v.telefone}</span>
          <a href={`tel:${telParaSms(v.telefone)}`} className="text-xs font-semibold text-[#4B34A8] underline">
            Ligar
          </a>
          <a href={`sms:${telParaSms(v.telefone)}`} className="text-xs font-semibold text-[#4B34A8] underline">
            SMS
          </a>
        </div>
      )}

      {erro && <p className="text-xs text-[#A32F2F]">{erro}</p>}

      {podeAgir && modo === null && (
        <div className="flex flex-wrap gap-2 pt-1">
          {fixo && v.confirmacao !== "confirmada" && (
            <button
              disabled={processando}
              onClick={() => executar("/api/agendamentos/acao", { id: v.id, acao: "confirmou" })}
              className={`${btn} bg-[#17695F] text-white border-[#17695F] disabled:opacity-50`}
            >
              Confirmou
            </button>
          )}
          <button onClick={() => abrir("remarcar")} className={`${btn} bg-white text-[#4B34A8] border-[#6B4FD1]`}>
            Remarcar
          </button>
          <button
            onClick={() => (fixo ? cancelar() : abrir("cancelar"))}
            disabled={processando}
            className={`${btn} bg-white text-[#9B1C1C] border-[#E5B4B4] disabled:opacity-50`}
          >
            Cancelar
          </button>
        </div>
      )}

      {modo === "remarcar" && (
        <div className="flex flex-col gap-2 bg-white/70 rounded-lg p-3">
          <span className="text-sm font-semibold">Nova data e horário</span>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
              className="h-11 px-3 rounded-lg border border-[#7F8999] bg-white text-base text-[#233041]"
            />
            <input
              type="time"
              step={1800}
              value={novaHora}
              onChange={(e) => setNovaHora(e.target.value)}
              className="h-11 px-3 rounded-lg border border-[#7F8999] bg-white text-base text-[#233041]"
            />
          </div>
          {!fixo && (
            <p className="text-xs text-[#5B6573]">Uma mensagem de remarcação vai para a fila de SMS.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => remarcar()}
              disabled={processando}
              className={`${btn} bg-[#6B4FD1] text-white border-[#6B4FD1] disabled:opacity-50`}
            >
              {processando ? "Salvando…" : "Remarcar"}
            </button>
            {conflito && (
              <button
                onClick={() => remarcar(true)}
                disabled={processando}
                className={`${btn} bg-white text-[#4B34A8] border-[#6B4FD1]`}
              >
                Remarcar mesmo assim
              </button>
            )}
            <button onClick={() => setModo(null)} className="h-10 px-3 text-sm text-[#5B6573] underline">
              Voltar
            </button>
          </div>
        </div>
      )}

      {modo === "cancelar" && !fixo && (
        <div className="flex flex-col gap-2 bg-white/70 rounded-lg p-3">
          <span className="text-sm font-semibold">E o sinal que o cliente já pagou?</span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["devolver", "Devolver o sinal"],
                ["manter", "Manter o sinal"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setSinal(val)}
                className={`${btn} ${
                  sinal === val
                    ? "bg-[#9B1C1C] text-white border-[#9B1C1C]"
                    : "bg-white text-[#233041] border-[#E5B4B4]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#5B6573]">
            Sai do Google Calendar e uma mensagem de cancelamento vai para a fila de SMS.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={cancelar}
              disabled={processando}
              className={`${btn} bg-[#9B1C1C] text-white border-[#9B1C1C] disabled:opacity-50`}
            >
              {processando ? "Cancelando…" : "Confirmar cancelamento"}
            </button>
            <button onClick={() => setModo(null)} className="h-10 px-3 text-sm text-[#5B6573] underline">
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}