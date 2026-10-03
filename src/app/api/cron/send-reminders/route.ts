import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const inicioAmanha = new Date(amanha.setHours(0, 0, 0, 0));
  const fimAmanha = new Date(amanha.setHours(23, 59, 59, 999));

  const { data: agendamentos, error } = await supabaseAdmin
    .from("agendamentos")
    .select("*, orcamentos(nome_cliente, telefone, periodo_escolhido)")
    .eq("status", "confirmado")
    .eq("lembrete_enviado", false)
    .gte("data_hora", inicioAmanha.toISOString())
    .lte("data_hora", fimAmanha.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const resultados = [];

  for (const ag of agendamentos || []) {
    const orc = ag.orcamentos as any;
    if (!orc?.telefone) continue;

    const periodoFmt = orc.periodo_escolhido === "manha" ? "Morning (8am-12pm)" : "Afternoon (1pm-5pm)";
    const dataFmt = new Date(ag.data_hora).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });

    const texto = `Reminder: your RM27 Cleaning appointment is tomorrow!

${dataFmt} — ${periodoFmt}

See you soon! 🧹`;

    const res = await fetch(
      `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.EVOLUTION_API_KEY!,
        },
        body: JSON.stringify({ number: orc.telefone, text: texto }),
      }
    );

    if (res.ok) {
      await supabaseAdmin
        .from("agendamentos")
        .update({ lembrete_enviado: true })
        .eq("id", ag.id);
    }

    resultados.push({ id: ag.id, enviado: res.ok });
  }

  return NextResponse.json({ success: true, total: resultados.length, resultados });
}