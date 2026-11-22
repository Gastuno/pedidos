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
npm run db:migrate
npm run db:generate
npm run dev
```


Para una compilación de producción: `npm run build` y `npm run start`.
