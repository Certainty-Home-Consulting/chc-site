const REQUIRED = ['name', 'email', 'project', 'stress', 'feedback_consent'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CORS_ORIGIN = 'https://certaintyhomeconsulting.com';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return corsPrelight();
    if (request.method !== 'POST') return err(405, 'Method Not Allowed');

    let payload;
    try {
      payload = await parseBody(request);
    } catch (e) {
      return err(400, 'Unparseable body');
    }

    // honeypot
    if (payload.website) return ok({ ok: true, ignored: true });

    const validationError = validate(payload);
    if (validationError) return err(400, validationError);

    const lead = normalize(payload);
    const leadId = 'CHC-' + crypto.randomUUID().slice(0, 8).toUpperCase();

    await Promise.all([
      sendEmail(env, lead, leadId),
      notifyDiscord(env, lead, leadId),
    ]);

    return ok({ ok: true, leadId });
  },
};

async function parseBody(request) {
  const ct = (request.headers.get('content-type') || '').split(';')[0].trim();
  if (ct === 'application/json') {
    return request.json();
  }
  // form-encoded fallback
  const text = await request.text();
  const params = new URLSearchParams(text);
  return Object.fromEntries(params.entries());
}

function validate(p) {
  for (const f of REQUIRED) {
    if (!p[f] || !String(p[f]).trim()) return `${f} is required`;
  }
  if (!EMAIL_RE.test(String(p.email).trim())) return 'invalid email';
  const consent = String(p.feedback_consent).toLowerCase();
  if (!['yes', 'true', 'on', '1'].includes(consent)) return 'feedback_consent must be accepted';
  return null;
}

function normalize(p) {
  return {
    name: String(p.name).trim(),
    email: String(p.email).trim(),
    phone: String(p.phone || '').trim(),
    project: String(p.project).trim(),
    timeline: String(p.timeline || '').trim(),
    stress: String(p.stress).trim(),
    feedback_consent: true,
    source: String(p.source || 'chc-site'),
    ts: new Date().toISOString(),
  };
}

async function sendEmail(env, lead, leadId) {
  if (!env.RESEND_API_KEY) return;
  const body = [
    `Lead ID: ${leadId}`,
    `Time: ${lead.ts}`,
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone || '-'}`,
    `Timeline: ${lead.timeline || '-'}`,
    `Feedback consent: yes`,
    '',
    'Project:',
    lead.project,
    '',
    'Current stress / biggest pain:',
    lead.stress,
  ].join('\n');

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.NOTIFY_FROM,
      to: env.NOTIFY_TO,
      reply_to: lead.email,
      subject: `[CHC Lead] ${lead.name} (${leadId})`,
      text: body,
    }),
  });
}

async function notifyDiscord(env, lead, leadId) {
  if (!env.DISCORD_WEBHOOK_URL) return;
  const content = [
    `**New CHC Lead — ${leadId}**`,
    `**Name:** ${lead.name}`,
    `**Email:** ${lead.email}`,
    lead.phone ? `**Phone:** ${lead.phone}` : null,
    lead.timeline ? `**Timeline:** ${lead.timeline}` : null,
    `**Project:** ${lead.project}`,
    `**Stress:** ${lead.stress}`,
  ].filter(Boolean).join('\n');

  await fetch(env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

function ok(body) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

function err(status, message) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
  });
}

function corsPrelight() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
