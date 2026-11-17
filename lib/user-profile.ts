import type { User } from "@supabase/supabase-js";
import { prisma } from "./prisma";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function ensureUserProfile(user: User) {
  const existingUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { phone: true, address: true },
  });
  if (existingUser?.phone && existingUser.address) return existingUser;

  const metadata: unknown = user.user_metadata;
  const phone = isRecord(metadata) ? metadata.phone : null;
  const address = isRecord(metadata) ? metadata.address : null;
  if (
    typeof user.email !== "string" ||
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
      phone: phone.trim(),
      address: address.trim(),
    },
    update: {
      id: user.id,
      phone: phone.trim(),
      address: address.trim(),
    },
    select: { phone: true, address: true },
  });
}
