"use client";

import { useState } from "react";
import { calcularOrcamento, type QuoteInput } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";

export default function OrcamentoPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [estimativa, setEstimativa] = useState<number | null>(null);

  const [tipoServico, setTipoServico] = useState<QuoteInput["tipoServico"]>("regular");
  const [frequencia, setFrequencia] = useState<NonNullable<QuoteInput["frequencia"]>>("quinzenal");
  const [sf, setSf] = useState(1500);
  const [pets, setPets] = useState(0);
  const [criancas, setCriancas] = useState(0);
  const [forno, setForno] = useState(false);
  const [geladeira, setGeladeira] = useState(false);
  const [areaExterna, setAreaExterna] = useState<"pequena" | "media" | "grande" | null>(null);

  const [dataEscolhida, setDataEscolhida] = useState("");
  const [horariosDisponiveis, setHorariosDisponiveis] = useState<string[]>([]);
  const [horarioEscolhido, setHorarioEscolhido] = useState("");
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  async function calcular() {
    setLoading(true);
    try {
      const valor = await calcularOrcamento({
        tipoServico,
        frequencia,
        sf,
        pets,
        criancas,
        primeiraVisitaRegularSemDeep: tipoServico === "regular",
        addons: { forno, geladeira, areaExterna },
      });
      setEstimativa(valor);
      setStep(4);
    } catch (e) {
      alert("Erro ao calcular. Tenta de novo.");
    }
    setLoading(false);
  }

  async function buscarHorarios(date: string) {
    setDataEscolhida(date);
    setHorarioEscolhido("");
    setCarregandoHorarios(true);
    try {
      const res = await fetch(`/api/calendar/slots?date=${date}`);
      const data = await res.json();
      setHorariosDisponiveis(data.slots || []);
    } catch (e) {
      setHorariosDisponiveis([]);
    }
    setCarregandoHorarios(false);
  }

  async function enviar() {
    setLoading(true);
    const horarioTexto = horarioEscolhido
      ? new Date(horarioEscolhido).toLocaleString("en-US")
      : "Not selected";

    const { error } = await supabase.from("orcamentos").insert({
      tipo: tipoServico === "regular" ? "fixo" : "pontual",
      tamanho_imovel: `${sf} SF`,
      frequencia: tipoServico === "regular" ? frequencia : null,
      status: "pendente",
      idioma: "en",
      mensagem: `Estimativa: $${estimativa} | Pets: ${pets} | Crianças: ${criancas} | Forno: ${forno} | Geladeira: ${geladeira} | Área externa: ${areaExterna || "não"} | Data desejada: ${horarioTexto} | Nome: ${nome} | Tel: ${telefone} | Email: ${email}`,
    });
    setLoading(false);
    if (error) {
      alert("Erro ao enviar. Tenta de novo.");
      return;
    }
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
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => setTipoServico(opt.v as QuoteInput["tipoServico"])}
                className={`text-left px-5 py-4 rounded-xl border ${
                  tipoServico === opt.v
                    ? "border-[#8C6EE8] bg-[#F5EFFF]"
                    : "border-[#E6EAF2] bg-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={() => setStep(2)}
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
                    className={`text-left px-5 py-4 rounded-xl border ${
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
              value={sf}
              onChange={(e) => setSf(Number(e.target.value))}
              className="px-5 py-4 rounded-xl border border-[#E6EAF2]"
            />

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="font-semibold text-[#233041] text-sm">Pets</label>
                <input
                  type="number"
                  min={0}
                  value={pets}
                  onChange={(e) => setPets(Number(e.target.value))}
                  className="w-full px-5 py-3 rounded-xl border border-[#E6EAF2]"
                />
              </div>
              <div className="flex-1">
                <label className="font-semibold text-[#233041] text-sm">Kids</label>
                <input
                  type="number"
                  min={0}
                  value={criancas}
                  onChange={(e) => setCriancas(Number(e.target.value))}
                  className="w-full px-5 py-3 rounded-xl border border-[#E6EAF2]"
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

            <label className="flex items-center gap-3 px-5 py-4 rounded-xl border border-[#E6EAF2]">
              <input type="checkbox" checked={forno} onChange={(e) => setForno(e.target.checked)} />
              Oven interior (+$45)
            </label>
            <label className="flex items-center gap-3 px-5 py-4 rounded-xl border border-[#E6EAF2]">
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
                className={`text-left px-5 py-3 rounded-xl border ${
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

        {step === 4 && (
          <div className="flex flex-col gap-5">
            <div className="bg-[#F5EFFF] rounded-2xl p-6 text-center">
              <div className="text-sm text-[#6B7480]">Estimated price</div>
              <div className="font-[family-name:var(--font-fraunces)] text-4xl text-[#8C6EE8]">
                ${estimativa}
              </div>
              <div className="text-xs text-[#6B7480] mt-1">Final price confirmed after review</div>
            </div>

            <button
              onClick={() => setStep(5)}
              className="bg-[#8C6EE8] text-white rounded-full py-3 font-semibold"
            >
              Choose a date
            </button>
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-4">
            <label className="font-semibold text-[#233041]">Pick a date</label>
            <input
              type="date"
              min={new Date().toISOString().split("T")[0]}
              value={dataEscolhida}
              onChange={(e) => buscarHorarios(e.target.value)}
              className="px-5 py-4 rounded-xl border border-[#E6EAF2]"
            />

            {carregandoHorarios && <p className="text-sm text-[#6B7480]">Loading available times...</p>}

            {!carregandoHorarios && dataEscolhida && horariosDisponiveis.length === 0 && (
              <p className="text-sm text-[#6B7480]">No availability on this date. Try another day.</p>
            )}

            {horariosDisponiveis.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-[#233041] text-sm">Available times</label>
                {horariosDisponiveis.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setHorarioEscolhido(slot)}
                    className={`text-left px-5 py-3 rounded-xl border ${
                      horarioEscolhido === slot
                        ? "border-[#8C6EE8] bg-[#F5EFFF]"
                        : "border-[#E6EAF2] bg-white"
                    }`}
                  >
                    {new Date(slot).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(4)} className="flex-1 border border-[#8C6EE8] text-[#8C6EE8] rounded-full py-3 font-semibold">
                Back
              </button>
              <button
                onClick={() => setStep(6)}
                disabled={!horarioEscolhido}
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
              <div className="font-semibold text-[#233041]">
                {horarioEscolhido &&
                  new Date(horarioEscolhido).toLocaleString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
              </div>
            </div>

            <label className="font-semibold text-[#233041]">Your info</label>
            <input
              placeholder="Full name"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="px-5 py-4 rounded-xl border border-[#E6EAF2]"
            />
            <input
              placeholder="Phone (WhatsApp)"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="px-5 py-4 rounded-xl border border-[#E6EAF2]"
            />
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-5 py-4 rounded-xl border border-[#E6EAF2]"
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