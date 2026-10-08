import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sincronizarClientes } from "@/lib/fixos";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data } = await supabaseAdmin
      .from("clientes_fixos")
      .select("id")
      .eq("status", "ativo");
    const ids = (data ?? []).map((c) => c.id as string);

    if (ids.length === 0) {
      return NextResponse.json({ success: true, clientes: 0 });
    }

    const resumos = await sincronizarClientes(ids);
    return NextResponse.json({
      success: true,
      clientes: resumos.length,
      criadas: resumos.reduce((s, r) => s + r.criadas, 0),
      conflitos: resumos.flatMap((r) => r.conflitos.map((c) => `${r.nome}: ${c}`)),
      erros: resumos.flatMap((r) => r.erros.map((e) => `${r.nome}: ${e}`)),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}