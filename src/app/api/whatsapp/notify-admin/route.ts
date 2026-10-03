import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { nome, telefone, tipo, estimativa, data, periodo } = await request.json();

  const periodoTexto = periodo === "manha" ? "Manhã (8h-12h)" : "Tarde (13h-17h)";

  const texto = `🆕 Novo pedido RM27 Cleaning

Cliente: ${nome}
Telefone: ${telefone}
Serviço: ${tipo}
Estimativa: $${estimativa}
Data desejada: ${data} — ${periodoTexto}

Acesse o painel para confirmar o orçamento.`;

  try {
    const res = await fetch(
      `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.EVOLUTION_API_KEY!,
        },
        body: JSON.stringify({
          number: process.env.ADMIN_WHATSAPP,
          text: texto,
        }),
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to send WhatsApp" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to send WhatsApp" }, { status: 500 });
  }
}