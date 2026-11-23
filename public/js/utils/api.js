/**
 * PAK GLOBE UNIFIED PLATFORM — API CLIENT UTILITY
 * Wraps fetch() with auth token injection, error handling, and toast notifications
 */

'use strict';

// ─── Configuration ────────────────────────────────────────────────────────────
const API_BASE = '/api';

// ─── API Client ───────────────────────────────────────────────────────────────
const API = {
  async _request(method, endpoint, data = null, isFormData = false) {
    const token = localStorage.getItem('pgt_token');
    const headers = { Authorization: token ? `Bearer ${token}` : '' };
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (data) opts.body = isFormData ? data : JSON.stringify(data);

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, opts);
      if (res.status === 401) {
        localStorage.removeItem('pgt_token');
        location.reload();
        return null;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return json;
    } catch (err) {
      console.error(`API ${method} ${endpoint}:`, err);
      throw err;
    }
  },

  get:    (ep)       => API._request('GET',    ep),
  post:   (ep, d)    => API._request('POST',   ep, d),
  put:    (ep, d)    => API._request('PUT',    ep, d),
  delete: (ep)       => API._request('DELETE', ep),
  upload: (ep, fd)   => API._request('POST',   ep, fd, true),
};

// ─── Toast Notifications ──────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const id  = 'toast-' + Date.now();
  const ico = { success:'bi-check-circle-fill', error:'bi-x-circle-fill',
                info:'bi-info-circle-fill', warn:'bi-exclamation-triangle-fill' };
  const col = { success:'var(--ok)', error:'var(--err)', info:'var(--pri)', warn:'var(--wrn)' };

  const el = document.createElement('div');
  el.id = id;
  el.className = 'toast-item';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
                background:var(--glass-bg);backdrop-filter:blur(20px);
                border:1px solid ${col[type] || col.info}30;
                border-left:3px solid ${col[type] || col.info};
                border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4);
                min-width:260px;max-width:380px;animation:toastIn .3s ease;">
      <i class="bi ${ico[type] || ico.info}" style="color:${col[type]};font-size:16px;flex-shrink:0"></i>
      <span style="font-size:13px;color:var(--t1);font-weight:500;flex:1">${msg}</span>
      <button onclick="document.getElementById('${id}')?.remove()"
              style="background:none;border:none;color:var(--t3);cursor:pointer;font-size:16px;padding:0;line-height:1">×</button>
    </div>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut .3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ─── Loading overlay ──────────────────────────────────────────────────────────
function showLoading(msg = 'Loading...') {
  const el = document.getElementById('loadOverlay');
  if (el) { el.querySelector('.load-msg').textContent = msg; el.style.display = 'flex'; }
}
function hideLoading() {
  const el = document.getElementById('loadOverlay');
  if (el) el.style.display = 'none';
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
function numR(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function fmtNum(n, dec = 0) { return numR(n).toLocaleString('en-PK', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
function fmtSAR(n) { return 'SAR ' + fmtNum(n, 2); }
function fmtPKR(n) { return 'PKR ' + fmtNum(n, 0); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

// ─── Date helpers ─────────────────────────────────────────────────────────────
function toDateStr(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toISOString().slice(0,10);
}
function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' });
}
function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins  = Math.floor(diff/60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins/60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs/24)}d ago`;
}

// ─── Normalize helpers (from original HMS) ────────────────────────────────────
function normName(s) { return String(s||'').toUpperCase().replace(/\s+/g,' ').trim(); }
function normMeal(s = '') {
  const u = s.toUpperCase().replace(/[\.\s_&\/-]/g,'');
  if(u==='RO'||u==='ROOMONLY') return 'RO';
  if(u==='BB'||u==='BEDBREAKFAST'||u==='BREAKFAST') return 'BB';
  if(u==='HB'||u==='HALFBOARD') return 'HB';
  if(u==='FB'||u==='FULLBOARD') return 'FB';
  if(u==='SUHOOR'||u==='SEHRI') return 'Suhoor';
  if(u==='IFTAR'||u==='IFTARI') return 'Iftar';
  return s.trim() || 'RO';
}

export { API, toast, showLoading, hideLoading, $, $$, esc, numR, fmtNum, fmtSAR, fmtPKR, uid, toDateStr, fmtDate, timeAgo, normName, normMeal };
