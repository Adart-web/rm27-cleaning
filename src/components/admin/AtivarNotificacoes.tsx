"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Estado = "carregando" | "sem-suporte" | "ios-instalar" | "desativado" | "negado" | "ativo";

function chaveParaBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const bruto = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i++) out[i] = bruto.charCodeAt(i);
  return out;
}

async function token(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

// Botões de notificação no topo do painel: ativar, testar e desativar
export default function AtivarNotificacoes() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const verificar = useCallback(async () => {
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const instalado =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    const suporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

    if (!suporta) {
      setEstado(ios && !instalado ? "ios-instalar" : "sem-suporte");
      return;
    }
    try {
      await navigator.serviceWorker.register("/sw.js", { scope: "/admin" });
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (Notification.permission === "denied") setEstado("negado");
      else setEstado(sub && Notification.permission === "granted" ? "ativo" : "desativado");
    } catch {
      setEstado("sem-suporte");
    }
  }, []);

  useEffect(() => {
    verificar();
  }, [verificar]);

  function mostrar(texto: string) {
    setAviso(texto);
    setTimeout(() => setAviso(null), 6000);
  }

  async function ativar() {
    setOcupado(true);
    try {
      const chave = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!chave) {
        mostrar("Falta configurar a chave das notificações no servidor.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setEstado(perm === "denied" ? "negado" : "desativado");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const existente = await reg.pushManager.getSubscription();
      const sub =
        existente ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) }));
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        mostrar(j.error || "Não consegui ativar. Tente de novo.");
        return;
      }
      setEstado("ativo");
      mostrar("Avisos ativados ✓ Toque em “Testar aviso” para conferir.");
    } catch {
      mostrar("Não consegui ativar as notificações neste aparelho.");
    } finally {
      setOcupado(false);
    }
  }

  async function testar() {
    setOcupado(true);
    const res = await fetch("/api/push/test", {
      method: "POST",
      headers: { Authorization: `Bearer ${await token()}` },
    });
    const j = await res.json().catch(() => ({}));
    setOcupado(false);
    mostrar(res.ok ? "Teste enviado. A notificação deve chegar em instantes." : j.error || "Falha no teste.");
  }

  async function desativar() {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setEstado("desativado");
      mostrar("Avisos desativados neste aparelho.");
    } finally {
      setOcupado(false);
    }
  }

  const btn = "min-h-[44px] px-4 rounded-full border text-sm font-semibold disabled:opacity-60";

  if (estado === "carregando" || estado === "sem-suporte") return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {estado === "desativado" && (
          <button onClick={ativar} disabled={ocupado} className={`${btn} border-[#6B4FD1] text-[#4B34A8] bg-white`}>
            🔔 Ativar avisos
          </button>
        )}
        {estado === "ativo" && (
          <>
            <button onClick={testar} disabled={ocupado} className={`${btn} border-[#E6EAF2] text-[#233041] bg-white`}>
              🔔 Testar aviso
            </button>
            <button onClick={desativar} disabled={ocupado} className="min-h-[44px] px-2 text-xs text-[#5B6573] underline">
              Desativar
            </button>
          </>
        )}
        {estado === "ios-instalar" && (
          <button
            onClick={() =>
              mostrar(
                "Para receber avisos no iPhone: toque em Compartilhar → “Adicionar à Tela de Início”, abra o painel pelo ícone e toque em “Ativar avisos”."
              )
            }
            className={`${btn} border-[#6B4FD1] text-[#4B34A8] bg-white`}
          >
            🔔 Ativar avisos
          </button>
        )}
        {estado === "negado" && (
          <button
            onClick={() =>
              mostrar("As notificações estão bloqueadas. Libere em Ajustes do iPhone → Notificações → RM27 Painel.")
            }
            className={`${btn} border-[#E5B4B4] text-[#9B1C1C] bg-white`}
          >
            🔕 Avisos bloqueados
          </button>
        )}
      </div>
      {aviso && (
        <p className="max-w-[280px] text-xs text-[#5B6573] bg-[#F5EFFF] rounded-lg px-3 py-2">{aviso}</p>
      )}
    </div>
  );
}