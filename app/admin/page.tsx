import OrderPage from "../../components/order-page";
import { prisma } from "../../lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
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

  return <OrderPage products={products} heroImageUrl={null} adminMode />;
}
