# Pedivos

Aplicación de compra online para un local de comida.

## Configuración

Este proyecto requiere un archivo `.env` donde se va a configurar::

- `DATABASE_URL`: conexión de la aplicación a Supabase.
- `DIRECT_URL`: conexión directa de Supabase para ejecutar migraciones.
- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto de Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: clave pública (anon/publishable) del proyecto para autenticación.


## Ejecución

```bash
npm install
npm run db:migrate
npm run db:generate
npm run db:seed
npm run dev
```
