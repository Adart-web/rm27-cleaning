import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function extrairValor(mensagem: string): number {
  const match = mensagem.match(/Estimativa:\s*\$([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

export async function POST(request: NextRequest) {
  try {
    const { orcamentoId } = await request.json();

    const { data: orcamento, error: fetchError } = await supabaseAdmin
      .from("orcamentos")
      .select("*")
      .eq("id", orcamentoId)
      .single();

    if (fetchError || !orcamento) {
      return NextResponse.json({ error: `Quote not found: ${fetchError?.message}` }, { status: 404 });
    }

    const valorTotal = extrairValor(orcamento.mensagem);
    const sinal = (valorTotal / 2).toFixed(2);

    const texto = `Hi ${orcamento.nome_cliente}! Your quote with RM27 Cleaning has been confirmed.

Total estimate: $${valorTotal}
Deposit required to secure your booking: $${sinal} (50%)

Please send the deposit via Zelle to:
rm27solutions@gmail.com

Once sent, just reply here with the payment receipt/screenshot and we'll confirm your appointment.`;

    const res = await fetch(
      `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.EVOLUTION_API_KEY!,
        },
        body: JSON.stringify({
          number: orcamento.telefone,
          text: texto,
        }),
      }
    );

    const resBody = await res.text();

    if (!res.ok) {
      return NextResponse.json({ error: `Evolution API error (${res.status}): ${resBody}` }, { status: 500 });
    }

    const { data: updateData, error: updateError } = await supabaseAdmin
      .from("orcamentos")
      .update({ status: "aguardando_pagamento" })
      .eq("id", orcamentoId)
      .select();

    if (updateError) {
      return NextResponse.json({ error: `Supabase update error: ${updateError.message}` }, { status: 500 });
    }

    if (!updateData || updateData.length === 0) {
      return NextResponse.json({ error: "Update ran but no row was changed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: `Unexpected error: ${e.message}` }, { status: 500 });
  }
}