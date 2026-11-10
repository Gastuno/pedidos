import { createClient } from "@supabase/supabase-js";

export async function getAuthenticatedSupabaseUser(request: Request) {
  const accessToken = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!accessToken) return { user: null, error: null, status: null };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Falta configurar Supabase para validar la sesión.");
  }

  const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);

  return {
    user: data.user,
    error,
    status: error?.status ?? null,
  };
}
