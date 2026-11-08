// Textos das mensagens (SMS) e utilidades. Sem acesso ao banco: pode ser usado em qualquer lugar.
import { formatDataEn, formatHora12 } from "./time";

export type TipoMensagem =
  | "sinal"
  | "pagamento"
  | "lembrete"
  | "confirmacao_sabado"
  | "remarcacao"
  | "cancelamento";
export type Idioma = "en" | "pt";

export const TIPO_LABEL: Record<TipoMensagem, string> = {
  sinal: "Pedido de sinal",
  pagamento: "Pagamento confirmado",
  lembrete: "Lembrete",
  confirmacao_sabado: "Confirmação de sábado",
  remarcacao: "Visita remarcada",
  cancelamento: "Visita cancelada",
};

export const ZELLE = "rm27solutions@gmail.com";

export function idiomaDe(valor: string | null | undefined): Idioma {
  return valor === "pt" ? "pt" : "en";
}

function formatDataPt(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function dataExtenso(dateStr: string, idioma: Idioma): string {
  return idioma === "pt" ? formatDataPt(dateStr) : formatDataEn(dateStr);
}

export function textoSinal(p: {
  nome: string;
  data: string;
  hora: string; // "HH:MM"
  total: number;
  idioma: Idioma;
}): string {
  const sinal = (p.total / 2).toFixed(2);
  const quando = `${dataExtenso(p.data, p.idioma)} ${p.idioma === "pt" ? "às" : "at"} ${formatHora12(p.hora)}`;
  if (p.idioma === "pt") {
    return `Oi ${p.nome}! Seu orçamento com a RM27 Cleaning foi confirmado.

Visita: ${quando}
Valor estimado: $${p.total}
Sinal para garantir o horário: $${sinal} (50%)

Envie o sinal por Zelle para:
${ZELLE}

Depois de enviar, responda aqui com o comprovante e confirmamos o seu horário.`;
  }
  return `Hi ${p.nome}! Your quote with RM27 Cleaning has been confirmed.

Appointment: ${quando}
Total estimate: $${p.total}
Deposit required to secure your booking: $${sinal} (50%)

Please send the deposit via Zelle to:
${ZELLE}

Once sent, just reply here with the payment receipt/screenshot and we'll confirm your appointment.`;
}

export function textoPagamento(p: { data: string; hora: string; idioma: Idioma }): string {
  const quando = `${dataExtenso(p.data, p.idioma)} ${p.idioma === "pt" ? "às" : "at"} ${formatHora12(p.hora)}`;
  if (p.idioma === "pt") {
    return `Pagamento recebido!

Sua visita com a RM27 Cleaning está confirmada para:
${quando}

Mandamos um lembrete perto da data. Obrigada!`;
  }
  return `Payment received!

Your appointment with RM27 Cleaning is confirmed for:
${quando}

We'll send a reminder closer to the date. Thank you!`;
}

export function textoLembrete(p: { data: string; hora: string; idioma: Idioma }): string {
  const quando = `${dataExtenso(p.data, p.idioma)} ${p.idioma === "pt" ? "às" : "at"} ${formatHora12(p.hora)}`;
  if (p.idioma === "pt") {
    return `Lembrete: sua visita com a RM27 Cleaning é amanhã!

${quando}

Até logo!`;
  }
  return `Reminder: your RM27 Cleaning appointment is tomorrow!

${quando}

See you soon!`;
}

// Número para o link sms: (EUA por padrão). Aceita (407) 555-0142, +14075550142, 5519992090509...
export function telParaSms(telefone: string): string {
  const d = telefone.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  return `+${d}`;
}

// Link que abre o app Mensagens já com número e texto.
// iPhone usa "&body=" e Android usa "?body=" (no Android o "&body=" vira parte do número).
export function linkSms(telefone: string, texto: string, android = false): string {
  return `sms:${telParaSms(telefone)}${android ? "?" : "&"}body=${encodeURIComponent(texto)}`;
}
// Link que abre o WhatsApp já com a conversa do número e o texto (envio manual, sem API)
export function linkWhatsApp(telefone: string, texto: string): string {
  return `https://wa.me/${telParaSms(telefone).replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}

// Confirmação enviada no sábado com as visitas da semana seguinte (prazo: domingo 18h)
export function textoConfirmacaoSabado(p: {
  nome: string;
  visitas: { data: string; hora: string; link?: string }[];
  idioma: Idioma;
}): string {
  const pt = p.idioma === "pt";
  const comLink = p.visitas.some((v) => v.link);
  const unica = p.visitas.length === 1;
  const linhas = p.visitas
    .map((v) => {
      const quando = `${dataExtenso(v.data, p.idioma)} ${pt ? "às" : "at"} ${formatHora12(v.hora)}`;
      return v.link && !unica ? `- ${quando}\n  ${v.link}` : `- ${quando}`;
    })
    .join("\n");

  if (comLink) {
    const linkUnico = unica ? p.visitas[0].link : null;
    if (pt) {
      return `Oi ${p.nome}! Aqui é a RM27 Cleaning. Sua faxina da semana que vem:

${linhas}

${linkUnico ? `Confirme, cancele ou peça outro horário por este link:\n${linkUnico}\n\n` : "Confirme, cancele ou peça outro horário pelo link de cada visita.\n\n"}Responda até domingo às 20h. Sem resposta, o horário pode ser oferecido para outro cliente. Obrigada!`;
    }
    return `Hi ${p.nome}! This is RM27 Cleaning. Your cleaning next week:

${linhas}

${linkUnico ? `Confirm, cancel or ask for another time here:\n${linkUnico}\n\n` : "Confirm, cancel or ask for another time using the link for each visit.\n\n"}Please reply by Sunday 8 PM. If we don't hear from you, the spot may be offered to another client. Thank you!`;
  }

  if (pt) {
    return `Oi ${p.nome}! Aqui é a RM27 Cleaning. Sua faxina da semana que vem:

${linhas}

Responda SIM para confirmar ou NÃO se precisar pular essa semana. Se não tivermos resposta até domingo às 20h, o horário pode ser oferecido para outro cliente. Obrigada!`;
  }
  return `Hi ${p.nome}! This is RM27 Cleaning. Your cleaning next week:

${linhas}

Please reply YES to confirm or NO if you need to skip this week. If we don't hear from you by Sunday 8 PM, the spot may be offered to another client. Thank you!`;
}

