// Textos das mensagens (SMS) e utilidades. Sem acesso ao banco: pode ser usado em qualquer lugar.
import { formatDataEn, formatHora12 } from "./time";

export type TipoMensagem = "sinal" | "pagamento" | "lembrete" | "confirmacao_sabado";
export type Idioma = "en" | "pt";

export const TIPO_LABEL: Record<TipoMensagem, string> = {
  sinal: "Pedido de sinal",
  pagamento: "Pagamento confirmado",
  lembrete: "Lembrete",
  confirmacao_sabado: "Confirmação de sábado",
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

// Link que abre o app Mensagens do iPhone já com número e texto
export function linkSms(telefone: string, texto: string): string {
  return `sms:${telParaSms(telefone)}&body=${encodeURIComponent(texto)}`;
}
// Confirmação enviada no sábado com as visitas da semana seguinte (prazo: domingo 18h)
export function textoConfirmacaoSabado(p: {
  nome: string;
  visitas: { data: string; hora: string }[];
  idioma: Idioma;
}): string {
  const linhas = p.visitas
    .map((v) => `- ${dataExtenso(v.data, p.idioma)} ${p.idioma === "pt" ? "às" : "at"} ${formatHora12(v.hora)}`)
    .join("\n");
  if (p.idioma === "pt") {
    return `Oi ${p.nome}! Aqui é a RM27 Cleaning. Sua faxina da semana que vem:

${linhas}

Responda SIM para confirmar ou NÃO se precisar pular essa semana. Se não tivermos resposta até domingo às 18h, o horário pode ser oferecido para outro cliente. Obrigada!`;
  }
  return `Hi ${p.nome}! This is RM27 Cleaning. Your cleaning next week:

${linhas}

Please reply YES to confirm or NO if you need to skip this week. If we don't hear from you by Sunday 6 PM, the spot may be offered to another client. Thank you!`;
}