import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/authAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// Guarda (ou remove) o aparelho que quer receber notificações
export async function POST(request: NextRequest) {
  if (!(await exigirAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { subscription } = (await request.json()) as {
    subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  };
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Inscrição inválida" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    { endpoint, p256dh, auth, user_agent: request.headers.get("user-agent") },
    { onConflict: "endpoint" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  if (!(await exigirAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { endpoint } = (await request.json()) as { endpoint?: string };
  if (!endpoint) return NextResponse.json({ error: "Inscrição inválida" }, { status: 400 });
  await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return NextResponse.json({ success: true });
}