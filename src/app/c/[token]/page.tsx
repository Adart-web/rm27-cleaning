"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Estado = "aberta" | "confirmada" | "cancelada" | "remarcar" | "expirada" | "encerrada";
type Dados = {
  nome: string;
  idioma: "pt" | "en";
  data: string;
  hora: string;
  estado: Estado;
  pedido: { data: string; hora: string; nota: string } | null;
};

const T = {
  pt: {
    oi: (n: string) => (n ? `Oi, ${n}!` : "Oi!"),
    sub: "Sua faxina da semana que vem:",
    confirmar: "Confirmar",
    cancelar: "Cancelar esta visita",
    outro: "Pedir outro horário",
    confirmada: "Tudo certo! Sua visita está confirmada. Até lá!",
    cancelada: "Visita cancelada. O horário foi liberado. Se precisar, fale com a RM27.",
    pedidoEnviado: "Pedido enviado! A RM27 vai te responder para confirmar o novo horário.",
    quero: "Você pediu:",
    expirada: "O prazo para responder por este link acabou. Fale com a RM27 para qualquer ajuste.",
    encerrada: "Esta visita já passou ou não está mais ativa.",
    invalido: "Link inválido ou expirado.",
    carregando: "Carregando…",
    qualDia: "Qual dia você prefere?",
    qualHora: "Qual horário?",
    nota: "Quer deixar um recado? (opcional)",
    enviar: "Enviar pedido",
    voltar: "Voltar",
    certeza: "Tem certeza que quer cancelar esta visita?",
    simCancelar: "Sim, cancelar",
    naoCancelar: "Não, manter",
    erro: "Não foi possível salvar. Tente de novo.",
    escolha: "Escolha o dia e o horário.",
    mudar: "Mudar minha resposta",
  },
  en: {
    oi: (n: string) => (n ? `Hi, ${n}!` : "Hi!"),
    sub: "Your cleaning next week:",
    confirmar: "Confirm",
    cancelar: "Cancel this visit",
    outro: "Ask for another time",
    confirmada: "All set! Your visit is confirmed. See you then!",
    cancelada: "Visit cancelled. The spot has been released. Contact RM27 if you need anything.",
    pedidoEnviado: "Request sent! RM27 will get back to you to confirm the new time.",
    quero: "You asked for:",
    expirada: "The time to respond with this link has ended. Please contact RM27 for any changes.",
    encerrada: "This visit has passed or is no longer active.",
    invalido: "Invalid or expired link.",
    carregando: "Loading…",
    qualDia: "Which day do you prefer?",
    qualHora: "What time?",
    nota: "Want to leave a note? (optional)",
    enviar: "Send request",
    voltar: "Back",
    certeza: "Are you sure you want to cancel this visit?",
    simCancelar: "Yes, cancel",
    naoCancelar: "No, keep it",
    erro: "Could not save. Please try again.",
    escolha: "Choose a day and a time.",
    mudar: "Change my answer",
  },
} as const;

