"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type IconeNome = "agenda" | "mensagens" | "solicitacoes" | "clientes";

const ITENS: { href: string; label: string; icone: IconeNome }[] = [
  { href: "/admin", label: "Agenda", icone: "agenda" },
  { href: "/admin/mensagens", label: "Mensagens", icone: "mensagens" },
  { href: "/admin/solicitacoes", label: "Solicitações", icone: "solicitacoes" },
  { href: "/admin/clientes", label: "Clientes", icone: "clientes" },
];

function Icone({ nome }: { nome: IconeNome }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (nome === "agenda") {
    return (
      <svg {...props}>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M8 2v4M16 2v4M3 10h18" />
      </svg>
    );
  }
  if (nome === "mensagens") {
    return (
      <svg {...props}>
        <path d="M4 5h16v11H9l-5 4z" />
      </svg>
    );
  }
  if (nome === "solicitacoes") {
    return (
      <svg {...props}>
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </svg>
  );
}

function itemAtivo(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const ehLogin = pathname.startsWith("/admin/login");
  const [pronto, setPronto] = useState(false);
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    if (ehLogin) return;
    let vivo = true;

    async function verificar() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/admin/login");
        return;
      }
      if (!vivo) return;
      setPronto(true);

      const { count } = await supabase
        .from("orcamentos")
        .select("id", { count: "exact", head: true })
        .in("status", ["pendente", "aguardando_pagamento"]);
      if (vivo) setPendentes(count ?? 0);
    }

    verificar();
    return () => {
      vivo = false;
    };
  }, [ehLogin, pathname, router]);

  async function sair() {
    await supabase.auth.signOut();
    setPronto(false);
    router.push("/admin/login");
  }

  if (ehLogin) return <>{children}</>;

  if (!pronto) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#5B6573]">
        Carregando...
      </div>
    );
  }

  const contagem = (href: string) => (href === "/admin/solicitacoes" ? pendentes : 0);

  return (
    <div className="min-h-screen bg-[#FBFCFF] text-[#233041]">
      <header className="bg-white border-b border-[#E6EAF2]">
        <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-fraunces)] font-semibold text-2xl text-[#6B4FD1]">
              RM27
            </span>
            <span className="text-sm text-[#5B6573]">Painel</span>
          </div>

          <nav aria-label="Seções do painel" className="hidden md:flex gap-2">
            {ITENS.map((item) => {
              const on = itemAtivo(pathname, item.href);
              const n = contagem(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={on ? "page" : undefined}
                  className={`inline-flex items-center gap-2 min-h-[44px] px-[18px] rounded-full font-semibold ${
                    on
                      ? "bg-[#6B4FD1] text-white"
                      : "bg-white border border-[#E6EAF2] text-[#233041]"
                  }`}
                >
                  {item.label}
                  {n > 0 && (
                    <span
                      className={`px-2 rounded-full text-xs ${
                        on ? "bg-white text-[#4B34A8]" : "bg-[#FDECF4] text-[#A32F6C]"
                      }`}
                    >
                      {n}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={sair}
            className="min-h-[44px] px-4 rounded-full border border-[#E6EAF2] bg-white text-sm text-[#5B6573]"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-[1240px] mx-auto px-4 md:px-8 py-6 md:py-8 pb-28 md:pb-12">
        {children}
      </main>

      <nav
        aria-label="Seções do painel"
        className="md:hidden fixed bottom-0 inset-x-0 z-20 flex border-t border-[#E6EAF2] bg-white pb-[env(safe-area-inset-bottom)]"
      >
        {ITENS.map((item) => {
          const on = itemAtivo(pathname, item.href);
          const n = contagem(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={on ? "page" : undefined}
              className={`flex-1 min-h-[60px] flex flex-col items-center justify-center gap-0.5 text-xs ${
                on ? "font-bold text-[#4B34A8] bg-[#F5EFFF]" : "font-semibold text-[#5B6573]"
              }`}
            >
              <span className="relative">
                <Icone nome={item.icone} />
                {n > 0 && (
                  <span className="absolute -top-1.5 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-[#A32F6C] text-white text-[11px] font-bold flex items-center justify-center">
                    {n}
                  </span>
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}