"use client";

import { useEffect, useState } from "react";
import AuthButton from "./auth-button";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type OrderStatus = { id: number; nombre: string };
type OrderItem = {
  id: number;
  nombreProducto: string;
  precioUnitario: number;
  cantidad: number;
};
type AdminOrder = {
  id: number;
  fecha: string;
  montoTotal: number | null;
  puntosAdquiridos: number;
  cliente: string | null;
  telefono: string | null;
  modalidad: string | null;
  direccion: string | null;
  notas: string | null;
  estado: OrderStatus | null;
  medioPago: { nombre: string } | null;
  detalles: OrderItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    Number.isSafeInteger(value.id) &&
    typeof value.nombre === "string"
  );
}

function isOrderItem(value: unknown): value is OrderItem {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.nombreProducto === "string" &&
    typeof value.precioUnitario === "number" &&
    typeof value.cantidad === "number"
  );
}

function isAdminOrder(value: unknown): value is AdminOrder {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.fecha === "string" &&
    (typeof value.montoTotal === "number" || value.montoTotal === null) &&
    typeof value.puntosAdquiridos === "number" &&
    (typeof value.cliente === "string" || value.cliente === null) &&
    (typeof value.telefono === "string" || value.telefono === null) &&
    (typeof value.modalidad === "string" || value.modalidad === null) &&
    (typeof value.direccion === "string" || value.direccion === null) &&
    (typeof value.notas === "string" || value.notas === null) &&
    (value.estado === null || isOrderStatus(value.estado)) &&
    (value.medioPago === null ||
      (isRecord(value.medioPago) && typeof value.medioPago.nombre === "string")) &&
    Array.isArray(value.detalles) &&
    value.detalles.every(isOrderItem)
  );
}

