import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Falta configurar DATABASE_URL para cargar el menú.");
}

const storageBase =
  "https://xsptvqizcfwycdzbdvvh.supabase.co/storage/v1/object/public/Food/";
const images = {
  burger: `${storageBase}Burger-Food-PNG.png`,
  fries: `${storageBase}french-fries-with-ai-generated-free-png.webp`,
  soda: `${storageBase}manaos-colabyb1-39b9b22d17edc516ab15818258278577-1024-1024.png`,
};
const dashboardPreviewPrefix =
  "https://supabase.com/dashboard/project/xsptvqizcfwycdzbdvvh/storage/files/buckets/Food";

const products = [
  {
    name: "La Clásica",
    description: "Medallón de carne, cheddar, lechuga y nuestra salsa especial.",
    price: 8500,
    imageUrl: images.burger,
  },
  {
    name: "Doble Miga",
    description: "Doble carne, doble cheddar y cebolla caramelizada.",
    price: 11200,
    imageUrl: images.burger,
  },
  {
    name: "Crispy de pollo",
    description: "Pollo crocante, lechuga fresca y mayo de lima.",
    price: 9700,
    imageUrl: images.burger,
  },
  {
    name: "La veggie",
    description: "Medallón de garbanzos, palta y vegetales de estación.",
    price: 9200,
    imageUrl: images.burger,
  },
  {
    name: "Papas doradas",
    description: "Papas rústicas, doradas y con sal de romero.",
    price: 4200,
    imageUrl: images.fries,
  },
  {
    name: "Papas con cheddar",
    description: "Papas rústicas con cheddar fundido y verdeo.",
    price: 5900,
    imageUrl: images.fries,
  },
  {
    name: "Limonada de la casa",
    description: "Limón exprimido, menta fresca y un toque de jengibre.",
    price: 3200,
  },
  {
    name: "Gaseosa",
    description: "Lata de 354 ml, bien fría.",
    price: 2500,
    imageUrl: images.soda,
  },
];

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

try {
  const existingProducts = await prisma.product.count();

  if (existingProducts === 0) {
    await prisma.product.createMany({ data: products });
    console.log(`Menú inicial cargado: ${products.length} productos.`);
  } else {
    const previewProducts = await prisma.product.findMany({
      where: { imageUrl: { startsWith: dashboardPreviewPrefix } },
      select: { id: true, imageUrl: true },
    });

    for (const product of previewProducts) {
      if (!product.imageUrl) continue;
      const previewUrl = new URL(product.imageUrl);
      const fileName = previewUrl.searchParams.get("preview");
      if (!fileName) continue;

      await prisma.product.update({
        where: { id: product.id },
        data: {
          imageUrl: `${storageBase}${encodeURIComponent(fileName)}`,
        },
      });
    }

    for (const product of products) {
      if (!product.imageUrl) continue;
      await prisma.product.updateMany({
        where: { name: product.name, imageUrl: null },
        data: { imageUrl: product.imageUrl },
      });
    }
    console.log("Se completaron las imágenes faltantes y se normalizaron URLs de Storage.");
  }
} finally {
  await prisma.$disconnect();
}
