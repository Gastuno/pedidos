# Miga — pedidos

Aplicación sencilla para mostrar un menú y guardar pedidos en PostgreSQL de Supabase con Prisma.

## Configuración

En `.env` configurá:

- `DATABASE_URL`: conexión de la aplicación a Supabase (pooler recomendado).
- `DIRECT_URL`: conexión directa de Supabase para ejecutar migraciones.
- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto de Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: clave pública (anon/publishable) del proyecto para autenticación.

No compartas ni subas estos archivos al repositorio.

## Puesta en marcha

```bash
npm install
npm run db:generate
npm run db:seed
npm run dev
```

La carga inicial agrega ocho productos de ejemplo únicamente si el catálogo está vacío. Las imágenes se leen del campo `imageUrl` de cada fila en `Product`; `npm run db:seed` completa las imágenes faltantes de los productos de ejemplo sin reemplazar URLs que ya hayas configurado.

Los pedidos se guardan en la tabla existente `Pedido`: el campo `detalle` conserva los datos de contacto y el detalle de los productos como JSON. No hace falta modificar el esquema de Supabase para empezar a usar la página.

Para una compilación de producción: `npm run build` y `npm run start`.
