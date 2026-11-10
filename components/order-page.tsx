"use client";

import { useEffect, useRef, useState } from "react";
import AuthButton from "./auth-button";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
};

type ProductForm = {
  name: string;
  description: string;
  price: string;
  imageUrl: string;
};

type Props = { products: Product[]; heroImageUrl: string | null };
type Fulfillment = "PICKUP" | "DELIVERY";

const emptyProductForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  imageUrl: "",
};

function isProduct(value: unknown): value is Product {
  if (!isRecord(value)) return false;
  const product = value;
  return (
    typeof product.id === "string" &&
    typeof product.name === "string" &&
    (typeof product.description === "string" || product.description === null) &&
    typeof product.price === "number" &&
    Number.isFinite(product.price) &&
    (typeof product.imageUrl === "string" || product.imageUrl === null)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default function OrderPage({ products, heroImageUrl }: Props) {
  const [menuProducts, setMenuProducts] = useState(products);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [fulfillment, setFulfillment] = useState<Fulfillment>("PICKUP");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [productEditorOpen, setProductEditorOpen] = useState(false);
  const [productEditorScrollRequest, setProductEditorScrollRequest] = useState(0);
  const productEditorRef = useRef<HTMLFormElement>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productError, setProductError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");

  useEffect(() => {
    let active = true;
    let adminCheckId = 0;
    let unsubscribe = () => {};

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
        setAuthLoading(false);
      }).catch((sessionError: unknown) => {
        if (!active) return;
        setError(sessionError instanceof Error ? sessionError.message : "No se pudo verificar tu sesión.");
        setAuthLoading(false);
      });

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsAuthenticated(Boolean(session));
        void checkAdmin(session?.access_token ?? null);
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

  useEffect(() => {
    if (productEditorOpen && productEditorScrollRequest > 0) {
      productEditorRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }, [productEditorOpen, productEditorScrollRequest]);

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

  function openProductEditor(product: Product | null = null) {
    setEditingProduct(product);
    setProductForm(
      product
        ? {
            name: product.name,
            description: product.description ?? "",
            price: String(product.price),
            imageUrl: product.imageUrl ?? "",
          }
        : emptyProductForm,
    );
    setProductError("");
    setProductEditorOpen(true);
    setProductEditorScrollRequest((request) => request + 1);
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProduct(true);
    setProductError("");

    try {
      const { data, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        setIsAuthenticated(false);
        setIsAdmin(false);
        throw new Error("Iniciá sesión para administrar productos.");
      }

      const response = await fetch("/api/admin/products", {
        method: editingProduct ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({
          ...(editingProduct ? { id: editingProduct.id } : {}),
          name: productForm.name,
          description: productForm.description,
          price: Number(productForm.price),
          imageUrl: productForm.imageUrl,
        }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "No pudimos guardar el producto.";
        throw new Error(message);
      }

      if (!isProduct(result)) throw new Error("La respuesta del producto no es válida.");
      const savedProduct = result;
      setMenuProducts((current) =>
        editingProduct
          ? current.map((product) => product.id === savedProduct.id ? savedProduct : product)
          : [...current, savedProduct].sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
      setProductEditorOpen(false);
      setEditingProduct(null);
      setProductForm(emptyProductForm);
    } catch (saveError) {
      setProductError(
        saveError instanceof Error ? saveError.message : "No pudimos guardar el producto.",
      );
    } finally {
      setSavingProduct(false);
    }
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

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({
          customerName,
          fulfillment,
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
        <div className="menu-main">
          <div className="section-heading">
            <div>
              <span className="eyebrow">EL MENÚ</span>
              <h2>¿Qué se te antoja?</h2>
            </div>
            <span className="menu-count">{menuProducts.length} cosas ricas</span>
          </div>

          {adminError && <p className="form-error admin-error" role="alert">{adminError}</p>}

          {isAdmin && (
            <div className="product-management">
              <button
                className="admin-product-button"
                onClick={() => openProductEditor()}
                type="button"
              >
                ＋ Agregar producto
              </button>
              {productEditorOpen && (
                <form className="product-editor" onSubmit={saveProduct} ref={productEditorRef}>
                  <h3>{editingProduct ? "Editar producto" : "Nuevo producto"}</h3>
                  <label className="field-label">
                    Nombre
                    <input
                      autoComplete="off"
                      maxLength={100}
                      minLength={2}
                      onChange={(event) => setProductForm({ ...productForm, name: event.target.value })}
                      required
                      value={productForm.name}
                    />
                  </label>
                  <label className="field-label">
                    Descripción <span className="optional">(opcional)</span>
                    <textarea
                      maxLength={500}
                      onChange={(event) => setProductForm({ ...productForm, description: event.target.value })}
                      rows={3}
                      value={productForm.description}
                    />
                  </label>
                  <label className="field-label">
                    Precio
                    <input
                      inputMode="decimal"
                      min="0"
                      onChange={(event) => setProductForm({ ...productForm, price: event.target.value })}
                      required
                      step="0.01"
                      type="number"
                      value={productForm.price}
                    />
                  </label>
                  <label className="field-label">
                    URL de imagen <span className="optional">(opcional)</span>
                    <input
                      maxLength={2048}
                      onChange={(event) => setProductForm({ ...productForm, imageUrl: event.target.value })}
                      type="url"
                      value={productForm.imageUrl}
                    />
                  </label>
                  {productError && <p className="form-error" role="alert">{productError}</p>}
                  <div className="product-editor-actions">
                    <button className="admin-product-button" disabled={savingProduct} type="submit">
                      {savingProduct ? "Guardando..." : "Guardar producto"}
                    </button>
                    <button
                      className="product-cancel-button"
                      disabled={savingProduct}
                      onClick={() => setProductEditorOpen(false)}
                      type="button"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {menuProducts.length === 0 ? (
            <div className="empty-menu">
              <h3>Estamos preparando el menú</h3>
              <p>En un ratito vas a poder pedir tus favoritos.</p>
            </div>
          ) : (
            <div className="product-grid">
              {menuProducts.map((product, index) => (
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
                    {isAdmin && (
                      <button
                        className="edit-product-button"
                        onClick={() => openProductEditor(product)}
                        type="button"
                      >
                        Editar producto
                      </button>
                    )}
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
                    {submitting ? "Enviando pedido..." : "Confirmar pedido"}
                    {!submitting && <span aria-hidden="true">→</span>}
                  </button>
                  <p className="secure-note"><span>✦</span> Tu pedido se confirma al enviarlo al local.</p>
                </form>
              )}
            </>
          )}
        </aside>
      </section>
    </main>
  );
}
