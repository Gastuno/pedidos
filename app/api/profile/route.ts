import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getAuthenticatedSupabaseUser } from "../../../lib/supabase-server";
import { ensureUserProfile } from "../../../lib/user-profile";

export async function GET(request: Request) {
  let auth: Awaited<ReturnType<typeof getAuthenticatedSupabaseUser>>;
  try {
    auth = await getAuthenticatedSupabaseUser(request);
  } catch (error) {
    console.error("No se pudo validar la sesión para consultar los puntos.", error);
    return NextResponse.json(
      { error: "No pudimos validar tu sesión. Probá de nuevo." },
      { status: 503 },
    );
  }

  if (auth.error) {
    if (auth.status === 400 || auth.status === 401 || auth.status === 403) {
      return NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 });
    }
    console.error("No se pudo validar la sesión para consultar los puntos.", auth.error);
    return NextResponse.json(
      { error: "No pudimos validar tu sesión. Probá de nuevo." },
      { status: 503 },
    );
  }
  if (!auth.user) {
    return NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 });
  }

  try {
    await ensureUserProfile(auth.user);
    const user = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: { puntos: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "No encontramos los puntos de tu cuenta." },
        { status: 404 },
      );
    }

    return NextResponse.json({ puntos: user.puntos });
  } catch (error) {
    console.error("No se pudieron consultar los puntos de la cuenta.", error);
    return NextResponse.json(
      { error: "No pudimos consultar tus puntos. Probá de nuevo." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let auth: Awaited<ReturnType<typeof getAuthenticatedSupabaseUser>>;
  try {
    auth = await getAuthenticatedSupabaseUser(request);
  } catch (error) {
    console.error("No se pudo validar la sesión de Supabase.", error);
    return NextResponse.json(
      { error: "No pudimos validar tu sesión. Probá de nuevo." },
      { status: 503 },
    );
  }

  if (auth.error) {
    if (auth.status === 400 || auth.status === 401 || auth.status === 403) {
      return NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 });
    }
    console.error("No se pudo validar la sesión de Supabase.", auth.error);
    return NextResponse.json(
      { error: "No pudimos validar tu sesión. Probá de nuevo." },
      { status: 503 },
    );
  }
  if (!auth.user) {
    return NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 });
  }

  try {
    const profile = await ensureUserProfile(auth.user);
    if (!profile?.phone || !profile.address) {
      return NextResponse.json(
        { error: "La cuenta no tiene un teléfono y una dirección válidos." },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("No se pudieron guardar los datos de la cuenta.", error);
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : null;
    return NextResponse.json(
      {
        error: code
          ? `No pudimos guardar los datos de tu cuenta (error ${code}). Revisá la configuración de la base de datos.`
          : "No pudimos guardar los datos de tu cuenta. Revisá los registros del servidor.",
      },
      { status: 500 },
    );
  }
}
