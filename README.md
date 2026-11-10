# Pedivos

Aplicación de compra online.

## Configuración

En `.env` configurá:

- `DATABASE_URL`: conexión de la aplicación a Supabase.
- `DIRECT_URL`: conexión directa de Supabase para ejecutar migraciones.
- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto de Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: clave pública (anon/publishable) del proyecto para autenticación.


## Puesta en marcha

```bash
npm install
npm run db:generate
npm run db:seed
npm run dev
```

La carga inicial agrega ocho productos de ejemplo únicamente si el catálogo está vacío. Las imágenes se leen del campo `imageUrl` de cada fila en `Product`; `npm run db:seed` completa las imágenes faltantes de los productos de ejemplo sin reemplazar URLs que ya hayas configurado.


Para una compilación de producción: `npm run build` y `npm run start`.
