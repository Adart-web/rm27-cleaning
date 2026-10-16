import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/authAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createCalendarEvent, deleteCalendarEvent, getBusyIntervals } from "@/lib/googleCalendar";
import { horaPadrao, orlandoToDate } from "@/lib/time";
import { diaSemana } from "@/lib/clientes";
import { enfileirarMensagem } from "@/lib/mensagens";
import { idiomaDe, textoCancelamento, textoRemarcacao } from "@/lib/mensagensTextos";

// Remarcar ou cancelar uma visita avulsa já agendada (e avisar o cliente por SMS na fila)
export async function POST(request: NextRequest) {
  if (!(await exigirAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orcamentoId, acao, data, hora, sinal, forcar } = (await request.json()) as {
      orcamentoId?: string;
      acao?: "remarcar" | "cancelar";
      data?: string;
      hora?: string;
      sinal?: "devolver" | "manter";
      forcar?: boolean;
    };
    if (!orcamentoId || (acao !== "remarcar" && acao !== "cancelar")) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const { data: orc } = await supabaseAdmin.from("orcamentos").select("*").eq("id", orcamentoId).maybeSingle();
    if (!orc) return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });
    if (orc.status !== "agendado") {
      return NextResponse.json({ error: "Essa visita não está agendada" }, { status: 409 });
    }

    const { data: ag } = await supabaseAdmin
      .from("agendamentos")
      .select("id, data_hora, google_event_id, duracao_min")
      .eq("orcamento_id", orcamentoId)
      .eq("status", "confirmado")
      .order("data_hora", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ag) return NextResponse.json({ error: "Visita não encontrada na agenda" }, { status: 404 });

    const idioma = idiomaDe(orc.idioma);
    const duracao = ag.duracao_min ?? 120;
    const antigoInicio = new Date(ag.data_hora);
    const antigoFim = new Date(antigoInicio.getTime() + duracao * 60000);

    if (acao === "cancelar") {
      if (sinal !== "devolver" && sinal !== "manter") {
        return NextResponse.json({ error: "Escolha: devolver ou manter o sinal" }, { status: 400 });
      }
      if (ag.google_event_id) await deleteCalendarEvent(ag.google_event_id);
      const { error: e1 } = await supabaseAdmin
        .from("agendamentos")
        .update({ status: "cancelado", google_event_id: null })
        .eq("id", ag.id);
      if (e1) throw new Error(e1.message);
      const { error: e2 } = await supabaseAdmin
        .from("orcamentos")
        .update({ status: "cancelado", sinal_cancelamento: sinal, cancelado_em: new Date().toISOString() })
        .eq("id", orcamentoId);
      if (e2) throw new Error(e2.message);

      try {
        await enfileirarMensagem({
          tipo: "cancelamento",
          nome: orc.nome_cliente,
          telefone: orc.telefone,
          idioma,
          texto: textoCancelamento({
            data: orc.data_escolhida,
            hora: orc.hora_inicio || horaPadrao(orc.periodo_escolhido),
            idioma,
            sinal,
          }),
          orcamentoId,
          agendamentoId: ag.id,
          chave: `cancelamento:${orcamentoId}`,
        });
      } catch (e: unknown) {
        const m = e instanceof Error ? e.message : "erro";
        return NextResponse.json({ error: `Cancelado, mas ${m}` }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // remarcar
    if (!data || !hora || !/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) {
      return NextResponse.json({ error: "Informe a nova data e o novo horário" }, { status: 400 });
    }
    if (diaSemana(data) === 0) {
      return NextResponse.json({ error: "Não trabalhamos aos domingos" }, { status: 400 });
    }
    const novoInicio = orlandoToDate(data, hora);
    if (novoInicio <= new Date()) {
      return NextResponse.json({ error: "Esse horário já passou" }, { status: 400 });
    }
    if (novoInicio.getTime() === antigoInicio.getTime()) {
      return NextResponse.json({ error: "Esse já é o horário atual da visita" }, { status: 400 });
    }
    const novoFim = new Date(novoInicio.getTime() + duracao * 60000);

    if (!forcar) {
      const busy = await getBusyIntervals(
        new Date(novoInicio.getTime() - 3600000).toISOString(),
        new Date(novoFim.getTime() + 3600000).toISOString()
      );
      const ocupado = busy.some(
        (b) =>
          novoInicio < b.end &&
          novoFim > b.start &&
          !(b.start >= antigoInicio && b.end <= antigoFim)
      );
      if (ocupado) {
        return NextResponse.json(
          { conflito: true, error: "Já tem compromisso ou bloqueio nesse horário." },
          { status: 409 }
        );
      }
    }

    const eventId = await createCalendarEvent({
      summary: `RM27 Cleaning — ${orc.nome_cliente} (remarcada)`,
      description: orc.mensagem || "",
      startISO: novoInicio.toISOString(),
      endISO: novoFim.toISOString(),
    });
    if (!eventId) throw new Error("o Google não devolveu o ID do evento");

    const { error: upErr } = await supabaseAdmin
      .from("agendamentos")
      .update({ data_hora: novoInicio.toISOString(), google_event_id: eventId })
      .eq("id", ag.id);
    if (upErr) {
      await deleteCalendarEvent(eventId);
      throw new Error(upErr.message);
    }
    if (ag.google_event_id) await deleteCalendarEvent(ag.google_event_id);

    const { error: oErr } = await supabaseAdmin
      .from("orcamentos")
      .update({
        data_escolhida: data,
        hora_inicio: hora,
        periodo_escolhido: Number(hora.slice(0, 2)) < 12 ? "manha" : "tarde",
      })
      .eq("id", orcamentoId);
    if (oErr) throw new Error(oErr.message);

    try {
      await enfileirarMensagem({
        tipo: "remarcacao",
        nome: orc.nome_cliente,
        telefone: orc.telefone,
        idioma,
        texto: textoRemarcacao({ data, hora, idioma }),
        orcamentoId,
        agendamentoId: ag.id,
        chave: `remarcacao:${ag.id}:${novoInicio.toISOString()}`,
      });
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : "erro";
      return NextResponse.json({ error: `Remarcado, mas ${m}` }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}