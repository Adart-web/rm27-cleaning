import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/authAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { deleteCalendarEvent } from "@/lib/googleCalendar";

type Acao = "confirmou" | "cancelou" | "liberar";

// Ações da dona sobre uma visita de cliente fixo:
// confirmou/cancelou = registra a resposta do cliente; liberar = tira a visita da agenda e do Google Calendar
export async function POST(request: NextRequest) {
  if (!(await exigirAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, acao } = (await request.json()) as { id?: string; acao?: Acao };
    if (!id || !acao || !["confirmou", "cancelou", "liberar"].includes(acao)) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const { data: ag } = await supabaseAdmin
      .from("agendamentos")
      .select("id, status, tipo, google_event_id")
      .eq("id", id)
      .maybeSingle();
    if (!ag) return NextResponse.json({ error: "Visita não encontrada" }, { status: 404 });
    if (ag.tipo !== "fixo") {
      return NextResponse.json({ error: "Só vale para visitas de clientes fixos" }, { status: 400 });
    }

    if (acao === "confirmou" || acao === "cancelou") {
      if (ag.status !== "confirmado") {
        return NextResponse.json({ error: "Essa visita já foi liberada" }, { status: 409 });
      }
      const { error } = await supabaseAdmin
        .from("agendamentos")
        .update({ confirmacao: acao === "confirmou" ? "confirmada" : "cancelada" })
        .eq("id", id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    // liberar: some da agenda e do Google Calendar. A linha fica (status "cancelado")
    // para a rotina diária não recriar essa visita.
    if (ag.status === "confirmado") {
      if (ag.google_event_id) await deleteCalendarEvent(ag.google_event_id);
      const { error } = await supabaseAdmin
        .from("agendamentos")
        .update({ status: "cancelado", confirmacao: "cancelada", google_event_id: null })
        .eq("id", id);
      if (error) throw new Error(error.message);
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}