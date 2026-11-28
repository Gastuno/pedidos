"use client";

import { useEffect, useState } from "react";
import AuthButton from "./auth-button";
import AdminProducts, { type Product } from "./admin-products";
import ProductMenu from "./product-menu";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";
import { puntosRequeridosPorMonto } from "../lib/order-request";

type Props = { products: Product[]; heroImageUrl: string | null; adminMode?: boolean };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "MP" || value === "POINTS";
}

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default function OrderPage({ products, heroImageUrl, adminMode = false }: Props) {
  const [menuProducts, setMenuProducts] = useState(products);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [fulfillment, setFulfillment] = useState<Fulfillment>("PICKUP");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [checkoutDraft, setCheckoutDraft] = useState<CheckoutDraft | null>(null);
  const [orderTotal, setOrderTotal] = useState(0);
  const [orderPoints, setOrderPoints] = useState(0);
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);
  const [pointsError, setPointsError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("MP");
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<PaymentMethod>("MP");
  const [pointsRedeemed, setPointsRedeemed] = useState(0);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    let adminCheckId = 0;
    let pointsCheckId = 0;
    let unsubscribe = () => {};

    async function loadPoints(accessToken: string | null) {
      const currentCheckId = ++pointsCheckId;
      setPointsError("");
      if (!accessToken) {
        setPointsBalance(null);
        return;
      }

      try {
        const response = await fetch("/api/profile", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result: unknown = await response.json().catch(() => null);
        if (!active || currentCheckId !== pointsCheckId) return;
        if (
          !response.ok ||
          !isRecord(result) ||
          typeof result.puntos !== "number" ||
          !Number.isInteger(result.puntos) ||
          result.puntos < 0
        ) {
          const message =
            isRecord(result) && typeof result.error === "string"
              ? result.error
              : "No se pudo consultar tu saldo de puntos.";
          throw new Error(message);
        }
        setPointsBalance(result.puntos);
      } catch (pointsLoadError) {
        if (!active || currentCheckId !== pointsCheckId) return;
        setPointsBalance(null);
        setPointsError(
          pointsLoadError instanceof Error
            ? pointsLoadError.message
            : "No se pudo consultar tu saldo de puntos.",
        );
      }
    }

    async function checkAdmin(accessToken: string | null) {
      const currentCheckId = ++adminCheckId;
      setIsAdmin(false);
      setAdminError("");
      if (!accessToken) return;

      try {
        const response = await fetch("/api/admin/products", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!active || currentCheckId !== adminCheckId) return;
        if (response.status === 401 || response.status === 403) return;
        const result: unknown = await response.json().catch(() => null);
        if (!active || currentCheckId !== adminCheckId) return;
        if (!response.ok) {
          const message =
            typeof result === "object" &&
            result !== null &&
            "error" in result &&
            typeof result.error === "string"
              ? result.error
              : "No se pudieron verificar tus permisos de administración.";
          throw new Error(message);
        }
        setIsAdmin(
          typeof result === "object" &&
            result !== null &&
            "isAdmin" in result &&
            result.isAdmin === true,
        );
      } catch (adminCheckError) {
        if (!active || currentCheckId !== adminCheckId) return;
        setAdminError(
          adminCheckError instanceof Error
            ? adminCheckError.message
            : "No se pudieron verificar tus permisos de administración.",
        );
      }
    }

    try {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) setError(sessionError.message);
        setIsAuthenticated(Boolean(data.session));
        void checkAdmin(data.session?.access_token ?? null);
        void loadPoints(data.session?.access_token ?? null);
        setAuthLoading(false);
      }).catch((sessionError: unknown) => {
        if (!active) return;
        setError(sessionError instanceof Error ? sessionError.message : "No se pudo verificar tu sesión.");
        setAuthLoading(false);
      });

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsAuthenticated(Boolean(session));
        void checkAdmin(session?.access_token ?? null);
        void loadPoints(session?.access_token ?? null);
        setAuthLoading(false);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch (clientError) {
      setError(clientError instanceof Error ? clientError.message : "No se pudo verificar tu sesión.");
      setAuthLoading(false);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const cartItems = menuProducts.filter((product) => cart[product.id]);
  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const total = cartItems.reduce(
    (sum, product) => sum + product.price * cart[product.id],
    0,
  );
  const puntosRequeridos = puntosRequeridosPorMonto(orderTotal);
  const puedePagarConPuntos =
    puntosRequeridos > 0 && pointsBalance !== null && pointsBalance >= puntosRequeridos;

  function changeQuantity(productId: string, delta: number) {
    setCart((current) => {
      const quantity = (current[productId] ?? 0) + delta;
      if (quantity <= 0) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: quantity };
    });
  }

  async function placeOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const { data, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        setIsAuthenticated(false);
        setError("Iniciá sesión para confirmar tu pedido.");
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
        setError(
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
      setCheckoutReady(true);
    } catch {
      setError("No pudimos conectar con el local. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  async function payOrder() {
    if (!checkoutDraft || paymentSubmitting) return;
    setPaymentSubmitting(true);
    setError("");

    try {
      const { data, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        setIsAuthenticated(false);
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
          setPointsBalance(result.puntosDisponibles);
          setPaymentMethod("MP");
        } else if (response.status === 409) {
          setCheckoutReady(false);
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
      setPointsBalance(result.puntosRestantes);
      setCheckoutReady(false);
      setCheckoutDraft(null);
      setCart({});
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "No pudimos procesar el pago. Probá de nuevo.",
      );
    } finally {
      setPaymentSubmitting(false);
    }
  }

  function goBackToCheckout() {
    setCheckoutReady(false);
    setCheckoutDraft(null);
    setError("");
  }

  if (adminMode) {
    return (
      <main>
        <header className="topbar">
          <a className="brand" href="/" aria-label="Pedivos, inicio">
            <span className="brand-mark">P</span>
            <span>pedivos<span className="brand-period">.</span></span>
          </a>
          <div className="topbar-actions">
            <a className="admin-nav-link" href="/admin/orders">Ver pedidos</a>
            <a className="admin-nav-link" href="/">Volver a la tienda</a>
            <AuthButton onSignedOut={() => window.location.assign("/")} />
          </div>
        </header>

        <AdminProducts
          products={menuProducts}
          authLoading={authLoading}
          isAuthenticated={isAuthenticated}
          isAdmin={isAdmin}
          adminError={adminError}
          formatPrice={(price) => money.format(price)}
          updateProducts={setMenuProducts}
          onProductDeleted={(productId) => {
            setCart((current) => {
              const next = { ...current };
              delete next[productId];
              return next;
            });
          }}
          onSessionExpired={() => {
            setIsAuthenticated(false);
            setIsAdmin(false);
          }}
        />
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#" aria-label="Pedivos, inicio">
          <span className="brand-mark">P</span>
          <span>pedivos<span className="brand-period">.</span></span>
        </a>
        <AuthButton
          adminLink={isAdmin}
          cartButton={
            <>
              {isAuthenticated && (
                <span
                  className="top-points-counter"
                  aria-label={
                    pointsBalance === null
                      ? "Saldo de puntos no disponible"
                      : `${pointsBalance} puntos disponibles`
                  }
                  title={pointsError || "Puntos disponibles"}
                >
                  Puntos {pointsBalance === null ? "—" : pointsBalance.toLocaleString("es-AR")}
                </span>
              )}
              <a className="top-cart" href="#tu-pedido" aria-label={`Ver pedido, ${itemCount} productos`}>
                <svg className="shopping-bag-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
                  <path d="M5 8h14l1 13H4L5 8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  <path d="M9 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <span className="top-cart-count">{itemCount}</span>
              </a>
            </>
          }
        />
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1>Tu próximo<br /><span>favorito</span> está acá.</h1>
          <p>Comida rica, al momento.</p>
          <a className="hero-cta" href="#menu">Ver el menú <span aria-hidden="true">↓</span></a>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-sun" />
          {heroImageUrl && <img className="hero-image" src={heroImageUrl} alt="" />}
          <span className="hero-label">fresco<br />y rico</span>
        </div>
      </section>

      <section className="menu-layout" id="menu">
        <ProductMenu
          products={menuProducts}
          cart={cart}
          checkoutReady={checkoutReady}
          formatPrice={(price) => money.format(price)}
          onChangeQuantity={changeQuantity}
        />

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
                  setError("");
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
                <strong>{money.format(orderTotal)}</strong>
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
                        <span>{money.format(product.price * cart[product.id])}</span>
                      </div>
                      <div className="quantity-control" aria-label={`Cantidad de ${product.name}`}>
                        <button onClick={() => changeQuantity(product.id, -1)} type="button" aria-label="Quitar uno">−</button>
                        <span>{cart[product.id]}</span>
                        <button onClick={() => changeQuantity(product.id, 1)} type="button" aria-label="Agregar uno">＋</button>
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
                    <strong>{money.format(total)}</strong>
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
      </section>
    </main>
  );
}
