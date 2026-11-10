import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { getAuthenticatedSupabaseUser } from "../../../../lib/supabase-server";

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

async function authorizeAdmin(request: Request) {
  let auth: Awaited<ReturnType<typeof getAuthenticatedSupabaseUser>>;
  try {
    auth = await getAuthenticatedSupabaseUser(request);
  } catch (error) {
    console.error("No se pudo validar la sesión para administrar productos.", error);
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
    console.error("No se pudo validar la sesión para administrar productos.", auth.error);
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
        response: NextResponse.json({ error: "No tenés permisos para administrar productos." }, { status: 403 }),
      };
    }
    return { userId: auth.user.id };
  } catch (error) {
    console.error("No se pudo verificar el rol para administrar productos.", error);
    return {
      response: NextResponse.json(
        { error: "No pudimos verificar tus permisos. Probá de nuevo." },
        { status: 500 },
      ),
    };
  }
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
  const authorization = await authorizeAdmin(request);
  if ("response" in authorization) return authorization.response;
  return NextResponse.json({ isAdmin: true });
}

export async function POST(request: Request) {
  const authorization = await authorizeAdmin(request);
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
  const authorization = await authorizeAdmin(request);
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
  const authorization = await authorizeAdmin(request);
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
