ALTER TABLE "User"
  DROP COLUMN "name",
  DROP COLUMN "dni";

ALTER TABLE "User" RENAME COLUMN "createdAt" TO "creadoEn";
ALTER TABLE "User" RENAME COLUMN "phone" TO "telefono";
ALTER TABLE "User" RENAME COLUMN "address" TO "direccion";
ALTER TYPE "Role" RENAME TO "Rol";

ALTER TABLE "Pago" DROP COLUMN "idMP";
ALTER TABLE "Pedido"
  DROP COLUMN "idMP",
  DROP COLUMN "idNegocio";
ALTER TABLE "Product" DROP COLUMN "isCombo";

DROP TABLE "ListaProductos";
DROP TABLE "MpCliente";
DROP TABLE "Local";
DROP TABLE "MedioPago";
