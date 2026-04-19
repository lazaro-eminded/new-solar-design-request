const express = require('express');

const app = express();
const port = process.env.PORT || 3000;
const webhookSecret = process.env.WEBHOOK_SECRET || 'change-me';
const bridgeUrl = process.env.BRIDGE_URL || 'http://127.0.0.1:8787';
const bridgeToken = process.env.BRIDGE_TOKEN || 'testbridge123';
const whatsappGroup = process.env.WHATSAPP_GROUP || '120363191007710197@g.us';

app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'solar-design-webhook',
    status: 'running'
  });
});

app.post('/webhook/solar-design', async (req, res) => {
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

  try {
    const resp = await fetch(`${bridgeUrl}/send-whatsapp-group`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bridgeToken}`
      },
      body: JSON.stringify({ target: whatsappGroup, message })
    });

    const result = await resp.json().catch(() => ({}));

    console.log(JSON.stringify({
      event: 'solar_design_request',
      appointmentId: body.id,
      contactId: body.contactId,
      bridgeStatus: resp.status,
      bridgeResult: result
    }));

    return res.status(200).json({
      ok: true,
      dispatched: true,
      appointmentId: body.id,
      bridgeStatus: resp.status
    });
  } catch (err) {
    console.error('bridge_error', err.message);
    return res.status(502).json({ ok: false, error: 'bridge_unreachable', detail: err.message });
  }
});

app.listen(port, () => {
  console.log(`solar-design-webhook listening on port ${port}`);
});
