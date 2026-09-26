"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Orcamento = {
  id: string;
  tipo: string;
  tamanho_imovel: string;
  frequencia: string | null;
  status: string;
  mensagem: string;
  created_at: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [agendandoId, setAgendandoId] = useState<string | null>(null);
  const [dataHora, setDataHora] = useState("");
  const [erroAgenda, setErroAgenda] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function carregarOrcamentos() {
    setLoading(true);
    const { data, error } = await supabase
      .from("orcamentos")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrcamentos(data as Orcamento[]);
    }
    setLoading(false);
  }

  async function checkAuthAndLoad() {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      router.push("/admin/login");
      return;
    }

    setCheckingAuth(false);
    carregarOrcamentos();
  }

  useEffect(() => {
    checkAuthAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function recusar(id: string) {
    await supabase.from("orcamentos").update({ status: "recusado" }).eq("id", id);
    carregarOrcamentos();
  }

  async function confirmarAgendamento(id: string) {
    if (!dataHora) return;
    setSalvando(true);
    setErroAgenda("");

    const res = await fetch("/api/calendar/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orcamentoId: id,
        dataHoraISO: new Date(dataHora).toISOString(),
      }),
    });

    const result = await res.json();
    setSalvando(false);

    if (!res.ok) {
      setErroAgenda(result.error || "Error scheduling appointment");
      return;
    }

    setAgendandoId(null);
    setDataHora("");
    carregarOrcamentos();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/admin/login");
  }

  if (checkingAuth) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#FBFCFF] px-8 py-10">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-[#233041]">
            Quote Requests
          </h1>
          <button
            onClick={logout}
            className="text-sm text-[#6B7480] border border-[#E6EAF2] rounded-full px-4 py-2"
          >
            Sign out
          </button>
        </div>

        {loading && <p className="text-[#6B7480]">Loading...</p>}

        {!loading && orcamentos.length === 0 && (
          <p className="text-[#6B7480]">No quote requests yet.</p>
        )}

        <div className="flex flex-col gap-4">
          {orcamentos.map((o) => (
            <div
              key={o.id}
              className="bg-white border border-[#E6EAF2] rounded-2xl p-6 flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#8C6EE8]">
                  {o.tipo} {o.frequencia ? `— ${o.frequencia}` : ""}
                </span>
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full ${
                    o.status === "pendente"
                      ? "bg-[#F5EFFF] text-[#8C6EE8]"
                      : o.status === "agendado"
                      ? "bg-[#E6F8F6] text-[#2A9D8F]"
                      : o.status === "aprovado"
                      ? "bg-[#E6F8F6] text-[#2A9D8F]"
                      : "bg-red-50 text-red-500"
                  }`}
                >
                  {o.status}
                </span>
              </div>

              <div className="text-sm text-[#233041]">{o.tamanho_imovel}</div>
              <div className="text-sm text-[#6B7480]">{o.mensagem}</div>
              <div className="text-xs text-[#6B7480]">
                {new Date(o.created_at).toLocaleString()}
              </div>

              {o.status === "pendente" && agendandoId !== o.id && (
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setAgendandoId(o.id)}
                    className="flex-1 bg-[#71D7CF] text-white rounded-full py-2 text-sm font-semibold"
                  >
                    Approve & Schedule
                  </button>
                  <button
                    onClick={() => recusar(o.id)}
                    className="flex-1 border border-red-300 text-red-500 rounded-full py-2 text-sm font-semibold"
                  >
                    Decline
                  </button>
                </div>
              )}

              {agendandoId === o.id && (
                <div className="flex flex-col gap-3 mt-2 bg-[#F5EFFF] rounded-xl p-4">
                  <label className="text-xs font-semibold text-[#233041]">
                    Date & time
                  </label>
                  <input
                    type="datetime-local"
                    value={dataHora}
                    onChange={(e) => setDataHora(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-[#E6EAF2]"
                  />
                  {erroAgenda && (
                    <p className="text-sm text-red-600">{erroAgenda}</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => confirmarAgendamento(o.id)}
                      disabled={salvando || !dataHora}
                      className="flex-1 bg-[#8C6EE8] text-white rounded-full py-2 text-sm font-semibold disabled:opacity-50"
                    >
                      {salvando ? "Scheduling..." : "Confirm"}
                    </button>
                    <button
                      onClick={() => {
                        setAgendandoId(null);
                        setErroAgenda("");
                      }}
                      className="flex-1 border border-[#E6EAF2] text-[#6B7480] rounded-full py-2 text-sm font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}