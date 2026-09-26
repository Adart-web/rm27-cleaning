import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const { tokens } = await oauth2Client.getToken(code);

 const { error } = await supabaseAdmin.from("configuracoes").upsert(
  {
    chave: "google_calendar_tokens",
    valor: JSON.stringify(tokens),
  },
  { onConflict: "chave" }
);

  if (error) {
    console.log("ERRO AO SALVAR TOKEN:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL("/admin", request.url));
}