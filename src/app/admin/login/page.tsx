"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErro("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    setLoading(false);

    if (error) {
      setErro("Invalid email or password.");
      return;
    }

    router.push("/admin");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FBFCFF] px-8">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm flex flex-col gap-4 bg-white border border-[#E6EAF2] rounded-2xl p-8"
      >
        <h1 className="font-[family-name:var(--font-fraunces)] text-2xl text-[#233041] text-center mb-2">
          RM27 Admin
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="px-4 py-3 rounded-xl border border-[#E6EAF2]"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="px-4 py-3 rounded-xl border border-[#E6EAF2]"
          required
        />

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={loading}
          className="bg-[#8C6EE8] text-white rounded-full py-3 font-semibold disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}