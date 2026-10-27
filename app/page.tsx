import OrderPage from "../components/order-page";
import { prisma } from "../lib/prisma";

export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      imageUrl: true,
    },
  });

 const heroImageUrl = "https://xsptvqizcfwycdzbdvvh.supabase.co/storage/v1/object/public/Food/Burger-Food-PNG.png";

  return <OrderPage products={products} heroImageUrl={heroImageUrl} />;
}
