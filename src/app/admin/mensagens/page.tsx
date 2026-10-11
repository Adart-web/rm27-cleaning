"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  DIA_CURTO,
  addDias,
  diaSemana,
  formatarDataCurta,
  formatarTelefoneUS,
  hojeOrlando,
  semanaDe,
} from "@/lib/clientes";
import { orlandoToDate } from "@/lib/time";
import { minParaHora12, partesOrlando } from "@/lib/agenda";
import { TIPO_LABEL, linkSms, telParaSms, type TipoMensagem } from "@/lib/mensagensTextos";

type Mensagem = {
  id: string;
  tipo: TipoMensagem;
  nome: string | null;
  telefone: string;
  texto: string;
  status: "pendente" | "enviada" | "descartada";
  created_at: string;
  enviada_em: string | null;
};

type Aba = "pendentes" | "enviadas" | "confirmacoes";

const TIPO_COR: Record<TipoMensagem, string> = {
  sinal: "bg-[#E8F1FE] text-[#1F4F95]",
  pagamento: "bg-[#E6F8F6] text-[#17695F]",
  lembrete: "bg-[#FFF4DC] text-[#5C3B00]",
  confirmacao_sabado: "bg-[#F5EFFF] text-[#4B34A8]",
};

function formatarQuando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function telBonito(t: string): string {
  const s = telParaSms(t);
  return s.startsWith("+1") && s.length === 12 ? formatarTelefoneUS(s.slice(2)) : s;
}

