import { formatHora12 } from "./time";

export type Frequencia = "semanal" | "quinzenal" | "mensal";
export type StatusCliente = "ativo" | "pausado" | "encerrado";

// Um dia/horário de visita. O cliente tem o principal (colunas normais) + extras (ex.: terça E sexta)
export type Horario = {
  primeira_visita: string;
  hora_inicio: string;
  duracao_min: number;
};

export type ClienteFixo = {
  id: string;
  nome: string;
  telefone: string;
  endereco: string | null;
  idioma: "en" | "pt";
  frequencia: Frequencia;
  primeira_visita: string;
  hora_inicio: string;
  duracao_min: number;
  horarios_extras: Horario[];
  valor: number;
  equipe: number;
  observacoes: string | null;
  confirmar_sabado: boolean;
  status: StatusCliente;
  created_at: string;
};

export const FREQUENCIA_LABEL: Record<Frequencia, string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
};

// "Mensal" = a cada 4 semanas. Se a cliente quiser outra regra, é só mudar aqui.
export const INTERVALO_DIAS: Record<Frequencia, number> = {
  semanal: 7,
  quinzenal: 14,
  mensal: 28,
};

export const DIA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const DIA_LONGO = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

// 1 equipe x 2 períodos x 6 dias (segunda a sábado)
export const CAPACIDADE_SEMANAL = 12;

// Horários de início possíveis: 8:00–11:30 e 13:00–15:30
export const HORAS_INICIO: string[] = (() => {
  const out: string[] = [];
  for (let m = 8 * 60; m <= 15 * 60 + 30; m += 30) {
    if (m >= 12 * 60 && m < 13 * 60) continue;
    out.push(
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
    );
  }
  return out;
})();

// ---------- telefone (EUA) ----------

function soDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

export function normalizarTelefoneUS(v: string): string | null {
  let d = soDigitos(v);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length !== 10) return null;
  return `+1${d}`;
}

export function formatarTelefoneUS(v: string): string {
  let d = soDigitos(v);
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

// ---------- datas (sempre "YYYY-MM-DD") ----------

function utc(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function hojeOrlando(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(
    new Date()
  );
}

export function addDias(dateStr: string, dias: number): string {
  return new Date(utc(dateStr) + dias * 86400000).toISOString().slice(0, 10);
}

export function diasEntre(de: string, ate: string): number {
  return Math.round((utc(ate) - utc(de)) / 86400000);
}

// 0 = domingo ... 6 = sábado
export function diaSemana(dateStr: string): number {
  return new Date(utc(dateStr)).getUTCDay();
}

export function formatarDataCurta(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

// Próximas visitas a partir de hoje, seguindo a data-âncora e a frequência
export function proximasVisitas(
  ancora: string,
  frequencia: Frequencia,
  quantidade: number
): string[] {
  const passo = INTERVALO_DIAS[frequencia];
  const hoje = hojeOrlando();
  let atual = ancora;
  if (atual < hoje) {
    const k = Math.ceil(diasEntre(atual, hoje) / passo);
    atual = addDias(atual, k * passo);
  }
  const out: string[] = [];
  for (let i = 0; i < quantidade; i++) {
    out.push(atual);
    atual = addDias(atual, passo);
  }
  return out;
}

// ---------- capacidade e período ----------

export function visitasPorSemana(
  clientes: (Pick<ClienteFixo, "frequencia" | "status"> & { horarios_extras?: Horario[] })[]
): number {
  return clientes
    .filter((c) => c.status === "ativo")
    .reduce(
      (soma, c) => soma + ((1 + (c.horarios_extras ?? []).length) * 7) / INTERVALO_DIAS[c.frequencia],
      0
    );
}

// Todos os dias/horários do cliente: o principal + os extras
export function horariosDe(
  c: Pick<ClienteFixo, "primeira_visita" | "hora_inicio" | "duracao_min"> & {
    horarios_extras?: Horario[];
  }
): Horario[] {
  return [
    { primeira_visita: c.primeira_visita, hora_inicio: c.hora_inicio, duracao_min: c.duracao_min },
    ...(c.horarios_extras ?? []),
  ];
}

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function avisoDePeriodo(hhmm: string, duracaoMin: number): string | null {
  const ini = minutos(hhmm);
  const fim = ini + duracaoMin;
  const fmt = (m: number) =>
    formatHora12(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);

  // Visita longa (mais de 4h) atravessa o almoço de propósito: só avisa se passar do fim do dia
  if (duracaoMin > 240) {
    return fim > 17 * 60 ? `Esse horário termina às ${fmt(fim)}, depois do fim do expediente (5:00 PM).` : null;
  }

  const limite = ini < 12 * 60 ? 12 * 60 : 17 * 60;
  if (fim <= limite) return null;
  return `Esse horário termina às ${fmt(fim)}, depois do fim do período (${limite === 720 ? "12:00 PM" : "5:00 PM"}).`;
}

// ---------- semana de trabalho ----------

// Semana de trabalho (segunda a sábado) que contém a data
export function semanaDe(dateStr: string): { inicio: string; fim: string } {
  const dow = diaSemana(dateStr); // 0 = domingo
  const desloc = dow === 0 ? -6 : 1 - dow;
  const inicio = addDias(dateStr, desloc);
  return { inicio, fim: addDias(inicio, 5) };
}

// A data cai na semana corrente (já confirmada com os clientes)?
export function caiNaSemanaAtual(dateStr: string): boolean {
  const { inicio, fim } = semanaDe(hojeOrlando());
  return dateStr >= inicio && dateStr <= fim;
}
// Próxima visita (data) considerando todos os dias/horários do cliente
export function proximaVisitaDe(c: ClienteFixo): string {
  return horariosDe(c)
    .map((h) => proximasVisitas(h.primeira_visita, c.frequencia, 1)[0])
    .sort()[0];
}

// Ex.: "Ter · 9:00 AM + Sex · 1:00 PM"
export function diaEHoraDe(c: ClienteFixo): string {
  return horariosDe(c)
    .map((h) => `${DIA_CURTO[diaSemana(h.primeira_visita)]} · ${formatHora12(h.hora_inicio)}`)
    .join(" + ");
}