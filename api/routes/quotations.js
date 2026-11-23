'use strict';
const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth }  = require('../middleware/auth');
const { hasPerm }      = require('../middleware/rbac');
const { v4: uuid }     = require('uuid');
const { branchRecipients, recipientsFor, sendDueEmails } = require('../emailScheduler');

function departmentForQuotation(q) {
  const text = `${q.includes || ''} ${typeof q.options === 'string' ? q.options : JSON.stringify(q.options || '')}`.toLowerCase();
  if (text.includes('visa')) return 'visa';
  if (text.includes('transport')) return 'transport';
  if (text.includes('ticket') || text.includes('flight')) return 'ticket';
  if (text.includes('hotel')) return 'hotel';
  return 'booking';
}

function parseOptions(options) {
  if (!options) return {};
  if (typeof options === 'object') return options;
  try { return JSON.parse(options); } catch (_) { return {}; }
}

function normalizeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function minusDays(date, days) {
  const d = new Date(date); d.setDate(d.getDate() - days); d.setHours(9, 0, 0, 0); return d;
}

async function queueDepartmentEmails(q, approver) {
  if (!process.env.RESEND_API_KEY) return { queued:0, reason:'RESEND_API_KEY not configured' };
  const options = parseOptions(q.options);
  const events = [];
  Object.values(options).forEach(option => {
    if (!option || typeof option !== 'object') return;
    (option.flights || []).forEach(flight => { const date = normalizeDate(flight.date || flight.flightDate); if (date) events.push({ dept:'ticket', date, leadDays:1, label:'flight' }); });
    (option.transports || []).forEach(transport => { const date = normalizeDate(transport.date || transport.transportDate || transport.pickupDate); if (date) events.push({ dept:'transport', date, leadDays:2, label:'transport' }); });
  });
  const uniqueEvents = [...new Map(events.map(event => [`${event.dept}-${event.date.toISOString().slice(0,10)}`, event])).values()];
  if (!uniqueEvents.length) return { queued:0, reason:'No flight or transport date found in quotation' };
  let queued = 0;
  for (const event of uniqueEvents) {
    const [users] = await pool.execute('SELECT full_name,email FROM users WHERE status="active" AND branch_id=? AND LOWER(department)=? AND email IS NOT NULL', [q.branch_id, event.dept]);
    for (const user of users) {
      const scheduledFor = minusDays(event.date, event.leadDays);
      const subject = `${event.label.toUpperCase()} reminder — ${q.invoice_no} — ${q.client_name}`;
      const html = `<h2>${event.label} reminder</h2><p>The ${event.label} for <b>${q.client_name}</b> is scheduled for <b>${event.date.toLocaleDateString('en-GB')}</b>.</p><p>Quotation: <b>${q.invoice_no}</b><br>Approved by: ${approver.fullName || approver.username}</p>`;
      await pool.execute(`INSERT IGNORE INTO scheduled_emails (id,quotation_id,department,recipient_email,subject,html_body,event_date,scheduled_for) VALUES (?,?,?,?,?,?,?,?)`, [uuid(), q.id, event.dept, user.email, subject, html, event.date.toISOString().slice(0,10), scheduledFor]);
      queued++;
    }
  }
  return { queued, events: uniqueEvents.map(event => ({ department:event.dept, eventDate:event.date.toISOString().slice(0,10), leadDays:event.leadDays })) };
}

function emailEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function professionalEmail({ title, intro, department, quotation, approver, eventLabel, eventDate }) {
  const rows = [
    ['Client', quotation.client_name],
    ['Quotation', quotation.invoice_no],
    ['Department', department.toUpperCase()],
    ...(eventDate ? [['Scheduled date', eventDate]] : []),
    ...(approver ? [['Approved by', approver]] : [])
  ];
  return `<!doctype html><html><body style="margin:0;background:#f3f7f5;font-family:Arial,Helvetica,sans-serif;color:#1d332d"><div style="max-width:640px;margin:24px auto;background:#fff;border:1px solid #dbe8e1;border-radius:16px;overflow:hidden"><div style="padding:24px 28px;background:linear-gradient(135deg,#173d31,#3a8b6b);color:#fff"><div style="font-size:12px;letter-spacing:.14em;font-weight:700;opacity:.85">PAK GLOBE TRAVELS</div><div style="font-size:24px;font-weight:800;margin-top:8px">${emailEsc(title)}</div><div style="font-size:12px;opacity:.8;margin-top:6px">${emailEsc(eventLabel || 'Quotation workflow notification')}</div></div><div style="padding:26px 28px"><p style="font-size:15px;line-height:1.6;margin:0 0 12px">${emailEsc(intro)}</p><table style="width:100%;border-collapse:collapse;margin:20px 0">${rows.map(([label, value]) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #e7efeb;color:#6b7e75;font-size:12px;width:38%">${emailEsc(label)}</td><td style="padding:10px 12px;border-bottom:1px solid #e7efeb;font-size:13px;font-weight:700">${emailEsc(value)}</td></tr>`).join('')}</table><p style="font-size:13px;line-height:1.6;color:#52665d">Please review and process the assigned booking component. This notification was generated automatically by the Pak Globe Travels platform.</p></div><div style="padding:16px 28px;background:#f7fbf8;border-top:1px solid #e7efeb;color:#71837a;font-size:11px;line-height:1.5">This is an automated email. Please do not reply directly unless your branch workflow requires it.<br>Pak Globe Travels · Umrah Operations</div></div></body></html>`;
}

async function emailBranding(quotation) {
  const [globalRows] = await pool.execute('SELECT company_name,tagline,phone,email,address,logo_url,brand_color FROM settings WHERE scope="global" ORDER BY updated_at DESC,id DESC LIMIT 1');
  let brand = { ...(globalRows[0] || {}) };
  if (quotation.branch_id) {
    const [branchRows] = await pool.execute('SELECT name,phone,email,address,logo_url,brand_color FROM branches WHERE id=? LIMIT 1', [quotation.branch_id]);
    if (branchRows[0]) brand = { ...brand, ...Object.fromEntries(Object.entries(branchRows[0]).filter(([, value]) => value !== null && value !== '')) };
    const [branchSettings] = await pool.execute('SELECT company_name,tagline,phone,email,address,logo_url,brand_color FROM settings WHERE scope="branch" AND branch_id=? ORDER BY updated_at DESC,id DESC LIMIT 1', [quotation.branch_id]);
    if (branchSettings[0]) brand = { ...brand, ...Object.fromEntries(Object.entries(branchSettings[0]).filter(([, value]) => value !== null && value !== '')) };
  }
  const baseUrl = process.env.APP_URL || '';
  if (brand.logo_url && brand.logo_url.startsWith('/')) brand.logo_url = `${baseUrl}${brand.logo_url}`;
  return { name: brand.company_name || 'Pak Globe Travels', tagline: brand.tagline || 'Luxury Umrah Operations', logo_url: brand.logo_url || '', brand_color: /^#[0-9a-f]{6}$/i.test(brand.brand_color || '') ? brand.brand_color : '#b8893d' };
}

function luxuryProfessionalEmail({ title, intro, department, quotation, approver, recipient, issue, action, eventLabel, eventDate, brand }) {
  const labels = { hotel: 'Hotel Operations', visa: 'Visa Operations', ticket: 'Ticketing & Flights', transport: 'Transport Operations', booking: 'Booking Coordination' };
  const departmentLabel = labels[department] || department.toUpperCase();
  const rows = [['Client / Group', quotation.client_name], ['Quotation number', quotation.invoice_no], ['Assigned department', departmentLabel], ['Assigned to', recipient], ...(eventDate ? [['Scheduled date', eventDate]] : []), ...(approver ? [['Approved by', approver]] : [])];
  const logo = brand.logo_url ? `<img src="${emailEsc(brand.logo_url)}" alt="${emailEsc(brand.name)}" style="max-width:150px;max-height:42px;object-fit:contain;display:block;margin-bottom:14px">` : '<div style="width:42px;height:42px;border:1px solid rgba(255,255,255,.55);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;margin-bottom:14px">PG</div>';
  return `<!doctype html><html><body style="margin:0;background:#f4f1eb;font-family:Arial,Helvetica,sans-serif;color:#27352f"><div style="max-width:680px;margin:24px auto;background:#fff;border:1px solid #e4d9c7;border-radius:18px;overflow:hidden;box-shadow:0 12px 36px rgba(63,48,28,.12)"><div style="padding:28px 32px;background:linear-gradient(135deg,#173d31,#285f4b);color:#fff">${logo}<div style="font-size:11px;letter-spacing:.16em;font-weight:700;opacity:.82">${emailEsc(brand.name).toUpperCase()}</div><div style="font-size:25px;font-weight:800;margin-top:8px">${emailEsc(title)}</div><div style="font-size:12px;opacity:.82;margin-top:7px">${emailEsc(eventLabel || brand.tagline)}</div></div><div style="padding:28px 32px"><div style="display:inline-block;padding:6px 10px;border-radius:999px;background:#fbf2df;color:#8c6428;font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase">${emailEsc(departmentLabel)}</div><p style="font-size:16px;line-height:1.65;margin:16px 0 10px">${emailEsc(intro)}</p><table style="width:100%;border-collapse:collapse;margin:20px 0">${rows.map(([label, value]) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #eee9df;color:#7b817a;font-size:12px;width:38%">${emailEsc(label)}</td><td style="padding:10px 12px;border-bottom:1px solid #eee9df;font-size:13px;font-weight:700">${emailEsc(value)}</td></tr>`).join('')}</table><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0"><div style="padding:14px;border-left:4px solid #b8893d;background:#fff9ef;border-radius:8px"><div style="font-size:10px;color:#866b42;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Issue</div><div style="font-size:13px;line-height:1.45;margin-top:5px">${emailEsc(issue)}</div></div><div style="padding:14px;border-left:4px solid #285f4b;background:#f0f8f4;border-radius:8px"><div style="font-size:10px;color:#326651;font-weight:800;letter-spacing:.08em;text-transform:uppercase">Action required</div><div style="font-size:13px;line-height:1.45;margin-top:5px">${emailEsc(action)}</div></div></div><p style="font-size:12px;line-height:1.6;color:#68736c;margin-bottom:0">Please update the relevant department workflow after completing this action. This is an automated notification from the Pak Globe Travels operations desk.</p></div><div style="padding:17px 32px;background:#faf8f3;border-top:1px solid #eee9df;color:#7a827b;font-size:11px;line-height:1.55">${emailEsc(brand.name)} · ${emailEsc(brand.tagline)}<br>Automated email — please reply only if your branch workflow requires assistance.</div></div></body></html>`;
}

function compactProfessionalEmail({ title, intro, department, quotation, approver, recipient, issue, action, eventLabel, eventDate, brand, details = [] }) {
  const labels = { hotel: 'Hotel', visa: 'Visa', ticket: 'Ticketing', transport: 'Transport', booking: 'Booking' };
  const detailRows = details.slice(0, 12).map(item => `<tr><td style="padding:7px 9px;border-bottom:1px solid #eee9df;color:#7b817a;font-size:11px;width:34%">${emailEsc(item.label)}</td><td style="padding:7px 9px;border-bottom:1px solid #eee9df;font-size:12px;font-weight:700">${emailEsc(item.value)}</td></tr>`).join('');
  const logo = brand.logo_url ? `<img src="${emailEsc(brand.logo_url)}" alt="${emailEsc(brand.name)}" style="max-width:112px;max-height:30px;object-fit:contain;display:block">` : '<div style="width:30px;height:30px;border:1px solid rgba(255,255,255,.6);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800">PG</div>';
  return `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:Arial,Helvetica,sans-serif;color:#27352f"><div style="max-width:590px;margin:16px auto;background:#fff;border:1px solid #e4d9c7;border-radius:12px;overflow:hidden"><div style="padding:16px 20px;background:linear-gradient(135deg,#173d31,#285f4b);color:#fff;display:flex;align-items:center;gap:12px">${logo}<div><div style="font-size:9px;letter-spacing:.14em;font-weight:700;opacity:.84">${emailEsc(brand.name).toUpperCase()}</div><div style="font-size:18px;font-weight:800;margin-top:3px">${emailEsc(title)}</div></div></div><div style="padding:18px 20px"><div style="display:inline-block;padding:4px 8px;border-radius:999px;background:#fbf2df;color:#8c6428;font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase">${emailEsc(labels[department] || department)}</div><p style="font-size:13px;line-height:1.45;margin:10px 0 12px">${emailEsc(intro)}</p><table style="width:100%;border-collapse:collapse;margin:0 0 12px"><tr><td style="padding:7px 9px;border-bottom:1px solid #eee9df;color:#7b817a;font-size:11px;width:34%">Assigned to</td><td style="padding:7px 9px;border-bottom:1px solid #eee9df;font-size:12px;font-weight:700">${emailEsc(recipient)}</td></tr><tr><td style="padding:7px 9px;border-bottom:1px solid #eee9df;color:#7b817a;font-size:11px">Quotation</td><td style="padding:7px 9px;border-bottom:1px solid #eee9df;font-size:12px;font-weight:700">${emailEsc(quotation.invoice_no)} · ${emailEsc(quotation.client_name)}</td></tr>${eventDate ? `<tr><td style="padding:7px 9px;border-bottom:1px solid #eee9df;color:#7b817a;font-size:11px">Reminder date</td><td style="padding:7px 9px;border-bottom:1px solid #eee9df;font-size:12px;font-weight:700">${emailEsc(eventDate)}</td></tr>` : ''}</table>${detailRows ? `<div style="font-size:10px;color:#7f6a46;font-weight:800;letter-spacing:.08em;text-transform:uppercase;margin:12px 0 5px">Quotation details</div><table style="width:100%;border-collapse:collapse">${detailRows}</table>` : ''}<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px"><div style="padding:9px;border-left:3px solid #b8893d;background:#fff9ef;border-radius:6px"><div style="font-size:9px;color:#866b42;font-weight:800;text-transform:uppercase">Issue</div><div style="font-size:11px;line-height:1.35;margin-top:3px">${emailEsc(issue)}</div></div><div style="padding:9px;border-left:3px solid #285f4b;background:#f0f8f4;border-radius:6px"><div style="font-size:9px;color:#326651;font-weight:800;text-transform:uppercase">Do this</div><div style="font-size:11px;line-height:1.35;margin-top:3px">${emailEsc(action)}</div></div></div></div><div style="padding:10px 20px;background:#faf8f3;border-top:1px solid #eee9df;color:#7a827b;font-size:10px;line-height:1.4">${emailEsc(brand.name)} · ${emailEsc(brand.tagline)} · Automated ${emailEsc(eventLabel || 'workflow notification')}</div></div></body></html>`;
}

function departmentDetails(options, department) {
  const details = [];
  Object.values(options).forEach(option => {
    if (!option || typeof option !== 'object') return;
    if (department === 'hotel') (option.hotels || []).forEach(hotel => details.push(
      { label: 'Hotel', value: hotel.name || 'Selected hotel' },
      { label: 'City / stay', value: `${hotel.city || '—'} · ${hotel.checkIn || '—'} to ${hotel.checkOut || '—'}` },
      { label: 'Room / meal', value: `${hotel.roomType || '—'} / ${hotel.meal || '—'}` },
      { label: 'Nights / rooms', value: `${hotel.nights || '—'} / ${hotel.qty || '—'}` }
    ));
    if (department === 'ticket') (option.flights || []).forEach(flight => details.push({ label: 'Flight', value: `${flight.date || '—'} · ${flight.airline || '—'} · ${flight.sec || 'Route not entered'}` }));
    if (department === 'transport') (option.transports || []).forEach(transport => details.push({ label: 'Transport', value: `${transport.sector || '—'} · ${transport.vehicle || '—'} · Qty ${transport.qty || '—'}` }));
    if (department === 'visa' && option.visa) details.push({ label: 'Visa', value: `SAR ${option.visa.rate || 0} · Qty ${option.visa.qty || 0}` });
  });
  return details;
}

async function queueConfiguredDepartmentEmails(q, approver) {
  if (!process.env.RESEND_API_KEY) return { queued: 0, reason: 'RESEND_API_KEY not configured' };
  const routing = await branchRecipients(q.branch_id);
  if (!routing.enabled) return { queued: 0, reason: 'Branch email automation is disabled' };
  const options = parseOptions(q.options);
  const departments = new Set();
  const events = [];
  Object.values(options).forEach(option => {
    if (!option || typeof option !== 'object') return;
    if ((option.flights || []).length || Number(option.ticketPKR || option.ticket_pkr) > 0) departments.add('ticket');
    if ((option.transports || []).length || Number(option.transportRate || option.transport_rate) > 0) departments.add('transport');
    if ((option.hotels || []).length) departments.add('hotel');
    if (option.visa && Number(option.visa.rate || option.visa.visaRate) > 0) departments.add('visa');
    (option.flights || []).forEach(flight => { const date = normalizeDate(flight.date || flight.flightDate); if (date) events.push({ dept: 'ticket', date, leadDays: 1, label: 'flight confirmation', details: [{ label: 'Flight', value: `${flight.date || '—'} · ${flight.airline || '—'} · ${flight.sec || 'Route not entered'}` }] }); });
    (option.transports || []).forEach(transport => { const date = normalizeDate(transport.date || transport.transportDate || transport.pickupDate); if (date) events.push({ dept: 'transport', date, leadDays: 1, label: 'transport confirmation', details: [{ label: 'Transport', value: `${transport.sector || '—'} · ${transport.vehicle || '—'} · Qty ${transport.qty || '—'}` }] }); });
    (option.hotels || []).forEach(hotel => { const date = normalizeDate(hotel.checkIn || hotel.checkin_date); if (date) events.push({ dept: 'hotel', date, leadDays: 1, label: 'hotel booking confirmation', details: [{ label: 'Hotel', value: hotel.name || 'Selected hotel' }, { label: 'City / stay', value: `${hotel.city || '—'} · ${hotel.checkIn || '—'} to ${hotel.checkOut || '—'}` }, { label: 'Room / meal', value: `${hotel.roomType || '—'} / ${hotel.meal || '—'}` }, { label: 'Nights / rooms', value: `${hotel.nights || '—'} / ${hotel.qty || '—'}` }] }); });
  });
  if (/visa/i.test(q.includes || '')) departments.add('visa');
  const travelStart = normalizeDate((String(q.travel_dates || '').match(/\d{4}-\d{2}-\d{2}/) || [])[0]);
  if (travelStart && departments.has('visa')) events.push({ dept: 'visa', date: travelStart, leadDays: 1, label: 'visa confirmation', details: [{ label: 'Travel date', value: travelStart.toISOString().slice(0, 10) }] });
  if (travelStart && departments.has('transport') && !events.some(event => event.dept === 'transport')) events.push({ dept: 'transport', date: travelStart, leadDays: 1, label: 'transport confirmation', details: [{ label: 'Travel date', value: travelStart.toISOString().slice(0, 10) }] });
  if (!departments.size) departments.add('booking');
  const eventMap = new Map();
  events.forEach(event => {
    const key = `${event.dept}-${event.date.toISOString().slice(0, 10)}`;
    const existing = eventMap.get(key);
    if (existing) existing.details = [...existing.details, ...(event.details || [])];
    else eventMap.set(key, { ...event, details: [...(event.details || [])] });
  });
  const uniqueEvents = [...eventMap.values()];
  let queued = 0;
  const approverName = approver.fullName || approver.username;
  const brand = await emailBranding(q);
  const departmentWork = {
    hotel: { issue: 'Approved quotation requires hotel availability and contract verification.', action: 'Confirm hotel, room type, meal plan, dates and supplier rate.' },
    visa: { issue: 'Approved quotation includes visa processing that needs department review.', action: 'Review visa quantity, passenger documents and current visa requirements.' },
    ticket: { issue: 'Approved quotation includes flight or ticketing work that needs confirmation.', action: 'Confirm sectors, availability, baggage and ticket issuance timeline.' },
    transport: { issue: 'Approved quotation includes ground transport that needs supplier coordination.', action: 'Confirm route, vehicle, pickup timing and transport rate.' },
    booking: { issue: 'Approved quotation requires general booking coordination.', action: 'Review the full quotation and coordinate final confirmation.' }
  };
  // Approval only creates the reminder schedule. Department teams receive one
  // confirmation reminder before their relevant date, not an approval blast.
  for (const department of []) {
    const recipients = await recipientsFor(q, department, routing);
    for (const recipient of recipients) {
      const subject = `Approved quotation ${q.invoice_no} | ${q.client_name}`;
      const work = departmentWork[department] || departmentWork.booking;
      const html = compactProfessionalEmail({ title: 'Quotation Approved', intro: `The quotation for ${q.client_name} has been approved and is ready for department processing.`, department, quotation: q, approver: approverName, recipient, issue: work.issue, action: work.action, eventLabel: 'Approval workflow', brand, details: departmentDetails(options, department) });
      await pool.execute(`INSERT IGNORE INTO scheduled_emails (id,quotation_id,department,recipient_email,subject,html_body,event_date,scheduled_for) VALUES (?,?,?,?,?,?,?,NOW())`, [uuid(), q.id, department, recipient, subject, html, null]);
      queued++;
    }
  }
  for (const event of uniqueEvents) {
    const recipients = await recipientsFor(q, event.dept, routing);
    for (const recipient of recipients) {
      const scheduledFor = minusDays(event.date, event.leadDays);
      const formattedDate = event.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
      const subject = `Reminder: ${event.label} | ${q.invoice_no} | ${q.client_name}`;
      const work = departmentWork[event.dept] || departmentWork.booking;
      const reminderAction = event.dept === 'hotel' ? 'Please obtain hotel booking confirmation and update the quotation workflow.' : work.action;
      const html = compactProfessionalEmail({ title: 'Upcoming Booking Reminder', intro: `Please review the quotation details and complete the ${event.label}.`, department: event.dept, quotation: q, approver: approverName, recipient, issue: `The ${event.label} is due soon.`, action: reminderAction, eventLabel: 'Scheduled activity reminder', eventDate: formattedDate, brand, details: event.details });
      await pool.execute(`INSERT IGNORE INTO scheduled_emails (id,quotation_id,department,recipient_email,subject,html_body,event_date,scheduled_for) VALUES (?,?,?,?,?,?,?,?)`, [uuid(), q.id, event.dept, recipient, subject, html, event.date.toISOString().slice(0, 10), scheduledFor]);
      queued++;
    }
  }
  return { queued, departments: [...departments], events: uniqueEvents.map(event => ({ department: event.dept, eventDate: event.date.toISOString().slice(0, 10), leadDays: event.leadDays })) };
}

function canQuot(action = 'view') {
  return (req, res, next) => {
    if (hasPerm(req.user, 'quotations_pvt', action) || 
        hasPerm(req.user, 'quotations_grp', action) || 
        hasPerm(req.user, 'allquot', action)) {
      return next();
    }
    return res.status(403).json({ error: 'Permission denied' });
  };
}

// GET /api/quotations
router.get('/', requireAuth, canQuot('view'), async (req, res) => {
  try {
    let sql = 'SELECT * FROM quotations WHERE deleted_at IS NULL';
    const params = [];
    const { type, status, search } = req.query;

    // Role-based scope
    const role = req.user.role;
    if (role === 'user') {
      sql += ' AND created_by = ?'; params.push(req.user.userId);
    } else if (['branch_admin', 'editor', 'viewer'].includes(role)) {
      sql += ' AND branch_id = ?'; params.push(req.user.branchId || null);
    }
    if (req.query.mine === '1' && role !== 'user') {
      sql += ' AND created_by = ?'; params.push(req.user.userId);
    }
    // admin & superadmin see everything

    if (type) { sql += ' AND type = ?'; params.push(type); }
    if (status === 'pending') {
      // The approval queue includes drafts waiting for review and quotations
      // already moved into processing but not approved yet.
      sql += " AND status IN ('pending','in_process')";
    } else if (status) {
      sql += ' AND status = ?'; params.push(status);
    }
    if (search) {
      sql += ' AND (client_name LIKE ? OR invoice_no LIKE ? OR contact_no LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/quotations/:id
router.get('/:id', requireAuth, canQuot('view'), async (req, res) => {
  try {
    const params = [req.params.id];
    let sql = 'SELECT * FROM quotations WHERE id=? AND deleted_at IS NULL';
    if (req.query.mine === '1') { sql += ' AND created_by=?'; params.push(req.user.userId); }
    sql += ' LIMIT 1';
    const [rows] = await pool.execute(sql, params);
    if (!rows.length) return res.status(404).json({ error: 'Quotation not found' });
    const quotation = rows[0];
    const [globalRows] = await pool.execute(
      'SELECT * FROM settings WHERE scope="global" ORDER BY updated_at DESC, id DESC LIMIT 1'
    );
    let brandSettings = globalRows[0] || {};
    if (quotation.branch_id) {
      const [branchRows] = await pool.execute(
        'SELECT id,name,code,phone,email,address,license_no,logo_url,brand_color FROM branches WHERE id=? LIMIT 1',
        [quotation.branch_id]
      );
      const branch = branchRows[0] || null;
      if (branch) {
        brandSettings.company_name = branch.name;
        brandSettings.branch_name = branch.name;
        brandSettings.branch_code = branch.code;
        brandSettings.logo_url = branch.logo_url || null;
        if (branch.brand_color) brandSettings.brand_color = branch.brand_color;
        if (branch.phone) brandSettings.phone = branch.phone;
        if (branch.email) brandSettings.email = branch.email;
        if (branch.address) brandSettings.address = branch.address;
        if (branch.license_no) brandSettings.license_no = branch.license_no;
      }
      const [branchSettingsRows] = await pool.execute(
        'SELECT * FROM settings WHERE scope="branch" AND branch_id=? ORDER BY updated_at DESC,id DESC LIMIT 1',
        [quotation.branch_id]
      );
      if (branchSettingsRows[0]) {
        const bs = branchSettingsRows[0];
        Object.keys(bs).forEach(key => {
          if (bs[key] !== null && bs[key] !== '') {
            if (key === 'company_name' && !bs[key].trim()) return;
            if (key === 'brand_color' && bs[key] === '#7EC8E3' && branch?.brand_color) return;
            brandSettings[key] = bs[key];
          }
        });
      }
      if (!brandSettings.company_name || brandSettings.company_name === globalRows[0]?.company_name) {
        brandSettings.company_name = branch ? branch.name : brandSettings.company_name;
      }
    }
    quotation.brand_settings = {
      company_name: brandSettings.company_name,
      branch_name: brandSettings.branch_name || brandSettings.company_name,
      tagline: brandSettings.tagline,
      phone: brandSettings.phone,
      email: brandSettings.email,
      address: brandSettings.address,
      license_no: brandSettings.license_no,
      logo_url: brandSettings.logo_url,
      brand_color: brandSettings.brand_color,
      terms_text: brandSettings.terms_text,
      disclaimer_text: brandSettings.disclaimer_text
    };
    res.json(quotation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/quotations
router.post('/', requireAuth, canQuot('add'), async (req, res) => {
  try {
    const { type, client_name, contact_no, travel_dates, includes,
            adult_pax, child_pax, infant_pax, options } = req.body;
    if (!type || !client_name) return res.status(400).json({ error: 'type and client_name required' });

    // Auto generate invoice number
    let [settRows] = await pool.execute('SELECT invoice_prefix, invoice_next FROM settings WHERE scope="global" LIMIT 1');
    let updateSql = 'UPDATE settings SET invoice_next = invoice_next + 1 WHERE scope="global"';
    let updateParams = [];

    if (req.user.branchId) {
      const [bSett] = await pool.execute('SELECT invoice_prefix, invoice_next FROM settings WHERE scope="branch" AND branch_id=? LIMIT 1', [req.user.branchId]);
      if (bSett.length) {
        settRows = bSett;
        updateSql = 'UPDATE settings SET invoice_next = invoice_next + 1 WHERE scope="branch" AND branch_id=?';
        updateParams = [req.user.branchId];
      }
    }

    const sett   = settRows[0] || { invoice_prefix: 'PGT', invoice_next: 1 };
    const month  = new Date().toISOString().slice(0,7).replace('-','');
    const num    = String(sett.invoice_next || 1).padStart(4,'0');
    const inv_no = `${sett.invoice_prefix || 'PGT'}-${month}-${num}`;

    // Increment counter
    await pool.execute(updateSql, updateParams);

    const requestedBranchId = ['superadmin', 'admin'].includes(req.user.role) && req.body.branch_id
      ? req.body.branch_id : (req.user.branchId || null);
    let bName = req.body.branch_name || null;
    if (requestedBranchId) {
      const [brRows] = await pool.execute('SELECT name FROM branches WHERE id = ? AND status="active" LIMIT 1', [requestedBranchId]);
      if (!brRows.length) return res.status(400).json({ error: 'Selected branch is not active or does not exist' });
      bName = brRows[0].name;
    }

    const id = uuid();
    await pool.execute(
      `INSERT INTO quotations
       (id,invoice_no,type,client_name,contact_no,travel_dates,includes,
        adult_pax,child_pax,infant_pax,options,created_by,branch_id,branch_name)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, inv_no, type, client_name, contact_no||null, travel_dates||null,
       includes||null, parseInt(adult_pax)||0, parseInt(child_pax)||0,
       parseInt(infant_pax)||0,
       options ? JSON.stringify(options) : null,
       req.user.userId, requestedBranchId, bName]
    );

    res.json({ id, invoice_no: inv_no, ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/component-status', requireAuth, canQuot('edit'), async (req, res) => {
  try {
    const allowedDepartments = ['ticket', 'visa', 'hotel', 'transport'];
    const allowedStatuses = ['pending', 'in_process', 'done'];
    const department = String(req.body?.department || '').toLowerCase();
    const status = String(req.body?.status || '').toLowerCase();
    if (!allowedDepartments.includes(department) || !allowedStatuses.includes(status)) return res.status(400).json({ error: 'Invalid department or component status' });
    const [rows] = await pool.execute('SELECT component_statuses FROM quotations WHERE id=? AND deleted_at IS NULL LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Quotation not found' });
    const current = parseOptions(rows[0].component_statuses);
    current[department] = status;
    await pool.execute('UPDATE quotations SET component_statuses=? WHERE id=?', [JSON.stringify(current), req.params.id]);
    res.json({ ok: true, component_statuses: current });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/quotations/:id
router.put('/:id', requireAuth, canQuot('edit'), async (req, res) => {
  try {
    const { client_name, contact_no, travel_dates, includes, status,
            adult_pax, child_pax, infant_pax, options, shares } = req.body;
    if (status === 'approved' && !['superadmin','admin','branch_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only branch or head-office admins can approve quotations' });
    }
    const previous = (await pool.execute('SELECT * FROM quotations WHERE id=? LIMIT 1', [req.params.id]))[0][0];
    if (!previous) return res.status(404).json({ error: 'Quotation not found' });
    if (req.user.role === 'user' && previous.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'You can edit your own quotations only' });
    }
    if (['branch_admin', 'editor', 'viewer'].includes(req.user.role) && previous.branch_id && req.user.branchId && previous.branch_id !== req.user.branchId) {
      return res.status(403).json({ error: 'You can manage quotations for your assigned branch only' });
    }
    // Status actions send a partial payload. Preserve stored values so
    // mysql2 never receives undefined bind parameters during approval.
    const nextClientName = client_name === undefined ? previous.client_name : client_name;
    const nextContactNo = contact_no === undefined ? previous.contact_no : contact_no;
    const nextTravelDates = travel_dates === undefined ? previous.travel_dates : travel_dates;
    const nextIncludes = includes === undefined ? previous.includes : includes;
    const nextStatus = status === undefined ? previous.status : status;
    const nextAdultPax = adult_pax === undefined ? previous.adult_pax : (parseInt(adult_pax) || 0);
    const nextChildPax = child_pax === undefined ? previous.child_pax : (parseInt(child_pax) || 0);
    const nextInfantPax = infant_pax === undefined ? previous.infant_pax : (parseInt(infant_pax) || 0);
    const nextOptions = options === undefined ? previous.options : (options ? JSON.stringify(options) : null);
    const nextShares = shares === undefined ? previous.shares : (shares ? JSON.stringify(shares) : null);
    await pool.execute(
      `UPDATE quotations SET client_name=?,contact_no=?,travel_dates=?,includes=?,
       status=COALESCE(?,status),adult_pax=?,child_pax=?,infant_pax=?,options=?,shares=COALESCE(?,shares) WHERE id=?`,
      [nextClientName ?? null, nextContactNo ?? null, nextTravelDates ?? null, nextIncludes ?? null,
       nextStatus, nextAdultPax, nextChildPax, nextInfantPax,
       nextOptions ?? null, nextShares ?? null,
       req.params.id]
    );
    let email = null;
    if (status === 'approved' && previous?.status !== 'approved') {
      await pool.execute('UPDATE quotations SET approved_at=NOW(), approved_by=? WHERE id=?', [req.user.userId, req.params.id]);
      const currentComponents = parseOptions(previous.component_statuses);
      const optionText = `${previous.includes || ''} ${JSON.stringify(parseOptions(previous.options))}`.toLowerCase();
      ['ticket', 'visa', 'hotel', 'transport'].forEach(department => {
        if (optionText.includes(department) || (department === 'ticket' && optionText.includes('flight'))) currentComponents[department] = currentComponents[department] || 'pending';
      });
      await pool.execute('UPDATE quotations SET component_statuses=? WHERE id=?', [JSON.stringify(currentComponents), req.params.id]);
      try {
        email = await queueConfiguredDepartmentEmails({ ...previous, ...req.body, id:req.params.id }, req.user);
        if (email.queued > 0) sendDueEmails().catch(error => console.error('Approval email dispatch:', error.message));
      } catch (mailError) { email = { queued:0, reason:mailError.message }; }
    }
    res.json({ ok:true, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/quotations/:id  (soft - 30-day recovery)
router.delete('/:id', requireAuth, canQuot('del'), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM quotations WHERE id=? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const q = rows[0];
    if (req.user.role === 'user' && q.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'You can delete your own quotations only' });
    }
    if (['branch_admin', 'editor', 'viewer'].includes(req.user.role) && q.branch_id && req.user.branchId && q.branch_id !== req.user.branchId) {
      return res.status(403).json({ error: 'You can delete quotations for your assigned branch only' });
    }

    await pool.execute('UPDATE quotations SET deleted_at=NOW() WHERE id=?', [req.params.id]);

    const exp = new Date(Date.now() + 30 * 86400 * 1000);
    await pool.execute(
      `INSERT INTO recycle_bin (id,entity_type,entity_id,entity_name,data_snapshot,deleted_by,branch_id,expires_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [uuid(),'quotation',q.id,`${q.invoice_no} - ${q.client_name}`,
       JSON.stringify(q), req.user.userId, req.user.branchId||null, exp]
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
