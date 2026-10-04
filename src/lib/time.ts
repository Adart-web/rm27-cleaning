const TZ = "America/New_York";

function offsetMs(utc: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(utc);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );
  return asUtc - utc.getTime();
}

// "2026-10-05" + "10:00" (horário de Orlando) -> instante UTC correto
export function orlandoToDate(dateStr: string, hhmm: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const first = naive - offsetMs(new Date(naive));
  return new Date(naive - offsetMs(new Date(first)));
}

export function formatHora12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatDataEn(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function horaPadrao(periodo: string | null): string {
  return periodo === "manha" ? "09:00" : "13:00";
}

// Horários de início possíveis dentro do período (serviço de 2h)
export function opcoesHorario(periodo: string | null): string[] {
  const [ini, fim] = periodo === "manha" ? [8, 10] : [13, 15];
  const out: string[] = [];
  for (let h = ini; h <= fim; h++) {
    const hh = String(h).padStart(2, "0");
    out.push(`${hh}:00`);
    if (h < fim) out.push(`${hh}:30`);
  }
  return out;
}