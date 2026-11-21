import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { getAuthenticatedSupabaseUser } from "./supabase-server";

export async function authorizeAdmin(request: Request, area: string) {
  let auth: Awaited<ReturnType<typeof getAuthenticatedSupabaseUser>>;
  try {
    auth = await getAuthenticatedSupabaseUser(request);
  } catch (error) {
    console.error("No se pudo validar la sesión para administrar.", error);
    return {
      response: NextResponse.json(
        { error: "No pudimos validar tu sesión. Probá de nuevo." },
        { status: 503 },
      ),
    };
  }

  if (auth.error) {
    if (auth.status === 400 || auth.status === 401 || auth.status === 403) {
      return {
        response: NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 }),
      };
    }
    console.error("No se pudo validar la sesión para administrar.", auth.error);
    return {
      response: NextResponse.json(
        { error: "No pudimos validar tu sesión. Probá de nuevo." },
        { status: 503 },
      ),
    };
  }
  if (!auth.user) {
    return {
      response: NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 }),
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { role: true },
    });
    if (user?.role !== "ADMIN") {
      return {
        response: NextResponse.json({ error: `No tenés permisos para ${area}.` }, { status: 403 }),
      };
    }
    return { userId: auth.user.id };
  } catch (error) {
    console.error("No se pudo verificar el rol para administrar.", error);
    return {
      response: NextResponse.json(
        { error: "No pudimos verificar tus permisos. Probá de nuevo." },
        { status: 500 },
      ),
    };
  }
}
