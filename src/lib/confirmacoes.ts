import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "./supabaseAdmin";
import { orlandoToDate } from "./time";
import { addDias, hojeOrlando, semanaDe } from "./clientes";
import { minParaHHMM, partesOrlando } from "./agenda";
import { enfileirarMensagem } from "./mensagens";
import { idiomaDe, textoConfirmacaoSabado } from "./mensagensTextos";

// Segunda-feira da semana que vem (a semana de trabalho vai de segunda a sábado)
export function inicioProximaSemana(): string {
  return addDias(semanaDe(hojeOrlando()).inicio, 7);
}

// Endereço público do site (usado nos links enviados aos clientes)
export function urlDoSite(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://rm27-cleaning.vercel.app").replace(/\/+$/, "");
}

export type ResumoConfirmacoes = {
  inicioSemana: string;
  mensagens: number;
  visitas: number;
  ignorados: string[];
};

// Coloca na fila a confirmação de cada cliente fixo que tem visita na semana indicada.
// Pode rodar mais de uma vez: não duplica mensagens.
export async function gerarConfirmacoes(inicioSemana: string): Promise<ResumoConfirmacoes> {
  const fim = addDias(inicioSemana, 5);
  const de = orlandoToDate(inicioSemana, "00:00").toISOString();
  const ate = orlandoToDate(addDias(fim, 1), "00:00").toISOString();

  const { data: visitas, error } = await supabaseAdmin
    .from("agendamentos")
    .select("id, data_hora, cliente_fixo_id, confirmacao, token_confirmacao")
    .eq("tipo", "fixo")
    .eq("status", "confirmado")
    .not("cliente_fixo_id", "is", null)
    .gte("data_hora", de)
    .lt("data_hora", ate)
    .order("data_hora");
  if (error) throw new Error(error.message);

  const resumo: ResumoConfirmacoes = { inicioSemana, mensagens: 0, visitas: 0, ignorados: [] };
  if (!visitas || visitas.length === 0) return resumo;

  const ids = [...new Set(visitas.map((v) => v.cliente_fixo_id as string))];
  const { data: clientes } = await supabaseAdmin
    .from("clientes_fixos")
    .select("id, nome, telefone, idioma, confirmar_sabado, status")
    .in("id", ids);
  const porId = new Map((clientes ?? []).map((c) => [c.id as string, c]));

  for (const id of ids) {
    const c = porId.get(id);
    if (!c || c.status !== "ativo") continue;
    if (!c.confirmar_sabado) {
      resumo.ignorados.push(`${c.nome}: não recebe confirmação`);
      continue;
    }

    const doCliente = visitas.filter((v) => v.cliente_fixo_id === id);
    // cada visita ganha um link próprio (token impossível de adivinhar), válido até domingo 20h
    const expira = orlandoToDate(addDias(inicioSemana, -1), "20:00").toISOString();
    const lista: { data: string; hora: string; link: string }[] = [];
    for (const v of doCliente) {
      const token = (v.token_confirmacao as string | null) ?? randomBytes(16).toString("hex");
      const { error: tokErr } = await supabaseAdmin
        .from("agendamentos")
        .update({ token_confirmacao: token, token_expira_em: expira })
        .eq("id", v.id);
      if (tokErr) throw new Error(tokErr.message);
      const p = partesOrlando(v.data_hora);
      lista.push({ data: p.data, hora: minParaHHMM(p.min), link: `${urlDoSite()}/c/${token}` });
    }

    await enfileirarMensagem({
      tipo: "confirmacao_sabado",
      nome: c.nome,
      telefone: c.telefone,
      idioma: idiomaDe(c.idioma),
      texto: textoConfirmacaoSabado({ nome: c.nome, visitas: lista, idioma: idiomaDe(c.idioma) }),
      clienteFixoId: id,
      chave: `sabado:${id}:${inicioSemana}`,
    });
    resumo.mensagens++;

    const pendentes = doCliente.filter((v) => !v.confirmacao).map((v) => v.id);
    if (pendentes.length > 0) {
      await supabaseAdmin.from("agendamentos").update({ confirmacao: "pendente" }).in("id", pendentes);
    }
    resumo.visitas += doCliente.length;
  }

  return resumo;
}