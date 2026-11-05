"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatarTelefoneUS } from "@/lib/clientes";

const SERVICOS: [string, string][] = [
  ["regular", "Regular"],
  ["deep", "Deep Cleaning"],
  ["move_in_out", "Move In / Out"],
  ["carpet_upholstery", "Carpete e Estofados"],
];

// Cadastro manual de cliente avulso (pedido por telefone, por exemplo)
export default function AvulsoForm({
  dataInicial,
  onFechar,
  onConcluido,
}: {
  dataInicial: string;
  onFechar: () => void;
  onConcluido: () => void;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [servico, setServico] = useState("regular");
  const [data, setData] = useState(dataInicial);
  const [hora, setHora] = useState("09:00");
  const [valor, setValor] = useState("");
  const [duracao, setDuracao] = useState(120);
  const [sinalRecebido, setSinalRecebido] = useState(false);
  const [enviarSms, setEnviarSms] = useState(true);
  const [idioma, setIdioma] = useState<"en" | "pt">("en");
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function salvar(forcar = false) {
    setErro(null);
    setConflito(false);
    setEnviando(true);
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch("/api/agendamentos/avulso-manual", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sess.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        nome,
        telefone,
        endereco,
        servico,
        data,
        hora,
        valor: Number(valor.replace(",", ".")),
        duracaoMin: duracao,
        sinalRecebido,
        enviarSms,
        idioma,
        observacoes: obs,
        forcar,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setEnviando(false);
    if (!res.ok) {
      if (j.conflito) setConflito(true);
      setErro(j.error || "Não consegui salvar. Tente de novo.");
      return;
    }
    onConcluido();
    if (j.aviso) {
      setAviso(j.aviso);
      return;
    }
    onFechar();
  }

  const campo = "h-11 rounded-xl border border-[#7F8999] px-3 bg-white w-full text-base text-[#233041]";
  const rotulo = "flex flex-col gap-1 text-sm";

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 flex flex-col gap-3 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Novo cliente avulso</h2>
          <button onClick={onFechar} className="h-9 px-3 rounded-lg border border-[#E6EAF2] text-sm">
            Fechar
          </button>
        </div>

        {aviso ? (
          <div className="flex flex-col gap-3 text-sm">
            <p className="bg-[#FFF6DD] text-[#7A5A00] rounded-lg p-3">{aviso}</p>
            <button onClick={onFechar} className="h-11 rounded-xl bg-[#6B4FD1] text-white font-semibold">
              Ok
            </button>
          </div>
        ) : (
          <>
            <label className={rotulo}>
              Nome
              <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
            </label>
            <label className={rotulo}>
              Telefone
              <input
                value={telefone}
                onChange={(e) => setTelefone(formatarTelefoneUS(e.target.value))}
                inputMode="tel"
                placeholder="(407) 555-0142"
                className={campo}
              />
            </label>
            <label className={rotulo}>
              Endereço (opcional)
              <input value={endereco} onChange={(e) => setEndereco(e.target.value)} className={campo} />
            </label>
            <label className={rotulo}>
              Serviço
              <select value={servico} onChange={(e) => setServico(e.target.value)} className={campo}>
                {SERVICOS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={rotulo}>
                Data
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} />
              </label>
              <label className={rotulo}>
                Horário
                <input
                  type="time"
                  step={1800}
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className={campo}
                />
              </label>
            </div>
            <label className={rotulo}>
              Valor total ($)
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder="160"
                className={campo}
              />
            </label>
            <label className={rotulo}>
              Observações (opcional)
              <input value={obs} onChange={(e) => setObs(e.target.value)} className={campo} />
            </label>

            <label className="flex items-center gap-3 text-sm min-h-[44px]">
              <input
                type="checkbox"
                checked={sinalRecebido}
                onChange={(e) => setSinalRecebido(e.target.checked)}
                className="w-5 h-5"
              />
              Sinal já recebido (entra direto como agendado)
            </label>
            {sinalRecebido && (
              <label className={rotulo}>
                Duração
                <select
                  value={duracao}
                  onChange={(e) => setDuracao(Number(e.target.value))}
                  className={campo}
                >
                  {[2, 3, 4, 5, 6].map((h) => (
                    <option key={h} value={h * 60}>
                      {h} horas
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!sinalRecebido && (
              <p className="text-xs text-[#5B6573]">
                Sem sinal: entra em Solicitações como &quot;Aguardando pagamento&quot; e a agenda só é
                reservada quando você confirmar o pagamento.
              </p>
            )}

            <label className="flex items-center gap-3 text-sm min-h-[44px]">
              <input
                type="checkbox"
                checked={enviarSms}
                onChange={(e) => setEnviarSms(e.target.checked)}
                className="w-5 h-5"
              />
              {sinalRecebido ? "Enviar SMS de confirmação" : "Enviar SMS pedindo o sinal"}
            </label>
            {enviarSms && (
              <label className={rotulo}>
                Idioma do SMS
                <select
                  value={idioma}
                  onChange={(e) => setIdioma(e.target.value === "pt" ? "pt" : "en")}
                  className={campo}
                >
                  <option value="en">Inglês</option>
                  <option value="pt">Português</option>
                </select>
              </label>
            )}

            {erro && <p className="text-sm text-[#A32F2F]">{erro}</p>}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={() => salvar()}
                disabled={enviando}
                className="h-11 px-5 rounded-xl bg-[#6B4FD1] text-white font-semibold disabled:opacity-60"
              >
                {enviando ? "Salvando…" : "Cadastrar"}
              </button>
              {conflito && (
                <button
                  onClick={() => salvar(true)}
                  disabled={enviando}
                  className="h-11 px-5 rounded-xl border border-[#6B4FD1] text-[#4B34A8] font-semibold"
                >
                  Cadastrar mesmo assim
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}