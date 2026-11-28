import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

export type Product = {
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

type Props = {
  products: Product[];
  authLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  adminError: string;
  formatPrice: (price: number) => string;
  updateProducts: (update: (current: Product[]) => Product[]) => void;
  onProductDeleted: (productId: string) => void;
  onSessionExpired: () => void;
};

const emptyProductForm: ProductForm = {
  name: "",
  description: "",
  price: "",
  imageUrl: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProduct(value: unknown): value is Product {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (typeof value.description === "string" || value.description === null) &&
    typeof value.price === "number" &&
    Number.isFinite(value.price) &&
    (typeof value.imageUrl === "string" || value.imageUrl === null)
  );
}

export default function AdminProducts({
  products,
  authLoading,
  isAuthenticated,
  isAdmin,
  adminError,
  formatPrice,
  updateProducts,
  onProductDeleted,
  onSessionExpired,
}: Props) {
  const [productEditorOpen, setProductEditorOpen] = useState(false);
  const [productEditorScrollRequest, setProductEditorScrollRequest] = useState(0);
  const productEditorRef = useRef<HTMLFormElement>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProductForm);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productError, setProductError] = useState("");
  const [deletingProductId, setDeletingProductId] = useState("");
  const [deleteProductError, setDeleteProductError] = useState("");

  useEffect(() => {
    if (productEditorOpen && productEditorScrollRequest > 0) {
      productEditorRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }, [productEditorOpen, productEditorScrollRequest]);

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

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProduct(true);
    setProductError("");

    try {
      const { data, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        onSessionExpired();
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
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "No pudimos guardar el producto.";
        throw new Error(message);
      }

      if (!isProduct(result)) throw new Error("La respuesta del producto no es válida.");
      const savedProduct = result;
      updateProducts((current) =>
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

  async function deleteProduct(product: Product) {
    if (deletingProductId) return;
    if (!window.confirm(`¿Eliminar el producto "${product.name}"? Esta acción no se puede deshacer.`)) return;

    setDeletingProductId(product.id);
    setDeleteProductError("");

    try {
      const { data, error: sessionError } = await getSupabaseBrowserClient().auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        onSessionExpired();
        throw new Error("Iniciá sesión para administrar productos.");
      }

      const response = await fetch("/api/admin/products", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ id: product.id }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          isRecord(result) && typeof result.error === "string"
            ? result.error
            : "No pudimos eliminar el producto.";
        throw new Error(message);
      }

      updateProducts((current) => current.filter((item) => item.id !== product.id));
      onProductDeleted(product.id);
      if (editingProduct?.id === product.id) {
        setProductEditorOpen(false);
        setEditingProduct(null);
        setProductForm(emptyProductForm);
      }
    } catch (deleteError) {
      setDeleteProductError(
        deleteError instanceof Error ? deleteError.message : "No pudimos eliminar el producto.",
      );
    } finally {
      setDeletingProductId("");
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">ADMINISTRACIÓN</span>
          <h1>Productos</h1>
          <p>Creá y mantené actualizado el menú de la tienda.</p>
        </div>
      </div>

      {authLoading ? (
        <p className="admin-access-message">Verificando tu cuenta...</p>
      ) : !isAuthenticated ? (
        <p className="admin-access-message">Iniciá sesión con una cuenta administradora para continuar.</p>
      ) : adminError ? (
        <p className="form-error" role="alert">{adminError}</p>
      ) : !isAdmin ? (
        <p className="admin-access-message">No tenés permisos para administrar productos.</p>
      ) : (
        <>
          {deleteProductError && <p className="form-error" role="alert">{deleteProductError}</p>}
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

          {products.length === 0 ? (
            <div className="empty-menu">
              <h3>Todavía no hay productos</h3>
              <p>Agregá el primero para que aparezca en la tienda.</p>
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
                      <span className="product-price">{formatPrice(product.price)}</span>
                    </div>
                    {product.description && <p>{product.description}</p>}
                    <button
                      className="edit-product-button"
                      onClick={() => openProductEditor(product)}
                      type="button"
                    >
                      Editar producto
                    </button>
                    <button
                      className="delete-product-button"
                      disabled={Boolean(deletingProductId)}
                      onClick={() => void deleteProduct(product)}
                      type="button"
                    >
                      {deletingProductId === product.id ? "Eliminando..." : "Eliminar producto"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
