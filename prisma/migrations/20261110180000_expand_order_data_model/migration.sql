ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "dni" TEXT,
  ADD COLUMN IF NOT EXISTS "nombre" TEXT,
  ADD COLUMN IF NOT EXISTS "apellido" TEXT,
  ADD COLUMN IF NOT EXISTS "puntos" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "User_dni_key" ON "User"("dni");

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
  ADD COLUMN IF NOT EXISTS "isCombo" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Pedido"
  ALTER COLUMN "detalle" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "montoTotal" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "puntosAdquiridos" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cliente" TEXT,
  ADD COLUMN IF NOT EXISTS "telefono" TEXT,
  ADD COLUMN IF NOT EXISTS "modalidad" TEXT,
  ADD COLUMN IF NOT EXISTS "direccion" TEXT,
  ADD COLUMN IF NOT EXISTS "notas" TEXT,
  ADD COLUMN IF NOT EXISTS "idUsuario" TEXT,
  ADD COLUMN IF NOT EXISTS "idEstado" INTEGER,
  ADD COLUMN IF NOT EXISTS "idMP" INTEGER,
  ADD COLUMN IF NOT EXISTS "idNegocio" INTEGER;

CREATE TABLE IF NOT EXISTS "Ciudad" (
  "id" SERIAL NOT NULL,
  "nombre" TEXT NOT NULL,
  CONSTRAINT "Ciudad_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Calle" (
  "id" SERIAL NOT NULL,
  "nombre" TEXT NOT NULL,
  "idCiudad" INTEGER NOT NULL,
  CONSTRAINT "Calle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Direccion" (
  "id" SERIAL NOT NULL,
  "altura" TEXT NOT NULL,
  "idCalle" INTEGER NOT NULL,
  CONSTRAINT "Direccion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DirUsuario" (
  "id" SERIAL NOT NULL,
  "idUsuario" TEXT NOT NULL,
  "idDireccion" INTEGER NOT NULL,
  CONSTRAINT "DirUsuario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Local" (
  "id" SERIAL NOT NULL,
  "idDireccion" INTEGER NOT NULL,
  CONSTRAINT "Local_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Estado" (
  "id" SERIAL NOT NULL,
  "nombre" TEXT NOT NULL,
  CONSTRAINT "Estado_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ListaProductos" (
  "id" SERIAL NOT NULL,
  "idProducto" TEXT NOT NULL,
  "idLocal" INTEGER NOT NULL,
  CONSTRAINT "ListaProductos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MedioPago" (
  "id" SERIAL NOT NULL,
  "nombre" TEXT NOT NULL,
  CONSTRAINT "MedioPago_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MpCliente" (
  "id" SERIAL NOT NULL,
  "idUsuario" TEXT NOT NULL,
  "idMP" INTEGER NOT NULL,
  CONSTRAINT "MpCliente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Pago" (
  "id" SERIAL NOT NULL,
  "idPedido" INTEGER NOT NULL,
  "idMP" INTEGER NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "hora" TIME(0),
  CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Variante" (
  "id" SERIAL NOT NULL,
  "nombre" TEXT NOT NULL,
  CONSTRAINT "Variante_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Categoria" (
  "id" SERIAL NOT NULL,
  "nombre" TEXT NOT NULL,
  "idProducto" TEXT NOT NULL,
  "idVariante" INTEGER NOT NULL,
  CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DetallePedido" (
  "id" SERIAL NOT NULL,
  "idPedido" INTEGER NOT NULL,
  "idProducto" TEXT,
  "nombreProducto" TEXT NOT NULL,
  "precioUnitario" DOUBLE PRECISION NOT NULL,
  "cantidad" INTEGER NOT NULL,
  CONSTRAINT "DetallePedido_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Ciudad_nombre_key" ON "Ciudad"("nombre");
CREATE UNIQUE INDEX IF NOT EXISTS "Calle_nombre_idCiudad_key" ON "Calle"("nombre", "idCiudad");
CREATE UNIQUE INDEX IF NOT EXISTS "DirUsuario_idUsuario_idDireccion_key" ON "DirUsuario"("idUsuario", "idDireccion");
CREATE UNIQUE INDEX IF NOT EXISTS "Estado_nombre_key" ON "Estado"("nombre");
CREATE UNIQUE INDEX IF NOT EXISTS "ListaProductos_idProducto_idLocal_key" ON "ListaProductos"("idProducto", "idLocal");
CREATE UNIQUE INDEX IF NOT EXISTS "MedioPago_nombre_key" ON "MedioPago"("nombre");
CREATE UNIQUE INDEX IF NOT EXISTS "MpCliente_idUsuario_idMP_key" ON "MpCliente"("idUsuario", "idMP");
CREATE UNIQUE INDEX IF NOT EXISTS "Variante_nombre_key" ON "Variante"("nombre");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Calle_idCiudad_fkey') THEN
    ALTER TABLE "Calle" ADD CONSTRAINT "Calle_idCiudad_fkey"
      FOREIGN KEY ("idCiudad") REFERENCES "Ciudad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Direccion_idCalle_fkey') THEN
    ALTER TABLE "Direccion" ADD CONSTRAINT "Direccion_idCalle_fkey"
      FOREIGN KEY ("idCalle") REFERENCES "Calle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DirUsuario_idUsuario_fkey') THEN
    ALTER TABLE "DirUsuario" ADD CONSTRAINT "DirUsuario_idUsuario_fkey"
      FOREIGN KEY ("idUsuario") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DirUsuario_idDireccion_fkey') THEN
    ALTER TABLE "DirUsuario" ADD CONSTRAINT "DirUsuario_idDireccion_fkey"
      FOREIGN KEY ("idDireccion") REFERENCES "Direccion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Local_idDireccion_fkey') THEN
    ALTER TABLE "Local" ADD CONSTRAINT "Local_idDireccion_fkey"
      FOREIGN KEY ("idDireccion") REFERENCES "Direccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ListaProductos_idProducto_fkey') THEN
    ALTER TABLE "ListaProductos" ADD CONSTRAINT "ListaProductos_idProducto_fkey"
      FOREIGN KEY ("idProducto") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ListaProductos_idLocal_fkey') THEN
    ALTER TABLE "ListaProductos" ADD CONSTRAINT "ListaProductos_idLocal_fkey"
      FOREIGN KEY ("idLocal") REFERENCES "Local"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DetallePedido_idPedido_fkey') THEN
    ALTER TABLE "DetallePedido" ADD CONSTRAINT "DetallePedido_idPedido_fkey"
      FOREIGN KEY ("idPedido") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DetallePedido_idProducto_fkey') THEN
    ALTER TABLE "DetallePedido" ADD CONSTRAINT "DetallePedido_idProducto_fkey"
      FOREIGN KEY ("idProducto") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Pago_idPedido_fkey') THEN
    ALTER TABLE "Pago" ADD CONSTRAINT "Pago_idPedido_fkey"
      FOREIGN KEY ("idPedido") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Pago_idMP_fkey') THEN
    ALTER TABLE "Pago" ADD CONSTRAINT "Pago_idMP_fkey"
      FOREIGN KEY ("idMP") REFERENCES "MedioPago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MpCliente_idUsuario_fkey') THEN
    ALTER TABLE "MpCliente" ADD CONSTRAINT "MpCliente_idUsuario_fkey"
      FOREIGN KEY ("idUsuario") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MpCliente_idMP_fkey') THEN
    ALTER TABLE "MpCliente" ADD CONSTRAINT "MpCliente_idMP_fkey"
      FOREIGN KEY ("idMP") REFERENCES "MedioPago"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Categoria_idProducto_fkey') THEN
    ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_idProducto_fkey"
      FOREIGN KEY ("idProducto") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Categoria_idVariante_fkey') THEN
    ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_idVariante_fkey"
      FOREIGN KEY ("idVariante") REFERENCES "Variante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Pedido_idUsuario_fkey') THEN
    ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_idUsuario_fkey"
      FOREIGN KEY ("idUsuario") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Pedido_idEstado_fkey') THEN
    ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_idEstado_fkey"
      FOREIGN KEY ("idEstado") REFERENCES "Estado"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Pedido_idMP_fkey') THEN
    ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_idMP_fkey"
      FOREIGN KEY ("idMP") REFERENCES "MedioPago"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Pedido_idNegocio_fkey') THEN
    ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_idNegocio_fkey"
      FOREIGN KEY ("idNegocio") REFERENCES "Local"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
