import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { orlandoToDate } from "@/lib/time";
import { addDias, hojeOrlando } from "@/lib/clientes";
import { partesOrlando, minParaHHMM } from "@/lib/agenda";
import { enfileirarMensagem } from "@/lib/mensagens";
import { idiomaDe, textoLembrete } from "@/lib/mensagensTextos";

// Roda de manhã: coloca na fila do painel o lembrete das visitas de amanhã (clientes avulsos).
// Clientes fixos já recebem a confirmação de sábado, então não entram aqui.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dia = addDias(hojeOrlando(), 1);
  const inicioDia = orlandoToDate(dia, "00:00");
  const fimDia = orlandoToDate(addDias(dia, 1), "00:00");

  const { data: agendamentos, error } = await supabaseAdmin
    .from("agendamentos")
    .select("id, data_hora, orcamento_id")
    .eq("status", "confirmado")
    .eq("tipo", "avulso")
    .not("orcamento_id", "is", null)
    .gte("data_hora", inicioDia.toISOString())
    .lt("data_hora", fimDia.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (agendamentos ?? []).map((a) => a.orcamento_id as string);
  const { data: orcs } = ids.length
    ? await supabaseAdmin.from("orcamentos").select("id, nome_cliente, telefone, idioma").in("id", ids)
    : { data: [] };
  const porId = new Map((orcs ?? []).map((o) => [o.id as string, o]));

  const resultados: { id: string; ok: boolean; erro?: string }[] = [];

  for (const ag of agendamentos ?? []) {
    const orc = porId.get(ag.orcamento_id as string);
    if (!orc?.telefone) {
      resultados.push({ id: ag.id, ok: false, erro: "sem telefone" });
      continue;
    }
    const quando = partesOrlando(ag.data_hora);
    try {
      await enfileirarMensagem({
        tipo: "lembrete",
        nome: orc.nome_cliente,
        telefone: orc.telefone,
        idioma: idiomaDe(orc.idioma),
        texto: textoLembrete({
          data: quando.data,
          hora: minParaHHMM(quando.min),
          idioma: idiomaDe(orc.idioma),
        }),
        orcamentoId: ag.orcamento_id,
        agendamentoId: ag.id,
        chave: `lembrete:${ag.id}`,
      });
      await supabaseAdmin.from("agendamentos").update({ lembrete_enviado: true }).eq("id", ag.id);
      resultados.push({ id: ag.id, ok: true });
    } catch (e: unknown) {
      resultados.push({ id: ag.id, ok: false, erro: e instanceof Error ? e.message : "erro" });
    }
  }

  return NextResponse.json({ success: true, total: resultados.length, resultados });
}