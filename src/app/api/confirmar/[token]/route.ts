import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { deleteCalendarEvent } from "@/lib/googleCalendar";
import { partesOrlando, minParaHHMM, minParaHora12 } from "@/lib/agenda";
import { DIA_CURTO, addDias, diaSemana, formatarDataCurta, hojeOrlando } from "@/lib/clientes";
import { enviarPush } from "@/lib/push";

export const runtime = "nodejs";

// Página pública do cliente (sem login): o token na URL é a chave. Só devolve primeiro nome, dia e hora.
type Estado = "aberta" | "confirmada" | "cancelada" | "remarcar" | "expirada" | "encerrada";

async function buscar(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const { data: ag } = await supabaseAdmin
    .from("agendamentos")
    .select(
      "id, status, tipo, data_hora, confirmacao, google_event_id, cliente_fixo_id, token_expira_em, pedido_data, pedido_hora, pedido_nota"
    )
    .eq("token_confirmacao", token)
    .maybeSingle();
  if (!ag || ag.tipo !== "fixo") return null;
  const { data: cliente } = ag.cliente_fixo_id
    ? await supabaseAdmin.from("clientes_fixos").select("nome, idioma").eq("id", ag.cliente_fixo_id).maybeSingle()
    : { data: null };
  return { ag, cliente };
}

function estadoDe(ag: NonNullable<Awaited<ReturnType<typeof buscar>>>["ag"]): Estado {
  if (ag.status === "cancelado") return "cancelada";
  if (ag.status !== "confirmado") return "encerrada";
  const agora = new Date();
  if (new Date(ag.data_hora) <= agora) return "encerrada";
  if (ag.token_expira_em && new Date(ag.token_expira_em) < agora) return "expirada";
  if (ag.confirmacao === "confirmada") return "confirmada";
  if (ag.confirmacao === "remarcar") return "remarcar";
  return "aberta";
}

function resposta(r: NonNullable<Awaited<ReturnType<typeof buscar>>>) {
  const p = partesOrlando(r.ag.data_hora);
  return {
    nome: String(r.cliente?.nome ?? "").trim().split(/\s+/)[0] || "",
    idioma: r.cliente?.idioma === "pt" ? "pt" : "en",
    data: p.data,
    hora: minParaHHMM(p.min),
    estado: estadoDe(r.ag),
    pedido: r.ag.pedido_data
      ? { data: r.ag.pedido_data as string, hora: (r.ag.pedido_hora as string) ?? "", nota: (r.ag.pedido_nota as string) ?? "" }
      : null,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await buscar(token);
  if (!r) return NextResponse.json({ error: "Link inválido" }, { status: 404 });
  return NextResponse.json(resposta(r));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const r = await buscar(token);
    if (!r) return NextResponse.json({ error: "Link inválido" }, { status: 404 });
    const { ag, cliente } = r;

    const corpo = (await request.json().catch(() => ({}))) as {
      acao?: string;
      data?: string;
      hora?: string;
      nota?: string;
    };
    const acao = corpo.acao;
    if (acao !== "confirmar" && acao !== "cancelar" && acao !== "remarcar") {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const estado = estadoDe(ag);
    if (estado === "expirada" || estado === "encerrada" || estado === "cancelada") {
      return NextResponse.json({ error: "Este link não está mais ativo", estado }, { status: 409 });
    }

    const p = partesOrlando(ag.data_hora);
    const quando = `${DIA_CURTO[diaSemana(p.data)]} ${formatarDataCurta(p.data)} · ${minParaHora12(p.min)}`;
    const nome = String(cliente?.nome ?? "Cliente");
    const agora = new Date().toISOString();

    if (acao === "confirmar") {
      const { error } = await supabaseAdmin
        .from("agendamentos")
        .update({
          confirmacao: "confirmada",
          respondido_em: agora,
          pedido_data: null,
          pedido_hora: null,
          pedido_nota: null,
        })
        .eq("id", ag.id)
        .eq("status", "confirmado");
      if (error) throw new Error(error.message);
    }

    if (acao === "cancelar") {
      // cancelou = libera o horário na hora: sai da agenda e do Google Calendar.
      // A linha fica "cancelado" para a rotina diária não recriar essa visita.
      const { data: lib, error } = await supabaseAdmin
        .from("agendamentos")
        .update({ status: "cancelado", confirmacao: "cancelada", google_event_id: null, respondido_em: agora })
        .eq("id", ag.id)
        .eq("status", "confirmado")
        .select("id");
      if (error) throw new Error(error.message);
      if (lib && lib.length > 0 && ag.google_event_id) {
        try {
          await deleteCalendarEvent(ag.google_event_id);
        } catch (e) {
          console.error("não consegui apagar o evento do Calendar", e);
        }
      }
      await enviarPush({
        titulo: "Cliente cancelou",
        corpo: `${nome} · ${quando} — horário liberado`,
        url: "/admin",
        tag: `cancelou:${ag.id}`,
      });
    }

    if (acao === "remarcar") {
      const data = corpo.data ?? "";
      const hora = corpo.hora ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) {
        return NextResponse.json({ error: "Informe o dia e o horário que prefere" }, { status: 400 });
      }
      if (diaSemana(data) === 0) {
        return NextResponse.json({ error: "Não trabalhamos aos domingos" }, { status: 400 });
      }
      if (data < hojeOrlando() || data > addDias(p.data, 30)) {
        return NextResponse.json({ error: "Escolha uma data próxima" }, { status: 400 });
      }
      const nota = String(corpo.nota ?? "").trim().slice(0, 300);
      const { error } = await supabaseAdmin
        .from("agendamentos")
        .update({
          confirmacao: "remarcar",
          respondido_em: agora,
          pedido_data: data,
          pedido_hora: hora,
          pedido_nota: nota || null,
        })
        .eq("id", ag.id)
        .eq("status", "confirmado");
      if (error) throw new Error(error.message);
      const [hh, mm] = hora.split(":").map(Number);
      await enviarPush({
        titulo: "Cliente pediu outro horário",
        corpo: `${nome} · era ${quando} · quer ${DIA_CURTO[diaSemana(data)]} ${formatarDataCurta(data)} ${minParaHora12(hh * 60 + mm)}`,
        url: "/admin",
        tag: `remarcar:${ag.id}`,
      });
    }

    const nova = await buscar(token);
    return NextResponse.json({ success: true, ...(nova ? resposta(nova) : {}) });
  } catch (e: unknown) {
    console.error("confirmar", e);
    return NextResponse.json({ error: "Não foi possível salvar. Tente de novo." }, { status: 500 });
  }
}