import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getAuthenticatedSupabaseUser } from "../../../lib/supabase-server";
import { ensureUserProfile } from "../../../lib/user-profile";
import { createOrderQuote, isOrderRequest } from "../../../lib/order-request";

export async function POST(request: Request) {
  let auth: Awaited<ReturnType<typeof getAuthenticatedSupabaseUser>>;
  try {
    auth = await getAuthenticatedSupabaseUser(request);
  } catch (error) {
    console.error("No se pudo validar la sesión para crear el pedido.", error);
    return NextResponse.json(
      { error: "No pudimos validar tu sesión. Probá de nuevo." },
      { status: 503 },
    );
  }

  if (auth.error) {
    if (auth.status === 400 || auth.status === 401 || auth.status === 403) {
      return NextResponse.json({ error: "Iniciá sesión para hacer tu pedido." }, { status: 401 });
    }
    console.error("No se pudo validar la sesión para crear el pedido.", auth.error);
    return NextResponse.json(
      { error: "No pudimos validar tu sesión. Probá de nuevo." },
      { status: 503 },
    );
  }
  if (!auth.user) {
    return NextResponse.json({ error: "Iniciá sesión para hacer tu pedido." }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isOrderRequest(body)) {
    return NextResponse.json(
      { error: "Revisá los datos del pedido e intentá de nuevo." },
      { status: 400 },
    );
  }

  try {
    const profile = await ensureUserProfile(auth.user);
    if (!profile?.phone || !profile.address) {
      return NextResponse.json(
        { error: "No encontramos tus datos de contacto. Volvé a iniciar sesión." },
        { status: 409 },
      );
    }

    const products = await prisma.product.findMany({
      where: { id: { in: body.items.map((item) => item.productId) } },
      select: { id: true, name: true, price: true },
    });
    const quote = createOrderQuote(body, products);

    if (!quote) {
      return NextResponse.json(
        { error: "Algún producto ya no está disponible. Actualizá el menú." },
        { status: 409 },
      );
    }

    return NextResponse.json(quote);
  } catch (error) {
    console.error("No se pudo cotizar el pedido.", error);
    return NextResponse.json(
      { error: "No pudimos calcular el pedido. Probá de nuevo en unos minutos." },
      { status: 500 },
    );
  }
}
