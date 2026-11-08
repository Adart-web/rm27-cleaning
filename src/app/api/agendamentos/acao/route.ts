import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/authAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createCalendarEvent, deleteCalendarEvent, getBusyIntervals } from "@/lib/googleCalendar";
import { orlandoToDate } from "@/lib/time";
import { addDias, diaSemana } from "@/lib/clientes";
import { enfileirarMensagem } from "@/lib/mensagens";
import { idiomaDe, textoRemarcacao, textoRemarcacaoFixo } from "@/lib/mensagensTextos";
import { urlDoSite } from "@/lib/confirmacoes";
import { randomBytes } from "node:crypto";

type Acao = "confirmou" | "cancelou" | "liberar" | "remarcar";

// Ações da dona sobre uma visita de cliente fixo:
// confirmou/cancelou = registra a resposta do cliente; liberar = tira a visita da agenda e do Google Calendar
export async function POST(request: NextRequest) {
  if (!(await exigirAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, acao, data, hora, forcar } = (await request.json()) as {
      id?: string;
      acao?: Acao;
      data?: string;
      hora?: string;
      forcar?: boolean;
    };
    if (!id || !acao || !["confirmou", "cancelou", "liberar", "remarcar"].includes(acao)) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const { data: ag } = await supabaseAdmin
      .from("agendamentos")
      .select("id, status, tipo, google_event_id, data_hora, duracao_min, cliente_fixo_id, equipe, confirmacao")
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
        .update(
          acao === "confirmou"
            ? { confirmacao: "confirmada", pedido_data: null, pedido_hora: null, pedido_nota: null }
            : { confirmacao: "cancelada" }
        )
        .eq("id", id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    // remarcar: só nesta semana o cliente quer outro dia/horário. Cria a visita no novo horário
    // e libera a antiga (a linha antiga fica "cancelado" para a rotina diária não recriá-la).
    if (acao === "remarcar") {
      if (ag.status !== "confirmado") {
        return NextResponse.json({ error: "Essa visita já foi liberada" }, { status: 409 });
      }
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
      const duracao = ag.duracao_min ?? 120;
      const novoFim = new Date(novoInicio.getTime() + duracao * 60000);
      const antigoInicio = new Date(ag.data_hora);
      const antigoFim = new Date(antigoInicio.getTime() + duracao * 60000);

      if (novoInicio.getTime() === antigoInicio.getTime()) {
        return NextResponse.json({ error: "Esse já é o horário atual da visita" }, { status: 400 });
      }

      if (!forcar) {
        const busy = await getBusyIntervals(
          new Date(novoInicio.getTime() - 3600000).toISOString(),
          new Date(novoFim.getTime() + 3600000).toISOString()
        );
        const ocupado = busy.some(
          (b) =>
            novoInicio < b.end &&
            novoFim > b.start &&
            !(b.start >= antigoInicio && b.end <= antigoFim) // ignora a própria visita
        );
        if (ocupado) {
          return NextResponse.json(
            { conflito: true, error: "Já tem compromisso ou bloqueio nesse horário." },
            { status: 409 }
          );
        }
      }

      const { data: cliente } = ag.cliente_fixo_id
        ? await supabaseAdmin
            .from("clientes_fixos")
            .select("nome, endereco, telefone, valor, observacoes, idioma")
            .eq("id", ag.cliente_fixo_id)
            .maybeSingle()
        : { data: null };

      const descricao = [
        cliente?.endereco ? `Endereço: ${cliente.endereco}` : null,
        cliente?.telefone ? `Tel: ${cliente.telefone}` : null,
        cliente?.valor != null ? `Valor: $${cliente.valor}` : null,
        cliente?.observacoes ? `Obs: ${cliente.observacoes}` : null,
        "Remarcada só nesta semana",
      ]
        .filter(Boolean)
        .join("\n");

      const eventId = await createCalendarEvent({
        summary: `RM27 — ${cliente?.nome ?? "Cliente"} (fixo, remarcada)`,
        description: descricao,
        startISO: novoInicio.toISOString(),
        endISO: novoFim.toISOString(),
      });
      if (!eventId) throw new Error("o Google não devolveu o ID do evento");

      // pedido do cliente aceito: já está combinado. Remarcação por iniciativa da dona:
      // o cliente recebe um link para confirmar ou pedir outro horário.
      const pedidoDoCliente = ag.confirmacao === "remarcar";
      const token = pedidoDoCliente ? null : randomBytes(16).toString("hex");
      let expira: string | null = null;
      if (token) {
        const limite = orlandoToDate(addDias(data, -1), "20:00");
        expira = (limite > new Date() ? limite : novoInicio).toISOString();
      }

      const { error: insErr } = await supabaseAdmin.from("agendamentos").insert({
        cliente_fixo_id: ag.cliente_fixo_id,
        tipo: "fixo",
        data_hora: novoInicio.toISOString(),
        duracao_min: duracao,
        google_event_id: eventId,
        status: "confirmado",
        confirmacao: pedidoDoCliente ? "confirmada" : "pendente",
        token_confirmacao: token,
        token_expira_em: expira,
        equipe: ag.equipe,
      });
      if (insErr) {
        await deleteCalendarEvent(eventId);
        throw new Error(insErr.message);
      }

      if (ag.google_event_id) await deleteCalendarEvent(ag.google_event_id);
      const { error: upErr } = await supabaseAdmin
        .from("agendamentos")
        .update({ status: "cancelado", confirmacao: "cancelada", google_event_id: null })
        .eq("id", id);
      if (upErr) throw new Error(upErr.message);

      // deixa na fila a mensagem avisando o novo horário (com link, quando foi a dona que remarcou)
      if (cliente?.telefone) {
        try {
          await enfileirarMensagem({
            tipo: "remarcacao",
            nome: cliente.nome,
            telefone: cliente.telefone,
            idioma: idiomaDe(cliente.idioma),
            texto: token
              ? textoRemarcacaoFixo({
                  nome: String(cliente.nome ?? "").trim().split(/\s+/)[0] || "",
                  data,
                  hora,
                  idioma: idiomaDe(cliente.idioma),
                  link: `${urlDoSite()}/c/${token}`,
                })
              : textoRemarcacao({ data, hora, idioma: idiomaDe(cliente.idioma) }),
            clienteFixoId: ag.cliente_fixo_id,
            chave: `remarcacao:${id}:${novoInicio.toISOString()}`,
          });
        } catch (e) {
          console.error("não consegui enfileirar o aviso de remarcação", e);
        }
      }
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