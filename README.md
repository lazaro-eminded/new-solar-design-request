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
- arma el mensaje de diseño
- responde con preview del mensaje

## Railway deploy

Este proyecto está preparado para Railway con:
- `railway.json`
- `npm start`
- `PORT` dinámico

Variables mínimas en Railway:
- `WEBHOOK_SECRET`

## Siguiente paso

Conectar el envío final al grupo de WhatsApp vía OpenClaw o el mecanismo de dispatch que definamos.