function hora12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suf = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suf}`;
}

function dataLonga(data: string, idioma: "pt" | "en"): string {
  const d = new Date(`${data}T12:00:00Z`);
  return d.toLocaleDateString(idioma === "pt" ? "pt-BR" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export default function PaginaConfirmacao() {
  const { token } = useParams<{ token: string }>();
  const [dados, setDados] = useState<Dados | null>(null);
  const [invalido, setInvalido] = useState(false);
  const [modo, setModo] = useState<"inicio" | "outro" | "cancelar">("inicio");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("09:00");
  const [nota, setNota] = useState("");

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/confirmar/${token}`);
    if (!res.ok) {
      setInvalido(true);
      return;
    }
    setDados((await res.json()) as Dados);
  }, [token]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function enviar(acao: "confirmar" | "cancelar" | "remarcar") {
    if (!dados) return;
    const t = T[dados.idioma];
    if (acao === "remarcar" && (!data || !hora)) {
      setErro(t.escolha);
      return;
    }
    setOcupado(true);
    setErro("");
    try {
      const res = await fetch(`/api/confirmar/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, data, hora, nota }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(j.error || t.erro);
        if (res.status === 409) await carregar();
      } else {
        setModo("inicio");
        await carregar();
      }
    } catch {
      setErro(t.erro);
    }
    setOcupado(false);
  }

  const campo = "h-12 px-3 rounded-xl border border-[#7F8999] bg-white text-base text-[#233041] w-full";
  const botao = "min-h-[52px] rounded-full text-base font-semibold w-full disabled:opacity-50";

  return (
    <main className="min-h-screen bg-[#F7F5FF] flex items-start justify-center px-4 py-10">
      <div className="w-full max-w-md flex flex-col gap-6">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold text-[#6B4FD1]" style={{ fontFamily: "var(--font-fraunces), serif" }}>
            RM27
          </span>
          <span className="text-[#5B6573]">Cleaning</span>
        </div>

        {invalido && <p className="rounded-2xl bg-white border border-[#E6EAF2] p-5 text-[#233041]">{T.pt.invalido} / {T.en.invalido}</p>}
        {!invalido && !dados && <p className="text-[#5B6573]">…</p>}

        {dados && (
          <div className="rounded-2xl bg-white border border-[#E6EAF2] p-6 flex flex-col gap-5 text-[#233041]">
            {(() => {
              const t = T[dados.idioma];
              const ativa = dados.estado === "aberta" || dados.estado === "confirmada" || dados.estado === "remarcar";
              return (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="text-xl font-semibold">{t.oi(dados.nome)}</span>
                    <span className="text-[#5B6573]">{t.sub}</span>
                  </div>

                  <div className="rounded-xl bg-[#F4F1FD] border border-[#D9CFF7] p-4 flex flex-col">
                    <span className="text-lg font-semibold capitalize">{dataLonga(dados.data, dados.idioma)}</span>
                    <span className="text-[#4B34A8] font-semibold">{hora12(dados.hora)}</span>
                  </div>

                  {dados.estado === "confirmada" && (
                    <p className="rounded-xl bg-[#DFF5E8] text-[#1B6B3A] p-4 font-semibold">{t.confirmada}</p>
                  )}
                  {dados.estado === "cancelada" && (
                    <p className="rounded-xl bg-[#FDE8E8] text-[#8A1F1F] p-4 font-semibold">{t.cancelada}</p>
                  )}
                  {dados.estado === "remarcar" && dados.pedido && (
                    <div className="rounded-xl bg-[#FFF4DC] text-[#5C3B00] p-4 flex flex-col gap-1">
                      <span className="font-semibold">{t.pedidoEnviado}</span>
                      <span className="text-sm">
                        {t.quero} <span className="capitalize">{dataLonga(dados.pedido.data, dados.idioma)}</span>
                        {dados.pedido.hora ? ` · ${hora12(dados.pedido.hora)}` : ""}
                      </span>
                    </div>
                  )}
                  {dados.estado === "expirada" && <p className="text-[#5B6573]">{t.expirada}</p>}
                  {dados.estado === "encerrada" && <p className="text-[#5B6573]">{t.encerrada}</p>}

                  {erro && <p className="rounded-xl bg-[#FDE8E8] text-[#8A1F1F] p-3 text-sm">{erro}</p>}

                  {ativa && modo === "inicio" && (
                    <div className="flex flex-col gap-3">
                      {dados.estado !== "confirmada" && (
                        <button
                          disabled={ocupado}
                          onClick={() => enviar("confirmar")}
                          className={`${botao} bg-[#17695F] text-white`}
                        >
                          {t.confirmar}
                        </button>
                      )}
                      <button
                        disabled={ocupado}
                        onClick={() => {
                          setModo("outro");
                          setErro("");
                        }}
                        className={`${botao} border border-[#6B4FD1] bg-white text-[#4B34A8]`}
                      >
                        {t.outro}
                      </button>
                      <button
                        disabled={ocupado}
                        onClick={() => {
                          setModo("cancelar");
                          setErro("");
                        }}
                        className={`${botao} border border-[#E5B4B4] bg-white text-[#9B1C1C]`}
                      >
                        {t.cancelar}
                      </button>
                    </div>
                  )}

                  {ativa && modo === "outro" && (
                    <div className="flex flex-col gap-3">
                      <label className="flex flex-col gap-1 text-sm font-semibold">
                        {t.qualDia}
                        <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-semibold">
                        {t.qualHora}
                        <input type="time" step={1800} value={hora} onChange={(e) => setHora(e.target.value)} className={campo} />
                      </label>
                      <label className="flex flex-col gap-1 text-sm font-semibold">
                        {t.nota}
                        <textarea
                          value={nota}
                          maxLength={300}
                          rows={3}
                          onChange={(e) => setNota(e.target.value)}
                          className="px-3 py-2 rounded-xl border border-[#7F8999] bg-white text-base text-[#233041]"
                        />
                      </label>
                      <button
                        disabled={ocupado}
                        onClick={() => enviar("remarcar")}
                        className={`${botao} bg-[#6B4FD1] text-white`}
                      >
                        {t.enviar}
                      </button>
                      <button onClick={() => setModo("inicio")} className="min-h-[44px] text-[#5B6573] underline">
                        {t.voltar}
                      </button>
                    </div>
                  )}

                  {ativa && modo === "cancelar" && (
                    <div className="flex flex-col gap-3">
                      <p className="font-semibold">{t.certeza}</p>
                      <button
                        disabled={ocupado}
                        onClick={() => enviar("cancelar")}
                        className={`${botao} bg-[#B42318] text-white`}
                      >
                        {t.simCancelar}
                      </button>
                      <button
                        disabled={ocupado}
                        onClick={() => setModo("inicio")}
                        className={`${botao} border border-[#7F8999] bg-white text-[#233041]`}
                      >
                        {t.naoCancelar}
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </main>
  );
}