// Visita avulsa remarcada pela RM27
export function textoRemarcacao(p: { data: string; hora: string; idioma: Idioma }): string {
  const quando = `${dataExtenso(p.data, p.idioma)} ${p.idioma === "pt" ? "às" : "at"} ${formatHora12(p.hora)}`;
  if (p.idioma === "pt") {
    return `Sua visita com a RM27 Cleaning foi remarcada para:
${quando}

Qualquer dúvida, é só responder aqui. Obrigada!`;
  }
  return `Your RM27 Cleaning appointment has been rescheduled to:
${quando}

If you have any questions, just reply here. Thank you!`;
}

// Cliente fixo remarcado pela RM27: pede para confirmar (ou pedir outro horário) pelo link
export function textoRemarcacaoFixo(p: { nome: string; data: string; hora: string; idioma: Idioma; link: string }): string {
  const quando = `${dataExtenso(p.data, p.idioma)} ${p.idioma === "pt" ? "às" : "at"} ${formatHora12(p.hora)}`;
  if (p.idioma === "pt") {
    return `Oi ${p.nome}! Aqui é a RM27 Cleaning. Precisamos mudar a sua faxina para:

${quando}

Confirme, ou peça outro horário, por este link:
${p.link}

Obrigada pela compreensão!`;
  }
  return `Hi ${p.nome}! This is RM27 Cleaning. We need to move your cleaning to:

${quando}

Please confirm, or ask for another time, here:
${p.link}

Thank you for understanding!`;
}

// Visita avulsa cancelada. `sinal` muda o texto: devolver (menciona reembolso) ou manter (não menciona).
export function textoCancelamento(p: {
  data: string;
  hora: string;
  idioma: Idioma;
  sinal: "devolver" | "manter";
}): string {
  const quando = `${dataExtenso(p.data, p.idioma)} ${p.idioma === "pt" ? "às" : "at"} ${formatHora12(p.hora)}`;
  if (p.idioma === "pt") {
    return `Sua visita com a RM27 Cleaning (${quando}) foi cancelada.${
      p.sinal === "devolver" ? "\n\nVamos devolver o valor do sinal que você enviou." : ""
    }

Quando quiser agendar de novo, é só pedir um novo orçamento. Obrigada!`;
  }
  return `Your RM27 Cleaning appointment (${quando}) has been cancelled.${
    p.sinal === "devolver" ? "\n\nWe will refund the deposit you sent." : ""
  }

Whenever you'd like to book again, just request a new quote. Thank you!`;
}