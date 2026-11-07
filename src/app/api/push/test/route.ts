import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/authAdmin";
import { enviarPush } from "@/lib/push";

export const runtime = "nodejs";

// Botão "Testar aviso" do painel
export async function POST(request: NextRequest) {
  if (!(await exigirAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let r: Awaited<ReturnType<typeof enviarPush>>;
  try {
    r = await enviarPush({
      titulo: "RM27 Painel",
      corpo: "Teste: as notificações estão funcionando ✓",
      url: "/admin",
      tag: "teste",
    });
  } catch (e) {
    return NextResponse.json({ error: `Erro no servidor: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
  if (r.erro) return NextResponse.json({ error: r.erro }, { status: 500 });
  if (r.enviados === 0) {
    return NextResponse.json({ error: "Nenhum aparelho cadastrado. Ative os avisos primeiro." }, { status: 404 });
  }
  return NextResponse.json({ success: true, enviados: r.enviados });
}