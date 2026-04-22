# solar-design-webhook

Servicio aislado para recibir webhooks de HighLevel cuando una cita del calendario Solar queda confirmada.

## Endpoint

`POST /webhook/solar-design`

## Auth

Usa uno de estos:
- `Authorization: Bearer <WEBHOOK_SECRET>`
- `x-webhook-secret: <WEBHOOK_SECRET>`

## Variables de entorno

- `WEBHOOK_SECRET` = secreto compartido para HighLevel
- `PORT` = puerto del servicio (Railway lo inyecta)
- `DEDUPE_TTL_DAYS` = ventana en días para evitar reenviar diseños a la misma dirección (default: `90`)
- `DEDUPE_STORE_PATH` = ruta del archivo JSON donde se persiste la dedupe (default: `/data/sent-addresses.json`, apunta al Railway Volume)

## Body esperado

```json
{
  "type": "AppointmentUpdate",
  "locationId": "...",
  "id": "...",
  "contactId": "...",
  "contactName": "...",
  "calendarName": "Solar",
  "startTime": "...",
  "assignedUserName": "...",
  "appointmentStatus": "Confirmed",
  "contactPhone": "...",
  "address1": "...",
  "city": "...",
  "state": "...",
  "postalCode": "...",
  "fullAddress": "..."
}
```

## Estado actual

- valida secret
- valida tipo de evento
- valida que sea calendario Solar
- valida que la cita esté Confirmed
- deduplica por `fullAddress` normalizada dentro de la ventana `DEDUPE_TTL_DAYS` (default 90 días)
- persiste la dedupe en `DEDUPE_STORE_PATH` para sobrevivir a reinicios / deploys
- arma el mensaje de diseño
- responde con preview del mensaje

## Persistencia de dedupe (Railway Volume)

Para que la ventana de 90 días sobreviva a redeploys o restarts, monta un Railway Volume:

1. En Railway → el servicio → **Volumes** → New Volume
2. Mount path: `/data`
3. Tamaño: 1 GB es más que suficiente
4. (opcional) Override `DEDUPE_STORE_PATH` si usas otro mount

Si no montas volumen, el servicio sigue funcionando: cargará la memoria vacía al iniciar y sólo loggeará un warning al intentar persistir.

## Railway deploy

Este proyecto está preparado para Railway con:
- `railway.json`
- `npm start`
- `PORT` dinámico

Variables mínimas en Railway:
- `WEBHOOK_SECRET`

## Siguiente paso

Conectar el envío final al grupo de WhatsApp vía OpenClaw o el mecanismo de dispatch que definamos.
