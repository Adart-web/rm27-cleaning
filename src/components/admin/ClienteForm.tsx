"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { formatHora12 } from "@/lib/time";
import {
  DIA_LONGO,
  FREQUENCIA_LABEL,
  HORAS_INICIO,
  addDias,
  avisoDePeriodo,
  caiNaSemanaAtual,
  diaSemana,
  type Horario,
  formatarDataCurta,
  formatarTelefoneUS,
  hojeOrlando,
  normalizarTelefoneUS,
  proximasVisitas,
  type ClienteFixo,
  type Frequencia,
  type StatusCliente,
} from "@/lib/clientes";

type Slot = { data: string; hora: string; dur: string };

// "2,5" ou "2.5" horas -> minutos (null se inválido). Aceita de 30 min a 12 h.
function duracaoParaMin(texto: string): number | null {
  const h = Number(texto.trim().replace(",", "."));
  if (!Number.isFinite(h)) return null;
  const min = Math.round(h * 60);
  return min >= 30 && min <= 720 ? min : null;
}

function minParaTexto(min: number): string {
  return String(Math.round((min / 60) * 100) / 100);
}

const inputCls =
  "min-h-[48px] px-3 w-full rounded-xl border border-[#7F8999] bg-white text-base text-[#233041]";
const labelCls = "text-sm font-semibold";

type Resumo = {
  criadas: number;
  existentes: number;
  removidas: number;
  conflitos: string[];
  erros: string[];
};

type Resultado = { titulo: string; resumo?: Resumo; falha?: string };

async function sincronizar(
  id: string,
  recriar: boolean
): Promise<{ resumo?: Resumo; falha?: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { falha: "Sessão expirada. Entre de novo no painel." };

  try {
    const res = await fetch("/api/fixos/sincronizar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ clienteId: id, recriar }),
    });
    const json = await res.json();
    if (!res.ok) return { falha: json.error || "Erro ao criar as visitas." };
    return { resumo: json.resumo as Resumo };
  } catch {
    return { falha: "Sem conexão com o servidor." };
  }
}