export default function MensagensPage() {
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aba, setAba] = useState<Aba>("pendentes");
  const [abertas, setAbertas] = useState<Record<string, boolean>>({});
  const [copiado, setCopiado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("mensagens")
      .select("id, tipo, nome, telefone, texto, status, created_at, enviada_em")
      .neq("status", "descartada")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      setErro(error.message);
    } else {
      setErro("");
      setMsgs((data ?? []) as Mensagem[]);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
    // ao voltar do app Mensagens para o painel, atualiza a fila
    const aoVoltar = () => {
      if (document.visibilityState === "visible") carregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [carregar]);

  async function mudarStatus(id: string, status: Mensagem["status"]) {
    const { error } = await supabase
      .from("mensagens")
      .update({ status, enviada_em: status === "enviada" ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) {
      setErro(error.message);
      return;
    }
    setAbertas((prev) => ({ ...prev, [id]: false }));
    carregar();
  }

  async function descartar(m: Mensagem) {
    if (!window.confirm(`Descartar a mensagem para ${m.nome || "o cliente"}? Ela sai da fila sem ser enviada.`)) {
      return;
    }
    await mudarStatus(m.id, "descartada");
  }

  async function copiar(m: Mensagem) {
    try {
      await navigator.clipboard.writeText(m.texto);
      setCopiado(m.id);
      setTimeout(() => setCopiado(null), 2000);
    } catch {
      setCopiado(null);
    }
  }

  const pendentes = msgs.filter((m) => m.status === "pendente");
  const enviadas = msgs.filter((m) => m.status === "enviada");
  const visiveis = aba === "pendentes" ? pendentes : enviadas;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl">Mensagens</h1>
        <p className="text-[#5B6573]">
          Toque em &quot;Abrir no Mensagens&quot;, confira o texto e envie pelo iPhone.
        </p>
      </div>

      <div className="flex gap-2">
        {(
          [
            { key: "pendentes", label: "Para enviar", n: pendentes.length },
            { key: "enviadas", label: "Enviadas", n: enviadas.length },
            { key: "confirmacoes", label: "Confirmações", n: -1 },
          ] as { key: Aba; label: string; n: number }[]
        ).map((a) => (
          <button
            key={a.key}
            onClick={() => setAba(a.key)}
            className={`min-h-[44px] px-4 rounded-full border text-sm font-semibold ${
              aba === a.key
                ? "bg-[#6B4FD1] text-white border-[#6B4FD1]"
                : "bg-white text-[#233041] border-[#E6EAF2]"
            }`}
          >
            {a.label}{a.n >= 0 ? ` (${a.n})` : ""}
          </button>
        ))}
      </div>

      {aba === "confirmacoes" && <ConfirmacoesSemana />}

      {aba !== "confirmacoes" && erro && (
        <p className="text-sm rounded-xl bg-[#FDE8E8] text-[#8A1F1F] px-4 py-3">
          {erro}
          {erro.includes("mensagens") && " — falta rodar o SQL da tabela mensagens no Supabase."}
        </p>
      )}
      {aba !== "confirmacoes" && carregando && <p className="text-[#5B6573]">Carregando...</p>}
      {aba !== "confirmacoes" && !carregando && !erro && visiveis.length === 0 && (
        <p className="text-[#5B6573]">
          {aba === "pendentes" ? "Nenhuma mensagem para enviar. Tudo em dia." : "Nada enviado ainda."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {(aba === "confirmacoes" ? [] : visiveis).map((m) => (
          <div
            key={m.id}
            className="bg-white border border-[#E6EAF2] rounded-2xl p-4 flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <span className="font-semibold text-lg">{m.nome || "Cliente"}</span>
                <span className="text-sm text-[#5B6573]">{telBonito(m.telefone)}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${TIPO_COR[m.tipo]}`}>
                  {TIPO_LABEL[m.tipo]}
                </span>
                <span className="text-xs text-[#5B6573]">
                  {m.status === "enviada" && m.enviada_em
                    ? `enviada ${formatarQuando(m.enviada_em)}`
                    : formatarQuando(m.created_at)}
                </span>
              </div>
            </div>

            <p className="whitespace-pre-wrap text-sm bg-[#FBFCFF] border border-[#E6EAF2] rounded-xl px-4 py-3">
              {m.texto}
            </p>

            {m.status === "pendente" ? (
              <div className="flex flex-col sm:flex-row gap-2">
                {abertas[m.id] ? (
                  <button
                    onClick={() => mudarStatus(m.id, "enviada")}
                    className="flex-1 min-h-[48px] rounded-full bg-[#17695F] text-white text-sm font-semibold"
                  >
                    Já enviei, marcar como enviada
                  </button>
                ) : (
                  <a
                    href={linkSms(m.telefone, m.texto)}
                    onClick={() => setAbertas((prev) => ({ ...prev, [m.id]: true }))}
                    className="flex-1 min-h-[48px] inline-flex items-center justify-center rounded-full bg-[#6B4FD1] text-white text-sm font-semibold"
                  >
                    Abrir no Mensagens
                  </a>
                )}
                <button
                  onClick={() => copiar(m)}
                  className="min-h-[48px] px-5 rounded-full border border-[#E6EAF2] bg-white text-sm font-semibold"
                >
                  {copiado === m.id ? "Copiado" : "Copiar texto"}
                </button>
                <button
                  onClick={() => descartar(m)}
                  className="min-h-[48px] px-4 text-sm font-semibold text-[#9B1C1C]"
                >
                  Descartar
                </button>
              </div>
            ) : (
              <button
                onClick={() => mudarStatus(m.id, "pendente")}
                className="self-start min-h-[44px] px-4 rounded-full border border-[#E6EAF2] bg-white text-sm font-semibold"
              >
                Voltar para a fila
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- confirmações da semana que vem ----------

type VisitaFixa = {
  id: string;
  data_hora: string;
  cliente_fixo_id: string | null;
  confirmacao: "pendente" | "confirmada" | "cancelada" | null;
  status: string;
};

function ConfirmacoesSemana() {
  const inicio = useMemo(() => addDias(semanaDe(hojeOrlando()).inicio, 7), []);
  const fim = addDias(inicio, 5);
  // prazo: domingo anterior, 18h no horário de Orlando
  const prazo = orlandoToDate(addDias(inicio, -1), "18:00");

  const [visitas, setVisitas] = useState<VisitaFixa[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [gerando, setGerando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("agendamentos")
      .select("id, data_hora, cliente_fixo_id, confirmacao, status")
      .eq("tipo", "fixo")
      .in("status", ["confirmado", "cancelado"])
      .gte("data_hora", orlandoToDate(inicio, "00:00").toISOString())
      .lt("data_hora", orlandoToDate(addDias(fim, 1), "00:00").toISOString())
      .order("data_hora");
    if (error) {
      setErro(error.message);
      setCarregando(false);
      return;
    }
    const lista = (data ?? []) as VisitaFixa[];
    const ids = [...new Set(lista.map((v) => v.cliente_fixo_id).filter((x): x is string => Boolean(x)))];
    if (ids.length > 0) {
      const { data: cls } = await supabase.from("clientes_fixos").select("id, nome").in("id", ids);
      setNomes(Object.fromEntries((cls ?? []).map((c) => [c.id as string, c.nome as string])));
    }
    setErro("");
    setVisitas(lista);
    setCarregando(false);
  }, [inicio, fim]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function chamar(url: string, corpo?: object): Promise<{ ok: boolean; json: Record<string, unknown> }> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify(corpo ?? {}),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json };
  }

  async function gerar() {
    setGerando(true);
    setErro("");
    setAviso("");
    const { ok, json } = await chamar("/api/confirmacoes/gerar");
    setGerando(false);
    if (!ok) {
      setErro((json.error as string) || "Não consegui gerar as mensagens.");
      return;
    }
    const r = json.resumo as { mensagens: number };
    setAviso(
      r.mensagens > 0
        ? `${r.mensagens} ${r.mensagens === 1 ? "mensagem colocada" : "mensagens colocadas"} na fila (aba Para enviar).`
        : "Nenhuma mensagem nova: ou já estão na fila, ou não há visitas fixas nessa semana."
    );
    carregar();
  }

  async function acao(v: VisitaFixa, a: "confirmou" | "cancelou" | "liberar") {
    if (
      a === "liberar" &&
      !window.confirm(
        `Liberar o horário de ${nomes[v.cliente_fixo_id ?? ""] || "este cliente"}? A visita sai da agenda e do Google Calendar, e o horário fica livre para um avulso.`
      )
    ) {
      return;
    }
    setOcupado(v.id);
    setErro("");
    const { ok, json } = await chamar("/api/agendamentos/acao", { id: v.id, acao: a });
    setOcupado(null);
    if (!ok) {
      setErro((json.error as string) || "Não consegui salvar.");
      return;
    }
    carregar();
  }

  const ativas = visitas.filter((v) => v.status === "confirmado");
  const confirmadas = ativas.filter((v) => v.confirmacao === "confirmada").length;
  const prazoPassou = new Date() > prazo;

  function situacao(v: VisitaFixa): { texto: string; cor: string } {
    if (v.status === "cancelado") return { texto: "Horário liberado", cor: "bg-[#EEF0F4] text-[#5B6573]" };
    if (v.confirmacao === "confirmada") return { texto: "Confirmou", cor: "bg-[#DFF5E8] text-[#1B6B3A]" };
    if (v.confirmacao === "cancelada") return { texto: "Cancelou", cor: "bg-[#FDE8E8] text-[#8A1F1F]" };
    if (v.confirmacao === "pendente") {
      return prazoPassou
        ? { texto: "Sem resposta", cor: "bg-[#FDE8E8] text-[#8A1F1F]" }
        : { texto: "Aguardando resposta", cor: "bg-[#FFF4DC] text-[#5C3B00]" };
    }
    return { texto: "Mensagem não gerada", cor: "bg-[#EEF0F4] text-[#5B6573]" };
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-[#E6EAF2] rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold">
            Semana {formatarDataCurta(inicio)} – {formatarDataCurta(fim)}
          </span>
          <span className="text-sm text-[#5B6573]">
            Prazo para os clientes responderem: domingo às 18:00 (horário de Orlando).
            {ativas.length > 0 && ` ${confirmadas} de ${ativas.length} confirmadas.`}
          </span>
        </div>
        <button
          onClick={gerar}
          disabled={gerando}
          className="self-start min-h-[44px] px-5 rounded-full border border-[#6B4FD1] bg-white text-[#4B34A8] text-sm font-semibold disabled:opacity-50"
        >
          {gerando ? "Gerando..." : "Gerar mensagens de confirmação"}
        </button>
        <span className="text-xs text-[#5B6573]">
          Isso acontece sozinho todo sábado de manhã. Use o botão se quiser adiantar ou se alguma visita for criada depois.
        </span>
      </div>

      {aviso && <p className="text-sm rounded-xl bg-[#E6F8F6] text-[#17695F] px-4 py-3">{aviso}</p>}
      {erro && <p className="text-sm rounded-xl bg-[#FDE8E8] text-[#8A1F1F] px-4 py-3">{erro}</p>}
      {carregando && <p className="text-[#5B6573]">Carregando...</p>}
      {!carregando && visitas.length === 0 && (
        <p className="text-[#5B6573]">Nenhuma visita de cliente fixo nessa semana.</p>
      )}

      <div className="flex flex-col gap-3">
        {visitas.map((v) => {
          const p = partesOrlando(v.data_hora);
          const sit = situacao(v);
          const nome = nomes[v.cliente_fixo_id ?? ""] || "Cliente fixo";
          const ativa = v.status === "confirmado";
          return (
            <div key={v.id} className="bg-white border border-[#E6EAF2] rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                  <span className="font-semibold text-lg">{nome}</span>
                  <span className="text-sm text-[#5B6573]">
                    {DIA_CURTO[diaSemana(p.data)]} {formatarDataCurta(p.data)} · {minParaHora12(p.min)}
                  </span>
                </div>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${sit.cor}`}>{sit.texto}</span>
              </div>

              {ativa && (
                <div className="flex flex-wrap gap-2">
                  {v.confirmacao !== "confirmada" && (
                    <button
                      onClick={() => acao(v, "confirmou")}
                      disabled={ocupado === v.id}
                      className="min-h-[44px] px-4 rounded-full bg-[#17695F] text-white text-sm font-semibold disabled:opacity-50"
                    >
                      Confirmou
                    </button>
                  )}
                  {v.confirmacao !== "cancelada" && (
                    <button
                      onClick={() => acao(v, "cancelou")}
                      disabled={ocupado === v.id}
                      className="min-h-[44px] px-4 rounded-full border border-[#E5B4B4] bg-white text-[#9B1C1C] text-sm font-semibold disabled:opacity-50"
                    >
                      Cancelou
                    </button>
                  )}
                  {v.confirmacao !== "confirmada" && (
                    <button
                      onClick={() => acao(v, "liberar")}
                      disabled={ocupado === v.id}
                      className="min-h-[44px] px-4 rounded-full bg-[#6B4FD1] text-white text-sm font-semibold disabled:opacity-50"
                    >
                      Liberar horário
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}