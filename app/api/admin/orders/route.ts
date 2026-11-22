import { NextResponse } from "next/server";
import { authorizeAdmin } from "../../../../lib/admin-auth";
import { prisma } from "../../../../lib/prisma";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecordNotFound(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2025"
  );
}

export async function GET(request: Request) {
  const authorization = await authorizeAdmin(request, "administrar pedidos");
  if ("response" in authorization) return authorization.response;

  try {
    const [orders, statuses] = await Promise.all([
      prisma.pedido.findMany({
        orderBy: [{ fecha: "desc" }, { id: "desc" }],
        select: {
          id: true,
          fecha: true,
          montoTotal: true,
          puntosAdquiridos: true,
          cliente: true,
          telefono: true,
          modalidad: true,
          direccion: true,
          notas: true,
          estado: { select: { id: true, nombre: true } },
          medioPago: { select: { nombre: true } },
          detalles: {
            orderBy: { id: "asc" },
            select: {
              id: true,
              nombreProducto: true,
              precioUnitario: true,
              cantidad: true,
            },
          },
        },
      }),
      prisma.estado.findMany({
        orderBy: { orden: "asc" },
        select: { id: true, nombre: true },
      }),
    ]);

    return NextResponse.json({ orders, statuses });
  } catch (error) {
    console.error("No se pudieron cargar los pedidos para administración.", error);
    return NextResponse.json(
      { error: "No pudimos cargar los pedidos. Probá de nuevo." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorizeAdmin(request, "administrar pedidos");
  if ("response" in authorization) return authorization.response;

  const body: unknown = await request.json().catch(() => null);
  if (
    !isRecord(body) ||
    typeof body.orderId !== "number" ||
    !Number.isSafeInteger(body.orderId) ||
    body.orderId < 1 ||
    typeof body.statusId !== "number" ||
    !Number.isSafeInteger(body.statusId) ||
    body.statusId < 1
  ) {
    return NextResponse.json(
      { error: "Seleccioná un pedido y un estado válidos." },
      { status: 400 },
    );
  }

  try {
    const status = await prisma.estado.findUnique({
      where: { id: body.statusId },
      select: { id: true },
    });
    if (!status) {
      return NextResponse.json({ error: "El estado seleccionado no existe." }, { status: 400 });
    }

    const order = await prisma.pedido.update({
      where: { id: body.orderId },
      data: { idEstado: status.id },
      select: {
        id: true,
        estado: { select: { id: true, nombre: true } },
      },
    });
    return NextResponse.json(order);
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NextResponse.json({ error: "No encontramos ese pedido." }, { status: 404 });
    }
    console.error("No se pudo actualizar el estado del pedido.", error);
    return NextResponse.json(
      { error: "No pudimos actualizar el estado. Probá de nuevo." },
      { status: 500 },
    );
  }
}
