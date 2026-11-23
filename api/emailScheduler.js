'use strict';
const pool = require('./config/db');

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (_) { return fallback; }
}

function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function collectDates(value, dates = []) {
  if (!value) return dates;
  if (Array.isArray(value)) { value.forEach(item => collectDates(item, dates)); return dates; }
  if (typeof value !== 'object') return dates;
  Object.entries(value).forEach(([key, item]) => {
    if (/date|check.?out|checkout|return/i.test(key)) {
      if (typeof item === 'string') {
        const matches = item.match(/\d{4}-\d{2}-\d{2}/g) || [item];
        matches.forEach(candidate => { const d = parseDate(candidate); if (d) dates.push(d); });
      }
    }
    collectDates(item, dates);
  });
  return dates;
}

function quotationEndDate(q) {
  const dates = collectDates(parseJson(q.options));
  const travel = String(q.travel_dates || '');
  (travel.match(/\d{4}-\d{2}-\d{2}/g) || []).forEach(value => { const d = parseDate(value); if (d) dates.push(d); });
  return dates.sort((a, b) => b - a)[0] || null;
}

async function closeExpiredQuotations() {
  const [rows] = await pool.execute("SELECT id,travel_dates,options,status FROM quotations WHERE deleted_at IS NULL AND status IN ('pending','in_process','approved')");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let closed = 0;
  for (const q of rows) {
    const endDate = quotationEndDate(q);
    if (endDate && endDate < today) {
      await pool.execute("UPDATE quotations SET status='closed',updated_at=NOW() WHERE id=? AND status IN ('pending','in_process','approved')", [q.id]);
      closed++;
    }
  }
  return closed;
}

function normalizeEmails(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(/[;,\n]/);
  return [...new Set(values.map(email => String(email).trim().toLowerCase()).filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))];
}

async function branchRecipients(branchId) {
  if (!branchId) return { enabled: true, recipients: {} };
  const [rows] = await pool.execute('SELECT email, settings FROM branches WHERE id=? LIMIT 1', [branchId]);
  const [settings] = await pool.execute('SELECT email_recipients,email_automation_enabled FROM settings WHERE scope="branch" AND branch_id=? ORDER BY updated_at DESC,id DESC LIMIT 1', [branchId]);
  const branch = rows[0] || {};
  const configured = parseJson(settings[0]?.email_recipients, {});
  return {
    enabled: settings[0]?.email_automation_enabled !== 0,
    fallback: normalizeEmails(branch.email),
    recipients: Object.fromEntries(Object.entries(configured).map(([department, emails]) => [department, normalizeEmails(emails)]))
  };
}

async function recipientsFor(q, department, routing) {
  const configured = routing.recipients[department] || [];
  if (configured.length) return configured;
  const [users] = await pool.execute('SELECT email FROM users WHERE status="active" AND branch_id=? AND LOWER(department)=? AND email IS NOT NULL', [q.branch_id, department]);
  const userEmails = normalizeEmails(users.map(user => user.email));
  return userEmails.length ? userEmails : routing.fallback;
}

async function sendDueEmails() {
  try { await closeExpiredQuotations(); } catch (error) { console.error('Quotation auto-close:', error.message); }
  if (!process.env.RESEND_API_KEY) return;
  const [jobs] = await pool.execute(`SELECT * FROM scheduled_emails WHERE status='queued' AND scheduled_for <= NOW() ORDER BY scheduled_for ASC LIMIT 25`);
  for (const job of jobs) {
    try {
      const [quotationRows] = await pool.execute('SELECT component_statuses FROM quotations WHERE id=? LIMIT 1', [job.quotation_id]);
      const componentStatuses = parseJson(quotationRows[0]?.component_statuses, {});
      if (componentStatuses[job.department] === 'done') {
        await pool.execute("UPDATE scheduled_emails SET status='skipped', sent_at=NOW(), error_message=? WHERE id=?", ['Skipped because this department is already marked Done.', job.id]);
        continue;
      }
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || 'Pak Globe <onboarding@resend.dev>', to: [job.recipient_email], subject: job.subject, html: job.html_body })
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Resend error ${response.status}: ${detail.slice(0, 420)}`);
      }
      await pool.execute(`UPDATE scheduled_emails SET status='sent', sent_at=NOW(), error_message=NULL WHERE id=?`, [job.id]);
    } catch (error) {
      await pool.execute(`UPDATE scheduled_emails SET status='failed', error_message=? WHERE id=?`, [String(error.message).slice(0, 500), job.id]);
      console.error('Scheduled email failed:', error.message);
    }
  }
}

function startEmailScheduler() {
  sendDueEmails().catch(error => console.error('Email scheduler:', error.message));
  return setInterval(() => sendDueEmails().catch(error => console.error('Email scheduler:', error.message)), 15 * 60 * 1000);
}

module.exports = { startEmailScheduler, sendDueEmails, closeExpiredQuotations, branchRecipients, recipientsFor };
