"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Faz o conteúdo aparecer (subindo + fade) quando entra na tela. `delay` em ms para escalonar.
export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisivel(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisivel(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visivel ? "reveal-in" : ""} ${className}`}
      style={{ transitionDelay: visivel ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}