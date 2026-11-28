import { useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import { puntosRequeridosPorMonto } from "../lib/order-request";
import type { Product } from "./admin-products";

type Fulfillment = "PICKUP" | "DELIVERY";
type PaymentMethod = "MP" | "POINTS";
type CheckoutDraft = {
  customerName: string;
  fulfillment: Fulfillment;
  notes: string;
  items: { productId: string; quantity: number }[];
  idempotencyKey: string;
  expectedTotal: number;
};

type Props = {
  products: Product[];
  cart: Record<string, number>;
  itemCount: number;
  authLoading: boolean;
  isAuthenticated: boolean;
  checkoutReady: boolean;
  pointsBalance: number | null;
  pointsError: string;
  error: string;
  formatPrice: (price: number) => string;
  onChangeQuantity: (productId: string, delta: number) => void;
  onCheckoutReadyChange: (ready: boolean) => void;
  onErrorChange: (message: string) => void;
  onPointsBalanceChange: (balance: number) => void;
  onSessionExpired: () => void;
  onOrderPaid: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "MP" || value === "POINTS";
}

export default function OrderCheckout({
  products,
  cart,
  itemCount,
  authLoading,
  isAuthenticated,
  checkoutReady,
  pointsBalance,
  pointsError,
  error,
  formatPrice,
  onChangeQuantity,
  onCheckoutReadyChange,
  onErrorChange,
  onPointsBalanceChange,
  onSessionExpired,
  onOrderPaid,
}: Props) {
  const [fulfillment, setFulfillment] = useState<Fulfillment>("PICKUP");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraft | null>(null);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderPoints, setOrderPoints] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("MP");
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<PaymentMethod>("MP");
  const [pointsRedeemed, setPointsRedeemed] = useState(0);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const cartItems = products.filter((product) => cart[product.id]);
  const total = cartItems.reduce(
    (sum, product) => sum + product.price * cart[product.id],
    0,
  );
  const puntosRequeridos = puntosRequeridosPorMonto(orderTotal);
  const puedePagarConPuntos =
    puntosRequeridos > 0 && pointsBalance !== null && pointsBalance >= puntosRequeridos;

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    onErrorChange("");

    try {
      const { data, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        onSessionExpired();
        onErrorChange("Iniciá sesión para confirmar tu pedido.");
        return;
      }

      const checkout = {
        customerName,
        fulfillment,
        notes,
        items: cartItems.map((product) => ({
          productId: product.id,
          quantity: cart[product.id],
        })),
      };
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify(checkout),
      });
      const result: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        onErrorChange(
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "No pudimos calcular el pedido.",
        );
        return;
      }

      if (
        !isRecord(result) ||
        typeof result.total !== "number" ||
        typeof result.puntosAdquiridos !== "number"
      ) {
        throw new Error("La respuesta del pedido no es válida.");
      }

      setOrderTotal(result.total);
      setOrderPoints(result.puntosAdquiridos);
      setCheckoutDraft({
        ...checkout,
        idempotencyKey: crypto.randomUUID(),
        expectedTotal: result.total,
      });
      onCheckoutReadyChange(true);
    } catch {
      onErrorChange("No pudimos conectar con el local. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function payOrder() {
    if (!checkoutDraft || paymentSubmitting) return;
    setPaymentSubmitting(true);
    onErrorChange("");

    try {
      const { data, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        onSessionExpired();
        throw new Error("Iniciá sesión para continuar con el pago.");
      }

      const response = await fetch("/api/orders/payment", {
        method: "POST",
        body: JSON.stringify({ ...checkoutDraft, paymentMethod }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "No pudimos procesar el pago.";
        if (
          isRecord(result) &&
          result.code === "INSUFFICIENT_POINTS" &&
          typeof result.puntosDisponibles === "number"
        ) {
          onPointsBalanceChange(result.puntosDisponibles);
          setPaymentMethod("MP");
        } else if (response.status === 409) {
          onCheckoutReadyChange(false);
          setCheckoutDraft(null);
        }
        throw new Error(message);
      }

      if (
        !isRecord(result) ||
        (typeof result.id !== "number" && typeof result.id !== "string") ||
        typeof result.total !== "number" ||
        typeof result.puntosAdquiridos !== "number" ||
        !isPaymentMethod(result.paymentMethod) ||
        typeof result.puntosUsados !== "number" ||
        !Number.isInteger(result.puntosUsados) ||
        typeof result.puntosRestantes !== "number" ||
        !Number.isInteger(result.puntosRestantes)
      ) {
        throw new Error("La respuesta del pago no es válida.");
      }
      setOrderId(String(result.id));
      setOrderTotal(result.total);
      setOrderPoints(result.puntosAdquiridos);
      setOrderPaymentMethod(result.paymentMethod);
      setPointsRedeemed(result.puntosUsados);
      onPointsBalanceChange(result.puntosRestantes);
      onCheckoutReadyChange(false);
      setCheckoutDraft(null);
      onOrderPaid();
    } catch (paymentError) {
      onErrorChange(
        paymentError instanceof Error
          ? paymentError.message
          : "No pudimos procesar el pago. Probá de nuevo.",
      );
    } finally {
      setPaymentSubmitting(false);
    }
  }

  function goBackToCheckout() {
    onCheckoutReadyChange(false);
    setCheckoutDraft(null);
    onErrorChange("");
  }

  return (
    <aside className="order-panel" id="tu-pedido">
      <div className="order-panel-heading">
        <div>
          <h2>Tu pedido <span className="order-count">{itemCount}</span></h2>
        </div>
        <span className="bag-icon" aria-hidden="true">↗</span>
      </div>

      {orderId ? (
        <div className="success-panel" role="status">
          <span className="success-icon">✓</span>
          <h3>¡Pago aprobado!</h3>
          <p>
            {orderPaymentMethod === "POINTS"
              ? `Tu pedido está confirmado. Usaste ${pointsRedeemed} puntos; no sumaste puntos con este pago.`
              : `Tu pedido ya está confirmado y sumaste ${orderPoints} puntos.`}
          </p>
          <span className="order-number">N.º {orderId.slice(0, 8).toUpperCase()}</span>
          <button
            className="text-button"
            onClick={() => {
              setOrderId("");
              onErrorChange("");
            }}
            type="button"
          >
            Hacer otro pedido
          </button>
        </div>
      ) : checkoutReady ? (
        <div className="success-panel payment-panel">
          <span className="payment-label">
            {paymentMethod === "POINTS" ? "Canje de puntos" : ""}
          </span>
          <h3>Tu pedido está listo para pagar</h3>
          <p>
            {paymentMethod === "POINTS"
              ? `Al confirmar, se descontarán ${puntosRequeridos.toLocaleString("es-AR")} puntos.`
              : ""}
          </p>
          <div className="payment-summary">
            <span>{paymentMethod === "POINTS" ? "Total del pedido" : "Total a pagar"}</span>
            <strong>{formatPrice(orderTotal)}</strong>
          </div>
          <fieldset className="payment-options">
            <legend>Forma de pago</legend>
            <label className={`payment-option${paymentMethod === "MP" ? " selected" : ""}`}>
              <input
                checked={paymentMethod === "MP"}
                name="paymentMethod"
                onChange={() => setPaymentMethod("MP")}
                type="radio"
              />
              <span>
                <strong>Mercado Pago</strong>
                <small>Al pagar vas a sumar {orderPoints} puntos.</small>
              </span>
            </label>
            <label
              className={`payment-option${paymentMethod === "POINTS" ? " selected" : ""}${puedePagarConPuntos ? "" : " disabled"}`}
            >
              <input
                checked={paymentMethod === "POINTS"}
                disabled={!puedePagarConPuntos}
                name="paymentMethod"
                onChange={() => setPaymentMethod("POINTS")}
                type="radio"
              />
              <span>
                <strong>Pagar con puntos</strong>
                <small>
                  {pointsBalance === null
                    ? pointsError || "Consultando saldo..."
                    : `1 punto = $1 · saldo ${pointsBalance.toLocaleString("es-AR")} · necesitás ${puntosRequeridos.toLocaleString("es-AR")}`}
                </small>
              </span>
            </label>
          </fieldset>
          {pointsError && <p className="form-error" role="alert">{pointsError}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button
            className="payment-back-button"
            disabled={paymentSubmitting}
            onClick={goBackToCheckout}
            type="button"
          >
            <span aria-hidden="true">←</span>
            Volver al pedido
          </button>
          <button
            className="submit-order"
            disabled={paymentSubmitting || (paymentMethod === "POINTS" && !puedePagarConPuntos)}
            onClick={() => void payOrder()}
            type="button"
          >
            {paymentSubmitting
              ? "Procesando pago..."
              : paymentMethod === "POINTS" ? "Confirmar con puntos" : "Realizar pago"}
            {!paymentSubmitting && <span aria-hidden="true">→</span>}
          </button>
        </div>
      ) : (
        <>
          {cartItems.length === 0 ? (
            <div className="cart-empty">
              <svg className="cart-empty-icon" aria-hidden="true" viewBox="0 0 32 32" fill="none">
                <path d="M7 11h18l1.5 17h-21L7 11Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M12 12V8a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p>Pedí tu comida en dos clics!</p>
              <span>Sumá algo del menú para empezar.</span>
            </div>
          ) : (
            <ul className="cart-list">
              {cartItems.map((product) => (
                <li className="cart-item" key={product.id}>
                  {product.imageUrl ? (
                    <img className="cart-item-image" src={product.imageUrl} alt="" />
                  ) : (
                    <span className="cart-item-image-placeholder" aria-hidden="true" />
                  )}
                  <div className="cart-item-copy">
                    <strong>{product.name}</strong>
                    <span>{formatPrice(product.price * cart[product.id])}</span>
                  </div>
                  <div className="quantity-control" aria-label={`Cantidad de ${product.name}`}>
                    <button onClick={() => onChangeQuantity(product.id, -1)} type="button" aria-label="Quitar uno">−</button>
                    <span>{cart[product.id]}</span>
                    <button onClick={() => onChangeQuantity(product.id, 1)} type="button" aria-label="Agregar uno">＋</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {authLoading ? (
            <p className="secure-note">Verificando tu cuenta...</p>
          ) : !isAuthenticated ? (
            <div className="cart-empty">
              {error && <p className="form-error" role="alert">{error}</p>}
              <p>Iniciá sesión para confirmar tu pedido.</p>
            </div>
          ) : (
            <form className="checkout-form" onSubmit={placeOrder}>
              <fieldset className="fulfillment-options">
                <legend>¿Cómo lo querés?</legend>
                <button
                  className={fulfillment === "PICKUP" ? "fulfillment-option active" : "fulfillment-option"}
                  onClick={() => setFulfillment("PICKUP")}
                  type="button"
                >
                  Paso a buscar
                </button>
                <button
                  className={fulfillment === "DELIVERY" ? "fulfillment-option active" : "fulfillment-option"}
                  onClick={() => setFulfillment("DELIVERY")}
                  type="button"
                >
                  Envío
                </button>
              </fieldset>

              <label className="field-label">
                Tu nombre
                <input
                  autoComplete="name"
                  maxLength={80}
                  minLength={2}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="¿Cómo te llamás?"
                  required
                  value={customerName}
                />
              </label>
              <label className="field-label">
                Nota para el local <span className="optional">(opcional)</span>
                <textarea
                  maxLength={300}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Algún detalle que debamos saber..."
                  rows={2}
                  value={notes}
                />
              </label>

              {error && <p className="form-error" role="alert">{error}</p>}

              <div className="order-total">
                <span>Total</span>
                <strong>{formatPrice(total)}</strong>
              </div>
              <button className="submit-order" disabled={itemCount === 0 || submitting} type="submit">
                {submitting ? "Calculando total..." : "Continuar al pago"}
                {!submitting && <span aria-hidden="true">→</span>}
              </button>
              <p className="secure-note">El pedido se guardará únicamente al confirmar el pago.</p>
            </form>
          )}
        </>
      )}
    </aside>
  );
}
