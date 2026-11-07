import webpush from "web-push";
import { supabaseAdmin } from "./supabaseAdmin";

export type PayloadPush = {
  titulo: string;
  corpo: string;
  url?: string; // para onde o toque na notificação leva (padrão: /admin)
  tag?: string; // mesma tag substitui a notificação anterior em vez de empilhar
};

let configurado = false;

function configurar(): boolean {
  if (configurado) return true;
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privada = process.env.VAPID_PRIVATE_KEY;
  if (!publica || !privada) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:rm27solutions@gmail.com", publica, privada);
  configurado = true;
  return true;
}

// Manda a notificação para todos os aparelhos cadastrados. Nunca lança erro:
// um aviso que falha não pode derrubar quem chamou (orçamento, rotina diária etc.).
export async function enviarPush(p: PayloadPush): Promise<{ enviados: number; removidos: number; erro?: string }> {
  try {
    if (!configurar()) return { enviados: 0, removidos: 0, erro: "Chaves VAPID não configuradas" };
  } catch (e) {
    return { enviados: 0, removidos: 0, erro: `Chave VAPID inválida: ${e instanceof Error ? e.message : String(e)}` };
  }

  const { data, error } = await supabaseAdmin.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (error) return { enviados: 0, removidos: 0, erro: error.message };

  let enviados = 0;
  const mortos: string[] = [];

  await Promise.allSettled(
    (data ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...p, url: p.url ?? "/admin" }),
          { TTL: 60 * 60 * 12, urgency: "high" }
        );
        enviados++;
      } catch (e: unknown) {
        const status = (e as { statusCode?: number }).statusCode;
        console.error("push falhou", status, e instanceof Error ? e.message : e);
        // 404/410: o aparelho cancelou ou o app foi removido
        if (status === 404 || status === 410) mortos.push(s.endpoint);
      }
    })
  );

  if (mortos.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", mortos);
  }
  return { enviados, removidos: mortos.length };
}