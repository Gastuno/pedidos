CREATE TABLE IF NOT EXISTS "MedioPago" (
  "id" SERIAL NOT NULL,
  "nombre" TEXT NOT NULL,
  CONSTRAINT "MedioPago_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Pedido"
  ADD COLUMN IF NOT EXISTS "claveIdempotencia" TEXT,
  ADD COLUMN IF NOT EXISTS "idMP" INTEGER;

ALTER TABLE "Pago"
  ADD COLUMN IF NOT EXISTS "idMP" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "Pedido_claveIdempotencia_key"
  ON "Pedido"("claveIdempotencia");
CREATE UNIQUE INDEX IF NOT EXISTS "MedioPago_nombre_key"
  ON "MedioPago"("nombre");

DO $$
DECLARE
  table_name TEXT;
  sequence_name TEXT;
  max_id BIGINT;
  next_id BIGINT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['Estado', 'MedioPago', 'Pedido', 'DetallePedido', 'Pago']
  LOOP
    sequence_name := pg_get_serial_sequence(format('%I', table_name), 'id');
    IF sequence_name IS NOT NULL THEN
      EXECUTE format('SELECT COALESCE(MAX("id"), 0) FROM %I', table_name) INTO max_id;
      EXECUTE format('SELECT nextval(%L::regclass)', sequence_name) INTO next_id;
      PERFORM setval(sequence_name, GREATEST(max_id, next_id), true);
    END IF;
  END LOOP;
END $$;

INSERT INTO "MedioPago" ("nombre")
  VALUES ('Mercado Pago')
  ON CONFLICT ("nombre") DO NOTHING;

UPDATE "Pago"
SET "idMP" = (
  SELECT "id" FROM "MedioPago" WHERE "nombre" = 'Mercado Pago'
)
WHERE "idMP" IS NULL;

ALTER TABLE "Pago"
  ALTER COLUMN "idMP" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Pedido_idMP_fkey') THEN
    ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_idMP_fkey"
      FOREIGN KEY ("idMP") REFERENCES "MedioPago"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Pago_idMP_fkey') THEN
    ALTER TABLE "Pago" ADD CONSTRAINT "Pago_idMP_fkey"
      FOREIGN KEY ("idMP") REFERENCES "MedioPago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "Estado" ("nombre")
  VALUES ('Pagado')
  ON CONFLICT ("nombre") DO NOTHING;
