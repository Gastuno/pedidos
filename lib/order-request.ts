export type OrderRequest = {
  customerName: string;
  fulfillment: "PICKUP" | "DELIVERY";
  notes?: string;
  items: { productId: string; quantity: number }[];
};

export type OrderItem = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

type ProductForOrder = { id: string; name: string; price: number };

const PESOS_POR_PUNTO_GANADO = 100;
const PUNTOS_POR_PESO_CANJE = 1;

export function puntosRequeridosPorMonto(monto: number) {
  return Math.round(monto * PUNTOS_POR_PESO_CANJE);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isOrderRequest(value: unknown): value is OrderRequest {
  if (!isRecord(value)) return false;

  if (
    typeof value.customerName !== "string" ||
    value.customerName.trim().length < 2 ||
    value.customerName.trim().length > 80 ||
    (value.fulfillment !== "PICKUP" && value.fulfillment !== "DELIVERY") ||
    (value.notes !== undefined &&
      (typeof value.notes !== "string" || value.notes.length > 300)) ||
    !Array.isArray(value.items) ||
    value.items.length === 0 ||
    value.items.length > 20
  ) {
    return false;
  }

  const ids = new Set<string>();
  return value.items.every((item: unknown) => {
    if (!isRecord(item)) return false;
    if (
      typeof item.productId !== "string" ||
      item.productId.length > 50 ||
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99 ||
      ids.has(item.productId)
    ) {
      return false;
    }
    ids.add(item.productId);
    return true;
  });
}

export function createOrderQuote(
  request: OrderRequest,
  products: ProductForOrder[],
) {
  if (products.length !== request.items.length) return null;

  const productById = new Map(products.map((product) => [product.id, product]));
  const orderItems: OrderItem[] = [];
  for (const item of request.items) {
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
  return {
    items: orderItems,
    total,
    puntosAdquiridos: Math.floor(total / PESOS_POR_PUNTO_GANADO),
  };
}
