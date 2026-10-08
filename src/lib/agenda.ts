import { formatHora12 } from "./time";

export type Periodo = "manha" | "tarde";
export type PeriodoBloqueio = "dia" | "manha" | "tarde";

// Janelas de atendimento em minutos desde 00:00 (horário de Orlando)
export const JANELAS: Record<Periodo, [number, number]> = {
  manha: [8 * 60, 12 * 60],
  tarde: [13 * 60, 17 * 60],
};

// Menor pedaço de tempo livre que ainda cabe uma visita
export const DURACAO_MINIMA = 120;

export type Faixa = { ini: number; fim: number };

export function faixaDoBloqueio(periodo: PeriodoBloqueio): Faixa {
  if (periodo === "manha") return { ini: JANELAS.manha[0], fim: JANELAS.manha[1] };
  if (periodo === "tarde") return { ini: JANELAS.tarde[0], fim: JANELAS.tarde[1] };
  return { ini: JANELAS.manha[0], fim: JANELAS.tarde[1] };
}

export function minParaHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function minParaHora12(min: number): string {
  return formatHora12(minParaHHMM(min));
}

// Instante (ISO) -> data e minutos do dia no horário de Orlando
export function partesOrlando(iso: string): { data: string; min: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    data: `${get("year")}-${get("month")}-${get("day")}`,
    min: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

// Pedaços livres (>= 2h) dentro de cada período, descontando o que está ocupado
export function janelasLivres(ocupado: Faixa[]): Record<Periodo, Faixa[]> {
  const ordenado = [...ocupado].sort((a, b) => a.ini - b.ini);
  const resultado: Record<Periodo, Faixa[]> = { manha: [], tarde: [] };

  (Object.keys(JANELAS) as Periodo[]).forEach((p) => {
    const [ini, fim] = JANELAS[p];
    let cursor = ini;
    for (const o of ordenado) {
      if (o.fim <= cursor || o.ini >= fim) continue;
      if (o.ini - cursor >= DURACAO_MINIMA) resultado[p].push({ ini: cursor, fim: o.ini });
      cursor = Math.max(cursor, o.fim);
    }
    if (fim - cursor >= DURACAO_MINIMA) resultado[p].push({ ini: cursor, fim });
  });

  return resultado;
}

// ---------- conflitos de horário (usado em Solicitações) ----------

export type Ocupacao = Faixa & {
  rotulo: string;
  // suave = só um pedido ainda sem confirmação; duro = já ocupa a agenda
  suave?: boolean;
};

export function hhmmParaMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function conflitosDoHorario(
  ocupacoes: Ocupacao[],
  inicioMin: number,
  duracaoMin = 120
): Ocupacao[] {
  const fim = inicioMin + duracaoMin;
  return ocupacoes.filter((o) => inicioMin < o.fim && fim > o.ini);
}