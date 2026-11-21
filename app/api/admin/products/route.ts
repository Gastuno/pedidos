import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { authorizeAdmin } from "../../../../lib/admin-auth";

type ProductInput = {
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProductInput(value: unknown): value is ProductInput {
  if (!isRecord(value)) return false;
  const { name, description, price, imageUrl } = value;
  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 100 ||
    (description !== null &&
      (typeof description !== "string" || description.length > 500)) ||
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    price < 0 ||
    (imageUrl !== null && typeof imageUrl !== "string")
  ) {
    return false;
  }

  if (typeof imageUrl === "string" && imageUrl.length > 2048) return false;
  if (typeof imageUrl === "string" && imageUrl.trim()) {
    try {
      const url = new URL(imageUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    } catch {
      return false;
    }
  }

  return true;
}

function productData(input: ProductInput) {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    price: input.price,
    imageUrl: input.imageUrl?.trim() || null,
  };
}

export async function GET(request: Request) {
  const authorization = await authorizeAdmin(request, "administrar productos");
  if ("response" in authorization) return authorization.response;
  return NextResponse.json({ isAdmin: true });
}

export async function POST(request: Request) {
  const authorization = await authorizeAdmin(request, "administrar productos");
  if ("response" in authorization) return authorization.response;

  const body: unknown = await request.json().catch(() => null);
  if (!isProductInput(body)) {
    return NextResponse.json({ error: "Revisá los datos del producto e intentá de nuevo." }, { status: 400 });
  }

  try {
    const product = await prisma.product.create({ data: productData(body) });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("No se pudo crear el producto.", error);
    return NextResponse.json({ error: "No pudimos guardar el producto. Probá de nuevo." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorizeAdmin(request, "administrar productos");
  if ("response" in authorization) return authorization.response;

  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Revisá los datos del producto e intentá de nuevo." }, { status: 400 });
  }
  const productId = body.id;
  if (!isProductInput(body)) {
    return NextResponse.json({ error: "Revisá los datos del producto e intentá de nuevo." }, { status: 400 });
  }

  try {
    const product = await prisma.product.update({
      where: { id: productId },
      data: productData(body),
    });
    return NextResponse.json(product);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "No encontramos ese producto." }, { status: 404 });
    }
    console.error("No se pudo actualizar el producto.", error);
    return NextResponse.json({ error: "No pudimos guardar el producto. Probá de nuevo." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const authorization = await authorizeAdmin(request, "administrar productos");
  if ("response" in authorization) return authorization.response;

  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "No encontramos ese producto." }, { status: 400 });
  }

  try {
    await prisma.product.delete({ where: { id: body.id } });
    return NextResponse.json({ id: body.id });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "No encontramos ese producto." }, { status: 404 });
    }
    console.error("No se pudo eliminar el producto.", error);
    return NextResponse.json({ error: "No pudimos eliminar el producto. Probá de nuevo." }, { status: 500 });
  }
}
