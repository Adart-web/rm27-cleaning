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

  async function enviar() {
    setLoading(true);
    const { error } = await supabase.from("orcamentos").insert({
      tipo: tipoServico === "regular" ? "fixo" : "pontual",
      tamanho_imovel: `${sf} SF`,
      frequencia: tipoServico === "regular" ? frequencia : null,
      status: "pendente",
      idioma: "en",
      mensagem: `Estimativa: $${estimativa} | Pets: ${pets} | Crianças: ${criancas} | Forno: ${forno} | Geladeira: ${geladeira} | Área externa: ${areaExterna || "não"} | Nome: ${nome} | Tel: ${telefone} | Email: ${email}`,
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
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF8] px-8">
        <div className="max-w-md text-center flex flex-col gap-4">
          <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-[#1B2A31]">
            Thank you!
          </h1>
          <p className="text-[#5B6B73]">
            We received your request. We&apos;ll reach out on WhatsApp shortly to confirm your quote.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF8] py-16 px-8 flex flex-col items-center">
      <div className="w-full max-w-lg flex flex-col gap-8">
        <h1 className="font-[family-name:var(--font-fraunces)] text-3xl text-[#1B2A31] text-center">
          Get your free quote
        </h1>

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <label className="font-semibold text-[#1B2A31]">What service do you need?</label>
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
                    ? "border-[#0F6B7C] bg-[#EAF3F2]"
                    : "border-[#ECE6DA] bg-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={() => setStep(2)}
              className="mt-4 bg-[#0F6B7C] text-white rounded-full py-3 font-semibold"
            >
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            {tipoServico === "regular" && (
              <>
                <label className="font-semibold text-[#1B2A31]">How often?</label>
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
                        ? "border-[#0F6B7C] bg-[#EAF3F2]"
                        : "border-[#ECE6DA] bg-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </>
            )}

            <label className="font-semibold text-[#1B2A31] mt-2">Home size (square feet)</label>
            <input
              type="number"
              value={sf}
              onChange={(e) => setSf(Number(e.target.value))}
              className="px-5 py-4 rounded-xl border border-[#ECE6DA]"
            />

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="font-semibold text-[#1B2A31] text-sm">Pets</label>
                <input
                  type="number"
                  min={0}
                  value={pets}
                  onChange={(e) => setPets(Number(e.target.value))}
                  className="w-full px-5 py-3 rounded-xl border border-[#ECE6DA]"
                />
              </div>
              <div className="flex-1">
                <label className="font-semibold text-[#1B2A31] text-sm">Kids</label>
                <input
                  type="number"
                  min={0}
                  value={criancas}
                  onChange={(e) => setCriancas(Number(e.target.value))}
                  className="w-full px-5 py-3 rounded-xl border border-[#ECE6DA]"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(1)} className="flex-1 border border-[#0F6B7C] text-[#0F6B7C] rounded-full py-3 font-semibold">
                Back
              </button>
              <button onClick={() => setStep(3)} className="flex-1 bg-[#0F6B7C] text-white rounded-full py-3 font-semibold">
                Next
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <label className="font-semibold text-[#1B2A31]">Optional add-ons</label>

            <label className="flex items-center gap-3 px-5 py-4 rounded-xl border border-[#ECE6DA]">
              <input type="checkbox" checked={forno} onChange={(e) => setForno(e.target.checked)} />
              Oven interior (+$45)
            </label>
            <label className="flex items-center gap-3 px-5 py-4 rounded-xl border border-[#ECE6DA]">
              <input type="checkbox" checked={geladeira} onChange={(e) => setGeladeira(e.target.checked)} />
              Fridge interior (+$45)
            </label>

            <label className="font-semibold text-[#1B2A31] mt-2">Outdoor area</label>
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
                  areaExterna === opt.v ? "border-[#0F6B7C] bg-[#EAF3F2]" : "border-[#ECE6DA] bg-white"
                }`}
              >
                {opt.label}
              </button>
            ))}

            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(2)} className="flex-1 border border-[#0F6B7C] text-[#0F6B7C] rounded-full py-3 font-semibold">
                Back
              </button>
              <button
                onClick={calcular}
                disabled={loading}
                className="flex-1 bg-[#0F6B7C] text-white rounded-full py-3 font-semibold disabled:opacity-50"
              >
                {loading ? "Calculating..." : "See estimate"}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-5">
            <div className="bg-[#EAF3F2] rounded-2xl p-6 text-center">
              <div className="text-sm text-[#5B6B73]">Estimated price</div>
              <div className="font-[family-name:var(--font-fraunces)] text-4xl text-[#0F6B7C]">
                ${estimativa}
              </div>
              <div className="text-xs text-[#5B6B73] mt-1">Final price confirmed after review</div>
            </div>

            <label className="font-semibold text-[#1B2A31]">Your info</label>
            <input
              placeholder="Full name"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="px-5 py-4 rounded-xl border border-[#ECE6DA]"
            />
            <input
              placeholder="Phone (WhatsApp)"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              className="px-5 py-4 rounded-xl border border-[#ECE6DA]"
            />
            <input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-5 py-4 rounded-xl border border-[#ECE6DA]"
            />

            <div className="flex gap-3 mt-2">
              <button onClick={() => setStep(3)} className="flex-1 border border-[#0F6B7C] text-[#0F6B7C] rounded-full py-3 font-semibold">
                Back
              </button>
              <button
                onClick={enviar}
                disabled={loading || !nome || !telefone}
                className="flex-1 bg-[#E8837C] text-white rounded-full py-3 font-semibold disabled:opacity-50"
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