"use client";

import { useEffect, useState } from "react";
import AuthButton from "./auth-button";
import AdminProducts, { type Product } from "./admin-products";
import ProductMenu from "./product-menu";
import OrderCheckout from "./order-checkout";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type Props = { products: Product[]; heroImageUrl: string | null; adminMode?: boolean };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default function OrderPage({ products, heroImageUrl, adminMode = false }: Props) {
  const [menuProducts, setMenuProducts] = useState(products);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [error, setError] = useState("");
  const [checkoutReady, setCheckoutReady] = useState(false);
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);
  const [pointsError, setPointsError] = useState("");

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

  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);

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

        <OrderCheckout
          products={menuProducts}
          cart={cart}
          itemCount={itemCount}
          authLoading={authLoading}
          isAuthenticated={isAuthenticated}
          checkoutReady={checkoutReady}
          pointsBalance={pointsBalance}
          pointsError={pointsError}
          error={error}
          formatPrice={(price) => money.format(price)}
          onChangeQuantity={changeQuantity}
          onCheckoutReadyChange={setCheckoutReady}
          onErrorChange={setError}
          onPointsBalanceChange={setPointsBalance}
          onSessionExpired={() => setIsAuthenticated(false)}
          onOrderPaid={() => setCart({})}
        />
      </section>
    </main>
  );
}
