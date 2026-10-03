"use client";

import { useState, useEffect } from "react";
import {
  calcularOrcamento,
  calcularCarpeteEstofados,
  type QuoteInput,
  type CarpetInput,
} from "@/lib/pricing";
import { supabase } from "@/lib/supabase";

function parseNum(v: string): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

type TipoServico = QuoteInput["tipoServico"] | "carpet_upholstery";
type Disponibilidade = Record<string, { manha: boolean; tarde: boolean }>;

const ITENS_CARPETE: { key: keyof CarpetInput; label: string }[] = [
  { key: "quartoCarpete", label: "Bedroom with carpet" },
  { key: "salaCarpete", label: "Living room with carpet" },
  { key: "corredor", label: "Hallway" },
  { key: "escada1Lance", label: "Stairs — 1 flight" },
  { key: "escada2Lances", label: "Stairs — 2 flights" },
  { key: "tapetePequeno", label: "Small rug" },
  { key: "tapeteMedio", label: "Medium rug" },
  { key: "tapeteGrande", label: "Large rug" },
  { key: "sofa2Lugares", label: "Sofa — 2 seats" },
  { key: "sofa3Lugares", label: "Sofa — 3 seats" },
  { key: "sofaSectional", label: "Sectional sofa" },
  { key: "cadeiras", label: "Chairs" },
  { key: "poltronas", label: "Armchair" },
  { key: "colchaoTwin", label: "Mattress — Twin" },
  { key: "colchaoQueen", label: "Mattress — Queen" },
  { key: "colchaoKing", label: "Mattress — King" },
];

const MESES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDiasDoMes(year: number, month: number): (number | null)[] {
  const dias: (number | null)[] = [];
  const primeiroDiaSemana = new Date(year, month - 1, 1).getDay();
  const totalDias = new Date(year, month, 0).getDate();
  for (let i = 0; i < primeiroDiaSemana; i++) dias.push(null);
  for (let d = 1; d <= totalDias; d++) dias.push(d);
  return dias;
}

function formatDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function OrcamentoPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [estimativa, setEstimativa] = useState<number | null>(null);

  const [tipoServico, setTipoServico] = useState<TipoServico>("regular");
  const [frequencia, setFrequencia] = useState<NonNullable<QuoteInput["frequencia"]>>("quinzenal");
  const [sf, setSf] = useState("1500");
  const [pets, setPets] = useState("");
  const [criancas, setCriancas] = useState("");
  const [forno, setForno] = useState(false);
  const [geladeira, setGeladeira] = useState(false);
  const [areaExterna, setAreaExterna] = useState<"pequena" | "media" | "grande" | null>(null);

  const [itensCarpete, setItensCarpete] = useState<Record<keyof CarpetInput, string>>({
    quartoCarpete: "",
    salaCarpete: "",
    corredor: "",
    escada1Lance: "",
    escada2Lances: "",
    tapetePequeno: "",
    tapeteMedio: "",
    tapeteGrande: "",
    sofa2Lugares: "",
    sofa3Lugares: "",
    sofaSectional: "",
    cadeiras: "",
    poltronas: "",
    colchaoTwin: "",
    colchaoQueen: "",
    colchaoKing: "",
  });

  const hoje = new Date();
  const [mesAtual, setMesAtual] = useState({ year: hoje.getFullYear(), month: hoje.getMonth() + 1 });
  const [disponibilidade, setDisponibilidade] = useState<Disponibilidade>({});
  const [carregandoMes, setCarregandoMes] = useState(false);
  const [dataEscolhida, setDataEscolhida] = useState("");
  const [periodoEscolhido, setPeriodoEscolhido] = useState<"manha" | "tarde" | "">("");

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cidade, setCidade] = useState("");
  const [indicacao, setIndicacao] = useState("");

  useEffect(() => {
    async function carregar() {
      setCarregandoMes(true);
      try {
        const res = await fetch(`/api/calendar/slots?year=${mesAtual.year}&month=${mesAtual.month}`);
        const data = await res.json();
        setDisponibilidade(data.availability || {});
      } catch (e) {
        setDisponibilidade({});
      }
      setCarregandoMes(false);
    }
    carregar();
  }, [mesAtual]);

  function setItemCarpete(key: keyof CarpetInput, v: string) {
    setItensCarpete((prev) => ({ ...prev, [key]: v }));
  }

  function mesAnteriorDisabled() {
    return mesAtual.year === hoje.getFullYear() && mesAtual.month === hoje.getMonth() + 1;
  }

  function irParaMesAnterior() {
    if (mesAnteriorDisabled()) return;
    setMesAtual((prev) => {
      const m = prev.month === 1 ? 12 : prev.month - 1;
      const y = prev.month === 1 ? prev.year - 1 : prev.year;
      return { year: y, month: m };
    });
  }

  function irParaProximoMes() {
    setMesAtual((prev) => {
      const m = prev.month === 12 ? 1 : prev.month + 1;
      const y = prev.month === 12 ? prev.year + 1 : prev.year;
      return { year: y, month: m };
    });
  }

  function selecionarDia(dateStr: string) {
    if (!disponibilidade[dateStr]) return;
    setDataEscolhida(dateStr);
    setPeriodoEscolhido("");
  }

  function formatarDataEscolhida() {
    if (!dataEscolhida) return "";
    const [y, m, d] = dataEscolhida.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const dataFmt = dt.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const periodoFmt = periodoEscolhido === "manha" ? "Morning (8am–12pm)" : "Afternoon (1pm–5pm)";
    return `${dataFmt} — ${periodoFmt}`;
  }

  async function calcular() {
    setLoading(true);
    try {
      let valor: number;
      if (tipoServico === "carpet_upholstery") {
        const parsed = Object.fromEntries(
          Object.entries(itensCarpete).map(([k, v]) => [k, parseNum(v)])
        ) as CarpetInput;
        valor = await calcularCarpeteEstofados(parsed);
      } else {
        valor = await calcularOrcamento({
          tipoServico,
          frequencia,
          sf: parseNum(sf),
          pets: parseNum(pets),
          criancas: parseNum(criancas),
          primeiraVisitaRegularSemDeep: tipoServico === "regular",
          addons: { forno, geladeira, areaExterna },
        });
      }
      setEstimativa(valor);
      setStep(5);
    } catch (e) {
      alert("Erro ao calcular. Tenta de novo.");
    }
    setLoading(false);
  }

  async function enviar() {
    setLoading(true);
    const horarioTexto =
      dataEscolhida && periodoEscolhido
        ? `${dataEscolhida} - ${periodoEscolhido === "manha" ? "Morning (8am-12pm)" : "Afternoon (1pm-5pm)"}`
        : "Not selected";

    const detalhes =
      tipoServico === "carpet_upholstery"
        ? `Itens: ${ITENS_CARPETE.filter((i) => parseNum(itensCarpete[i.key]) > 0)
            .map((i) => `${i.label} x${parseNum(itensCarpete[i.key])}`)
            .join(", ")}`
        : `Pets: ${parseNum(pets)} | Crianças: ${parseNum(criancas)} | Forno: ${forno} | Geladeira: ${geladeira} | Área externa: ${areaExterna || "não"}`;

    const { error } = await supabase.from("orcamentos").insert({
      tipo: tipoServico === "regular" ? "fixo" : "pontual",
      tamanho_imovel: tipoServico === "carpet_upholstery" ? null : `${sf || "0"} SF`,
      frequencia: tipoServico === "regular" ? frequencia : null,
      status: "pendente",
      idioma: "en",
      data_escolhida: dataEscolhida,
      periodo_escolhido: periodoEscolhido,
      telefone,
      nome_cliente: nome,
      mensagem: `Serviço: ${tipoServico} | Estimativa: $${estimativa} | ${detalhes} | Cidade: ${cidade || "não informado"} | Indicação: ${indicacao || "não informado"} | Data desejada: ${horarioTexto} | Nome: ${nome} | Tel: ${telefone} | Email: ${email}`,
    });

    setLoading(false);
    if (error) {
      alert("Erro ao enviar. Tenta de novo.");
      return;
    }

    fetch("/api/whatsapp/notify-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        telefone,
        tipo: tipoServico,
        estimativa,
        data: dataEscolhida,
        periodo: periodoEscolhido,
      }),
    }).catch(() => {});

    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FBFCFF] px-8">
        <div className="max-w-md text-center flex flex-col gap-4">
          <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-[#233041]">
            Thank you!
          </h1>
          <p className="text-[#6B7480]">
            We received your request. We&apos;ll reach out on WhatsApp shortly to confirm your quote and appointment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFCFF] py-16 px-8 flex flex-col items-center">
      <div className="w-full max-w-lg flex flex-col gap-8">
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-[#233041] text-center">
          Get your free quote
        </h1>

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <label className="font-semibold text-[#233041]">What service do you need?</label>
            {[
              { v: "regular", label: "Regular Cleaning" },
              { v: "deep", label: "Deep Cleaning" },
              { v: "move_in_out", label: "Move In / Move Out" },
              { v: "carpet_upholstery", label: "Carpet & Upholstery Cleaning" },
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => setTipoServico(opt.v as TipoServico)}
                className={`text-left px-5 py-4 rounded-xl border text-[#233041] ${
                  tipoServico === opt.v
                    ? "border-[#8C6EE8] bg-[#F5EFFF]"
                    : "border-[#E6EAF2] bg-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={() => setStep(tipoServico === "carpet_upholstery" ? 10 : 2)}
              className="mt-4 bg-[#8C6EE8] text-white rounded-full py-3 font-semibold"
            >
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            {tipoServico === "regular" && (
              <>
                <label className="font-semibold text-[#233041]">How often?</label>
                {[
                  { v: "semanal", label: "Weekly" },
                  { v: "quinzenal", label: "Every 2 weeks" },
                  { v: "mensal", label: "Monthly" },
                ].map((opt) => (
                  <button
                    key={opt.v}
                    onClick={() => setFrequencia(opt.v as typeof frequencia)}
                    className={`text-left px-5 py-4 rounded-xl border text-[#233041] ${
                      frequencia === opt.v
                        ? "border-[#8C6EE8] bg-[#F5EFFF]"
                        : "border-[#E6EAF2] bg-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </>
            )}

            <label className="font-semibold text-[#233041] mt-2">Home size (square feet)</label>
            <input
              type="number"
              inputMode="numeric"
              placeholder="e.g. 1500"
              value={sf}
              onChange={(e) => setSf(e.target.value)}
              className="px-5 py-4 rounded-xl border border-[#E6EAF2] text-[#233041] placeholder:text-[#9AA5B1]"
            />

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="font-semibold text-[#233041] text-sm">Pets</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="0"
                  value={pets}
                  onChange={(e) => setPets(e.target.value)}
                  className="w-full px-5 py-3 rounded-xl border border-[#E6EAF2] text-[#233041] placeholder:text-[#9AA5B1]"
                />
              </div>
              <div className="flex-1">
                <label className="font-semibold text-[#233041] text-sm">Kids</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="0"
                  value={criancas}
                  onChange={(e) => setCriancas(e.target.value)}
                  className="w-full px-5 py-3 rounded-xl border border-[#E6EAF2] text-[#233041] placeholder:text-[#9AA5B1]"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(1)} className="flex-1 border border-[#8C6EE8] text-[#8C6EE8] rounded-full py-3 font-semibold">
                Back
              </button>
              <button onClick={() => setStep(3)} className="flex-1 bg-[#8C6EE8] text-white rounded-full py-3 font-semibold">
                Next
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <label className="font-semibold text-[#233041]">Optional add-ons</label>

            <label className="flex items-center gap-3 px-5 py-4 rounded-xl border border-[#E6EAF2] text-[#233041]">
              <input type="checkbox" checked={forno} onChange={(e) => setForno(e.target.checked)} />
              Oven interior (+$45)
            </label>
            <label className="flex items-center gap-3 px-5 py-4 rounded-xl border border-[#E6EAF2] text-[#233041]">
              <input type="checkbox" checked={geladeira} onChange={(e) => setGeladeira(e.target.checked)} />
              Fridge interior (+$45)
            </label>

            <label className="font-semibold text-[#233041] mt-2">Outdoor area</label>
            {[
              { v: null, label: "None" },
              { v: "pequena", label: "Small (+$50)" },
              { v: "media", label: "Medium (+$75)" },
              { v: "grande", label: "Large (+$100)" },
            ].map((opt) => (
              <button
                key={String(opt.v)}
                onClick={() => setAreaExterna(opt.v as typeof areaExterna)}
                className={`text-left px-5 py-3 rounded-xl border text-[#233041] ${
                  areaExterna === opt.v ? "border-[#8C6EE8] bg-[#F5EFFF]" : "border-[#E6EAF2] bg-white"
                }`}
              >
                {opt.label}
              </button>
            ))}

            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(2)} className="flex-1 border border-[#8C6EE8] text-[#8C6EE8] rounded-full py-3 font-semibold">
                Back
              </button>
              <button
                onClick={calcular}
                disabled={loading}
                className="flex-1 bg-[#8C6EE8] text-white rounded-full py-3 font-semibold disabled:opacity-50"
              >
                {loading ? "Calculating..." : "See estimate"}
              </button>
            </div>
          </div>
        )}

        {step === 10 && (
          <div className="flex flex-col gap-4">
            <label className="font-semibold text-[#233041]">
              Select the quantity of each item
            </label>
            {ITENS_CARPETE.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-4">
                <label className="text-[#233041] text-sm flex-1">{item.label}</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="0"
                  value={itensCarpete[item.key]}
                  onChange={(e) => setItemCarpete(item.key, e.target.value)}
                  className="w-20 px-3 py-2 rounded-xl border border-[#E6EAF2] text-[#233041] placeholder:text-[#9AA5B1] text-center"
                />
              </div>
            ))}

            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(1)} className="flex-1 border border-[#8C6EE8] text-[#8C6EE8] rounded-full py-3 font-semibold">
                Back
              </button>
              <button
                onClick={calcular}
                disabled={loading}
                className="flex-1 bg-[#8C6EE8] text-white rounded-full py-3 font-semibold disabled:opacity-50"
              >
                {loading ? "Calculating..." : "Continue"}
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-4">
            <label className="font-semibold text-[#233041]">Pick a date</label>

            <div className="bg-white border border-[#E6EAF2] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={irParaMesAnterior}
                  disabled={mesAnteriorDisabled()}
                  className="px-3 py-1 rounded-lg text-[#8C6EE8] disabled:opacity-30 font-semibold"
                >
                  ‹
                </button>
                <span className="font-semibold text-[#233041]">
                  {MESES[mesAtual.month - 1]} {mesAtual.year}
                </span>
                <button
                  onClick={irParaProximoMes}
                  className="px-3 py-1 rounded-lg text-[#8C6EE8] font-semibold"
                >
                  ›
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs text-[#9AA5B1] mb-2">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>

              {carregandoMes ? (
                <p className="text-sm text-[#6B7480] text-center py-6">Loading availability...</p>
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {getDiasDoMes(mesAtual.year, mesAtual.month).map((dia, idx) => {
                    if (dia === null) return <div key={`empty-${idx}`} />;
                    const dateStr = formatDateStr(mesAtual.year, mesAtual.month, dia);
                    const disp = disponibilidade[dateStr];
                    const selecionado = dataEscolhida === dateStr;
                    return (
                      <button
                        key={dateStr}
                        onClick={() => selecionarDia(dateStr)}
                        disabled={!disp}
                        className={`aspect-square rounded-lg text-sm font-medium ${
                          selecionado
                            ? "bg-[#8C6EE8] text-white"
                            : disp
                            ? "bg-[#F5EFFF] text-[#233041]"
                            : "text-[#D5DAE1]"
                        }`}
                      >
                        {dia}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {dataEscolhida && (
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-[#233041] text-sm">Choose a period</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPeriodoEscolhido("manha")}
                    disabled={!disponibilidade[dataEscolhida]?.manha}
                    className={`flex-1 px-5 py-3 rounded-xl border text-[#233041] disabled:opacity-30 ${
                      periodoEscolhido === "manha"
                        ? "border-[#8C6EE8] bg-[#F5EFFF]"
                        : "border-[#E6EAF2] bg-white"
                    }`}
                  >
                    Morning
                    <div className="text-xs text-[#6B7480]">8am – 12pm</div>
                  </button>
                  <button
                    onClick={() => setPeriodoEscolhido("tarde")}
                    disabled={!disponibilidade[dataEscolhida]?.tarde}
                    className={`flex-1 px-5 py-3 rounded-xl border text-[#233041] disabled:opacity-30 ${
                      periodoEscolhido === "tarde"
                        ? "border-[#8C6EE8] bg-[#F5EFFF]"
                        : "border-[#E6EAF2] bg-white"
                    }`}
                  >
                    Afternoon
                    <div className="text-xs text-[#6B7480]">1pm – 5pm</div>
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setStep(tipoServico === "carpet_upholstery" ? 10 : 3)}
                className="flex-1 border border-[#8C6EE8] text-[#8C6EE8] rounded-full py-3 font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => setStep(6)}
                disabled={!periodoEscolhido}
                className="flex-1 bg-[#8C6EE8] text-white rounded-full py-3 font-semibold disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="flex flex-col gap-5">
            <div className="bg-[#F5EFFF] rounded-2xl p-5 text-center">
              <div className="text-sm text-[#6B7480]">Selected time</div>
              <div className="font-semibold text-[#233041]">{formatarDataEscolhida()}</div>
            </div>

            <label className="font-semibold text-[#233041]">Your info</label>
            <input
              placeholder="Full name"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="px-5 py-4 rounded-xl border border-[#E6EAF2] text-[#233041] placeholder:text-[#9AA5B1]"
            />
            <input
              placeholder="Phone (WhatsApp)"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="px-5 py-4 rounded-xl border border-[#E6EAF2] text-[#233041] placeholder:text-[#9AA5B1]"
            />
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-5 py-4 rounded-xl border border-[#E6EAF2] text-[#233041] placeholder:text-[#9AA5B1]"
            />
            <input
              placeholder="City"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className="px-5 py-4 rounded-xl border border-[#E6EAF2] text-[#233041] placeholder:text-[#9AA5B1]"
            />
            <input
              placeholder="Who referred you? (optional)"
              value={indicacao}
              onChange={(e) => setIndicacao(e.target.value)}
              className="px-5 py-4 rounded-xl border border-[#E6EAF2] text-[#233041] placeholder:text-[#9AA5B1]"
            />

            <div className="flex gap-3 mt-2">
              <button onClick={() => setStep(5)} className="flex-1 border border-[#8C6EE8] text-[#8C6EE8] rounded-full py-3 font-semibold">
                Back
              </button>
              <button
                onClick={enviar}
                disabled={loading || !nome || !telefone}
                className="flex-1 bg-[#F39BC5] text-white rounded-full py-3 font-semibold disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send request"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}