var CHCIntake = (function () {
  function handlePost(e, config) {
    try {
      var cfg = normalizeConfig_(config || {});
      var payload = parsePayload_(e);
      validateLead_(payload);

      if (payload.website) {
        return jsonResponse_({ ok: true, ignored: true });
      }

      var lead = normalizeLead_(payload, cfg.timezone);
      var leadId = writeLeadToSheet_(lead, cfg.sheetName);
      sendLeadEmail_(lead, leadId, cfg.notifyTo);
      return jsonResponse_({ ok: true, leadId: leadId });
    } catch (err) {
      return jsonResponse_({ ok: false, error: String((err && err.message) || err) });
    }
  }

  function normalizeConfig_(c) {
    if (!c.notifyTo) throw new Error('notifyTo required');
    return {
      notifyTo: c.notifyTo,
      sheetName: c.sheetName || 'Leads',
      timezone: c.timezone || 'America/New_York'
    };
  }

  function parsePayload_(e) {
    if (!e || !e.postData) throw new Error('Missing POST body');
    var raw = e.postData.contents || '{}';
    try { return JSON.parse(raw); } catch (_) {}
    var p = e.parameter || {};
    return {
      name: p.name, email: p.email, phone: p.phone,
      project: p.project, timeline: p.timeline,
      stress: p.stress, feedback_consent: p.feedback_consent,
      website: p.website
    };
  }

  function validateLead_(p) {
    if (!p.name || !p.email || !p.project || !p.stress) {
      throw new Error('name, email, project, stress are required');
    }
    var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.email));
    if (!ok) throw new Error('invalid email');

    var consent = String(p.feedback_consent || '').toLowerCase();
    if (['yes','true','on','1'].indexOf(consent) === -1) {
      throw new Error('feedback consent required');
    }
  }

  function normalizeLead_(p, tz) {
    var now = new Date();
    return {
      ts: Utilities.formatDate(now, tz, "yyyy-MM-dd'T'HH:mm:ssXXX"),
      name: String(p.name || '').trim(),
      email: String(p.email || '').trim(),
      phone: String(p.phone || '').trim(),
      project: String(p.project || '').trim(),
      timeline: String(p.timeline || '').trim(),
      stress: String(p.stress || '').trim(),
      feedback_consent: String(p.feedback_consent || '').trim(),
      source: 'chc-site',
      status: 'new'
    };
  }

  function getOrCreateSheet_(sheetName) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(sheetName);
    if (!sh) {
      sh = ss.insertSheet(sheetName);
      sh.appendRow(['lead_id','timestamp','name','email','phone','project','timeline','stress','feedback_consent','source','status']);
    }
    return sh;
  }

  function writeLeadToSheet_(lead, sheetName) {
    var sh = getOrCreateSheet_(sheetName);
    var leadId = 'CHC-' + Utilities.getUuid().slice(0,8).toUpperCase();
    sh.appendRow([leadId, lead.ts, lead.name, lead.email, lead.phone, lead.project, lead.timeline, lead.stress, lead.feedback_consent, lead.source, lead.status]);
    return leadId;
  }

  function sendLeadEmail_(lead, leadId, notifyTo) {
    var subject = '[CHC Lead] ' + lead.name + ' (' + leadId + ')';
    var body = [
      'Lead ID: ' + leadId,
      'Time: ' + lead.ts,
      'Name: ' + lead.name,
      'Email: ' + lead.email,
      'Phone: ' + (lead.phone || '-'),
      'Timeline: ' + (lead.timeline || '-'),
      'Feedback consent: ' + (lead.feedback_consent || '-'),
      '',
      'Project:',
      lead.project,
      '',
      'Stress point:',
      (lead.stress || '-')
    ].join('\n');

    MailApp.sendEmail({ to: notifyTo, replyTo: lead.email, subject: subject, body: body });
  }

  function jsonResponse_(obj) {
    var out = ContentService.createTextOutput(JSON.stringify(obj));
    out.setMimeType(ContentService.MimeType.JSON);
    return out;
  }

  return { handlePost: handlePost };
})();
