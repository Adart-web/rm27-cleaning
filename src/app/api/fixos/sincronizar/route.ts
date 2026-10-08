import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sincronizarClientes } from "@/lib/fixos";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { clienteId, recriar } = await request.json();
    if (!clienteId) {
      return NextResponse.json({ error: "clienteId is required" }, { status: 400 });
    }
    const resumos = await sincronizarClientes([clienteId], { recriar: Boolean(recriar) });
    return NextResponse.json({ success: true, resumo: resumos[0] });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}