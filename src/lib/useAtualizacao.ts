"use client";

import { useEffect, useRef } from "react";

export const EVENTO_ATUALIZAR = "rm27-atualizar";

// Avisa o menu (contadores) que algo mudou e ele deve recontar agora
export function avisarAtualizacao() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_ATUALIZAR));
}

// Chama a função de tempos em tempos (só com a aba visível) e sempre que a pessoa volta para a aba
export function useAtualizacaoAuto(fn: () => void, intervaloMs = 20000) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });

  useEffect(() => {
    const rodar = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    const id = setInterval(rodar, intervaloMs);
    document.addEventListener("visibilitychange", rodar);
    window.addEventListener("focus", rodar);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", rodar);
      window.removeEventListener("focus", rodar);
    };
  }, [intervaloMs]);
}