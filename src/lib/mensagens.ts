import { supabaseAdmin } from "./supabaseAdmin";
import type { Idioma, TipoMensagem } from "./mensagensTextos";

// Coloca uma mensagem na fila do painel (a dona envia pelo iPhone).
// Com `chave`, repetir a chamada não duplica a mensagem.
export async function enfileirarMensagem(m: {
  tipo: TipoMensagem;
  nome: string | null;
  telefone: string;
  idioma: Idioma;
  texto: string;
  orcamentoId?: string | null;
  agendamentoId?: string | null;
  clienteFixoId?: string | null;
  chave?: string;
}): Promise<void> {
  const linha = {
    tipo: m.tipo,
    nome: m.nome,
    telefone: m.telefone,
    idioma: m.idioma,
    texto: m.texto,
    orcamento_id: m.orcamentoId ?? null,
    agendamento_id: m.agendamentoId ?? null,
    cliente_fixo_id: m.clienteFixoId ?? null,
    chave: m.chave ?? null,
  };

  const { error } = m.chave
    ? await supabaseAdmin.from("mensagens").upsert(linha, { onConflict: "chave", ignoreDuplicates: true })
    : await supabaseAdmin.from("mensagens").insert(linha);

  if (error) throw new Error(`Não consegui colocar a mensagem na fila: ${error.message}`);
}