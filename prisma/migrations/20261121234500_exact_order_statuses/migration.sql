ALTER TABLE "Estado"
  ADD COLUMN IF NOT EXISTS "orden" INTEGER;

INSERT INTO "Estado" ("nombre", "orden")
VALUES
  ('Pagado', 1),
  ('En preparacion', 2),
  ('Enviado', 3),
  ('Entregado', 4),
  ('Cancelado', 5)
ON CONFLICT ("nombre") DO UPDATE
SET "orden" = EXCLUDED."orden";

UPDATE "Pedido"
SET "idEstado" = (
  SELECT "id" FROM "Estado" WHERE "nombre" = 'Pagado'
)
WHERE "idEstado" IS NOT NULL
  AND "idEstado" NOT IN (
    SELECT "id" FROM "Estado"
    WHERE "nombre" IN (
      'Pagado',
      'En preparacion',
      'Enviado',
      'Entregado',
      'Cancelado'
    )
  );

DELETE FROM "Estado"
WHERE "nombre" NOT IN (
  'Pagado',
  'En preparacion',
  'Enviado',
  'Entregado',
  'Cancelado'
);

ALTER TABLE "Estado"
  ALTER COLUMN "orden" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Estado_orden_key"
  ON "Estado"("orden");
