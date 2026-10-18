"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Menu fixo no topo; ganha fundo translúcido e sombra quando a página rola.
export default function Header() {
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    const onScroll = () => setRolou(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 flex items-center justify-between px-8 md:px-24 transition-all duration-300 ${
        rolou
          ? "py-3 bg-white/80 backdrop-blur-md shadow-[0_2px_20px_rgba(35,48,65,0.08)]"
          : "py-6 bg-transparent"
      }`}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-fraunces)] font-semibold text-2xl text-[#8C6EE8]">
          RM27
        </span>
        <span className="text-sm text-[#6B7480]">Cleaning</span>
      </div>
      <nav className="hidden md:flex items-center gap-10">
        {[
          ["#about", "About"],
          ["#services", "Services"],
          ["#how", "How it works"],
          ["#reviews", "Reviews"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="nav-link text-sm font-medium">
            {label}
          </a>
        ))}
        <Link
          href="/orcamento"
          className="btn-glow bg-[#8C6EE8] text-[#FBFCFF] rounded-full px-6 py-3 text-sm font-semibold hover:bg-[#7857D6]"
        >
          Get a free quote
        </Link>
      </nav>
    </header>
  );
}