export default function ClienteForm({ clienteId }: { clienteId?: string }) {
  const editando = Boolean(clienteId);

  const [carregando, setCarregando] = useState(editando);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [status, setStatus] = useState<StatusCliente>("ativo");

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [idioma, setIdioma] = useState<"en" | "pt">("en");
  const [frequencia, setFrequencia] = useState<Frequencia>("semanal");
  const [slots, setSlots] = useState<Slot[]>([{ data: "", hora: "09:00", dur: "2" }]);
  const [valor, setValor] = useState("");
  const [equipe, setEquipe] = useState(1);
  const [observacoes, setObservacoes] = useState("");
  const [confirmarSabado, setConfirmarSabado] = useState(true);

  useEffect(() => {
    if (!clienteId) return;
    async function carregar() {
      const { data, error } = await supabase
        .from("clientes_fixos")
        .select("*")
        .eq("id", clienteId)
        .single();
      if (error || !data) {
        setErro("Cliente não encontrado.");
        setCarregando(false);
        return;
      }
      const c = data as ClienteFixo;
      setNome(c.nome);
      setTelefone(formatarTelefoneUS(c.telefone));
      setEndereco(c.endereco ?? "");
      setIdioma(c.idioma);
      setFrequencia(c.frequencia);
      setSlots([
        { data: c.primeira_visita, hora: c.hora_inicio, dur: minParaTexto(c.duracao_min) },
        ...(c.horarios_extras ?? []).map((h) => ({
          data: h.primeira_visita,
          hora: h.hora_inicio,
          dur: minParaTexto(h.duracao_min),
        })),
      ]);
      setValor(String(c.valor));
      setEquipe(c.equipe);
      setObservacoes(c.observacoes ?? "");
      setConfirmarSabado(c.confirmar_sabado);
      setStatus(c.status);
      setCarregando(false);
    }
    carregar();
  }, [clienteId]);

  const limite = addDias(hojeOrlando(), 56);
  const proximas = slots
    .flatMap((sl) =>
      sl.data && diaSemana(sl.data) !== 0 ? proximasVisitas(sl.data, frequencia, 8) : []
    )
    .filter((d) => d < limite)
    .sort();
  const avisoSemana = !editando && slots.some((sl) => sl.data && caiNaSemanaAtual(sl.data));

  function mudarSlot(i: number, campo: keyof Slot, valor: string) {
    setSlots((prev) => prev.map((sl, j) => (j === i ? { ...sl, [campo]: valor } : sl)));
  }

  function adicionarSlot() {
    setSlots((prev) => [...prev, { data: "", hora: prev[prev.length - 1].hora, dur: prev[prev.length - 1].dur }]);
  }

  function removerSlot(i: number) {
    setSlots((prev) => prev.filter((_, j) => j !== i));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    const tel = normalizarTelefoneUS(telefone);
    const valorNum = Number(valor.replace(/[^0-9.]/g, ""));

    if (!nome.trim()) {
      setErro("Informe o nome.");
      return;
    }
    if (!tel) {
      setErro("Telefone dos EUA com 10 dígitos, por exemplo (407) 555-0142.");
      return;
    }
    const horarios: Horario[] = [];
    for (let i = 0; i < slots.length; i++) {
      const sl = slots[i];
      const nomeVisita = slots.length > 1 ? `Visita ${i + 1}: ` : "";
      if (!sl.data) {
        setErro(`${nomeVisita}informe a data da primeira visita (ou da próxima).`);
        return;
      }
      if (diaSemana(sl.data) === 0) {
        setErro(`${nomeVisita}não atendemos aos domingos. Escolha outra data.`);
        return;
      }
      const min = duracaoParaMin(sl.dur);
      if (!min) {
        setErro(`${nomeVisita}duração inválida. Digite em horas, de 0,5 a 12 (ex.: 2,5).`);
        return;
      }
      horarios.push({ primeira_visita: sl.data, hora_inicio: sl.hora, duracao_min: min });
    }
    if (new Set(horarios.map((h) => h.primeira_visita)).size !== horarios.length) {
      setErro("Duas visitas estão na mesma data. Use dias diferentes.");
      return;
    }
    if (!valorNum || valorNum <= 0) {
      setErro("Informe o valor por visita.");
      return;
    }

    const payload = {
      nome: nome.trim(),
      telefone: tel,
      endereco: endereco.trim() || null,
      idioma,
      frequencia,
      primeira_visita: horarios[0].primeira_visita,
      hora_inicio: horarios[0].hora_inicio,
      duracao_min: horarios[0].duracao_min,
      horarios_extras: horarios.slice(1),
      valor: valorNum,
      equipe,
      observacoes: observacoes.trim() || null,
      confirmar_sabado: confirmarSabado,
    };

    setSalvando(true);
    let id = clienteId;

    if (clienteId) {
      const { error } = await supabase.from("clientes_fixos").update(payload).eq("id", clienteId);
      if (error) {
        setSalvando(false);
        setErro(`Erro ao salvar: ${error.message}`);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("clientes_fixos")
        .insert(payload)
        .select("id")
        .single();
      if (error || !data) {
        setSalvando(false);
        setErro(`Erro ao salvar: ${error?.message ?? "sem resposta"}`);
        return;
      }
      id = data.id as string;
    }

    // Em edição, as visitas futuras são recriadas pra refletir as mudanças
    const r = await sincronizar(id as string, Boolean(clienteId));
    setSalvando(false);
    setResultado({ titulo: "Cliente salvo", ...r });
  }

  async function mudarStatus(novo: StatusCliente) {
    if (!clienteId) return;
    if (
      novo === "encerrado" &&
      !window.confirm("Encerrar o contrato deste cliente? As visitas futuras saem da agenda.")
    ) {
      return;
    }
    const { error } = await supabase
      .from("clientes_fixos")
      .update({ status: novo })
      .eq("id", clienteId);
    if (error) {
      setErro(`Erro: ${error.message}`);
      return;
    }
    const r = await sincronizar(clienteId, false);
    const titulo =
      novo === "pausado" ? "Cliente pausado" : novo === "ativo" ? "Cliente reativado" : "Contrato encerrado";
    setStatus(novo);
    setResultado({ titulo, ...r });
  }

  if (carregando) return <p className="text-[#5B6573]">Carregando...</p>;

  if (resultado) {
    const r = resultado.resumo;
    const temProblema = Boolean(resultado.falha) || (r && (r.conflitos.length > 0 || r.erros.length > 0));
    return (
      <div className="max-w-3xl mx-auto flex flex-col gap-4">
        <div className="bg-white border border-[#E6EAF2] rounded-2xl p-6 flex flex-col gap-4">
          <h1 className="font-[family-name:var(--font-fraunces)] text-3xl">{resultado.titulo}</h1>

          {resultado.falha && (
            <p className="rounded-xl bg-[#FDE8E8] text-[#8A1F1F] px-4 py-3 text-sm">
              {resultado.falha} O cliente foi salvo. As visitas faltantes são criadas na rodada
              automática da manhã, ou salve de novo pra tentar agora.
            </p>
          )}

          {r && (
            <ul className="flex flex-col gap-1 text-[#233041]">
              {r.criadas > 0 && <li>{r.criadas} visitas criadas no Google Calendar</li>}
              {r.existentes > 0 && <li>{r.existentes} visitas já existiam</li>}
              {r.removidas > 0 && <li>{r.removidas} visitas futuras removidas</li>}
              {r.criadas === 0 && r.existentes === 0 && r.removidas === 0 && !temProblema && (
                <li>Nenhuma visita nova nas próximas 8 semanas.</li>
              )}
            </ul>
          )}

          {r && r.conflitos.length > 0 && (
            <div className="rounded-xl bg-[#FFF4DC] text-[#5C3B00] px-4 py-3 text-sm flex flex-col gap-1">
              <strong>Conflito de horário (visita não criada):</strong>
              {r.conflitos.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          )}

          {r && r.erros.length > 0 && (
            <div className="rounded-xl bg-[#FDE8E8] text-[#8A1F1F] px-4 py-3 text-sm flex flex-col gap-1">
              <strong>Erros:</strong>
              {r.erros.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/clientes"
              className="inline-flex items-center min-h-[48px] px-6 rounded-full bg-[#6B4FD1] text-white font-semibold"
            >
              Voltar pra lista
            </Link>
            {editando && (
              <button
                onClick={() => setResultado(null)}
                className="min-h-[48px] px-5 rounded-full border border-[#E6EAF2] bg-white font-semibold"
              >
                Continuar editando
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href="/admin/clientes"
          className="inline-flex items-center min-h-[44px] self-start font-semibold text-[#4B34A8]"
        >
          ‹ Clientes
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-[family-name:var(--font-fraunces)] text-3xl md:text-4xl">
            {editando ? nome || "Cliente" : "Novo cliente fixo"}
          </h1>
          {editando && (
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full ${
                status === "pausado"
                  ? "bg-[#FFE9B8] text-[#6B4300]"
                  : status === "encerrado"
                  ? "bg-[#FDE8E8] text-[#8A1F1F]"
                  : "bg-[#DFF5E8] text-[#1B6B3A]"
              }`}
            >
              {status === "pausado" ? "Pausado" : status === "encerrado" ? "Encerrado" : "Ativo"}
            </span>
          )}
        </div>
      </div>

      <form
        onSubmit={salvar}
        className="bg-white border border-[#E6EAF2] rounded-2xl p-5 md:p-6 flex flex-col gap-5"
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-nome" className={labelCls}>Nome</label>
          <input id="c-nome" value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-tel" className={labelCls}>Telefone</label>
          <input
            id="c-tel"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="(407) 555-0142"
            value={telefone}
            onChange={(e) => setTelefone(formatarTelefoneUS(e.target.value))}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-end" className={labelCls}>Endereço</label>
          <input id="c-end" value={endereco} onChange={(e) => setEndereco(e.target.value)} className={inputCls} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-freq" className={labelCls}>Frequência</label>
          <select
            id="c-freq"
            value={frequencia}
            onChange={(e) => setFrequencia(e.target.value as Frequencia)}
            className={inputCls}
          >
            <option value="semanal">{FREQUENCIA_LABEL.semanal}</option>
            <option value="quinzenal">{FREQUENCIA_LABEL.quinzenal}</option>
            <option value="mensal">{FREQUENCIA_LABEL.mensal}</option>
          </select>
        </div>

        <div className="flex flex-col gap-3">
          <span className={labelCls}>Dias e horários das visitas</span>

          {slots.map((sl, i) => {
            const d = sl.data ? diaSemana(sl.data) : null;
            const min = duracaoParaMin(sl.dur);
            const aviso = min ? avisoDePeriodo(sl.hora, min) : null;
            return (
              <div key={i} className="rounded-xl border border-[#E6EAF2] p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#4B34A8]">
                    {slots.length > 1 ? `Visita ${i + 1}` : "Visita"}
                  </span>
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => removerSlot(i)}
                      className="min-h-[44px] px-2 text-sm font-semibold text-[#9B1C1C]"
                    >
                      Remover
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                    <label htmlFor={`c-data-${i}`} className={labelCls}>Primeira visita (ou próxima)</label>
                    <input
                      id={`c-data-${i}`}
                      type="date"
                      value={sl.data}
                      onChange={(e) => mudarSlot(i, "data", e.target.value)}
                      className={inputCls}
                    />
                    {d !== null && (
                      <span className={`text-xs ${d === 0 ? "text-[#9B1C1C]" : "text-[#5B6573]"}`}>
                        {d === 0
                          ? "Domingo: não atendemos."
                          : `${DIA_LONGO[d]} · ${FREQUENCIA_LABEL[frequencia].toLowerCase()}`}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`c-hora-${i}`} className={labelCls}>Início</label>
                    <select
                      id={`c-hora-${i}`}
                      value={sl.hora}
                      onChange={(e) => mudarSlot(i, "hora", e.target.value)}
                      className={inputCls}
                    >
                      {HORAS_INICIO.map((h) => (
                        <option key={h} value={h}>{formatHora12(h)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={`c-dur-${i}`} className={labelCls}>Duração (horas)</label>
                    <input
                      id={`c-dur-${i}`}
                      inputMode="decimal"
                      placeholder="2,5"
                      value={sl.dur}
                      onChange={(e) => mudarSlot(i, "dur", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                {aviso && (
                  <p className="text-sm rounded-xl bg-[#FFF4DC] text-[#5C3B00] px-4 py-2">{aviso}</p>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={adicionarSlot}
            className="self-start min-h-[44px] px-4 rounded-full border border-[#6B4FD1] bg-white text-[#4B34A8] text-sm font-semibold"
          >
            + Adicionar outro dia/horário
          </button>
          <span className="text-xs text-[#5B6573]">
            Use quando o cliente tem mais de uma visita por semana (ex.: terça de manhã e sexta à tarde).
            O valor abaixo vale para cada visita.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="c-valor" className={labelCls}>Valor por visita</label>
            <input
              id="c-valor"
              inputMode="decimal"
              placeholder="$135"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="c-equipe" className={labelCls}>Equipe</label>
            <select id="c-equipe" value={equipe} onChange={(e) => setEquipe(Number(e.target.value))} className={inputCls}>
              <option value={1}>Equipe 1</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
            <label htmlFor="c-idioma" className={labelCls}>Mensagens em</label>
            <select id="c-idioma" value={idioma} onChange={(e) => setIdioma(e.target.value as "en" | "pt")} className={inputCls}>
              <option value="en">Inglês</option>
              <option value="pt">Português</option>
            </select>
          </div>
        </div>

        {avisoSemana && (
          <p className="text-sm rounded-xl bg-[#FFF4DC] text-[#5C3B00] px-4 py-2">
            Essa data cai nesta semana, que já foi confirmada. Tudo bem se o cliente já é ativo
            ou se há uma vaga livre. Se for cliente novo, prefira a semana que vem.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="c-obs" className={labelCls}>Observações</label>
          <textarea
            id="c-obs"
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="px-3 py-2.5 w-full rounded-xl border border-[#7F8999] bg-white text-base text-[#233041]"
          />
        </div>

        <div className="flex items-center gap-3 min-h-[44px]">
          <input
            id="c-conf"
            type="checkbox"
            checked={confirmarSabado}
            onChange={(e) => setConfirmarSabado(e.target.checked)}
            className="w-5 h-5 accent-[#6B4FD1]"
          />
          <label htmlFor="c-conf">Mandar confirmação todo sábado</label>
        </div>

        {proximas.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl bg-[#F5EFFF] px-4 py-3">
            <span className="text-sm font-semibold text-[#4B34A8]">
              Visitas que serão criadas (próximas 8 semanas)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {proximas.map((d) => (
                <span key={d} className="text-sm bg-white border border-[#D9CFFA] rounded-full px-2.5 py-0.5">
                  {formatarDataCurta(d)}
                </span>
              ))}
            </div>
          </div>
        )}

        {erro && (
          <p role="alert" className="text-sm text-red-600">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={salvando}
            className="min-h-[48px] px-6 rounded-full bg-[#6B4FD1] text-white font-semibold disabled:opacity-50"
          >
            {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Cadastrar cliente"}
          </button>

          {editando && status === "ativo" && (
            <button
              type="button"
              onClick={() => mudarStatus("pausado")}
              className="min-h-[48px] px-5 rounded-full border border-[#E6EAF2] bg-white font-semibold"
            >
              Pausar
            </button>
          )}
          {editando && status === "pausado" && (
            <button
              type="button"
              onClick={() => mudarStatus("ativo")}
              className="min-h-[48px] px-5 rounded-full border border-[#E6EAF2] bg-white font-semibold"
            >
              Reativar
            </button>
          )}
          {editando && status !== "encerrado" && (
            <button
              type="button"
              onClick={() => mudarStatus("encerrado")}
              className="min-h-[48px] px-3 font-semibold text-[#9B1C1C]"
            >
              Encerrar contrato
            </button>
          )}
        </div>
      </form>
    </div>
  );
}