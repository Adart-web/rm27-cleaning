import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/authAdmin";
import { gerarConfirmacoes, inicioProximaSemana } from "@/lib/confirmacoes";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!(await exigirAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const resumo = await gerarConfirmacoes(inicioProximaSemana());
    return NextResponse.json({ success: true, resumo });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}