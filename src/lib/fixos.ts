import { supabaseAdmin } from "./supabaseAdmin";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getBusyIntervals,
} from "./googleCalendar";
import { orlandoToDate } from "./time";
import {
  INTERVALO_DIAS,
  addDias,
  diasEntre,
  formatarDataCurta,
  hojeOrlando,
  horariosDe,
  type ClienteFixo,
} from "./clientes";

// Quantos dias à frente o sistema mantém visitas criadas (8 semanas)
const HORIZONTE_DIAS = 56;

export type ResumoSync = {
  clienteId: string;
  nome: string;
  criadas: number;
  existentes: number;
  removidas: number;
  conflitos: string[];
  erros: string[];
};

type Intervalo = { start: Date; end: Date };

function mensagemDe(e: unknown): string {
  return e instanceof Error ? e.message : "erro desconhecido";
}

function datasNoHorizonte(primeiraVisita: string, frequencia: ClienteFixo["frequencia"], hoje: string): string[] {
  const passo = INTERVALO_DIAS[frequencia];
  const limite = addDias(hoje, HORIZONTE_DIAS);
  let atual = primeiraVisita;
  if (atual < hoje) {
    const k = Math.ceil(diasEntre(atual, hoje) / passo);
    atual = addDias(atual, k * passo);
  }
  const out: string[] = [];
  while (atual < limite) {
    out.push(atual);
    atual = addDias(atual, passo);
  }
  return out;
}

async function removerVisitasFuturas(clienteId: string, erros: string[]): Promise<number> {
  const { data } = await supabaseAdmin
    .from("agendamentos")
    .select("id, google_event_id")
    .eq("cliente_fixo_id", clienteId)
    .eq("status", "confirmado")
    .gte("data_hora", new Date().toISOString());

  let removidas = 0;
  for (const v of data ?? []) {
    try {
      if (v.google_event_id) await deleteCalendarEvent(v.google_event_id);
      const { error } = await supabaseAdmin.from("agendamentos").delete().eq("id", v.id);
      if (error) throw new Error(error.message);
      removidas++;
    } catch (e: unknown) {
      erros.push(`Não consegui remover uma visita: ${mensagemDe(e)}`);
    }
  }
  return removidas;
}

export async function sincronizarClientes(
  clienteIds: string[],
  opcoes: { recriar?: boolean } = {}
): Promise<ResumoSync[]> {
  const { data, error } = await supabaseAdmin
    .from("clientes_fixos")
    .select("*")
    .in("id", clienteIds);
  if (error) throw new Error(error.message);

  const clientes = (data ?? []) as ClienteFixo[];
  const resumos: ResumoSync[] = [];

  // 1) limpeza (pausado, encerrado ou recriação)
  for (const c of clientes) {
    const resumo: ResumoSync = {
      clienteId: c.id,
      nome: c.nome,
      criadas: 0,
      existentes: 0,
      removidas: 0,
      conflitos: [],
      erros: [],
    };
    if (opcoes.recriar || c.status !== "ativo") {
      resumo.removidas = await removerVisitasFuturas(c.id, resumo.erros);
    }
    resumos.push(resumo);
  }

  const ativos = clientes.filter((c) => c.status === "ativo");
  if (ativos.length === 0) return resumos;

  // 2) horários ocupados no calendário (uma consulta só)
  const hoje = hojeOrlando();
  const agora = new Date();
  const fimJanela = orlandoToDate(addDias(hoje, HORIZONTE_DIAS + 1), "00:00");
  const busy: Intervalo[] = await getBusyIntervals(
    agora.toISOString(),
    fimJanela.toISOString()
  );

  // 3) criação
  for (const c of ativos) {
    const resumo = resumos.find((r) => r.clienteId === c.id)!;

    const { data: existentes } = await supabaseAdmin
      .from("agendamentos")
      .select("data_hora")
      .eq("cliente_fixo_id", c.id)
      .gte("data_hora", agora.toISOString());
    const jaTem = new Set((existentes ?? []).map((e) => new Date(e.data_hora).getTime()));

    const descricao = [
      c.endereco ? `Endereço: ${c.endereco}` : null,
      `Tel: ${c.telefone}`,
      `Valor: $${c.valor}`,
      c.observacoes ? `Obs: ${c.observacoes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    // cada dia/horário do cliente (ex.: terça de manhã e sexta à tarde) gera suas próprias visitas
    const ocorrencias = horariosDe(c).flatMap((h) =>
      datasNoHorizonte(h.primeira_visita, c.frequencia, hoje).map((data) => ({ data, h }))
    );

    for (const { data, h } of ocorrencias) {
      const inicio = orlandoToDate(data, h.hora_inicio);
      if (inicio <= agora) continue;

      if (jaTem.has(inicio.getTime())) {
        resumo.existentes++;
        continue;
      }

      const fim = new Date(inicio.getTime() + h.duracao_min * 60000);
      if (busy.some((b) => inicio < b.end && fim > b.start)) {
        resumo.conflitos.push(`${formatarDataCurta(data)}: horário ocupado na agenda`);
        continue;
      }

      try {
        const eventId = await createCalendarEvent({
          summary: `RM27 — ${c.nome} (fixo)`,
          description: descricao,
          startISO: inicio.toISOString(),
          endISO: fim.toISOString(),
        });
        if (!eventId) throw new Error("o Google não devolveu o ID do evento");

        const { error: insErr } = await supabaseAdmin.from("agendamentos").insert({
          cliente_fixo_id: c.id,
          tipo: "fixo",
          data_hora: inicio.toISOString(),
          duracao_min: h.duracao_min,
          google_event_id: eventId,
          status: "confirmado",
          equipe: c.equipe,
        });
        if (insErr) {
          await deleteCalendarEvent(eventId);
          throw new Error(insErr.message);
        }

        busy.push({ start: inicio, end: fim });
        resumo.criadas++;
      } catch (e: unknown) {
        resumo.erros.push(`${formatarDataCurta(data)}: ${mensagemDe(e)}`);
      }
    }
  }

  return resumos;
}