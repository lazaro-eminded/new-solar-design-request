const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const QRCode = require('qrcode');

const app = express();
const port = process.env.PORT || 3000;
const webhookSecret = process.env.WEBHOOK_SECRET || 'change-me';
const whatsappGroup = process.env.WHATSAPP_GROUP || '120363191007710197@g.us';
const sessionPath = process.env.SESSION_PATH || './session';

app.use(express.json({ limit: '1mb' }));

let sock = null;
let waReady = false;
let latestQR = null;

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      console.log('Nuevo QR generado — visita /qr para escanearlo');
    }

    if (connection === 'close') {
      waReady = false;
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log('Conexión cerrada, código:', code, '— reconectar:', shouldReconnect);
      if (shouldReconnect) connectToWhatsApp();
      else console.log('Sesión expirada. Borra la carpeta session y reinicia.');
    } else if (connection === 'open') {
      waReady = true;
      console.log('✅ WhatsApp conectado y listo');
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

connectToWhatsApp().catch(err => console.error('WA init error:', err));

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'solar-design-webhook', whatsapp: waReady ? 'ready' : 'not_ready' });
});

app.get('/qr', async (_req, res) => {
  if (waReady) return res.send('<h2>✅ WhatsApp ya está conectado</h2>');
  if (!latestQR) return res.send('<h2>⏳ Generando QR, recarga en 5 segundos...</h2><meta http-equiv="refresh" content="5">');
  const img = await QRCode.toDataURL(latestQR, { scale: 8 });
  res.send(`<!DOCTYPE html><html><head><meta http-equiv="refresh" content="20"><title>WhatsApp QR</title></head>
<body style="display:flex;flex-direction:column;align-items:center;font-family:sans-serif;padding:40px">
<h2>Escanea con WhatsApp → Dispositivos vinculados</h2>
<img src="${img}" style="width:300px;height:300px"/>
<p style="color:gray">Se renueva automáticamente cada 20s</p>
</body></html>`);
});

app.post('/webhook/solar-design', async (req, res) => {
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const providedSecret = bearer || req.headers['x-webhook-secret'];

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

  if (!waReady) {
    return res.status(503).json({ ok: false, error: 'whatsapp_not_ready' });
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
    await sock.sendMessage(whatsappGroup, { text: message });
    console.log(JSON.stringify({ event: 'solar_design_sent', appointmentId: body.id }));
    return res.status(200).json({ ok: true, sent: true, appointmentId: body.id });
  } catch (err) {
    console.error('whatsapp_send_error', err.message);
    return res.status(500).json({ ok: false, error: 'send_failed', detail: err.message });
  }
});

app.listen(port, () => {
  console.log(`solar-design-webhook listening on port ${port}`);
});
