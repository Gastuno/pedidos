"use client";

import { useState } from "react";
import AuthButton from "./auth-button";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
};

type Props = { products: Product[]; heroImageUrl: string | null };
type Fulfillment = "PICKUP" | "DELIVERY";

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default function OrderPage({ products, heroImageUrl }: Props) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [fulfillment, setFulfillment] = useState<Fulfillment>("PICKUP");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");

  const cartItems = products.filter((product) => cart[product.id]);
  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
  const total = cartItems.reduce(
    (sum, product) => sum + product.price * cart[product.id],
    0,
  );

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
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          phone,
          fulfillment,
          ...(fulfillment === "DELIVERY" ? { address } : {}),
          notes,
          items: cartItems.map((product) => ({
            productId: product.id,
            quantity: cart[product.id],
          })),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "No pudimos enviar tu pedido.");
        return;
      }

      setOrderId(String(result.id));
      setCart({});
    } catch {
      setError("No pudimos conectar con el local. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#" aria-label="Pedivos, inicio">
          <span className="brand-mark">P</span>
          <span>pedivos<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-note">
          <span className="status-dot" />
          <span>Hecho en el momento</span>
        </div>
        <AuthButton
          cartButton={
            <a className="top-cart" href="#tu-pedido" aria-label={`Ver pedido, ${itemCount} productos`}>
              <svg className="shopping-bag-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
                <path d="M5 8h14l1 13H4L5 8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M9 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span className="top-cart-count">{itemCount}</span>
            </a>
          }
        />
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> BUENAS COSAS, SIN VUELTAS</span>
          <h1>Tu próximo<br /><span>favorito</span> está acá.</h1>
          <p>Comida rica, hecha con cariño y lista para compartir. Elegí lo tuyo.</p>
          <a className="hero-cta" href="#menu">Ver el menú <span aria-hidden="true">↓</span></a>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-sun" />
          {heroImageUrl && <img className="hero-image" src={heroImageUrl} alt="" />}
          <span className="hero-spark spark-one">✳</span>
          <span className="hero-spark spark-two">✦</span>
          <span className="hero-label">fresco<br />y rico</span>
        </div>
        <div className="hero-bottom">
          <span>DESLIZÁ Y ELEGÍ</span><span className="hero-line" /><span>01 — 03</span>
        </div>
      </section>

      <section className="menu-layout" id="menu">
        <div className="menu-main">
          <div className="section-heading">
            <div>
              <span className="eyebrow">EL MENÚ</span>
              <h2>¿Qué se te antoja?</h2>
            </div>
            <span className="menu-count">{products.length} cosas ricas</span>
          </div>

          {products.length === 0 ? (
            <div className="empty-menu">
              <h3>Estamos preparando el menú</h3>
              <p>En un ratito vas a poder pedir tus favoritos.</p>
            </div>
          ) : (
            <div className="product-grid">
              {products.map((product, index) => (
                <article className="product-card" key={product.id}>
                  <div className={`product-visual visual-${index % 4}`}>
                    {product.imageUrl ? (
                      <img className="product-image" src={product.imageUrl} alt={product.name} />
                    ) : (
                      <span className="image-placeholder">Sin imagen</span>
                    )}
                    <span className="product-category">Del menú</span>
                  </div>
                  <div className="product-info">
                    <div className="product-title-row">
                      <h3>{product.name}</h3>
                      <span className="product-price">{money.format(product.price)}</span>
                    </div>
                    {product.description && <p>{product.description}</p>}
                    <button
                      className={`add-button${cart[product.id] ? " has-quantity" : ""}`}
                      onClick={() => changeQuantity(product.id, 1)}
                      type="button"
                      aria-label={`Agregar ${product.name} al pedido`}
                    >
                      {cart[product.id] ? `Agregar otro · ${cart[product.id]} en tu pedido` : "＋ Agregar"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="order-panel" id="tu-pedido">
          <div className="order-panel-heading">
            <div>
              <span className="eyebrow">CASI TUYO</span>
              <h2>Tu pedido <span className="order-count">{itemCount}</span></h2>
            </div>
            <span className="bag-icon" aria-hidden="true">↗</span>
          </div>

          {orderId ? (
            <div className="success-panel" role="status">
              <span className="success-icon">✓</span>
              <h3>¡Pedido recibido!</h3>
              <p>Ya lo estamos preparando. Guardá el número para consultar en el local.</p>
              <span className="order-number">N.º {orderId.slice(0, 8).toUpperCase()}</span>
              <button className="text-button" onClick={() => setOrderId("")} type="button">
                Hacer otro pedido
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
                  <p>Tu bolsa está esperando algo rico.</p>
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
                  Teléfono
                  <input
                    autoComplete="tel"
                    maxLength={24}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="Para avisarte cuando esté"
                    required
                    type="tel"
                    value={phone}
                  />
                </label>
                {fulfillment === "DELIVERY" && (
                  <label className="field-label">
                    Dirección de entrega
                    <input
                      autoComplete="street-address"
                      maxLength={200}
                      minLength={5}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="Calle, número y barrio"
                      required
                      value={address}
                    />
                  </label>
                )}
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
                  {submitting ? "Enviando pedido..." : "Confirmar pedido"}
                  {!submitting && <span aria-hidden="true">→</span>}
                </button>
                <p className="secure-note"><span>✦</span> Tu pedido se confirma al enviarlo al local.</p>
              </form>
            </>
          )}
        </aside>
      </section>

      <footer className="site-footer">
        <a className="brand footer-brand" href="#" aria-label="Pedivos, inicio">
          <span className="brand-mark">P</span><span>pedivos<span className="brand-period">.</span></span>
        </a>
        <span>Hecho con cariño. Y con hambre.</span>
        <span className="footer-year">© Pedivos 2026</span>
      </footer>
    </main>
  );
}
