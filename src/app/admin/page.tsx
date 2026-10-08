"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { orlandoToDate } from "@/lib/time";
import {
  DIA_CURTO,
  addDias,
  diaSemana,
  formatarDataCurta,
  hojeOrlando,
  semanaDe,
} from "@/lib/clientes";
import {
  faixaDoBloqueio,
  janelasLivres,
  minParaHora12,
  partesOrlando,
  type Faixa,
  type Periodo,
  type PeriodoBloqueio,
} from "@/lib/agenda";

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
};

type Bloqueio = {
  id: string;
  data: string;
  periodo: PeriodoBloqueio;
  motivo: string | null;
};

type AgRow = {
  id: string;
  data_hora: string;
  duracao_min: number | null;
  tipo: string | null;
  cliente_fixo_id: string | null;
  orcamento_id: string | null;
};
type FixoRow = { id: string; nome: string; endereco: string | null; telefone: string; valor: number };
type OrcRow = { id: string; nome_cliente: string | null; telefone: string | null; tipo: string; mensagem: string };

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

const GRID_INI = 8 * 60;
const GRID_FIM = 18 * 60;
const PX_HORA = 56;

function extrairValor(mensagem: string): number {
  const match = mensagem.match(/Estimativa:\s*\$([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function tituloDia(data: string): string {
  return `${DIA_CURTO[diaSemana(data)]} ${formatarDataCurta(data)}`;
}

function inicioDaSemanaPadrao(): string {
  const hoje = hojeOrlando();
  return semanaDe(diaSemana(hoje) === 0 ? addDias(hoje, 1) : hoje).inicio;
}

// ---------- página ----------

export default function AgendaPage() {
  const [inicio, setInicio] = useState<string>(inicioDaSemanaPadrao);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [formBloqueio, setFormBloqueio] = useState<{ data: string; periodo: PeriodoBloqueio } | null>(null);

  const dias = useMemo(() => Array.from({ length: 6 }, (_, i) => addDias(inicio, i)), [inicio]);
  const hoje = hojeOrlando();

  const carregar = useCallback(async (ini: string) => {
    setCarregando(true);
    setErro(null);
    const fim = addDias(ini, 5);
    const de = orlandoToDate(ini, "00:00").toISOString();
    const ate = orlandoToDate(addDias(fim, 1), "00:00").toISOString();

    const [agRes, blRes] = await Promise.all([
      supabase
        .from("agendamentos")
        .select("id, data_hora, duracao_min, tipo, cliente_fixo_id, orcamento_id")
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
        : Promise.resolve({ data: [] as FixoRow[], error: null }),
      orcIds.length
        ? supabase.from("orcamentos").select("id, nome_cliente, telefone, tipo, mensagem").in("id", orcIds)
        : Promise.resolve({ data: [] as OrcRow[], error: null }),
    ]);

    const fixos = new Map(((fxRes.data ?? []) as FixoRow[]).map((f) => [f.id, f]));
    const orcs = new Map(((ocRes.data ?? []) as OrcRow[]).map((o) => [o.id, o]));

    const lista: Visita[] = ags.map((a) => {
      const p = partesOrlando(a.data_hora);
      const dur = a.duracao_min ?? 120;
      const fx = a.cliente_fixo_id ? fixos.get(a.cliente_fixo_id) : undefined;
      const oc = a.orcamento_id ? orcs.get(a.orcamento_id) : undefined;
      if (fx) {
        return {
          id: a.id, data: p.data, ini: p.min, fim: p.min + dur, tipo: "fixo",
          nome: fx.nome, detalhe: fx.endereco || "Cliente fixo", telefone: fx.telefone, valor: fx.valor,
        };
      }
      return {
        id: a.id, data: p.data, ini: p.min, fim: p.min + dur, tipo: "avulso",
        nome: oc?.nome_cliente || "Cliente",
        detalhe: oc ? servicoLabel[oc.tipo] || oc.tipo : "Avulso",
        telefone: oc?.telefone ?? null,
        valor: oc ? extrairValor(oc.mensagem) || null : null,
      };
    });

    setVisitas(lista);
    setBloqueios((blRes.data ?? []) as Bloqueio[]);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar(inicio);
  }, [inicio, carregar]);

  // organiza por dia
  const porDia = useMemo(() => {
    const agora = partesOrlando(new Date().toISOString());
    return dias.map((data) => {
      const vs = visitas.filter((v) => v.data === data).sort((a, b) => a.ini - b.ini);
      const bs = bloqueios.filter((b) => b.data === data);
      const ocupado: Faixa[] = [
        ...vs.map((v) => ({ ini: v.ini, fim: v.fim })),
        ...bs.map((b) => faixaDoBloqueio(b.periodo)),
      ];
      if (data === agora.data) ocupado.push({ ini: 0, fim: agora.min });
      const livres = data < hoje ? { manha: [], tarde: [] } : janelasLivres(ocupado);
      return { data, visitas: vs, bloqueios: bs, livres };
    });
  }, [dias, visitas, bloqueios, hoje]);

  const fimSemana = addDias(inicio, 5);
  const ehSemanaAtual = inicio === inicioDaSemanaPadrao();

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl">Agenda</h1>
      </div>

      {/* navegação */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setInicio(addDias(inicio, -7))}
          className="h-11 w-11 rounded-xl border border-[#E6EAF2] bg-white text-lg"
          aria-label="Semana anterior"
        >
          ‹
        </button>
        <div className="flex-1 min-w-[140px] text-center font-semibold">
          {formatarDataCurta(inicio)} – {formatarDataCurta(fimSemana)}
        </div>
        <button
          onClick={() => setInicio(addDias(inicio, 7))}
          className="h-11 w-11 rounded-xl border border-[#E6EAF2] bg-white text-lg"
          aria-label="Próxima semana"
        >
          ›
        </button>
        {!ehSemanaAtual && (
          <button
            onClick={() => setInicio(inicioDaSemanaPadrao())}
            className="h-11 px-4 rounded-xl border border-[#E6EAF2] bg-white text-sm font-semibold"
          >
            Hoje
          </button>
        )}
        <button
          onClick={() => setFormBloqueio({ data: hoje, periodo: "dia" })}
          className="h-11 px-4 rounded-xl bg-[#6B4FD1] text-white text-sm font-semibold"
        >
          Bloquear data
        </button>
      </div>

      {erro && (
        <div className="bg-[#FDECEC] text-[#A32F2F] rounded-xl p-3 text-sm">
          {erro}
          {erro.includes("bloqueios") && " — falta rodar o SQL da tabela bloqueios no Supabase."}
        </div>
      )}

      {/* legenda */}
      <div className="flex flex-wrap gap-3 text-xs text-[#5B6573]">
        <Legenda cor="bg-[#F5EFFF] border-[#C9B8F5]" texto="Fixo" />
        <Legenda cor="bg-[#E8F1FE] border-[#B5D0F5]" texto="Avulso" />
        <Legenda cor="bg-[#EEF0F4] border-[#C9CED8]" texto="Bloqueado" />
        <Legenda cor="bg-[#E6F8F6] border-[#9ADBD2]" texto="Livre" />
      </div>

      {carregando && <p className="text-sm text-[#5B6573]">Carregando…</p>}

      {/* celular: lista por dia */}
      <div className="flex flex-col gap-3 md:hidden">
        {porDia.map((d) => (
          <DiaCard
            key={d.data}
            dia={d}
            hoje={hoje}
            onBloquear={(periodo) => setFormBloqueio({ data: d.data, periodo })}
            onMudou={() => carregar(inicio)}
          />
        ))}
      </div>

      {/* desktop: grade com horas */}
      <div className="hidden md:block">
        <GradeSemana dias={porDia} hoje={hoje} onAbrirDia={setDiaAberto} diaAberto={diaAberto} />
        {diaAberto && (
          <div className="mt-4">
            {porDia
              .filter((d) => d.data === diaAberto)
              .map((d) => (
                <DiaCard
                  key={d.data}
                  dia={d}
                  hoje={hoje}
                  aberto
                  onFechar={() => setDiaAberto(null)}
                  onBloquear={(periodo) => setFormBloqueio({ data: d.data, periodo })}
                  onMudou={() => carregar(inicio)}
                />
              ))}
          </div>
        )}
      </div>

      {formBloqueio && (
        <BloqueioForm
          inicial={formBloqueio}
          onFechar={() => setFormBloqueio(null)}
          onConcluido={() => carregar(inicio)}
        />
      )}

      <Resumo />
    </div>
  );
}

// ---------- peças ----------

type DiaInfo = {
  data: string;
  visitas: Visita[];
  bloqueios: Bloqueio[];
  livres: Record<Periodo, Faixa[]>;
};

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-3 h-3 rounded border ${cor}`} />
      {texto}
    </span>
  );
}

function textoLivre(p: Periodo, f: Faixa): string {
  const nome = p === "manha" ? "Manhã" : "Tarde";
  return `${nome} livre ${minParaHora12(f.ini)}–${minParaHora12(f.fim)}`;
}

function DiaCard({
  dia,
  hoje,
  aberto = false,
  onFechar,
  onBloquear,
  onMudou,
}: {
  dia: DiaInfo;
  hoje: string;
  aberto?: boolean;
  onFechar?: () => void;
  onBloquear: (p: PeriodoBloqueio) => void;
  onMudou: () => void;
}) {
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const passado = dia.data < hoje;
  const vazio = dia.visitas.length === 0 && dia.bloqueios.length === 0;

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
      className={`bg-white border rounded-2xl p-4 flex flex-col gap-3 ${
        dia.data === hoje ? "border-[#6B4FD1]" : "border-[#E6EAF2]"
      } ${passado ? "opacity-70" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">
          {tituloDia(dia.data)}
          {dia.data === hoje && <span className="ml-2 text-xs text-[#6B4FD1]">hoje</span>}
        </span>
        <div className="flex items-center gap-2">
          {!passado && (
            <button
              onClick={() => onBloquear("dia")}
              className="h-9 px-3 rounded-lg border border-[#E6EAF2] text-xs font-semibold"
            >
              Bloquear
            </button>
          )}
          {aberto && onFechar && (
            <button onClick={onFechar} className="h-9 px-3 rounded-lg border border-[#E6EAF2] text-xs font-semibold">
              Fechar
            </button>
          )}
        </div>
      </div>

      {vazio && <p className="text-sm text-[#5B6573]">Sem visitas.</p>}

      {dia.visitas.map((v) => (
        <div
          key={v.id}
          className={`rounded-xl border p-3 flex flex-col gap-0.5 ${
            v.tipo === "fixo" ? "bg-[#F5EFFF] border-[#C9B8F5]" : "bg-[#E8F1FE] border-[#B5D0F5]"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm">{v.nome}</span>
            <span className="text-xs font-semibold">
              {minParaHora12(v.ini)}–{minParaHora12(v.fim)}
            </span>
          </div>
          <span className="text-xs text-[#5B6573]">
            {v.tipo === "fixo" ? "Fixo" : "Avulso"} · {v.detalhe}
            {v.valor ? ` · $${v.valor}` : ""}
          </span>
          {v.telefone && <span className="text-xs text-[#5B6573]">{v.telefone}</span>}
        </div>
      ))}

      {dia.bloqueios.map((b) => (
        <div
          key={b.id}
          className="rounded-xl border border-[#C9CED8] bg-[#EEF0F4] p-3 flex items-center justify-between gap-2"
        >
          <span className="text-sm">
            <span className="font-semibold">Bloqueado · {periodoBloqueioLabel[b.periodo]}</span>
            {b.motivo ? ` — ${b.motivo}` : ""}
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

      {!passado && (
        <div className="flex flex-wrap gap-2">
          {(["manha", "tarde"] as Periodo[]).flatMap((p) =>
            dia.livres[p].map((f) => (
              <button
                key={`${p}-${f.ini}`}
                onClick={() => onBloquear(p)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#E6F8F6] text-[#17695F] border border-[#9ADBD2]"
              >
                {textoLivre(p, f)}
              </button>
            ))
          )}
          {dia.livres.manha.length === 0 && dia.livres.tarde.length === 0 && (
            <span className="text-xs text-[#5B6573]">Sem horário livre.</span>
          )}
        </div>
      )}
    </div>
  );
}

function GradeSemana({
  dias,
  hoje,
  onAbrirDia,
  diaAberto,
}: {
  dias: DiaInfo[];
  hoje: string;
  onAbrirDia: (d: string | null) => void;
  diaAberto: string | null;
}) {
  const altura = ((GRID_FIM - GRID_INI) / 60) * PX_HORA;
  const topo = (min: number) => ((Math.min(Math.max(min, GRID_INI), GRID_FIM) - GRID_INI) / 60) * PX_HORA;
  const horas = Array.from({ length: (GRID_FIM - GRID_INI) / 60 + 1 }, (_, i) => GRID_INI + i * 60);

  return (
    <div className="bg-white border border-[#E6EAF2] rounded-2xl overflow-hidden">
      <div className="grid grid-cols-[56px_repeat(6,1fr)] border-b border-[#E6EAF2]">
        <div />
        {dias.map((d) => (
          <button
            key={d.data}
            onClick={() => onAbrirDia(diaAberto === d.data ? null : d.data)}
            className={`py-3 text-sm font-semibold border-l border-[#E6EAF2] ${
              d.data === hoje ? "text-[#6B4FD1]" : ""
            } ${diaAberto === d.data ? "bg-[#F5EFFF]" : ""}`}
          >
            {tituloDia(d.data)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[56px_repeat(6,1fr)]">
        <div className="relative" style={{ height: altura }}>
          {horas.map((m) => (
            <span
              key={m}
              className="absolute right-2 text-[10px] text-[#5B6573] -translate-y-1/2"
              style={{ top: topo(m) }}
            >
              {minParaHora12(m)}
            </span>
          ))}
        </div>

        {dias.map((d) => (
          <div key={d.data} className="relative border-l border-[#E6EAF2]" style={{ height: altura }}>
            {horas.map((m) => (
              <div
                key={m}
                className="absolute left-0 right-0 border-t border-[#F0F2F7]"
                style={{ top: topo(m) }}
              />
            ))}

            {(["manha", "tarde"] as Periodo[]).flatMap((p) =>
              d.livres[p].map((f) => (
                <div
                  key={`${p}-${f.ini}`}
                  className="absolute left-0.5 right-0.5 rounded-md bg-[#E6F8F6]/70 border border-dashed border-[#9ADBD2]"
                  style={{ top: topo(f.ini), height: topo(f.fim) - topo(f.ini) }}
                />
              ))
            )}

            {d.bloqueios.map((b) => {
              const f = faixaDoBloqueio(b.periodo);
              return (
                <div
                  key={b.id}
                  className="absolute left-0.5 right-0.5 rounded-md bg-[#EEF0F4] border border-[#C9CED8] px-1.5 py-1 text-[11px] overflow-hidden"
                  style={{ top: topo(f.ini), height: topo(f.fim) - topo(f.ini) }}
                >
                  <span className="font-semibold">Bloqueado</span>
                  {b.motivo ? <span className="block text-[#5B6573]">{b.motivo}</span> : null}
                </div>
              );
            })}

            {d.visitas.map((v) => (
              <div
                key={v.id}
                className={`absolute left-1 right-1 rounded-md border px-1.5 py-1 text-[11px] overflow-hidden ${
                  v.tipo === "fixo"
                    ? "bg-[#F5EFFF] border-[#C9B8F5] text-[#4B34A8]"
                    : "bg-[#E8F1FE] border-[#B5D0F5] text-[#1F4F95]"
                }`}
                style={{ top: topo(v.ini), height: Math.max(topo(v.fim) - topo(v.ini), 24) }}
                title={`${v.nome} · ${v.detalhe}`}
              >
                <span className="font-semibold block truncate">{v.nome}</span>
                <span className="block truncate">{minParaHora12(v.ini)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function BloqueioForm({
  inicial,
  onFechar,
  onConcluido,
}: {
  inicial: { data: string; periodo: PeriodoBloqueio };
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const [de, setDe] = useState(inicial.data);
  const [ate, setAte] = useState(inicial.data);
  const [periodo, setPeriodo] = useState<PeriodoBloqueio>(inicial.periodo);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conflitos, setConflitos] = useState<string[] | null>(null);
  const [resultado, setResultado] = useState<{
    criados: number;
    ignorados: string[];
    avisos: string[];
    erros: string[];
  } | null>(null);

  async function salvar(confirmar = false) {
    setErro(null);
    if (!de || !ate || ate < de) {
      setErro("Confira as datas: o fim não pode ser antes do início.");
      return;
    }
    setEnviando(true);
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch("/api/bloqueios", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sess.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ dataInicio: de, dataFim: ate, periodo, motivo, confirmar }),
    });
    const j = await res.json().catch(() => ({}));
    setEnviando(false);
    if (!res.ok) {
      setErro(j.error || "Não consegui bloquear");
      return;
    }
    if (j.precisaConfirmar) {
      setConflitos(j.conflitos as string[]);
      return;
    }
    setConflitos(null);
    setResultado(j.resumo);
    onConcluido();
  }

  const campo = "h-11 rounded-xl border border-[#E6EAF2] px-3 bg-white w-full";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Bloquear data</h2>
          <button onClick={onFechar} className="h-9 px-3 rounded-lg border border-[#E6EAF2] text-sm">
            Fechar
          </button>
        </div>

        {resultado ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="font-semibold">
              {resultado.criados} {resultado.criados === 1 ? "bloqueio criado" : "bloqueios criados"}.
            </p>
            {resultado.avisos.map((t) => (
              <p key={t} className="bg-[#FFF6DD] text-[#7A5A00] rounded-lg p-2">{t}</p>
            ))}
            {resultado.ignorados.length > 0 && (
              <p className="text-[#5B6573]">Ignorados: {resultado.ignorados.join("; ")}</p>
            )}
            {resultado.erros.map((t) => (
              <p key={t} className="bg-[#FDECEC] text-[#A32F2F] rounded-lg p-2">{t}</p>
            ))}
            <button onClick={onFechar} className="h-11 rounded-xl bg-[#6B4FD1] text-white font-semibold mt-2">
              Ok
            </button>
          </div>
        ) : conflitos ? (
          <div className="flex flex-col gap-3 text-sm">
            <p className="font-semibold">Já existe visita nesse período:</p>
            {conflitos.map((t) => (
              <p key={t} className="bg-[#FFF6DD] text-[#7A5A00] rounded-lg p-2">{t}</p>
            ))}
            <p className="text-[#5B6573]">
              Bloquear não apaga nem muda essas visitas. Você precisa avisar o cliente e reagendar.
            </p>
            <button
              onClick={() => salvar(true)}
              disabled={enviando}
              className="h-11 rounded-xl bg-[#6B4FD1] text-white font-semibold disabled:opacity-60"
            >
              {enviando ? "Bloqueando…" : "Bloquear mesmo assim"}
            </button>
            <button onClick={() => setConflitos(null)} className="h-11 rounded-xl border border-[#E6EAF2] font-semibold">
              Voltar
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                De
                <input type="date" value={de} onChange={(e) => { setDe(e.target.value); if (ate < e.target.value) setAte(e.target.value); }} className={campo} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Até
                <input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} className={campo} />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              Período
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoBloqueio)} className={campo}>
                <option value="dia">Dia todo</option>
                <option value="manha">Só manhã</option>
                <option value="tarde">Só tarde</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Motivo (opcional)
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={120} placeholder="Ex.: evento particular" className={campo} />
            </label>
            {erro && <p className="text-sm text-[#A32F2F]">{erro}</p>}
            <button
              onClick={() => salvar()}
              disabled={enviando}
              className="h-11 rounded-xl bg-[#6B4FD1] text-white font-semibold disabled:opacity-60"
            >
              {enviando ? "Bloqueando…" : "Bloquear"}
            </button>
            <p className="text-xs text-[#5B6573]">Domingos e datas passadas são ignorados. Visitas que já existem não são apagadas.</p>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- resumo (já existia) ----------

type Orc = { status: string; mensagem: string; created_at: string };
type Ag = { data_hora: string; status: string };

function Resumo() {
  const [orcs, setOrcs] = useState<Orc[]>([]);
  const [ags, setAgs] = useState<Ag[]>([]);

  useEffect(() => {
    async function carregar() {
      const { data: o } = await supabase.from("orcamentos").select("status, mensagem, created_at");
      const { data: a } = await supabase.from("agendamentos").select("data_hora, status");
      if (o) setOrcs(o as Orc[]);
      if (a) setAgs(a as Ag[]);
    }
    carregar();
  }, []);

  const agora = new Date();
  const em7dias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

  const pendentes = orcs.filter((o) => o.status === "pendente").length;
  const semana = ags.filter((a) => {
    const d = new Date(a.data_hora);
    return d >= agora && d <= em7dias && a.status === "confirmado";
  }).length;
  const receitaMes = orcs
    .filter((o) => {
      const d = new Date(o.created_at);
      return (
        o.status === "agendado" &&
        d.getMonth() === agora.getMonth() &&
        d.getFullYear() === agora.getFullYear()
      );
    })
    .reduce((soma, o) => soma + extrairValor(o.mensagem), 0);
  const agendados = orcs.filter((o) => o.status === "agendado").length;
  const conversao = orcs.length > 0 ? Math.round((agendados / orcs.length) * 100) : 0;

  const card = "bg-white border border-[#E6EAF2] rounded-2xl p-5 flex flex-col gap-1";
  const num = "font-[family-name:var(--font-fraunces)] text-3xl";

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className={card}>
        <span className="text-xs text-[#5B6573] font-medium">Orçamentos pendentes</span>
        <span className={`${num} text-[#6B4FD1]`}>{pendentes}</span>
      </div>
      <div className={card}>
        <span className="text-xs text-[#5B6573] font-medium">Próximos 7 dias</span>
        <span className={`${num} text-[#3B82D6]`}>{semana}</span>
      </div>
      <div className={card}>
        <span className="text-xs text-[#5B6573] font-medium">Receita (mês)</span>
        <span className={`${num} text-[#17695F]`}>${receitaMes.toFixed(0)}</span>
      </div>
      <div className={card}>
        <span className="text-xs text-[#5B6573] font-medium">Taxa de conversão</span>
        <span className={`${num} text-[#A32F6C]`}>{conversao}%</span>
      </div>
    </div>
  );
}