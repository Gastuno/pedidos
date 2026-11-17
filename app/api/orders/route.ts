import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getAuthenticatedSupabaseUser } from "../../../lib/supabase-server";
import { ensureUserProfile } from "../../../lib/user-profile";

type OrderRequest = {
  customerName: string;
  fulfillment: "PICKUP" | "DELIVERY";
  notes?: string;
  items: { productId: string; quantity: number }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOrderRequest(value: unknown): value is OrderRequest {
  if (!isRecord(value)) return false;
  const body = value;

  if (
    typeof body.customerName !== "string" ||
    body.customerName.trim().length < 2 ||
    body.customerName.trim().length > 80 ||
    (body.fulfillment !== "PICKUP" && body.fulfillment !== "DELIVERY") ||
    (body.notes !== undefined &&
      (typeof body.notes !== "string" || body.notes.length > 300)) ||
    !Array.isArray(body.items) ||
    body.items.length === 0 ||
    body.items.length > 20
  ) {
    return false;
  }

  const ids = new Set<string>();
  return body.items.every((item: unknown) => {
    if (!isRecord(item)) return false;
    const line = item;
    if (
      typeof line.productId !== "string" ||
      line.productId.length > 50 ||
      typeof line.quantity !== "number" ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 99 ||
      ids.has(line.productId)
    ) {
      return false;
    }
    ids.add(line.productId);
    return true;
  });
}

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

    const order = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: body.items.map((item) => item.productId) } },
        select: { id: true, name: true, price: true },
      });
      if (products.length !== body.items.length) return null;

      const productById = new Map(products.map((product) => [product.id, product]));
      const orderItems = [];
      for (const item of body.items) {
        const product = productById.get(item.productId);
        if (!product) return null;
        orderItems.push({
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          quantity: item.quantity,
        });
      }
      const total = Number(
        orderItems
          .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
          .toFixed(2),
      );

      const details = {
        cliente: body.customerName.trim(),
        telefono: profile.phone,
        modalidad: body.fulfillment,
        direccion: body.fulfillment === "DELIVERY" ? profile.address : null,
        notas: body.notes?.trim() || null,
        items: orderItems,
        total,
      };

      const pendingState = await tx.estado.upsert({
        where: { nombre: "Pendiente" },
        update: {},
        create: { nombre: "Pendiente" },
        select: { id: true },
      });

      const pedido = await tx.pedido.create({
        data: {
          montoTotal: total,
          puntosAdquiridos: 0,
          cliente: details.cliente,
          telefono: details.telefono,
          modalidad: details.modalidad,
          direccion: details.direccion,
          notas: details.notas,
          usuario: { connect: { id: auth.user.id } },
          estado: { connect: { id: pendingState.id } },
          detalles: {
            create: orderItems.map((item) => ({
              idProducto: item.productId,
              nombreProducto: item.name,
              precioUnitario: item.unitPrice,
              cantidad: item.quantity,
            })),
          },
        },
        select: { id: true },
      });

      return { id: pedido.id, total };
    });

    if (!order) {
      return NextResponse.json(
        { error: "Algún producto ya no está disponible. Actualizá el menú." },
        { status: 409 },
      );
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("No se pudo guardar el pedido en la base de datos.", error);
    return NextResponse.json(
      { error: "No pudimos guardar tu pedido. Probá de nuevo en unos minutos." },
      { status: 500 },
    );
  }
}
