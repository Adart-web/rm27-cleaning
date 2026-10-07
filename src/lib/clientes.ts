import { formatHora12 } from "./time";

export type Frequencia = "semanal" | "quinzenal" | "mensal";
export type StatusCliente = "ativo" | "pausado" | "encerrado";

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
  clientes: Pick<ClienteFixo, "frequencia" | "status">[]
): number {
  return clientes
    .filter((c) => c.status === "ativo")
    .reduce((soma, c) => soma + 7 / INTERVALO_DIAS[c.frequencia], 0);
}

function minutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function avisoDePeriodo(hhmm: string, duracaoMin: number): string | null {
  const ini = minutos(hhmm);
  const fim = ini + duracaoMin;
  const limite = ini < 12 * 60 ? 12 * 60 : 17 * 60;
  if (fim <= limite) return null;
  const fimHHMM = `${String(Math.floor(fim / 60)).padStart(2, "0")}:${String(fim % 60).padStart(2, "0")}`;
  return `Esse horário termina às ${formatHora12(fimHHMM)}, depois do fim do período (${limite === 720 ? "12:00 PM" : "5:00 PM"}).`;
}