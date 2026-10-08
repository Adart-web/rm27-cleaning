"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  conflitosDoHorario,
  faixaDoBloqueio,
  hhmmParaMin,
  janelasLivres,
  minParaHora12,
  partesOrlando,
  type Ocupacao,
} from "@/lib/agenda";
import { orlandoToDate } from "@/lib/time";
import { addDias } from "@/lib/clientes";
import { formatHora12, horaPadrao, opcoesHorario } from "@/lib/time";

type Orcamento = {
  id: string;
  tipo: string;
  tamanho_imovel: string | null;
  frequencia: string | null;
  status: string;
  mensagem: string;
  created_at: string;
  data_escolhida: string | null;
  periodo_escolhido: string | null;
  hora_inicio: string | null;
  telefone: string | null;
  nome_cliente: string | null;
};

type Filtro = "acao" | "agendado" | "recusado" | "todos";

function extrairValor(mensagem: string): number {
  const match = mensagem.match(/Estimativa:\s*\$([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function parseMensagem(m: string): Record<string, string> {
  const out: Record<string, string> = {};
  m.split(" | ").forEach((part) => {
    const i = part.indexOf(": ");
    if (i > -1) out[part.slice(0, i).trim()] = part.slice(i + 2).trim();
  });
  return out;
}

function formatDataBr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function formatRecebido(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusLabel: Record<string, string> = {
  pendente: "Pendente",
  aguardando_pagamento: "Aguardando Pagamento",
  agendado: "Agendado",
  recusado: "Recusado",
};

const servicoLabel: Record<string, string> = {
  regular: "Regular",
  deep: "Deep Cleaning",
  move_in_out: "Move In / Out",
  carpet_upholstery: "Carpete e Estofados",
};

const servicoCor: Record<string, string> = {
  regular: "bg-[#F5EFFF] text-[#4B34A8]",
  deep: "bg-[#E8F1FE] text-[#1F4F95]",
  move_in_out: "bg-[#E6F8F6] text-[#17695F]",
  carpet_upholstery: "bg-[#FDECF4] text-[#A32F6C]",
};

const frequenciaLabel: Record<string, string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
};

const periodoLabel: Record<string, string> = {
  manha: "Manhã (8h–12h)",
  tarde: "Tarde (13h–17h)",
};

const periodoCurto: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
};

const areaLabel: Record<string, string> = {
  pequena: "pequena",
  media: "média",
  grande: "grande",
};

function statusClasses(status: string): string {
  if (status === "pendente") return "bg-[#E7DEFF] text-[#4B34A8]";
  if (status === "agendado") return "bg-[#DFF5E8] text-[#1B6B3A]";
  if (status === "aguardando_pagamento") return "bg-[#FFE9B8] text-[#6B4300]";
  return "bg-[#FDE8E8] text-[#8A1F1F]";
}

function resumoData(o: Orcamento): string {
  if (!o.data_escolhida) return "Sem data";
  const hora = o.hora_inicio
    ? formatHora12(o.hora_inicio)
    : periodoCurto[o.periodo_escolhido ?? ""] || "";
  return `${formatDataBr(o.data_escolhida)}${hora ? ` · ${hora}` : ""}`;
}

function montarDados(o: Orcamento) {
  const d = parseMensagem(o.mensagem || "");
  const valor = extrairValor(o.mensagem || "");
  const servicoKey = d["Serviço"] || "";
  const servico = servicoLabel[servicoKey] || o.tipo;
  const freq = o.frequencia ? frequenciaLabel[o.frequencia] || o.frequencia : "";

  const adicionais: string[] = [];
  const pets = Number(d["Pets"] || 0);
  if (pets > 0) adicionais.push(`${pets} pet${pets > 1 ? "s" : ""}`);
  const kids = Number(d["Crianças"] || 0);
  if (kids > 0) adicionais.push(`${kids} ${kids > 1 ? "crianças" : "criança"}`);
  if (d["Forno"] === "true") adicionais.push("Forno");
  if (d["Geladeira"] === "true") adicionais.push("Geladeira");
  const area = d["Área externa"];
  if (area && area !== "não") adicionais.push(`Área externa ${areaLabel[area] || area}`);
  if (d["Itens"]) d["Itens"].split(", ").forEach((i) => adicionais.push(i));

  return {
    nome: o.nome_cliente || d["Nome"] || "Sem nome",
    valor,
    servicoKey,
    servico,
    freq,
    tamanho: o.tamanho_imovel || "",
    adicionais,
    telefone: o.telefone || d["Tel"] || "",
    cidade: d["Cidade"] && d["Cidade"] !== "não informado" ? d["Cidade"] : "",
    indicacao: d["Indicação"] && d["Indicação"] !== "não informado" ? d["Indicação"] : "",
    email: d["Email"] || "",
    parseOk: Boolean(d["Serviço"]),
  };
}

export default function SolicitacoesPage() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState<Record<string, string>>({});
  const [horarios, setHorarios] = useState<Record<string, string>>({});
  const [filtro, setFiltro] = useState<Filtro>("acao");
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});
  const [copiado, setCopiado] = useState(false);
  const [ocupDb, setOcupDb] = useState<Record<string, Ocupacao[]>>({});

  async function carregarDados() {
    setLoading(true);
    const { data } = await supabase
      .from("orcamentos")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setOrcamentos(data as Orcamento[]);
    setLoading(false);
  }

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ocupação real da agenda (visitas confirmadas + bloqueios) nas datas dos pedidos em aberto
  useEffect(() => {
    const abertos = orcamentos.filter(
      (o) => (o.status === "pendente" || o.status === "aguardando_pagamento") && o.data_escolhida
    );
    if (abertos.length === 0) {
      setOcupDb({});
      return;
    }
    const datas = abertos.map((o) => o.data_escolhida as string).sort();
    const de = datas[0];
    const ate = datas[datas.length - 1];

    async function carregarOcupacao() {
      const [agRes, blRes] = await Promise.all([
        supabase
          .from("agendamentos")
          .select("data_hora, duracao_min, cliente_fixo_id, orcamento_id")
          .eq("status", "confirmado")
          .gte("data_hora", orlandoToDate(de, "00:00").toISOString())
          .lt("data_hora", orlandoToDate(addDias(ate, 1), "00:00").toISOString()),
        supabase.from("bloqueios").select("data, periodo, motivo").gte("data", de).lte("data", ate),
      ]);

      const ags = (agRes.data ?? []) as {
        data_hora: string;
        duracao_min: number | null;
        cliente_fixo_id: string | null;
        orcamento_id: string | null;
      }[];
      const fixoIds = [...new Set(ags.map((a) => a.cliente_fixo_id).filter((x): x is string => Boolean(x)))];
      const { data: fixos } = fixoIds.length
        ? await supabase.from("clientes_fixos").select("id, nome").in("id", fixoIds)
        : { data: [] as { id: string; nome: string }[] };
      const nomeFixo = new Map((fixos ?? []).map((f) => [f.id, f.nome]));

      const mapa: Record<string, Ocupacao[]> = {};
      const add = (data: string, o: Ocupacao) => {
        (mapa[data] ||= []).push(o);
      };

      for (const a of ags) {
        const p = partesOrlando(a.data_hora);
        const dur = a.duracao_min ?? 120;
        const nome = a.cliente_fixo_id
          ? `visita fixa de ${nomeFixo.get(a.cliente_fixo_id) ?? "cliente fixo"}`
          : `visita de ${orcamentos.find((x) => x.id === a.orcamento_id)?.nome_cliente ?? "cliente"}`;
        add(p.data, { ini: p.min, fim: p.min + dur, rotulo: nome });
      }
      for (const b of (blRes.data ?? []) as { data: string; periodo: "dia" | "manha" | "tarde"; motivo: string | null }[]) {
        const f = faixaDoBloqueio(b.periodo);
        add(b.data, { ...f, rotulo: `bloqueio${b.motivo ? ` (${b.motivo})` : ""}` });
      }
      setOcupDb(mapa);
    }
    carregarOcupacao();
  }, [orcamentos]);

  // Tudo que ocupa um dia: agenda real + outros pedidos em aberto (exceto o próprio)
  function ocupacoesDoDia(data: string, ignorarId: string): Ocupacao[] {
    const lista = [...(ocupDb[data] ?? [])];
    for (const x of orcamentos) {
      if (x.id === ignorarId || x.data_escolhida !== data) continue;
      if (x.status !== "pendente" && x.status !== "aguardando_pagamento") continue;
      const ini = hhmmParaMin(x.hora_inicio || horaPadrao(x.periodo_escolhido));
      const nome = x.nome_cliente || "outro cliente";
      lista.push(
        x.status === "aguardando_pagamento"
          ? { ini, fim: ini + 120, rotulo: `pedido de ${nome} aguardando pagamento` }
          : { ini, fim: ini + 120, rotulo: `pedido pendente de ${nome}`, suave: true }
      );
    }
    return lista;
  }

  function toggle(id: string) {
    setExpandidos((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/orcamento`);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  async function recusar(id: string) {
    await supabase.from("orcamentos").update({ status: "recusado" }).eq("id", id);
    carregarDados();
  }

  async function confirmarOrcamento(o: Orcamento) {
    const hora = horarios[o.id] ?? horaPadrao(o.periodo_escolhido);
    setProcessando(o.id);
    setErro((prev) => ({ ...prev, [o.id]: "" }));

    const res = await fetch("/api/confirm-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orcamentoId: o.id, horaInicio: hora }),
    });

    const result = await res.json();
    setProcessando(null);

    if (!res.ok) {
      setErro((prev) => ({ ...prev, [o.id]: result.error || "Erro ao confirmar orçamento." }));
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

  const qtdAcao = orcamentos.filter(
    (o) => o.status === "pendente" || o.status === "aguardando_pagamento"
  ).length;
  const qtdAgendados = orcamentos.filter((o) => o.status === "agendado").length;
  const qtdRecusados = orcamentos.filter((o) => o.status === "recusado").length;

  const abas: { key: Filtro; label: string; count: number }[] = [
    { key: "acao", label: "Precisam de ação", count: qtdAcao },
    { key: "agendado", label: "Agendados", count: qtdAgendados },
    { key: "recusado", label: "Recusados", count: qtdRecusados },
    { key: "todos", label: "Todos", count: orcamentos.length },
  ];

  const visiveis = orcamentos.filter((o) => {
    if (filtro === "acao") return o.status === "pendente" || o.status === "aguardando_pagamento";
    if (filtro === "agendado") return o.status === "agendado";
    if (filtro === "recusado") return o.status === "recusado";
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl">
            Solicitações
          </h1>
          <p className="text-[#5B6573]">Pedidos do formulário · clientes avulsos</p>
        </div>
        <button
          onClick={copiarLink}
          className="min-h-[44px] px-5 rounded-full border border-[#6B4FD1] bg-white text-[#4B34A8] font-semibold"
        >
          {copiado ? "Link copiado" : "Copiar link do formulário"}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {abas.map((a) => (
          <button
            key={a.key}
            onClick={() => setFiltro(a.key)}
            className={`shrink-0 whitespace-nowrap min-h-[44px] text-sm px-4 rounded-full border font-semibold ${
              filtro === a.key
                ? "bg-[#6B4FD1] text-white border-[#6B4FD1]"
                : "bg-white text-[#233041] border-[#E6EAF2]"
            }`}
          >
            {a.label} ({a.count})
          </button>
        ))}
      </div>

      {loading && <p className="text-[#5B6573]">Carregando...</p>}
      {!loading && visiveis.length === 0 && <p className="text-[#5B6573]">Nada por aqui.</p>}

      <div className="flex flex-col gap-4">
        {visiveis.map((o) => {
          const dados = montarDados(o);
          const finalizado = o.status === "agendado" || o.status === "recusado";
          const recolhido = finalizado && !expandidos[o.id];

          if (recolhido) {
            return (
              <button
                key={o.id}
                onClick={() => toggle(o.id)}
                className="w-full bg-white border border-[#E6EAF2] rounded-2xl px-5 py-3 min-h-[56px] flex items-center justify-between gap-4 text-left"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">{dados.nome}</span>
                  <span className="text-xs text-[#5B6573]">
                    {dados.servico} · {resumoData(o)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-[family-name:var(--font-fraunces)] text-lg text-[#4B34A8]">
                    ${dados.valor}
                  </span>
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${statusClasses(o.status)}`}
                  >
                    {statusLabel[o.status] || o.status}
                  </span>
                </div>
              </button>
            );
          }

          const horaSelecionada = horarios[o.id] ?? horaPadrao(o.periodo_escolhido);
          const corServico = servicoCor[dados.servicoKey] || "bg-gray-100 text-gray-600";

          return (
            <div
              key={o.id}
              className="bg-white border border-[#E6EAF2] rounded-2xl p-5 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <span className="font-semibold text-lg">{dados.nome}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${corServico}`}>
                      {dados.servico}
                      {dados.freq ? ` · ${dados.freq}` : ""}
                    </span>
                    {dados.tamanho && (
                      <span className="text-xs text-[#5B6573]">{dados.tamanho}</span>
                    )}
                    <span className="text-xs text-[#5B6573]">
                      · recebido {formatRecebido(o.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${statusClasses(o.status)}`}
                  >
                    {statusLabel[o.status] || o.status}
                  </span>
                  <span className="font-[family-name:var(--font-fraunces)] text-2xl text-[#4B34A8]">
                    ${dados.valor}
                  </span>
                </div>
              </div>

              {o.data_escolhida && (
                <div className="flex flex-wrap items-center gap-x-2 text-sm bg-[#F5EFFF] rounded-xl px-4 py-2">
                  <span className="font-medium">{formatDataBr(o.data_escolhida)}</span>
                  <span className="text-[#5B6573]">
                    · {periodoLabel[o.periodo_escolhido ?? ""] || o.periodo_escolhido}
                  </span>
                  {o.hora_inicio && (
                    <span className="font-semibold text-[#4B34A8]">
                      · início {formatHora12(o.hora_inicio)}
                    </span>
                  )}
                </div>
              )}

              {o.data_escolhida &&
                (o.status === "pendente" || o.status === "aguardando_pagamento") &&
                (() => {
                  const hora =
                    o.status === "pendente"
                      ? horarios[o.id] ?? horaPadrao(o.periodo_escolhido)
                      : o.hora_inicio || horaPadrao(o.periodo_escolhido);
                  const ocup = ocupacoesDoDia(o.data_escolhida, o.id);
                  const conf = conflitosDoHorario(ocup, hhmmParaMin(hora));
                  if (conf.length === 0) {
                    return (
                      <div className="text-sm rounded-xl px-4 py-2 bg-[#E6F8F6] text-[#17695F] font-medium">
                        Horário livre na agenda
                      </div>
                    );
                  }
                  const duro = conf.some((c) => !c.suave);
                  const livres = janelasLivres(ocup.filter((c) => !c.suave));
                  const sugestoes = [
                    ...livres.manha.map((f) => `Manhã ${minParaHora12(f.ini)}–${minParaHora12(f.fim)}`),
                    ...livres.tarde.map((f) => `Tarde ${minParaHora12(f.ini)}–${minParaHora12(f.fim)}`),
                  ];
                  return (
                    <div
                      className={`text-sm rounded-xl px-4 py-3 flex flex-col gap-1 ${
                        duro ? "bg-[#FDECEC] text-[#A32F2F]" : "bg-[#FFF6DD] text-[#7A5A00]"
                      }`}
                    >
                      <span className="font-semibold">
                        {duro ? "Conflito de horário" : "Atenção: outro pedido no mesmo horário"}
                      </span>
                      {conf.map((c, i) => (
                        <span key={i}>
                          {c.rotulo} · {minParaHora12(c.ini)}–{minParaHora12(c.fim)}
                        </span>
                      ))}
                      <span className="text-xs">
                        {sugestoes.length > 0
                          ? `Livre nesse dia: ${sugestoes.join(" · ")}`
                          : "Sem horário livre nesse dia."}
                      </span>
                    </div>
                  );
                })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {dados.telefone && (
                  <div>
                    <span className="text-[#5B6573]">Tel: </span>
                    {dados.telefone}
                  </div>
                )}
                {dados.cidade && (
                  <div>
                    <span className="text-[#5B6573]">Cidade: </span>
                    {dados.cidade}
                  </div>
                )}
                {dados.indicacao && (
                  <div>
                    <span className="text-[#5B6573]">Indicação: </span>
                    {dados.indicacao}
                  </div>
                )}
                {dados.email && (
                  <div>
                    <span className="text-[#5B6573]">E-mail: </span>
                    {dados.email}
                  </div>
                )}
              </div>

              {dados.adicionais.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#5B6573]">
                    Adicionais
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {dados.adicionais.map((a) => (
                      <span
                        key={a}
                        className="text-sm bg-[#FBFCFF] border border-[#E6EAF2] rounded-lg px-3 py-1.5"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {!dados.parseOk && (
                <p className="text-xs text-[#5B6573] leading-relaxed">{o.mensagem}</p>
              )}

              {erro[o.id] && <p className="text-sm text-red-600">{erro[o.id]}</p>}

              {o.status === "pendente" && (
                <div className="flex flex-col gap-3">
                  {o.periodo_escolhido && (
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <label htmlFor={`hora-${o.id}`} className="font-medium">
                        Horário de início
                      </label>
                      <select
                        id={`hora-${o.id}`}
                        value={horaSelecionada}
                        onChange={(e) =>
                          setHorarios((prev) => ({ ...prev, [o.id]: e.target.value }))
                        }
                        className="min-h-[44px] px-3 rounded-lg border border-[#7F8999] bg-white text-base"
                      >
                        {opcoesHorario(o.periodo_escolhido).map((h) => (
                          <option key={h} value={h}>
                            {formatHora12(h)}
                            {o.data_escolhida &&
                            conflitosDoHorario(ocupacoesDoDia(o.data_escolhida, o.id), hhmmParaMin(h))
                              .length > 0
                              ? " · ocupado"
                              : ""}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-[#5B6573]">duração: 2h</span>
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => confirmarOrcamento(o)}
                      disabled={processando === o.id}
                      className="flex-1 min-h-[48px] bg-[#17695F] text-white rounded-full text-sm font-semibold disabled:opacity-50"
                    >
                      {processando === o.id ? "Enviando..." : "Confirmar orçamento"}
                    </button>
                    <button
                      onClick={() => recusar(o.id)}
                      className="flex-1 min-h-[48px] border border-[#E5B4B4] bg-white text-[#9B1C1C] rounded-full text-sm font-semibold"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              )}

              {o.status === "aguardando_pagamento" && (
                <button
                  onClick={() => confirmarPagamento(o.id)}
                  disabled={processando === o.id}
                  className="min-h-[48px] bg-[#6B4FD1] text-white rounded-full text-sm font-semibold disabled:opacity-50"
                >
                  {processando === o.id ? "Confirmando..." : "Pagamento confirmado"}
                </button>
              )}

              {finalizado && (
                <button
                  onClick={() => toggle(o.id)}
                  className="min-h-[44px] self-start text-xs text-[#5B6573] underline"
                >
                  Recolher
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}