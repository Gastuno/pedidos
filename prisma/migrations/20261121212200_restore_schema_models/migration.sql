ALTER TABLE "Pedido"
  ADD COLUMN "detalle" TEXT,
  ADD COLUMN "idNegocio" INTEGER;

ALTER TABLE "Product"
  ADD COLUMN "isCombo" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Local" (
  "id" SERIAL NOT NULL,
  "idDireccion" INTEGER NOT NULL,
  CONSTRAINT "Local_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ListaProductos" (
  "id" SERIAL NOT NULL,
  "idProducto" TEXT NOT NULL,
  "idLocal" INTEGER NOT NULL,
  CONSTRAINT "ListaProductos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MpCliente" (
  "id" SERIAL NOT NULL,
  "idUsuario" TEXT NOT NULL,
  "idMP" INTEGER NOT NULL,
  CONSTRAINT "MpCliente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ListaProductos_idProducto_idLocal_key"
  ON "ListaProductos"("idProducto", "idLocal");
CREATE UNIQUE INDEX "MpCliente_idUsuario_idMP_key"
  ON "MpCliente"("idUsuario", "idMP");

ALTER TABLE "Pedido"
  ADD CONSTRAINT "Pedido_idNegocio_fkey"
  FOREIGN KEY ("idNegocio") REFERENCES "Local"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Local"
  ADD CONSTRAINT "Local_idDireccion_fkey"
  FOREIGN KEY ("idDireccion") REFERENCES "Direccion"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ListaProductos"
  ADD CONSTRAINT "ListaProductos_idProducto_fkey"
  FOREIGN KEY ("idProducto") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListaProductos"
  ADD CONSTRAINT "ListaProductos_idLocal_fkey"
  FOREIGN KEY ("idLocal") REFERENCES "Local"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MpCliente"
  ADD CONSTRAINT "MpCliente_idUsuario_fkey"
  FOREIGN KEY ("idUsuario") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MpCliente"
  ADD CONSTRAINT "MpCliente_idMP_fkey"
  FOREIGN KEY ("idMP") REFERENCES "MedioPago"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
