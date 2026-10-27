import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

type OrderRequest = {
  customerName: string;
  phone: string;
  fulfillment: "PICKUP" | "DELIVERY";
  address?: string;
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
    typeof body.phone !== "string" ||
    !/^[+0-9()\s.-]{6,24}$/.test(body.phone.trim()) ||
    (body.fulfillment !== "PICKUP" && body.fulfillment !== "DELIVERY") ||
    (body.notes !== undefined &&
      (typeof body.notes !== "string" || body.notes.length > 300)) ||
    !Array.isArray(body.items) ||
    body.items.length === 0 ||
    body.items.length > 20
  ) {
    return false;
  }

  if (
    body.fulfillment === "DELIVERY" &&
    (typeof body.address !== "string" ||
      body.address.trim().length < 5 ||
      body.address.trim().length > 200)
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
  const body: unknown = await request.json().catch(() => null);
  if (!isOrderRequest(body)) {
    return NextResponse.json(
      { error: "Revisá los datos del pedido e intentá de nuevo." },
      { status: 400 },
    );
  }

  try {
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
        telefono: body.phone.trim(),
        modalidad: body.fulfillment,
        direccion:
          body.fulfillment === "DELIVERY" ? body.address?.trim() ?? null : null,
        notas: body.notes?.trim() || null,
        items: orderItems,
        total,
      };

      const pedido = await tx.pedido.create({
        data: {
          detalle: JSON.stringify(details),
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
