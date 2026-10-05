import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { orlandoToDate } from "@/lib/time";

const TZ = "America/New_York";

type OrcamentoResumo = {
  nome_cliente: string | null;
  telefone: string | null;
};

// Data de amanhã (YYYY-MM-DD) no fuso de Orlando
function amanhaEmOrlando(): string {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const [y, m, d] = hoje.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dia = amanhaEmOrlando();
  const inicioDia = orlandoToDate(dia, "00:00");
  const fimDia = orlandoToDate(dia, "23:59");

  const { data: agendamentos, error } = await supabaseAdmin
    .from("agendamentos")
    .select("*, orcamentos(nome_cliente, telefone)")
    .eq("status", "confirmado")
    .eq("lembrete_enviado", false)
    .gte("data_hora", inicioDia.toISOString())
    .lte("data_hora", fimDia.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const resultados = [];

  for (const ag of agendamentos || []) {
    const orc = ag.orcamentos as unknown as OrcamentoResumo;
    if (!orc?.telefone) continue;

    const inicioServico = new Date(ag.data_hora);
    const dataFmt = inicioServico.toLocaleDateString("en-US", {
      timeZone: TZ,
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const horaFmt = inicioServico.toLocaleTimeString("en-US", {
      timeZone: TZ,
      hour: "numeric",
      minute: "2-digit",
    });

    const texto = `Reminder: your RM27 Cleaning appointment is tomorrow!

${dataFmt} at ${horaFmt}

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