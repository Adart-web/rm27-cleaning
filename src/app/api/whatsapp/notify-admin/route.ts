import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { enviarPush } from "@/lib/push";

export const runtime = "nodejs";

const SERVICO_NOME: Record<string, string> = {
  regular: "Regular",
  deep: "Deep Cleaning",
  move_in_out: "Move In / Out",
  carpet_upholstery: "Carpete e Estofados",
};

// Chamada pelo site logo depois que o cliente envia o orçamento.
// (O caminho antigo "whatsapp" foi mantido; agora o aviso é uma notificação no celular da dona.)
// A rota é pública, então só avisa se existir mesmo um orçamento novo com esses dados,
// e só uma vez por orçamento — assim ninguém consegue disparar notificações à toa.
export async function POST(request: NextRequest) {
  try {
    const { nome, telefone } = (await request.json()) as { nome?: string; telefone?: string };
    if (!nome || !telefone) return NextResponse.json({ success: true });

    const desde = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: orc } = await supabaseAdmin
      .from("orcamentos")
      .select("id, nome_cliente, mensagem")
      .eq("nome_cliente", nome)
      .eq("telefone", telefone)
      .eq("status", "pendente")
      .eq("push_enviado", false)
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!orc) return NextResponse.json({ success: true });

    // marca antes de enviar: se duas chamadas chegarem juntas, só uma ganha
    const { data: marcado } = await supabaseAdmin
      .from("orcamentos")
      .update({ push_enviado: true })
      .eq("id", orc.id)
      .eq("push_enviado", false)
      .select("id");
    if (!marcado || marcado.length === 0) return NextResponse.json({ success: true });

    const msg = orc.mensagem ?? "";
    const servico = msg.match(/Serviço:\s*([^|]+)/)?.[1]?.trim() ?? "";
    const valor = msg.match(/Estimativa:\s*\$([\d.]+)/)?.[1];
    const corpo = [orc.nome_cliente, SERVICO_NOME[servico] ?? servico, valor ? `$${valor}` : ""]
      .filter(Boolean)
      .join(" · ");

    await enviarPush({
      titulo: "Novo orçamento",
      corpo,
      url: "/admin/solicitacoes",
      tag: `orcamento-${orc.id}`,
    });
  } catch {
    // o aviso nunca pode atrapalhar o cliente
  }
  return NextResponse.json({ success: true });
}