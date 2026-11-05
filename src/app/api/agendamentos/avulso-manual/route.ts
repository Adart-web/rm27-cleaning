import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/authAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createCalendarEvent, deleteCalendarEvent, getBusyIntervals } from "@/lib/googleCalendar";
import { orlandoToDate } from "@/lib/time";
import { diaSemana, formatarTelefoneUS, normalizarTelefoneUS } from "@/lib/clientes";
import { enfileirarMensagem } from "@/lib/mensagens";
import { textoPagamento, textoSinal, type Idioma } from "@/lib/mensagensTextos";

const SERVICOS = ["regular", "deep", "move_in_out", "carpet_upholstery"];
const SERVICO_NOME: Record<string, string> = {
  regular: "Regular",
  deep: "Deep Cleaning",
  move_in_out: "Move In / Out",
  carpet_upholstery: "Carpete e Estofados",
};

// Cadastro manual de cliente avulso (pedido por telefone, por exemplo).
// Com sinal recebido: já entra como agendado (evento no Google Calendar).
// Sem sinal: entra como "aguardando pagamento" e a dona confirma depois em Solicitações.
export async function POST(request: NextRequest) {
  if (!(await exigirAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const b = (await request.json()) as {
      nome?: string;
      telefone?: string;
      endereco?: string;
      servico?: string;
      data?: string;
      hora?: string;
      valor?: number | string;
      duracaoMin?: number;
      sinalRecebido?: boolean;
      enviarSms?: boolean;
      idioma?: string;
      observacoes?: string;
      forcar?: boolean;
    };

    const nome = (b.nome ?? "").trim();
    if (!nome) return NextResponse.json({ error: "Informe o nome do cliente" }, { status: 400 });
    const tel = normalizarTelefoneUS(b.telefone ?? "");
    if (!tel) {
      return NextResponse.json(
        { error: "Telefone inválido. Use (407) 555-0142 ou +55... para outro país." },
        { status: 400 }
      );
    }
    const telefone = formatarTelefoneUS(tel);
    const servico = b.servico && SERVICOS.includes(b.servico) ? b.servico : "regular";
    const data = b.data ?? "";
    const hora = b.hora ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) {
      return NextResponse.json({ error: "Informe a data e o horário" }, { status: 400 });
    }
    if (diaSemana(data) === 0) {
      return NextResponse.json({ error: "Não trabalhamos aos domingos" }, { status: 400 });
    }
    const inicio = orlandoToDate(data, hora);
    if (inicio <= new Date()) {
      return NextResponse.json({ error: "Esse horário já passou" }, { status: 400 });
    }
    const valor = Number(b.valor);
    if (!Number.isFinite(valor) || valor <= 0) {
      return NextResponse.json({ error: "Informe o valor do serviço" }, { status: 400 });
    }
    const duracao =
      b.duracaoMin && b.duracaoMin >= 60 && b.duracaoMin <= 480 ? Math.round(b.duracaoMin) : 120;
    const fim = new Date(inicio.getTime() + duracao * 60000);
    const idioma: Idioma = b.idioma === "pt" ? "pt" : "en";
    const endereco = (b.endereco ?? "").trim().replace(/\|/g, "/");
    const obs = (b.observacoes ?? "").trim().replace(/\|/g, "/");
    const sinalRecebido = Boolean(b.sinalRecebido);

    if (!b.forcar) {
      const busy = await getBusyIntervals(
        new Date(inicio.getTime() - 3600000).toISOString(),
        new Date(fim.getTime() + 3600000).toISOString()
      );
      if (busy.some((x) => inicio < x.end && fim > x.start)) {
        return NextResponse.json(
          { conflito: true, error: "Já tem compromisso ou bloqueio nesse horário." },
          { status: 409 }
        );
      }
    }

    const mensagem = [
      `Serviço: ${servico}`,
      `Estimativa: $${valor}`,
      `Endereço: ${endereco || "não informado"}`,
      `Cidade: não informado`,
      `Indicação: cadastro manual`,
      `Data desejada: ${data} ${hora}`,
      `Nome: ${nome}`,
      `Tel: ${telefone}`,
      obs ? `Obs: ${obs}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const { data: orc, error: orcErr } = await supabaseAdmin
      .from("orcamentos")
      .insert({
        tipo: "pontual",
        tamanho_imovel: null,
        frequencia: null,
        status: sinalRecebido ? "agendado" : "aguardando_pagamento",
        idioma,
        data_escolhida: data,
        periodo_escolhido: Number(hora.slice(0, 2)) < 12 ? "manha" : "tarde",
        hora_inicio: hora,
        telefone,
        nome_cliente: nome,
        mensagem,
      })
      .select("id")
      .single();
    if (orcErr || !orc) {
      return NextResponse.json({ error: `Não consegui salvar: ${orcErr?.message}` }, { status: 500 });
    }

    let agendamentoId: string | null = null;
    if (sinalRecebido) {
      const descricao = [
        `Serviço: ${SERVICO_NOME[servico]}`,
        endereco ? `Endereço: ${endereco}` : null,
        `Tel: ${telefone}`,
        `Valor: $${valor}`,
        obs ? `Obs: ${obs}` : null,
        "Cadastro manual",
      ]
        .filter(Boolean)
        .join("\n");

      let eventId: string | null | undefined;
      try {
        eventId = await createCalendarEvent({
          summary: `RM27 Cleaning — ${nome}`,
          description: descricao,
          startISO: inicio.toISOString(),
          endISO: fim.toISOString(),
        });
        if (!eventId) throw new Error("o Google não devolveu o ID do evento");
        const { data: ag, error: agErr } = await supabaseAdmin
          .from("agendamentos")
          .insert({
            orcamento_id: orc.id,
            data_hora: inicio.toISOString(),
            duracao_min: duracao,
            google_event_id: eventId,
            status: "confirmado",
          })
          .select("id")
          .single();
        if (agErr || !ag) throw new Error(agErr?.message ?? "falha ao salvar a visita");
        agendamentoId = ag.id;
      } catch (e: unknown) {
        if (eventId) await deleteCalendarEvent(eventId).catch(() => {});
        await supabaseAdmin.from("orcamentos").delete().eq("id", orc.id);
        const m = e instanceof Error ? e.message : "erro";
        return NextResponse.json({ error: `Não consegui agendar: ${m}` }, { status: 500 });
      }
    }

    if (b.enviarSms) {
      try {
        await enfileirarMensagem(
          sinalRecebido
            ? {
                tipo: "pagamento",
                nome,
                telefone,
                idioma,
                texto: textoPagamento({ data, hora, idioma }),
                orcamentoId: orc.id,
                agendamentoId,
                chave: `pagamento:${orc.id}`,
              }
            : {
                tipo: "sinal",
                nome,
                telefone,
                idioma,
                texto: textoSinal({ nome, data, hora, total: valor, idioma }),
                orcamentoId: orc.id,
                chave: `sinal:${orc.id}`,
              }
        );
      } catch (e: unknown) {
        const m = e instanceof Error ? e.message : "erro";
        return NextResponse.json({ success: true, aviso: `Cliente salvo, mas ${m}` });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}