import type { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabaseAdmin";

// Confere se a requisição vem de alguém logado no painel (token Bearer da sessão do Supabase)
export async function exigirAdmin(request: NextRequest): Promise<boolean> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return !error && Boolean(data.user);
}