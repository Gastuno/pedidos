import type { User } from "@supabase/supabase-js";
import { prisma } from "./prisma";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function ensureUserProfile(user: User) {
  const existingUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { nombre: true, apellido: true, phone: true, address: true },
  });
  if (existingUser?.nombre && existingUser.apellido && existingUser.phone && existingUser.address) {
    return existingUser;
  }

  const metadata: unknown = user.user_metadata;
  const nombre = isRecord(metadata) ? metadata.nombre : null;
  const apellido = isRecord(metadata) ? metadata.apellido : null;
  const phone = isRecord(metadata) ? metadata.phone : null;
  const address = isRecord(metadata) ? metadata.address : null;
  if (
    typeof user.email !== "string" ||
    typeof nombre !== "string" ||
    nombre.trim().length < 2 ||
    nombre.trim().length > 100 ||
    typeof apellido !== "string" ||
    apellido.trim().length < 2 ||
    apellido.trim().length > 100 ||
    typeof phone !== "string" ||
    !/^[+0-9()\s.-]{6,24}$/.test(phone.trim()) ||
    typeof address !== "string" ||
    address.trim().length < 5 ||
    address.trim().length > 200
  ) {
    return existingUser;
  }

  return prisma.user.upsert({
    where: { email: user.email },
    create: {
      id: user.id,
      email: user.email,
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      phone: phone.trim(),
      address: address.trim(),
    },
    update: {
      id: user.id,
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      phone: phone.trim(),
      address: address.trim(),
    },
    select: { nombre: true, apellido: true, phone: true, address: true },
  });
}
