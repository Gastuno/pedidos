import type { Product } from "./admin-products";

type Props = {
  products: Product[];
  cart: Record<string, number>;
  checkoutReady: boolean;
  formatPrice: (price: number) => string;
  onChangeQuantity: (productId: string, delta: number) => void;
};

export default function ProductMenu({
  products,
  cart,
  checkoutReady,
  formatPrice,
  onChangeQuantity,
}: Props) {
  return (
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
                  <span className="product-price">{formatPrice(product.price)}</span>
                </div>
                {product.description && <p>{product.description}</p>}
                <button
                  className={`add-button${cart[product.id] ? " has-quantity" : ""}`}
                  onClick={() => onChangeQuantity(product.id, 1)}
                  disabled={checkoutReady}
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
  );
}
