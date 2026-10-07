"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatHora12 } from "@/lib/time";
import {
  DIA_LONGO,
  FREQUENCIA_LABEL,
  HORAS_INICIO,
  avisoDePeriodo,
  diaSemana,
  formatarDataCurta,
  formatarTelefoneUS,
  normalizarTelefoneUS,
  proximasVisitas,
  type ClienteFixo,
  type Frequencia,
  type StatusCliente,
} from "@/lib/clientes";

const DURACOES = [
  { v: 90, l: "1 hora 30" },
  { v: 120, l: "2 horas" },
  { v: 150, l: "2 horas 30" },
  { v: 180, l: "3 horas" },
];

const inputCls =
  "min-h-[48px] px-3 w-full rounded-xl border border-[#7F8999] bg-white text-base text-[#233041]";
const labelCls = "text-sm font-semibold";

export default function ClienteForm({ clienteId }: { clienteId?: string }) {
  const router = useRouter();
  const editando = Boolean(clienteId);

  const [carregando, setCarregando] = useState(editando);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [status, setStatus] = useState<StatusCliente>("ativo");

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [idioma, setIdioma] = useState<"en" | "pt">("en");
  const [frequencia, setFrequencia] = useState<Frequencia>("semanal");
  const [primeiraVisita, setPrimeiraVisita] = useState("");
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [duracaoMin, setDuracaoMin] = useState(120);
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
      setPrimeiraVisita(c.primeira_visita);
      setHoraInicio(c.hora_inicio);
      setDuracaoMin(c.duracao_min);
      setValor(String(c.valor));
      setEquipe(c.equipe);
      setObservacoes(c.observacoes ?? "");
      setConfirmarSabado(c.confirmar_sabado);
      setStatus(c.status);
      setCarregando(false);
    }
    carregar();
  }, [clienteId]);

  const dia = primeiraVisita ? diaSemana(primeiraVisita) : null;
  const proximas =
    primeiraVisita && dia !== 0 ? proximasVisitas(primeiraVisita, frequencia, 8) : [];
  const aviso = avisoDePeriodo(horaInicio, duracaoMin);

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
    if (!primeiraVisita) {
      setErro("Informe a data da primeira visita (ou da próxima).");
      return;
    }
    if (diaSemana(primeiraVisita) === 0) {
      setErro("Não atendemos aos domingos. Escolha outra data.");
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
      primeira_visita: primeiraVisita,
      hora_inicio: horaInicio,
      duracao_min: duracaoMin,
      valor: valorNum,
      equipe,
      observacoes: observacoes.trim() || null,
      confirmar_sabado: confirmarSabado,
    };

    setSalvando(true);
    const { error } = clienteId
      ? await supabase.from("clientes_fixos").update(payload).eq("id", clienteId)
      : await supabase.from("clientes_fixos").insert(payload);
    setSalvando(false);

    if (error) {
      setErro(`Erro ao salvar: ${error.message}`);
      return;
    }
    router.push("/admin/clientes");
  }

  async function mudarStatus(novo: StatusCliente) {
    if (!clienteId) return;
    if (
      novo === "encerrado" &&
      !window.confirm("Encerrar o contrato deste cliente? Ele sai da lista de clientes fixos.")
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
    router.push("/admin/clientes");
  }

  if (carregando) return <p className="text-[#5B6573]">Carregando...</p>;

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
                  : "bg-[#DFF5E8] text-[#1B6B3A]"
              }`}
            >
              {status === "pausado" ? "Pausado" : "Ativo"}
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

        <div className="grid grid-cols-2 gap-3">
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

          <div className="flex flex-col gap-1.5">
            <label htmlFor="c-data" className={labelCls}>Primeira visita (ou próxima)</label>
            <input
              id="c-data"
              type="date"
              value={primeiraVisita}
              onChange={(e) => setPrimeiraVisita(e.target.value)}
              className={inputCls}
            />
            {dia !== null && (
              <span className={`text-xs ${dia === 0 ? "text-[#9B1C1C]" : "text-[#5B6573]"}`}>
                {dia === 0
                  ? "Domingo: não atendemos."
                  : `${DIA_LONGO[dia]} · ${FREQUENCIA_LABEL[frequencia].toLowerCase()}`}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="c-hora" className={labelCls}>Início</label>
            <select id="c-hora" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className={inputCls}>
              {HORAS_INICIO.map((h) => (
                <option key={h} value={h}>{formatHora12(h)}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="c-dur" className={labelCls}>Duração</label>
            <select id="c-dur" value={duracaoMin} onChange={(e) => setDuracaoMin(Number(e.target.value))} className={inputCls}>
              {DURACOES.map((d) => (
                <option key={d.v} value={d.v}>{d.l}</option>
              ))}
            </select>
          </div>

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

        {aviso && (
          <p className="text-sm rounded-xl bg-[#FFF4DC] text-[#5C3B00] px-4 py-2">{aviso}</p>
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
            <span className="text-sm font-semibold text-[#4B34A8]">Próximas visitas (8)</span>
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
          {editando && (
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