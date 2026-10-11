"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatarTelefoneUS } from "@/lib/clientes";
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

type Aba = "pendentes" | "enviadas";

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
            {a.label} ({a.n})
          </button>
        ))}
      </div>

      {erro && (
        <p className="text-sm rounded-xl bg-[#FDE8E8] text-[#8A1F1F] px-4 py-3">
          {erro}
          {erro.includes("mensagens") && " — falta rodar o SQL da tabela mensagens no Supabase."}
        </p>
      )}
      {carregando && <p className="text-[#5B6573]">Carregando...</p>}
      {!carregando && !erro && visiveis.length === 0 && (
        <p className="text-[#5B6573]">
          {aba === "pendentes" ? "Nenhuma mensagem para enviar. Tudo em dia." : "Nada enviado ainda."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {visiveis.map((m) => (
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