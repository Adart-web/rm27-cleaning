"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

// Sininho no topo do painel: abre um painel pequeno para ativar, testar e desativar os avisos
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

  const btn = "min-h-[44px] px-4 rounded-full border text-sm font-semibold disabled:opacity-60 w-full";
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  // fecha o painel ao tocar fora ou apertar Esc
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent | TouchEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("touchstart", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("touchstart", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  if (estado === "carregando" || estado === "sem-suporte") return null;

  const ligado = estado === "ativo";

  return (
    <div ref={caixa} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label="Avisos no celular"
        aria-expanded={aberto}
        className="relative h-11 w-11 rounded-full border border-[#E6EAF2] bg-white text-[#233041] flex items-center justify-center"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          {!ligado && <path d="M3 3l18 18" />}
        </svg>
        <span
          className={`absolute top-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-white ${
            ligado ? "bg-[#17A34A]" : "bg-[#F59E0B]"
          }`}
        />
      </button>

      {aberto && (
        <div className="absolute right-0 top-[52px] z-30 w-[290px] rounded-2xl border border-[#E6EAF2] bg-white p-4 shadow-lg flex flex-col gap-3">
          {estado === "ativo" && (
            <>
              <p className="text-sm font-semibold text-[#1B6B3A]">Avisos ligados neste aparelho ✓</p>
              <button onClick={testar} disabled={ocupado} className={`${btn} border-[#E6EAF2] text-[#233041] bg-white`}>
                Testar aviso
              </button>
              <button onClick={desativar} disabled={ocupado} className="text-xs text-[#5B6573] underline self-start">
                Desativar avisos
              </button>
            </>
          )}
          {estado === "desativado" && (
            <>
              <p className="text-sm text-[#5B6573]">
                Receba no celular: orçamento novo, cancelamentos, pedidos de outro horário e mensagens para enviar.
              </p>
              <button onClick={ativar} disabled={ocupado} className={`${btn} border-[#6B4FD1] bg-[#6B4FD1] text-white`}>
                Ativar avisos
              </button>
            </>
          )}
          {estado === "ios-instalar" && (
            <p className="text-sm text-[#5B6573]">
              Para receber avisos no iPhone: toque em Compartilhar → “Adicionar à Tela de Início”, abra o painel pelo
              ícone e ative os avisos aqui.
            </p>
          )}
          {estado === "negado" && (
            <p className="text-sm text-[#9B1C1C]">
              As notificações estão bloqueadas. Libere nas configurações do aparelho (Notificações → RM27 Painel) e
              volte aqui.
            </p>
          )}
          {aviso && <p className="text-xs text-[#5B6573] bg-[#F5EFFF] rounded-lg px-3 py-2">{aviso}</p>}
        </div>
      )}
    </div>
  );
}