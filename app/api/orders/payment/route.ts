import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getAuthenticatedSupabaseUser } from "../../../../lib/supabase-server";
import { ensureUserProfile } from "../../../../lib/user-profile";
import {
  createOrderQuote,
  isOrderRequest,
  puntosRequeridosPorMonto,
} from "../../../../lib/order-request";

type PaymentRequest = {
  idempotencyKey: string;
  expectedTotal: number;
  paymentMethod: "MP" | "POINTS";
} & Parameters<typeof createOrderQuote>[0];

function isPaymentRequest(value: unknown): value is PaymentRequest {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return (
    isOrderRequest(value) &&
    typeof body.idempotencyKey === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.idempotencyKey,
    ) &&
    typeof body.expectedTotal === "number" &&
    Number.isFinite(body.expectedTotal) &&
    body.expectedTotal >= 0 &&
    (body.paymentMethod === "MP" || body.paymentMethod === "POINTS")
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function POST(request: Request) {
  let auth: Awaited<ReturnType<typeof getAuthenticatedSupabaseUser>>;
  try {
    auth = await getAuthenticatedSupabaseUser(request);
  } catch (error) {
    console.error("No se pudo validar la sesión para procesar el pago simulado.", error);
    return NextResponse.json(
      { error: "No pudimos validar tu sesión. Probá de nuevo." },
      { status: 503 },
    );
  }

  if (auth.error) {
    if (auth.status === 400 || auth.status === 401 || auth.status === 403) {
      return NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 });
    }
    console.error("No se pudo validar la sesión para procesar el pago simulado.", auth.error);
    return NextResponse.json(
      { error: "No pudimos validar tu sesión. Probá de nuevo." },
      { status: 503 },
    );
  }
  if (!auth.user) {
    return NextResponse.json({ error: "Iniciá sesión para continuar." }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isPaymentRequest(body)) {
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

    const result = await prisma.$transaction(async (tx) => {
      const previousOrder = await tx.pedido.findUnique({
        where: { claveIdempotencia: body.idempotencyKey },
        select: {
          id: true,
          idUsuario: true,
          montoTotal: true,
          puntosAdquiridos: true,
          medioPago: { select: { nombre: true } },
        },
      });
      if (previousOrder) {
        if (previousOrder.idUsuario !== auth.user.id) {
          return { kind: "key-conflict" as const };
        }

        const user = await tx.user.findUnique({
          where: { id: auth.user.id },
          select: { puntos: true },
        });
        if (!user) throw new Error("No encontramos el saldo de puntos de la cuenta.");

        const paidWithPoints = previousOrder.medioPago?.nombre === "Canje de puntos";
        return {
          kind: "paid" as const,
          id: previousOrder.id,
          total: previousOrder.montoTotal ?? 0,
          puntosAdquiridos: previousOrder.puntosAdquiridos,
          paymentMethod: paidWithPoints ? ("POINTS" as const) : ("MP" as const),
          puntosUsados: paidWithPoints
            ? puntosRequeridosPorMonto(previousOrder.montoTotal ?? 0)
            : 0,
          puntosRestantes: user.puntos,
        };
      }

      const products = await tx.product.findMany({
        where: { id: { in: body.items.map((item) => item.productId) } },
        select: { id: true, name: true, price: true },
      });
      const quote = createOrderQuote(body, products);
      if (!quote) return { kind: "unavailable" as const };
      if (quote.total !== body.expectedTotal) {
        return { kind: "price-changed" as const };
      }

      const puntosUsados =
        body.paymentMethod === "POINTS" ? puntosRequeridosPorMonto(quote.total) : 0;
      if (puntosUsados > 0) {
        const debit = await tx.user.updateMany({
          where: {
            id: auth.user.id,
            puntos: { gte: puntosUsados },
          },
          data: { puntos: { decrement: puntosUsados } },
        });
        if (debit.count === 0) {
          const user = await tx.user.findUnique({
            where: { id: auth.user.id },
            select: { puntos: true },
          });
          if (!user) throw new Error("No encontramos el saldo de puntos de la cuenta.");
          return {
            kind: "insufficient-points" as const,
            puntosDisponibles: user.puntos,
          };
        }
      }

      const medioPagoNombre =
        body.paymentMethod === "POINTS" ? "Canje de puntos" : "Mercado Pago";
      const [estadoPagado, medioPago] = await Promise.all([
        tx.estado.findUnique({
          where: { nombre: "Pagado" },
          select: { id: true },
        }),
        tx.medioPago.upsert({
          where: { nombre: medioPagoNombre },
          create: { nombre: medioPagoNombre },
          update: {},
          select: { id: true },
        }),
      ]);
      if (!estadoPagado || !medioPago) {
        throw new Error("Falta aplicar la migración de preparación de pagos simulados.");
      }

      const pedido = await tx.pedido.create({
        data: {
          claveIdempotencia: body.idempotencyKey,
          montoTotal: quote.total,
          puntosAdquiridos: body.paymentMethod === "POINTS" ? 0 : quote.puntosAdquiridos,
          cliente: body.customerName.trim(),
          telefono: profile.phone,
          modalidad: body.fulfillment,
          direccion: body.fulfillment === "DELIVERY" ? profile.address : null,
          notas: body.notes?.trim() || null,
          usuario: { connect: { id: auth.user.id } },
          estado: { connect: { id: estadoPagado.id } },
          medioPago: { connect: { id: medioPago.id } },
          detalles: {
            create: quote.items.map((item) => ({
              idProducto: item.productId,
              nombreProducto: item.name,
              precioUnitario: item.unitPrice,
              cantidad: item.quantity,
            })),
          },
          pagos: {
            create: { medioPago: { connect: { id: medioPago.id } } },
          },
        },
        select: { id: true },
      });

      let puntosRestantes: number;
      if (body.paymentMethod === "POINTS") {
        const user = await tx.user.findUnique({
          where: { id: auth.user.id },
          select: { puntos: true },
        });
        if (!user) throw new Error("No encontramos el saldo de puntos de la cuenta.");
        puntosRestantes = user.puntos;
      } else {
        const user = await tx.user.update({
          where: { id: auth.user.id },
          data: { puntos: { increment: quote.puntosAdquiridos } },
          select: { puntos: true },
        });
        puntosRestantes = user.puntos;
      }

      return {
        kind: "paid" as const,
        id: pedido.id,
        total: quote.total,
        puntosAdquiridos: body.paymentMethod === "POINTS" ? 0 : quote.puntosAdquiridos,
        paymentMethod: body.paymentMethod,
        puntosUsados,
        puntosRestantes,
      };
    });

    if (result.kind === "unavailable") {
      return NextResponse.json(
        { error: "Algún producto ya no está disponible. Actualizá el menú." },
        { status: 409 },
      );
    }
    if (result.kind === "price-changed") {
      return NextResponse.json(
        { error: "El precio cambió. Revisá el total antes de volver a pagar." },
        { status: 409 },
      );
    }
    if (result.kind === "key-conflict") {
      return NextResponse.json(
        { error: "No pudimos confirmar el pago. Volvé a preparar tu pedido." },
        { status: 409 },
      );
    }
    if (result.kind === "insufficient-points") {
      return NextResponse.json(
        {
          error: "Tu saldo cambió y ya no alcanza para pagar todo el pedido con puntos.",
          code: "INSUFFICIENT_POINTS",
          puntosDisponibles: result.puntosDisponibles,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      id: result.id,
      total: result.total,
      puntosAdquiridos: result.puntosAdquiridos,
      paymentMethod: result.paymentMethod,
      puntosUsados: result.puntosUsados,
      puntosRestantes: result.puntosRestantes,
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existingOrder = await prisma.pedido.findUnique({
        where: { claveIdempotencia: body.idempotencyKey },
        select: {
          id: true,
          idUsuario: true,
          montoTotal: true,
          puntosAdquiridos: true,
          medioPago: { select: { nombre: true } },
        },
      });
      if (existingOrder?.idUsuario === auth.user.id) {
        const user = await prisma.user.findUnique({
          where: { id: auth.user.id },
          select: { puntos: true },
        });
        if (!user) throw new Error("No encontramos el saldo de puntos de la cuenta.");
        const paidWithPoints = existingOrder.medioPago?.nombre === "Canje de puntos";
        return NextResponse.json({
          id: existingOrder.id,
          total: existingOrder.montoTotal ?? 0,
          puntosAdquiridos: existingOrder.puntosAdquiridos,
          paymentMethod: paidWithPoints ? "POINTS" : "MP",
          puntosUsados: paidWithPoints
            ? puntosRequeridosPorMonto(existingOrder.montoTotal ?? 0)
            : 0,
          puntosRestantes: user.puntos,
        });
      }
    }

    console.error("No se pudo completar el pago simulado.", error);
    return NextResponse.json(
      { error: "No pudimos procesar el pago. Probá de nuevo." },
      { status: 500 },
    );
  }
}
