import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/googleCalendar";
import { orlandoToDate } from "@/lib/time";
import { addDias, diaSemana, diasEntre, formatarDataCurta, hojeOrlando } from "@/lib/clientes";
import { faixaDoBloqueio, minParaHHMM, type PeriodoBloqueio } from "@/lib/agenda";

export const maxDuration = 60;

const PERIODOS: PeriodoBloqueio[] = ["dia", "manha", "tarde"];
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 31;

async function autenticar(request: NextRequest): Promise<boolean> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return !error && Boolean(data.user);
}

function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : "erro desconhecido";
}

export async function POST(request: NextRequest) {
  if (!(await autenticar(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const dataInicio = String(body.dataInicio ?? "");
    const dataFim = String(body.dataFim ?? dataInicio);
    const periodo = body.periodo as PeriodoBloqueio;
    const motivo = String(body.motivo ?? "").trim().slice(0, 120);
    const confirmar = Boolean(body.confirmar);

    if (!DATA_RE.test(dataInicio) || !DATA_RE.test(dataFim)) {
      return NextResponse.json({ error: "Datas inválidas" }, { status: 400 });
    }
    if (!PERIODOS.includes(periodo)) {
      return NextResponse.json({ error: "Período inválido" }, { status: 400 });
    }
    const total = diasEntre(dataInicio, dataFim) + 1;
    if (total < 1 || total > MAX_DIAS) {
      return NextResponse.json(
        { error: `O intervalo deve ter entre 1 e ${MAX_DIAS} dias` },
        { status: 400 }
      );
    }

    const hoje = hojeOrlando();
    const faixa = faixaDoBloqueio(periodo);
    const resumo = {
      criados: 0,
      ignorados: [] as string[],
      avisos: [] as string[],
      erros: [] as string[],
    };

    // 1) antes de criar qualquer coisa, procura visitas que já existem no período
    const conflitos: string[] = [];
    for (let i = 0; i < total; i++) {
      const data = addDias(dataInicio, i);
      if (data < hoje || diaSemana(data) === 0) continue;
      const ini = orlandoToDate(data, minParaHHMM(faixa.ini));
      const fi = orlandoToDate(data, minParaHHMM(faixa.fim));
      const { count } = await supabaseAdmin
        .from("agendamentos")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmado")
        .gte("data_hora", ini.toISOString())
        .lt("data_hora", fi.toISOString());
      if (count && count > 0) {
        conflitos.push(
          `${formatarDataCurta(data)}: já tem ${count} ${count > 1 ? "visitas" : "visita"} nesse período`
        );
      }
    }
    if (conflitos.length > 0 && !confirmar) {
      return NextResponse.json({ precisaConfirmar: true, conflitos });
    }

    resumo.avisos.push(...conflitos);

    for (let i = 0; i < total; i++) {
      const data = addDias(dataInicio, i);
      const rotulo = formatarDataCurta(data);

      if (data < hoje) {
        resumo.ignorados.push(`${rotulo}: data passada`);
        continue;
      }
      if (diaSemana(data) === 0) {
        resumo.ignorados.push(`${rotulo}: domingo`);
        continue;
      }

      const { data: jaTem } = await supabaseAdmin
        .from("bloqueios")
        .select("id")
        .eq("data", data)
        .eq("periodo", periodo)
        .maybeSingle();
      if (jaTem) {
        resumo.ignorados.push(`${rotulo}: já bloqueado`);
        continue;
      }

      const inicio = orlandoToDate(data, minParaHHMM(faixa.ini));
      const fim = orlandoToDate(data, minParaHHMM(faixa.fim));

      try {
        const eventId = await createCalendarEvent({
          summary: `BLOQUEADO${motivo ? ` — ${motivo}` : ""}`,
          description: "Horário bloqueado pelo painel RM27",
          startISO: inicio.toISOString(),
          endISO: fim.toISOString(),
        });
        if (!eventId) throw new Error("o Google não devolveu o ID do evento");

        const { error: insErr } = await supabaseAdmin.from("bloqueios").insert({
          data,
          periodo,
          motivo: motivo || null,
          google_event_id: eventId,
        });
        if (insErr) {
          await deleteCalendarEvent(eventId);
          throw new Error(insErr.message);
        }
        resumo.criados++;
      } catch (e: unknown) {
        resumo.erros.push(`${rotulo}: ${mensagemDe(e)}`);
      }
    }

    return NextResponse.json({ success: true, resumo });
  } catch (e: unknown) {
    return NextResponse.json({ error: mensagemDe(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await autenticar(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const { data: bloqueio } = await supabaseAdmin
      .from("bloqueios")
      .select("id, google_event_id")
      .eq("id", id)
      .maybeSingle();
    if (!bloqueio) return NextResponse.json({ error: "Bloqueio não encontrado" }, { status: 404 });

    if (bloqueio.google_event_id) await deleteCalendarEvent(bloqueio.google_event_id);
    const { error } = await supabaseAdmin.from("bloqueios").delete().eq("id", id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: mensagemDe(e) }, { status: 500 });
  }
}