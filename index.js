const express = require('express');

const app = express();
const port = process.env.PORT || 3000;
const webhookSecret = process.env.WEBHOOK_SECRET || 'change-me';
const dedupeTtlDays = Number(process.env.DEDUPE_TTL_DAYS || 90);
const dedupeTtlMs = dedupeTtlDays * 24 * 60 * 60 * 1000;

const sentAddresses = new Map();

function normalizeAddress(address) {
  return String(address || '')
    .toLowerCase()
    .replace(/[.,#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wasRecentlySent(key, now) {
  const sentAt = sentAddresses.get(key);
  if (!sentAt) return false;
  if (now - sentAt > dedupeTtlMs) {
    sentAddresses.delete(key);
    return false;
  }
  return true;
}

app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'solar-design-webhook',
    status: 'running'
  });
});

app.post('/webhook/solar-design', (req, res) => {
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const headerSecret = req.headers['x-webhook-secret'];
  const providedSecret = bearer || headerSecret;

  if (!providedSecret || providedSecret !== webhookSecret) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const body = req.body || {};

  if (body.type !== 'AppointmentUpdate') {
    return res.status(400).json({ ok: false, error: 'invalid_type' });
  }

  if (body.appointmentStatus !== 'Confirmed') {
    return res.status(200).json({ ok: true, skipped: true, reason: 'appointment_not_confirmed' });
  }

  if ((body.calendarName || '').toLowerCase() !== 'solar') {
    return res.status(200).json({ ok: true, skipped: true, reason: 'not_solar_calendar' });
  }

  const addressKey = normalizeAddress(body.fullAddress);
  const now = Date.now();

  if (!addressKey) {
    return res.status(200).json({ ok: true, skipped: true, reason: 'missing_address' });
  }

  if (wasRecentlySent(addressKey, now)) {
    return res.status(200).json({
      ok: true,
      skipped: true,
      reason: 'duplicate_address_within_ttl',
      ttlDays: dedupeTtlDays
    });
  }

  sentAddresses.set(addressKey, now);

  const message = [
    '🚨 NUEVO DISEÑO SOLAR',
    '',
    `Cliente: ${body.contactName || 'N/A'}`,
    `Teléfono: ${body.contactPhone || 'N/A'}`,
    `Dirección: ${body.fullAddress || 'N/A'}`,
    `Cita confirmada: ${body.startTime || 'N/A'}`,
    `Vendedor asignado: ${body.assignedUserName || 'N/A'}`,
    '',
    'Por favor crear el diseño en Aurora y asignarlo a este vendedor.'
  ].join('\n');

  // Placeholder for next step: dispatch to OpenClaw / WhatsApp group.
  console.log(JSON.stringify({
    event: 'solar_design_request',
    appointmentId: body.id,
    contactId: body.contactId,
    message
  }, null, 2));

  return res.status(200).json({
    ok: true,
    received: true,
    appointmentId: body.id,
    previewMessage: message
  });
});

app.listen(port, () => {
  console.log(`solar-design-webhook listening on port ${port}`);
});