function errorMessage(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const dateTime = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [statuses, setStatuses] = useState<OrderStatus[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<Record<number, string>>({});
  const [savingOrderId, setSavingOrderId] = useState<number | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let requestId = 0;
    let unsubscribe = () => {};

    async function loadOrders(accessToken: string | null) {
      const currentRequestId = ++requestId;
      setIsAuthenticated(Boolean(accessToken));
      setError("");

      if (!accessToken) {
        setOrders([]);
        setStatuses([]);
        setLoading(false);
        setAuthLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch("/api/admin/orders", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result: unknown = await response.json().catch(() => null);
        if (!active || currentRequestId !== requestId) return;

        if (!response.ok) {
          if (response.status === 401) setIsAuthenticated(false);
          throw new Error(errorMessage(result, "No se pudieron cargar los pedidos."));
        }
        if (
          !isRecord(result) ||
          !Array.isArray(result.orders) ||
          !result.orders.every(isAdminOrder) ||
          !Array.isArray(result.statuses) ||
          !result.statuses.every(isOrderStatus)
        ) {
          throw new Error("La respuesta de pedidos no es válida.");
        }

        setOrders(result.orders);
        setStatuses(result.statuses);
        setSelectedStatuses({});
      } catch (loadError) {
        if (!active || currentRequestId !== requestId) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los pedidos.",
        );
      } finally {
        if (active && currentRequestId === requestId) {
          setLoading(false);
          setAuthLoading(false);
        }
      }
    }

    try {
      const supabase = getSupabaseBrowserClient();
      supabase.auth.getSession().then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) {
          setError(sessionError.message);
          setAuthLoading(false);
          return;
        }
        void loadOrders(data.session?.access_token ?? null);
      }).catch((sessionError: unknown) => {
        if (!active) return;
        setError(
          sessionError instanceof Error
            ? sessionError.message
            : "No se pudo verificar tu sesión.",
        );
        setAuthLoading(false);
      });

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        void loadOrders(session?.access_token ?? null);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch (clientError) {
      setError(
        clientError instanceof Error
          ? clientError.message
          : "No se pudo verificar tu sesión.",
      );
      setAuthLoading(false);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function saveStatus(orderId: number) {
    const statusId = Number(selectedStatuses[orderId]);
    if (!Number.isSafeInteger(statusId) || statusId < 1) return;

    setSavingOrderId(orderId);
    setError("");
    try {
      const { data, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        setIsAuthenticated(false);
        throw new Error("Iniciá sesión para continuar.");
      }

      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ orderId, statusId }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) setIsAuthenticated(false);
        throw new Error(errorMessage(result, "No pudimos actualizar el estado."));
      }
      if (!isRecord(result) || result.id !== orderId) {
        throw new Error("La respuesta del estado no es válida.");
      }
      const updatedStatus = result.estado;
      if (!isOrderStatus(updatedStatus)) {
        throw new Error("La respuesta del estado no es válida.");
      }

      setOrders((current) =>
        current.map((order) =>
          order.id === orderId ? { ...order, estado: updatedStatus } : order,
        ),
      );
      setSelectedStatuses((current) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No pudimos actualizar el estado.",
      );
    } finally {
      setSavingOrderId(null);
    }
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Pedivos, inicio">
          <span className="brand-mark">P</span>
          <span>pedivos<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-actions">
          <a className="admin-nav-link" href="/admin">Productos</a>
          <a className="admin-nav-link" href="/">Volver a la tienda</a>
          <AuthButton onSignedOut={() => window.location.assign("/")} />
        </div>
      </header>

      <section className="admin-page admin-orders-page">
        <div className="admin-page-heading">
          <div>
            <span className="eyebrow">ADMINISTRACIÓN</span>
            <h1>Pedidos</h1>
            <p>Consultá los pedidos y actualizá su estado.</p>
          </div>
        </div>

        {authLoading || loading ? (
          <p className="admin-access-message">Cargando pedidos...</p>
        ) : !isAuthenticated ? (
          <p className="admin-access-message">Iniciá sesión con una cuenta administradora para continuar.</p>
        ) : error && orders.length === 0 ? (
          <p className="form-error" role="alert">{error}</p>
        ) : (
          <>
            {error && <p className="form-error admin-orders-error" role="alert">{error}</p>}
            {orders.length === 0 ? (
              <p className="admin-access-message">Todavía no hay pedidos.</p>
            ) : (
              <div className="admin-orders-table-wrap">
                <table className="admin-orders-table">
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Cliente</th>
                      <th>Entrega</th>
                      <th>Productos</th>
                      <th>Notas</th>
                      <th>Pago</th>
                      <th>Total</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const selectedStatus = selectedStatuses[order.id] ?? String(order.estado?.id ?? "");
                      const changed = selectedStatus !== String(order.estado?.id ?? "");

                      return (
                        <tr key={order.id}>
                          <td>
                            <strong>#{order.id}</strong>
                            <span className="admin-order-secondary">{dateTime.format(new Date(order.fecha))}</span>
                          </td>
                          <td>
                            <strong>{order.cliente || "Sin nombre"}</strong>
                            <span className="admin-order-secondary">{order.telefono || "Sin teléfono"}</span>
                          </td>
                          <td>
                            <strong>{order.modalidad || "No especificada"}</strong>
                            {order.direccion && <span className="admin-order-secondary">{order.direccion}</span>}
                          </td>
                          <td>
                            <ul className="admin-order-items">
                              {order.detalles.map((item) => (
                                <li key={item.id}>
                                  {item.cantidad} × {item.nombreProducto}
                                  <span>{money.format(item.precioUnitario * item.cantidad)}</span>
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td>{order.notas || "—"}</td>
                          <td>
                            {order.medioPago?.nombre || "—"}
                            {order.puntosAdquiridos > 0 && (
                              <span className="admin-order-secondary">
                                +{order.puntosAdquiridos} puntos
                              </span>
                            )}
                          </td>
                          <td>{money.format(order.montoTotal ?? 0)}</td>
                          <td>
                            <div className="admin-order-status">
                              <select
                                aria-label={`Estado del pedido ${order.id}`}
                                disabled={statuses.length === 0 || savingOrderId === order.id}
                                onChange={(event) =>
                                  setSelectedStatuses((current) => ({
                                    ...current,
                                    [order.id]: event.target.value,
                                  }))
                                }
                                value={selectedStatus}
                              >
                                {!order.estado && <option value="">Sin estado</option>}
                                {order.estado &&
                                  !statuses.some((status) => status.id === order.estado?.id) && (
                                    <option value={order.estado.id}>{order.estado.nombre}</option>
                                  )}
                                {statuses.map((status) => (
                                  <option key={status.id} value={status.id}>{status.nombre}</option>
                                ))}
                              </select>
                              <button
                                className="admin-product-button"
                                disabled={!changed || savingOrderId === order.id}
                                onClick={() => void saveStatus(order.id)}
                                type="button"
                              >
                                {savingOrderId === order.id ? "Guardando..." : "Guardar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
