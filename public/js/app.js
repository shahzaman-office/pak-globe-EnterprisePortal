
/* ===== SMART TIME & LUGGAGE FORMATTERS (Legacy Compatibility) ===== */
window.fmtTime = function(inp) {
  if (!inp) return;
  let v = (inp.value || '').trim().toUpperCase();
  if (!v) { inp.value = ''; return; }
  let ampm = '';
  const digits = v.replace(/[^0-9]/g, '');
  const letters = v.replace(/[^APM]/g, '');
  if (letters.includes('A')) ampm = 'AM';
  else if (letters.includes('P')) ampm = 'PM';
  if (!digits) { inp.value = ''; return; }
  let h = 0, m = 0;
  if (digits.length <= 2) {
    h = parseInt(digits, 10);
    m = 0;
  } else if (digits.length === 3) {
    h = parseInt(digits[0], 10);
    m = parseInt(digits.slice(1), 10);
  } else {
    h = parseInt(digits.slice(0, 2), 10);
    m = parseInt(digits.slice(2, 4), 10);
  }
  if (m > 59) m = 59;
  if (h >= 13 && h <= 23) {
    h = h - 12;
    if (!ampm) ampm = 'PM';
  } else if (h === 0) {
    h = 12;
    if (!ampm) ampm = 'AM';
  } else if (h === 12) {
    if (!ampm) ampm = 'PM';
  } else if (h >= 1 && h <= 11 && !ampm) {
    ampm = 'AM';
  }
  if (h > 12) h = 12;
  inp.value = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' ' + ampm;
  triggerCostingCalc();
};

window.fmtLug = function(inp) {
  if (!inp) return;
  let v = (inp.value || '').trim().toUpperCase().replace(/[^0-9]/g, '');
  if (v) inp.value = v + ' Kg';
  else if ((inp.value || '').toUpperCase().includes('2PC')) inp.value = '2PC';
};

/**
 * PAK GLOBE UNIFIED PLATFORM — MAIN APP.JS
 * Global State, Auth, Navigation, and Module Orchestration
 */

'use strict';

// ═══════════════════════════════════════════════════════════
//  GLOBAL STATE OBJECT (G)
// ═══════════════════════════════════════════════════════════
const G = {
  user:         null,
  token:        null,
  hotels:       [],
  _hotelsLoaded: false,
  vendors:      [],
  _vendorsLoaded: false,
  _vendorsLoadedAt: 0,
  branches:     [],
  _branchesLoaded: false,
  _branchesLoadedAt: 0,
  users:        [],
  quotations:   [],
  queries:      [],
  transport:    [],
  _transportLoaded: false,
  _transportLoadedAt: 0,
  settings:     null,
  _settingsLoaded: false,
  _settingsLoadedAt: 0,
  logs:         [],
  recycle:      [],
  _loading:     false,
  _currentPage: 'dash',
};

// ═══════════════════════════════════════════════════════════
//  DOM HELPERS
// ═══════════════════════════════════════════════════════════
const $ = (s, ctx = document) => ctx.querySelector(s);
const $$ = (s, ctx = document) => [...ctx.querySelectorAll(s)];
const HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, char => HTML_ESCAPE_MAP[char]); }
function escAttr(s) { return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function numR(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
function fmtNum(n, d = 0) { return numR(n).toLocaleString('en-PK', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtSAR(n) { return 'SAR ' + fmtNum(n, 0); }
function fmtPKR(n) { return 'PKR ' + fmtNum(n, 0); }
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }); }
function toDateStr(d) {
  if (!d) return '';
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? String(d).slice(0, 10) : date.toISOString().slice(0, 10);
}
function timeAgo(ts) {
  const m = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60); if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}
function normName(s) { return String(s || '').toUpperCase().replace(/\s+/g, ' ').trim(); }

// ═══════════════════════════════════════════════════════════
//  ANIMATION HELPERS (Swipe + Number Counter)
// ═══════════════════════════════════════════════════════════
let _navHistory = [];

function animateCounter(el, targetVal, duration = 900, prefix = '', suffix = '', decimals = 0) {
  if (!el) return;
  const target = parseFloat(targetVal) || 0;
  if (target === 0) { el.textContent = prefix + (0).toFixed(decimals) + suffix; return; }
  let startTime = null;
  const startVal = parseFloat(el.dataset.counterVal) || 0;
  el.dataset.counterVal = target;
  el.classList.add('num-counter');
  function step(ts) {
    if (!startTime) startTime = ts;
    const p = Math.min((ts - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3); // cubic ease-out
    const current = startVal + (target - startVal) * ease;
    const display = decimals > 0 ? current.toFixed(decimals) : Math.round(current);
    el.textContent = prefix + Number(display).toLocaleString('en-PK') + suffix;
    if (p < 1) requestAnimationFrame(step);
    else {
      el.textContent = prefix + Number(target.toFixed(decimals)).toLocaleString('en-PK') + suffix;
      el.classList.add('num-bump');
      setTimeout(() => el.classList.remove('num-bump'), 240);
    }
  }
  requestAnimationFrame(step);
}

function animateCounterText(elId, targetVal, duration = 900, prefix = '', suffix = '', decimals = 0) {
  animateCounter(document.getElementById(elId), targetVal, duration, prefix, suffix, decimals);
}

// Animate an element with slide-in-from-right
function swipeIn(el, dir = 'right') {
  if (!el) return;
  el.classList.remove('swipe-left', 'swipe-right');
  void el.offsetWidth; // force reflow
  el.classList.add(dir === 'left' ? 'swipe-left' : 'swipe-right');
  setTimeout(() => el.classList.remove('swipe-left', 'swipe-right'), 320);
}

// ═══════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════
function toast(msg, type = 'info', dur = 4500) {
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const ico = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill', warn: 'bi-exclamation-triangle-fill' };
  const col = { success: '#34D399', error: '#F87171', info: '#7EC8E3', warn: '#FCD34D' };
  const id  = 't' + Date.now();
  const el  = document.createElement('div');
  el.id = id;
  el.style.cssText = `animation:toastIn .3s ease;margin-bottom:8px;cursor:pointer`;
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;
      background:rgba(15,20,35,0.92);backdrop-filter:blur(20px);
      border:1px solid ${col[type] || col.info}30;border-left:3px solid ${col[type] || col.info};
      border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.5);min-width:260px;max-width:380px;">
      <i class="bi ${ico[type] || ico.info}" style="color:${col[type]};font-size:16px;flex-shrink:0"></i>
      <span style="font-size:13px;color:#EEF2FF;font-weight:500;flex:1;line-height:1.4">${esc(msg)}</span>
      <span onclick="document.getElementById('${id}')?.remove()" style="color:#64748B;font-size:18px;line-height:1;padding:0 2px">×</span>
    </div>`;
  el.onclick = () => el.remove();
  c.appendChild(el);
  setTimeout(() => { el.style.animation = 'toastOut .3s ease forwards'; setTimeout(() => el.remove(), 300); }, dur);
}

// ═══════════════════════════════════════════════════════════
//  LOADING OVERLAY
// ═══════════════════════════════════════════════════════════
function showLoad(msg = 'Loading…') {
  if (G._navigating) return;
  const el = document.getElementById('loadOverlay');
  if (el) { el.querySelector('.load-msg').textContent = msg; el.style.display = 'flex'; }
}
function hideLoad() {
  const el = document.getElementById('loadOverlay');
  if (el) el.style.display = 'none';
}

// ═══════════════════════════════════════════════════════════
//  API CLIENT
// ═══════════════════════════════════════════════════════════
async function api(method, endpoint, data = null, isForm = false) {
  if (method !== 'GET') {
    document.querySelectorAll('.page-section').forEach(page => {
      delete page.dataset.navCachedAt;
    });
  }
  const headers = {};
  if (G.token) headers['Authorization'] = `Bearer ${G.token}`;
  if (!isForm) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (data) opts.body = isForm ? data : JSON.stringify(data);

  const res = await fetch(`/api${endpoint}`, opts);
  if (res.status === 401) {
    if (endpoint !== '/auth/login') {
      logout();
      return null;
    }
  }
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}
const GET  = ep     => api('GET',    ep);
const POST = (ep,d) => api('POST',   ep, d);
const PUT  = (ep,d) => api('PUT',    ep, d);
const DEL  = ep     => api('DELETE', ep);
const UPL  = (ep,d) => api('POST',   ep, d, true);

const _utilityScriptLoads = new Map();
const UTILITY_SCRIPTS = {
  chart: {
    src: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
    ready: () => !!window.Chart
  },
  xlsx: {
    src: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    ready: () => !!window.XLSX
  },
  jspdf: {
    src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    ready: () => !!window.jspdf?.jsPDF
  },
  autotable: {
    src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
    ready: () => !!window.jspdf?.jsPDF?.API?.autoTable
  }
};

function loadUtilityScript(name) {
  const utility = UTILITY_SCRIPTS[name];
  if (!utility) return Promise.reject(new Error(`Unknown utility library: ${name}`));
  if (utility.ready()) return Promise.resolve();
  if (_utilityScriptLoads.has(name)) return _utilityScriptLoads.get(name);

  const existing = document.querySelector(`script[data-utility="${name}"]`);
  const script = existing || document.createElement('script');
  const loaded = new Promise((resolve, reject) => {
    script.addEventListener('load', () => {
      if (utility.ready()) resolve();
      else reject(new Error(`${name} library loaded without its expected API`));
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Unable to load ${name} library`)), { once: true });
    if (!existing) {
      script.async = true;
      script.src = utility.src;
      script.dataset.utility = name;
      document.head.appendChild(script);
    }
  }).catch(error => {
    _utilityScriptLoads.delete(name);
    script.remove();
    throw error;
  });
  _utilityScriptLoads.set(name, loaded);
  return loaded;
}

// ═══════════════════════════════════════════════════════════
//  PERMISSION CHECKER (FRONTEND)
// ═══════════════════════════════════════════════════════════
// Policy:
//   • superadmin → unrestricted (_all)
//   • admin      → full role-level defaults, custom matrix IGNORED
//                   (prevents blank sidebar from malformed saved JSON)
//   • branch users → custom matrix is authoritative; role defaults fallback
const ROLE_DEFAULTS = {
  superadmin: { _all: true },
  admin: { dash:1,hotels:['view','add','edit','del','exp'],search:1,vendors:['view','add','edit','del'],
           queries:['view','add','edit','del'],ratelist:['view','exp'],
           quotations_pvt:['view','add','edit','del'],quotations_grp:['view','add','edit','del'],
           allquot:['view','add','edit','del'],transport:['view','add','edit','del'],
           import:['view','imp','exp'],
           users:['view','add','edit','del'],branches:['view','add','edit'],
           logs:['view'],recycle:['view','del'],backup:['view'],settings:['view','edit'],
           dedup:['view','del'],packages:['view','add','edit','del'],images:['view','add','del'] },
  branch_admin: { dash:1,hotels:['view'],search:1,ratelist:['view','exp'],
           queries:['view','add','edit'],quotations_pvt:['view','add','edit','del'],
           quotations_grp:['view','add','edit','del'],allquot:['view'],transport:['view'],
           import:['view','exp'],users:['view','add','edit'],
           branches:['view','edit'],logs:['view'],recycle:['view'],settings:['view','edit'],
           packages:['view','add','edit'],images:['view','add'] },
  editor: { dash:1,hotels:['view','add','edit','exp'],search:1,vendors:['view','add','edit'],
           ratelist:['view','exp'],queries:['view','add','edit'],
           quotations_pvt:['view','add','edit'],quotations_grp:['view','add','edit'],
           transport:['view','add','edit'],import:['view','imp','exp'],
           packages:['view','add','edit'],images:['view','add'] },
  viewer: { dash:1,hotels:['view'],search:1,ratelist:['view'],queries:['view'],
           quotations_pvt:['view'],quotations_grp:['view'],transport:['view'],
           packages:['view'] },
  user:   { dash:1,search:1,ratelist:['view'],quotations_pvt:['view','add','edit'],
           quotations_grp:['view','add','edit'],transport:['view'],
           packages:['view','add'] }
};

// Roles that always use role-level defaults and NEVER consult custom matrix
const GLOBAL_ADMIN_ROLES = new Set(['superadmin', 'admin']);

function P(module, action = 'view') {
  if (!G.user) return false;
  const def = ROLE_DEFAULTS[G.user.role] || {};
  if (def._all) return true; // superadmin

  // ── Admin: ALWAYS use role defaults, ignore any saved custom matrix ──
  // This prevents blank sidebar from malformed permission JSON
  if (GLOBAL_ADMIN_ROLES.has(G.user.role)) {
    const rm = def[module];
    if (!rm) return false;
    if (typeof rm === 'number') return action === 'view';
    return Array.isArray(rm) ? rm.includes(action) : !!rm[action];
  }

  // ── Branch users: custom matrix is authoritative when valid ──
  let up = G.user.permissions || null;
  if (typeof up === 'string') {
    try { up = JSON.parse(up); } catch (_) { up = null; }
  }
  if (up && typeof up === 'object' && Object.keys(up).length > 0) {
    if (up[module] === undefined) return false;
    if (Array.isArray(up[module])) return up[module].includes(action);
    if (typeof up[module] === 'boolean') return up[module];
    if (up[module][action] !== undefined) return !!up[module][action];
    return false;
  }

  // Fall back to role defaults
  const rm = def[module];
  if (!rm) return false;
  if (typeof rm === 'number') return action === 'view';
  return Array.isArray(rm) ? rm.includes(action) : !!rm[action];
}

// ═══════════════════════════════════════════════════════════
//  SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════════
function saveSession(token, user) {
  G.token = token;
  G.user  = user;
  localStorage.setItem('pgt_token', token);
  localStorage.setItem('pgt_user',  JSON.stringify(user));
}

function loadSession() {
  const token = localStorage.getItem('pgt_token');
  const user  = localStorage.getItem('pgt_user');
  if (token && user) {
    try { G.token = token; G.user = JSON.parse(user); return true; } catch(_) {}
  }
  return false;
}

function logout() {
  if (G.token) POST('/auth/logout').catch(() => {});
  G.token = null; G.user = null;
  localStorage.removeItem('pgt_token');
  localStorage.removeItem('pgt_user');
  showLogin();
}

// ═══════════════════════════════════════════════════════════
//  UI SHOW/HIDE
// ═══════════════════════════════════════════════════════════
function showLogin() {
  document.getElementById('lp').style.display  = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('loginUser').focus?.();
}

// Add accessible column labels once so regular data tables can become compact
// two-column cards on phones without duplicating every table template.
function decorateMobileDataTables(root = document) {
  const tables = root.querySelectorAll?.('.tbl, .table') || [];
  tables.forEach(table => {
    if (table.closest('.hotel-search-card__rates, .calc-table-wrap, .calc-tbl')) return;
    const headers = [...table.querySelectorAll(':scope > thead > tr:last-child > th')]
      .map(th => th.textContent.trim().replace(/\s+/g, ' '));
    if (!headers.length) return;
    table.classList.add('mobile-card-table');
    table.querySelectorAll(':scope > tbody > tr').forEach(row => {
      [...row.children].forEach((cell, index) => {
        if (cell.tagName !== 'TD' || cell.hasAttribute('colspan')) return;
        if (!cell.dataset.label && headers[index]) cell.dataset.label = headers[index];
      });
    });
  });
}

function startMobileTableCards() {
  decorateMobileDataTables();
  const content = document.getElementById('ct');
  if (!content || content.dataset.mobileCardsObserver) return;
  content.dataset.mobileCardsObserver = 'true';
  let timer = 0;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => decorateMobileDataTables(content), 40);
  }).observe(content, { childList: true, subtree: true });
}

function showApp() {
  document.getElementById('lp').style.display  = 'none';
  document.getElementById('app').style.display = 'flex';
  buildSidebar();
  updateUserWidget();
  startMobileTableCards();
}

// ═══════════════════════════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════════════════════════
async function doLogin() {
  const btn = $('#loginBtn');
  if (!btn || btn.disabled) return;

  const username = $('#loginUser').value.trim();
  const password = $('#loginPass').value;
  if (!username || !password) { toast('Enter username and password', 'warn'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Signing in…';

  try {
    const data = await POST('/auth/login', { username, password });
    if (!data) return;
    saveSession(data.token, data.user);
    showApp();
    await bootData();
    nav('dash');
    toast(`Welcome back, ${data.user.fullName || data.user.username}! 👋`, 'success');
  } catch (err) {
    toast(err.message || 'Login failed', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-box-arrow-in-right me-2"></i>Sign In';
  }
}

// ═══════════════════════════════════════════════════════════
//  BOOT: Load core data
// ═══════════════════════════════════════════════════════════
async function bootData() {
  showLoad('Loading platform data…');
  try {
    const [dash, hotels, vendors, branches, transport, branding, settings] = await Promise.all([
      GET('/dashboard'),
      GET('/hotels?summary=1&paginate=1&page=1&limit=1'),
      GET('/vendors'),
      GET('/branches'),
      GET('/transport'),
      GET('/branding'),
      P('settings') ? GET('/settings') : Promise.resolve(null),
    ]);

    G.hotels    = hotels?.items || hotels || [];
    G._hotelSummaryMeta = hotels?.total ? hotels : null;
    G._hotelsLoaded = true;
    G._hotelsDetailedLoaded = false;
    G.vendors   = vendors   || [];
    G._vendorsLoaded = true;
    G._vendorsLoadedAt = Date.now();
    G.branches  = branches  || [];
    G._branchesLoaded = true;
    G._branchesLoadedAt = Date.now();
    G.transport = transport || [];
    G._transportLoaded = true;
    G._transportLoadedAt = Date.now();

    // Merge settings & branding: branch identity takes precedence for branch users
    const activeBranchId = G.user?.branchId || G.user?.branch_id;
    const activeBranch = activeBranchId ? G.branches.find(b => b.id === activeBranchId) : null;
    G.settings = { ...(settings || {}), ...(branding || {}) };
    if (activeBranch) {
      G.settings.branch_id = activeBranch.id;
      G.settings.branch_name = activeBranch.name;
      G.settings.branch_code = activeBranch.code;
      if (!branding?.company_name || branding.company_name === 'Pak Globe Travels') {
        G.settings.company_name = activeBranch.name;
      }
      if (activeBranch.brand_color && (!branding?.brand_color || branding.brand_color === '#7EC8E3')) {
        G.settings.brand_color = activeBranch.brand_color;
      }
      G.settings.logo_url = branding?.logo_url ?? (activeBranch.logo_url || null);
    }
    G._settingsLoaded = true;
    G._settingsLoadedAt = Date.now();
    updateBrandLogos();
    updateUserWidget();

    // Store dashboard data for rendering
    G._dashData = dash;

    // Update sidebar counts/badges
    updateSidebarBadges(dash);

  } catch (err) {
    console.error('Boot error:', err);
    toast('Failed to load data: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

// ═══════════════════════════════════════════════════════════
//  GLOBAL UTILITY ALIASES & SYSTEM HELPERS
// ═══════════════════════════════════════════════════════════
window.apiFetch = async function(url, opts = {}) {
  const method = opts.method || 'GET';
  const ep = url.startsWith('/api') ? url.replace(/^\/api/, '') : url;
  let data = null;
  if (opts.body) {
    if (typeof opts.body === 'string') {
      try { data = JSON.parse(opts.body); } catch (_) { data = opts.body; }
    } else {
      data = opts.body;
    }
  }
  return api(method, ep, data);
};
window.showLoading = showLoad;
window.hideLoading = hideLoad;

function updateBrandLogos() {
  const branchId = G.user?.branchId || G.user?.branch_id;
  const branch = G.branches?.find(item => item.id === branchId) || null;
  const isBranchUser = Boolean(branchId && branch && !['admin', 'superadmin'].includes(G.user?.role));

  const brandName = isBranchUser ? (branch.name || G.settings?.company_name || 'Pak Globe Travels') : (G.settings?.company_name || 'Pak Globe Travels');
  const brandSub = isBranchUser ? `${branch.name} Portal${branch.code ? ' (' + branch.code + ')' : ''}` : 'Enterprise Portal';

  // Update sidebar branding text
  const sideTxt = document.getElementById('sideBrandTxt');
  if (sideTxt) {
    if (isBranchUser) {
      const parts = brandName.trim().split(/\s+/);
      if (parts.length > 1) {
        const last = parts.pop();
        sideTxt.innerHTML = `${esc(parts.join(' ').toUpperCase())} <span>${esc(last.toUpperCase())}</span>`;
      } else {
        sideTxt.innerHTML = `${esc(brandName.toUpperCase())}`;
      }
    } else {
      sideTxt.innerHTML = `PAK GLOBE <span>TRAVELS</span>`;
    }
  }
  const sideSub = document.getElementById('sideBrandSub');
  if (sideSub) {
    sideSub.textContent = brandSub;
  }

  // Update page title and topbar branding for white-label
  if (isBranchUser) {
    document.title = `${brandName} - Unified Business Platform`;
    const tbBrand = document.getElementById('tbBrandTxt');
    if (tbBrand) tbBrand.textContent = brandName;
  } else {
    document.title = 'Pak Globe Travels - Unified Business Platform';
    const tbBrand = document.getElementById('tbBrandTxt');
    if (tbBrand) tbBrand.textContent = 'Pak Globe Travels';
  }

  // Logo: branch user only shows branch logo if set, never head office's logo
  const logoUrl = isBranchUser ? (branch.logo_url || (G.settings?.logo_url && G.settings.logo_url !== 'http://localhost:3000/uploads/logos/logo_c9d31e2ad81b_1794327292153.jpg' ? G.settings.logo_url : '')) : (G.settings?.logo_url || '');

  ['loginBrandMark', 'sideBrandMark'].forEach(id => {
    const mark = document.getElementById(id);
    if (!mark) return;
    if (!logoUrl) {
      const icon = document.createElement('i');
      icon.className = isBranchUser ? 'bi bi-geo-alt-fill' : 'bi bi-moon-fill';
      icon.setAttribute('aria-hidden', 'true');
      mark.replaceChildren(icon);
      return;
    }
    if (mark.querySelector('img')?.getAttribute('src') === logoUrl) return;
    const image = document.createElement('img');
    image.className = 'brand-logo-image';
    image.alt = brandName;
    image.src = logoUrl;
    image.onerror = () => {
      if (image.parentElement !== mark) return;
      const icon = document.createElement('i');
      icon.className = isBranchUser ? 'bi bi-geo-alt-fill' : 'bi bi-moon-fill';
      icon.setAttribute('aria-hidden', 'true');
      mark.replaceChildren(icon);
    };
    mark.replaceChildren(image);
  });

  // Apply branch custom color if set
  const brandColor = (isBranchUser && branch.brand_color) ? branch.brand_color : (G.settings?.brand_color || '');
  if (brandColor && brandColor !== '#7EC8E3') {
    document.documentElement.style.setProperty('--brand-active-color', brandColor);
    // Also update --pri family so buttons, focus rings, and active links use branch color
    document.documentElement.style.setProperty('--pri', brandColor);
    // Generate alpha variants: simple hex to rgba conversion
    const hexToRgb = h => {
      const r = parseInt(h.slice(1,3), 16), g = parseInt(h.slice(3,5), 16), b = parseInt(h.slice(5,7), 16);
      return isNaN(r) ? null : { r, g, b };
    };
    const rgb = brandColor.length === 7 ? hexToRgb(brandColor) : null;
    if (rgb) {
      document.documentElement.style.setProperty('--priA', `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`);
      document.documentElement.style.setProperty('--priB', `rgba(${rgb.r},${rgb.g},${rgb.b},0.06)`);
      document.documentElement.style.setProperty('--priBrd', `rgba(${rgb.r},${rgb.g},${rgb.b},0.22)`);
    }
  }
}

async function fetchHotels() {
  const hotels = await GET('/hotels?include_vendors=1');
  G.hotels = hotels || [];
  G._hotelsLoaded = true;
  G._hotelsDetailedLoaded = true;
  document.getElementById('hotels')?.setAttribute('data-initialized', '');
  document.getElementById('ratelist')?.setAttribute('data-initialized', '');
  return G.hotels;
}
window.fetchHotels = fetchHotels;

async function ensureDetailedHotels() {
  if (G._hotelsDetailedLoaded) return G.hotels || [];
  showLoad('Loading hotel rates…');
  try {
    const data = await GET('/hotels?include_vendors=1&paginate=1&page=1&limit=10');
    G.hotels = data?.items || data || [];
    G._hotelsLoaded = true;
    G._hotelsDetailedLoaded = true;
    return G.hotels;
  } finally {
    hideLoad();
  }
}

async function downloadBackup() {
  try {
    showLoad('Generating full system backup…');
    const token = G.token || localStorage.getItem('pgt_token');
    const res = await fetch('/api/backup', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) throw new Error('Backup failed: HTTP ' + res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pakglobe-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('System database backup downloaded successfully! 🛡️', 'success');
  } catch (err) {
    toast('Backup error: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}
window.downloadBackup = downloadBackup;

async function pgBackup() {
  const pg = document.getElementById('backup');
  if (!pg) return;
  pg.innerHTML = `
    <div class="page-header d-flex justify-content-between align-items-center">
      <div>
        <h1 class="page-title"><i class="bi bi-safe2 me-2" style="color:var(--pri)"></i>System Backup & Disaster Recovery</h1>
        <span class="page-sub">Export and preserve self-hosted MySQL snapshots, rate sheets, and quotation archives</span>
      </div>
      <div>
        <button class="btn-pri" onclick="downloadBackup()">
          <i class="bi bi-cloud-arrow-down-fill me-2"></i>Export JSON Snapshot
        </button>
      </div>
    </div>
    <div class="glass-card p-4">
      <div class="row g-4">
        <div class="col-md-6">
          <div style="background:rgba(255,255,255,0.7);border:1px solid var(--glass-brd);border-radius:14px;padding:22px">
            <div style="font-weight:800;font-size:15px;color:var(--t1);margin-bottom:8px">
              <i class="bi bi-database-check me-2" style="color:var(--ok)"></i>Self-Hosted MySQL Backup
            </div>
            <p class="t2" style="font-size:12.5px;line-height:1.6">
              Complete full-database dump containing hotels inventory, multi-vendor rate lists, quotation vouchers, users, branches, transport sectors, and audit logs.
            </p>
            <div class="mt-3">
              <button class="btn-pri btn-sm" onclick="downloadBackup()">
                <i class="bi bi-download me-1"></i>Download .JSON Backup File
              </button>
            </div>
          </div>
        </div>
        <div class="col-md-6">
          <div style="background:rgba(255,255,255,0.7);border:1px solid var(--glass-brd);border-radius:14px;padding:22px">
            <div style="font-weight:800;font-size:15px;color:var(--pri)"></i>Hotel Catalogue Excel Export
            </div>
            <p class="t2" style="font-size:12.5px;line-height:1.6">
              Download live hotel inventories and real-time vendor pricing sheets in 19-column SheetJS format.
            </p>
            <div class="mt-3">
              <button class="btn-ghost btn-sm" onclick="exportHotelsToExcel()">
                <i class="bi bi-file-earmark-excel me-1"></i>Export to Excel (19-Col)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}
window.pgBackup = pgBackup;

// ═══════════════════════════════════════════════════════════
//  NAVIGATION & PAGE REGISTRY
// ═══════════════════════════════════════════════════════════
var PAGE_HANDLERS = {
  dash:     function() { if (typeof pgDashboard === 'function') return pgDashboard(); },
  hotels:   function() { if (typeof pgHotels === 'function') return pgHotels(); },
  search:   function() { if (typeof pgSearch === 'function') return pgSearch(); },
  ratelist: function() { if (typeof pgRateList === 'function') return pgRateList(); },
  pvt:      function() { if (typeof pgPrivate === 'function') return pgPrivate(); },
  grp:      function() { if (typeof pgGroup === 'function') return pgGroup(); },
  allquot:  function() { if (typeof pgAllQuotations === 'function') return pgAllQuotations(); },
  pendingquot: function() { if (typeof pgAllQuotations === 'function') return pgAllQuotations('pending'); },
  myquot: function() { if (typeof pgAllQuotations === 'function') return pgAllQuotations('mine'); },
  packages: function() { if (typeof pgPackages === 'function') return pgPackages(); },
  queries:  function() { if (typeof pgQueries === 'function') return pgQueries(); },
  vendors:  function() { if (typeof pgVendors === 'function') return pgVendors(); },
  transport: function() { if (typeof pgTransport === 'function') return pgTransport(); },
  import:   function() { if (typeof pgImport === 'function') return pgImport(); },
  dedup:    function() { if (typeof pgDedup === 'function') return pgDedup(); },
  users:    function() { if (typeof pgUsers === 'function') return pgUsers(); },
  branches: function() { if (typeof pgBranches === 'function') return pgBranches(); },
  logs:     function() { if (typeof pgLogs === 'function') return pgLogs(); },
  recycle:  function() { if (typeof pgRecycle === 'function') return pgRecycle(); },
  backup:   function() { if (typeof pgBackup === 'function') return pgBackup(); },
  settings: function() { if (typeof pgSettings === 'function') return pgSettings(); },
};
window.PAGE_HANDLERS = PAGE_HANDLERS;

// Keep rendered pages warm while users move between tabs. Any POST/PUT/DELETE
// clears page cache timestamps in api(), so updates still appear immediately.
const PAGE_CACHE_TTL = 300000;
const _pageRenderPromises = new Map();

function nav(pageId) {
  let allowed = P(pageId);
  if (!allowed) {
    if (['allquot', 'pendingquot', 'myquot'].includes(pageId)) {
      allowed = P('allquot') || P('quotations_pvt') || P('quotations_grp');
    } else if (pageId === 'packages') {
      allowed = P('packages') || P('quotations_pvt');
    }
  }
  if (!allowed) {
    if (pageId !== 'dash') { toast('Access denied', 'warn'); return; }
  }

  _hideActiveHotelAutocomplete?.();
  const prevPage = G._currentPage;
  const pg = document.getElementById(pageId);
  if (prevPage === pageId && pg?.classList.contains('act')) {
    if (window.innerWidth <= 1100) closeSidebar();
    return;
  }
  G._currentPage = pageId;

  // Only deactivate the current page; avoid restyling every hidden page.
  document.querySelector('.page-section.act')?.classList.remove('act');

  // Paint the target immediately; data loading runs after the browser can render.
  if (pg) {
    if (!pg.innerHTML.trim()) {
      pg.innerHTML = '<div class="page-switch-skeleton" aria-live="polite"><div class="skeleton-line skeleton-title"></div><div class="skeleton-line skeleton-wide"></div><div class="skeleton-panel"></div></div>';
    }
    pg.classList.add('act');
    const content = document.getElementById('ct');
    if (content && content.scrollTop !== 0) {
      const scrollBehavior = content.style.scrollBehavior;
      content.style.scrollBehavior = 'auto';
      content.scrollTop = 0;
      content.style.scrollBehavior = scrollBehavior;
    }
  }

  if (prevPage && prevPage !== pageId) _navHistory.push(prevPage);

  // Update sidebar active link
  document.querySelector('.nl.act')?.classList.remove('act');
  const activeLink = $(`.nl[data-page="${pageId}"]`);
  if (activeLink) activeLink.classList.add('act');

  // Update URL hash
  history.replaceState(null, '', '#' + pageId);

  // Run page handler
  const handler = PAGE_HANDLERS[pageId];
  if (handler && pg) {
    const cachedAt = Number(pg.dataset.navCachedAt || 0);
    if (Date.now() - cachedAt >= PAGE_CACHE_TTL && !_pageRenderPromises.has(pageId)) {
      try {
        G._navigating = true;
        const renderPromise = new Promise(resolve => setTimeout(resolve, 0))
          .then(() => handler())
          .then(() => { pg.dataset.navCachedAt = String(Date.now()); })
          .catch(error => {
            console.error(`Failed to load ${pageId} page:`, error);
            toast(`Failed to load page: ${error.message}`, 'error');
          })
          .finally(() => {
            G._navigating = false;
            _pageRenderPromises.delete(pageId);
          });
        _pageRenderPromises.set(pageId, renderPromise);
      } catch (error) {
        console.error(`Failed to load ${pageId} page:`, error);
        toast(`Failed to load page: ${error.message}`, 'error');
      }
    }
  }

  // Mobile: close sidebar
  if (window.innerWidth <= 1100) closeSidebar();
}

// ═══════════════════════════════════════════════════════════
//  SIDEBAR BUILD
// ═══════════════════════════════════════════════════════════
function buildSidebar() {
  const SECTIONS = [
    {
      title: 'OVERVIEW',
      items: [
        { page: 'dash',     icon: 'bi-speedometer2',      label: 'Dashboard' },
        { page: 'search',   icon: 'bi-search',            label: 'Hotel Search',    perm: 'search' },
      ]
    },
    {
      title: 'HOTEL MANAGEMENT',
      items: [
        { page: 'hotels',   icon: 'bi-building',          label: 'Hotels',          perm: 'hotels' },
        { page: 'vendors',  icon: 'bi-people',            label: 'Vendors',         perm: 'vendors' },
        { page: 'queries',  icon: 'bi-chat-dots',         label: 'Booking Queries', perm: 'queries', badge: 'queries' },
        { page: 'ratelist', icon: 'bi-file-earmark-text', label: 'Rate List',       perm: 'ratelist' },
      ]
    },
    {
      title: 'PACKAGE COSTING',
      items: [
        { page: 'pvt',      icon: 'bi-person-vcard',      label: 'Private Costing', perm: 'quotations_pvt' },
        { page: 'grp',      icon: 'bi-people-fill',       label: 'Group Costing',   perm: 'quotations_grp' },
        { page: 'allquot',  icon: 'bi-folder2-open',      label: 'All Quotations',   perm: 'allquot' },
        { page: 'pendingquot', icon: 'bi-hourglass-split', label: 'Pending Quotations', perm: 'quotations_pvt', badge: 'pendingquot' },
        { page: 'myquot',   icon: 'bi-person-lines-fill', label: 'My Quotations',   perm: 'quotations_pvt' },
        { page: 'packages', icon: 'bi-box-seam',          label: 'Package Creating', perm: 'packages' },
        { page: 'transport',icon: 'bi-truck',             label: 'Transport',        perm: 'transport' },
      ]
    },
    {
      title: 'DATA MANAGEMENT',
      items: [
        { page: 'import',   icon: 'bi-cloud-upload',      label: 'Import / Export',  perm: 'import' },
        { page: 'dedup',    icon: 'bi-copy',              label: 'Duplicates',       perm: 'dedup' },
      ]
    },
    {
      title: 'ADMINISTRATION',
      items: [
        { page: 'users',    icon: 'bi-person-gear',       label: 'Users',            perm: 'users' },
        { page: 'branches', icon: 'bi-diagram-3',         label: 'Branches',         perm: 'branches' },
        { page: 'logs',     icon: 'bi-clock-history',     label: 'Audit Logs',       perm: 'logs' },
        { page: 'recycle',  icon: 'bi-trash3',            label: 'Recycle Bin',      perm: 'recycle' },
        { page: 'backup',   icon: 'bi-safe2',             label: 'Backup',           perm: 'backup' },
        { page: 'settings', icon: 'bi-gear',              label: 'Settings',         perm: 'settings' },
      ]
    }
  ];

  const nav_el = document.getElementById('sideNav');
  if (!nav_el) return;
  nav_el.innerHTML = '';

  SECTIONS.forEach(sec => {
    const visibleItems = sec.items.filter(item => {
      const perm = item.perm || item.page;
      return P(perm);
    });
    if (!visibleItems.length) return; // Hide section header if all items hidden

    nav_el.innerHTML += `<div class="side-sec-t">${sec.title}</div>`;
    visibleItems.forEach(item => {
      nav_el.innerHTML += `
        <a class="nl" data-page="${item.page}" onclick="nav('${item.page}')" href="javascript:void(0)">
          <i class="bi ${item.icon}"></i>
          <span>${item.label}</span>
          ${item.badge ? `<span id="sbadge-${item.badge}" class="badge-cnt d-none">0</span>` : ''}
        </a>`;
    });
  });

  if (G._currentPage) {
    const activeLink = nav_el.querySelector(`.nl[data-page="${G._currentPage}"]`);
    if (activeLink) activeLink.classList.add('act');
  }
}

function updateSidebarBadges(dash) {
  if (!dash) return;
  const qBadge = document.getElementById('sbadge-queries');
  if (qBadge) {
    if (dash.queries > 0) {
      qBadge.textContent = dash.queries;
      qBadge.classList.remove('d-none');
    } else {
      qBadge.classList.add('d-none');
    }
  }
  const pBadge = document.getElementById('sbadge-pendingquot');
  if (pBadge) {
    const pendingCount = Number(dash.pendingQuotations ?? 0);
    if (pendingCount > 0) {
      pBadge.textContent = pendingCount;
      pBadge.classList.remove('d-none');
    } else {
      pBadge.classList.add('d-none');
    }
  }
}

function updateUserWidget() {
  const u = G.user;
  if (!u) return;
  const initials = (u.fullName || u.username || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  const el = document.getElementById('sideUserWidget');
  if (el) {
    const branchId = u.branchId || u.branch_id;
    const branch = G.branches?.find(b => b.id === branchId);
    const branchLabel = branch ? branch.name : (u.branchName || (['admin', 'superadmin'].includes(u.role) ? 'Head Office' : ''));
    el.innerHTML = `
      <div class="side-avatar">${initials}</div>
      <div style="flex:1;min-width:0">
        <div class="side-uname text-truncate">${esc(u.fullName || u.username)}</div>
        <div class="side-urole text-truncate" title="${esc(u.role)}${branchLabel ? ' · ' + esc(branchLabel) : ''}">
          ${esc(u.role)}${branchLabel ? ` · <span style="color:var(--pri);font-weight:600">${esc(branchLabel)}</span>` : ''}
        </div>
      </div>
      <button class="btn-icon" onclick="openChangePasswordModal()" title="Change Password" style="color:var(--t3);margin-right:2px">
        <i class="bi bi-key"></i>
      </button>
      <button class="btn-icon" onclick="logout()" title="Logout" style="color:var(--t3)">
        <i class="bi bi-box-arrow-right"></i>
      </button>`;
  }
  // Also update topbar
  const tbUser = document.getElementById('tbUserName');
  if (tbUser) tbUser.textContent = u.fullName || u.username;
}

function openChangePasswordModal() {
  document.getElementById('cpCurrentPass').value = '';
  document.getElementById('cpNewPass').value = '';
  document.getElementById('cpConfirmPass').value = '';
  openModal('changePasswordModal');
}
window.openChangePasswordModal = openChangePasswordModal;

async function submitChangePassword() {
  const currentPassword = document.getElementById('cpCurrentPass')?.value;
  const newPassword = document.getElementById('cpNewPass')?.value;
  const confirmPassword = document.getElementById('cpConfirmPass')?.value;

  if (!currentPassword) { toast('Please enter current password', 'warn'); return; }
  if (!newPassword || newPassword.length < 6) { toast('New password must be at least 6 characters', 'warn'); return; }
  if (newPassword !== confirmPassword) { toast('New passwords do not match', 'warn'); return; }

  showLoad('Updating password…');
  try {
    await POST('/auth/change-password', { currentPassword, newPassword });
    closeModal('changePasswordModal');
    toast('Password updated successfully! Please keep it secure.', 'success');
  } catch (err) {
    toast('Password change failed: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}
window.submitChangePassword = submitChangePassword;

// Sidebar mobile toggle
function toggleSidebar() {
  const side = $('.side');
  const ov   = document.getElementById('sbOv');
  if (!side) return;
  const open = side.classList.toggle('open');
  if (ov) ov.style.display = open ? 'block' : 'none';
  side.inert = !open && window.innerWidth <= 1100;
  const toggle = document.getElementById('sbToggleBtn');
  if (toggle) {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
  }
  if (open) side.querySelector('.nl.act, .nl')?.focus();
}
function closeSidebar() {
  const side = $('.side');
  const ov   = document.getElementById('sbOv');
  if (side) side.classList.remove('open');
  if (side) side.inert = window.innerWidth <= 1100;
  if (ov)   ov.style.display = 'none';
  const toggle = document.getElementById('sbToggleBtn');
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation menu');
  }
}

// Theme toggle
function toggleTheme() {
  const html = document.documentElement;
  const dark = html.getAttribute('data-theme') !== 'light';
  html.setAttribute('data-theme', dark ? 'light' : 'dark');
  localStorage.setItem('pgt_theme', dark ? 'light' : 'dark');
  const btn = document.getElementById('themeBtn');
  if (btn) btn.innerHTML = `<i class="bi ${dark ? 'bi-moon-fill' : 'bi-sun-fill'}"></i>`;
}

// ═══════════════════════════════════════════════════════════
//  PAGE: DASHBOARD
// ═══════════════════════════════════════════════════════════
function pgDashboard() {
  const d = G._dashData || {};
  const pg = document.getElementById('dash');
  if (!pg) return;

  const isAdmin = G.user?.role === 'superadmin' || G.user?.role === 'admin';
  const isBranchUser = !isAdmin && Boolean(G.user?.branchId || G.user?.branch_id);
  const companyName = G.settings?.company_name || G.settings?.branch_name || 'Pak Globe Travels';
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return '☀️ Good Morning';
    if (h < 17) return '🌤️ Good Afternoon';
    return '🌙 Good Evening';
  })();

  const hotelsCnt  = d.hotels     || G.hotels.length    || 0;
  const quotsCnt   = d.quotations || G.quotations.length || 0;
  const queriesCnt = d.queries    || G.queries.length    || 0;
  const vendorsCnt = d.vendors    || G.vendors.length    || 0;
  const cityStats = d.cityStats || [];
  const quotStats = d.quotStats || [];
  const cityStatsTotal = cityStats.reduce((sum, row) => sum + Number(row.cnt || 0), 0);
  const quotStatsTotal = quotStats.reduce((sum, row) => sum + Number(row.cnt || 0), 0);

  // Permission-aware KPI tiles
  const canHotels  = P('hotels');
  const canVendors = P('vendors');
  const canQueries = P('queries');
  const canAllQuot = P('allquot') || P('quotations_pvt') || P('quotations_grp');

  pg.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">
          <i class="bi bi-grid-1x2-fill"></i>Overview & Studio Desk
        </h1>
        <span class="page-sub">
          ${greeting}, <strong>${esc(G.user?.full_name || G.user?.fullName || G.user?.username)}</strong> 👋 · Live operational overview for ${esc(companyName)}
        </span>
      </div>
      <div class="page-actions">
        <span class="pill pill-bare" style="background:var(--surface);border:1px solid var(--line);font-weight:600;height:34px;padding:0 14px;border-radius:17px">
          📅 ${fmtDate(new Date())}
        </span>
        <button class="btn-ghost btn-sm" onclick="nav('search')">
          <i class="bi bi-search me-1"></i>Search Rates
        </button>
        ${P('quotations_pvt','add') || P('quotations_grp','add') ? `<button class="btn-pri btn-sm" onclick="nav('pvt')"><i class="bi bi-plus-lg me-1"></i>New Costing</button>` : ''}
      </div>
    </div>

    <!-- PERMISSION-AWARE KPI GRID -->
    <div class="kpi-grid mb-4">
      ${P('hotels') ? `<div class="kpi" data-tile="sage" onclick="nav('hotels')">
        <div class="d-flex justify-content-between align-items-center">
          <div class="kpi-lbl">HOTELS INVENTORY</div>
          <i class="bi bi-building fs-5" style="opacity:0.8"></i>
        </div>
        <div class="kpi-val" id="kpiHotels">${fmtNum(hotelsCnt)}</div>
        <div class="d-flex justify-content-between align-items-center">
          <span style="font-size:11.5px;opacity:0.85">Makkah, Madinah &amp; Jeddah</span>
          <span class="delta delta--up"><i class="bi bi-arrow-up-right"></i> Live</span>
        </div>
      </div>` : ''}

      ${(P('allquot') || P('quotations_pvt') || P('quotations_grp')) ? `<div class="kpi" data-tile="apricot" onclick="nav('allquot')">
        <div class="d-flex justify-content-between align-items-center">
          <div class="kpi-lbl">QUOTATIONS &amp; PROPOSALS</div>
          <i class="bi bi-file-earmark-text fs-5" style="opacity:0.8"></i>
        </div>
        <div class="kpi-val" id="kpiQuots">${fmtNum(quotsCnt)}</div>
        <div class="d-flex justify-content-between align-items-center">
          <span style="font-size:11.5px;opacity:0.85">Private &amp; Group Costing</span>
          <span class="delta delta--up"><i class="bi bi-arrow-up-right"></i> Active</span>
        </div>
      </div>` : ''}

      ${P('queries') ? `<div class="kpi" data-tile="mist" onclick="nav('queries')">
        <div class="d-flex justify-content-between align-items-center">
          <div class="kpi-lbl">BOOKING CRM INQUIRIES</div>
          <i class="bi bi-chat-dots fs-5" style="opacity:0.8"></i>
        </div>
        <div class="kpi-val" id="kpiQueries">${fmtNum(queriesCnt)}</div>
        <div class="d-flex justify-content-between align-items-center">
          <span style="font-size:11.5px;opacity:0.85">Client Leads &amp; Inquiries</span>
          <span class="pill pill-amber pill-bare" style="height:18px;font-size:10px">Pending</span>
        </div>
      </div>` : ''}

      ${P('vendors') ? `<div class="kpi" data-tile="clay" onclick="nav('vendors')">
        <div class="d-flex justify-content-between align-items-center">
          <div class="kpi-lbl">VENDORS &amp; SUPPLIERS</div>
          <i class="bi bi-people-fill fs-5" style="opacity:0.8"></i>
        </div>
        <div class="kpi-val" id="kpiVendors">${fmtNum(vendorsCnt)}</div>
        <div class="d-flex justify-content-between align-items-center">
          <span style="font-size:11.5px;opacity:0.85">Active Rate Contracts</span>
          <span style="font-size:11px;font-weight:700">${isAdmin ? (G.branches.length || 1) + ' Branches' : esc(G.settings?.branch_name || 'Branch')}</span>
        </div>
      </div>` : ''}
    </div>

    <!-- MAIN DASHBOARD SPLIT (8 COLS / 4 COLS) -->
    <div class="row g-3">
      <!-- LEFT 8 COLS: Featured Inventory & Quick Package Stage -->
      <div class="col-lg-8">
        
        <!-- Showcase Stage Card -->
        <div class="glass-card p-4 mb-3">
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <div class="card-title">🕋 Umrah Inventory & Costing Engine</div>
              <div class="t2" style="font-size:12.5px;margin-top:2px">Dynamic multi-hotel calculation with automated child/infant PAX scaling</div>
            </div>
            <div class="seg-control">
              <button class="seg-btn act" onclick="nav('pvt')">Private A/B/C</button>
              <button class="seg-btn" onclick="nav('grp')">Group Engine</button>
              <button class="seg-btn" onclick="nav('search')">Search All</button>
            </div>
          </div>

          <!-- Fact Badges -->
          <div class="shelf__facts mb-4">
            <div class="shelf__fact-card">
              <small>Default ROE</small>
              <b>${G.settings?.default_roe || 78} PKR</b>
              <span class="t3" style="font-size:10.5px">Saudi Riyal Rate</span>
            </div>
            <div class="shelf__fact-card">
              <small>Adult Visa</small>
              <b>SAR ${G.settings?.default_visa_adult || 560}</b>
              <span class="t3" style="font-size:10.5px">Standard Umrah</span>
            </div>
            <div class="shelf__fact-card">
              <small>Child Visa</small>
              <b>SAR ${G.settings?.default_visa_child || 560}</b>
              <span class="t3" style="font-size:10.5px">Direct MOFA</span>
            </div>
            <div class="shelf__fact-card">
              <small>Infant Visa</small>
              <b>SAR ${G.settings?.default_visa_infant || 150}</b>
              <span class="t3" style="font-size:10.5px">Infant Rate</span>
            </div>
          </div>

          <!-- Quick Launch Tiles -->
          <div class="row g-2">
            <div class="col-sm-6">
              <div style="background:var(--surface-2);border:1px solid var(--line);border-radius:16px;padding:16px;cursor:pointer;transition:var(--tr)"
                   onclick="nav('pvt')" onmouseenter="this.style.borderColor='var(--pri)'" onmouseleave="this.style.borderColor='var(--line)'">
                <div class="d-flex align-items-center gap-3">
                  <div style="width:42px;height:42px;border-radius:12px;background:var(--pri);color:#fff;display:grid;place-items:center;font-size:20px">
                    <i class="bi bi-calculator"></i>
                  </div>
                  <div>
                    <div style="font-weight:700;font-size:14px;color:var(--text)">Private Costing</div>
                    <div class="t3" style="font-size:11.5px">Multi-Option comparison (A/B/C)</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-sm-6">
              <div style="background:var(--surface-2);border:1px solid var(--line);border-radius:16px;padding:16px;cursor:pointer;transition:var(--tr)"
                   onclick="nav('search')" onmouseenter="this.style.borderColor='var(--pri)'" onmouseleave="this.style.borderColor='var(--line)'">
                <div class="d-flex align-items-center gap-3">
                  <div style="width:42px;height:42px;border-radius:12px;background:var(--sec);color:#fff;display:grid;place-items:center;font-size:20px">
                    <i class="bi bi-search"></i>
                  </div>
                  <div>
                    <div style="font-weight:700;font-size:14px;color:var(--text)">Hotel Rate Search</div>
                    <div class="t3" style="font-size:11.5px">11-filter search with strict date match</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Charts Row -->
        <div class="row g-3 dashboard-charts-row">
          <div class="col-md-6">
            <div class="glass-card dashboard-chart-card">
              <div class="dashboard-chart-head">
                <div><div class="card-title"><i class="bi bi-pie-chart-fill"></i>Hotels by City</div><div class="dashboard-chart-sub">Live inventory distribution</div></div>
                <span class="dashboard-chart-total">${fmtNum(cityStatsTotal)} <small>hotels</small></span>
              </div>
              <div class="dashboard-chart-body"><canvas id="chartCity" height="210"></canvas></div>
            </div>
          </div>
          <div class="col-md-6">
            <div class="glass-card dashboard-chart-card">
              <div class="dashboard-chart-head">
                <div><div class="card-title"><i class="bi bi-bar-chart-fill"></i>Quotations Breakdown</div><div class="dashboard-chart-sub">Private vs group proposals</div></div>
                <span class="dashboard-chart-total">${fmtNum(quotStatsTotal)} <small>quotes</small></span>
              </div>
              <div class="dashboard-chart-body"><canvas id="chartQuot" height="210"></canvas></div>
            </div>
          </div>
        </div>

      </div>

      <!-- RIGHT 4 COLS: Ink Card Quick Station & CRM Queries -->
      <div class="col-lg-4">
        
        <!-- Olvara Dark Ink Card -->
        <div class="glass-card card--ink p-4 mb-3">
          <div class="live mb-2" style="color:var(--side-pill)">
            <i></i> Live Studio Desk
          </div>
          <h3 style="font-size:20px;font-weight:700;color:var(--on-ink);letter-spacing:-0.015em;margin-bottom:4px">
            Quick Actions
          </h3>
          <p style="font-size:12px;color:var(--ink-dim);margin-bottom:16px">
            Instant operations for bookings & proposals
          </p>

          <button class="ink-btn-pill" onclick="nav('pvt')">
            <span><i class="bi bi-calculator me-2"></i>New Private Costing</span>
            <i class="bi bi-arrow-right"></i>
          </button>
          <button class="ink-btn-pill" onclick="nav('grp')">
            <span><i class="bi bi-people me-2"></i>New Group Costing</span>
            <i class="bi bi-arrow-right"></i>
          </button>
          <button class="ink-btn-pill" onclick="nav('search')">
            <span><i class="bi bi-search me-2"></i>Search Hotel Rates</span>
            <i class="bi bi-arrow-right"></i>
          </button>
          ${isAdmin ? `
            <button class="ink-btn-pill" onclick="nav('import')">
              <span><i class="bi bi-file-earmark-excel me-2"></i>19-Col Excel Importer</span>
              <i class="bi bi-arrow-right"></i>
            </button>
            <button class="ink-btn-pill" onclick="nav('settings')">
              <span><i class="bi bi-gear me-2"></i>Platform Settings</span>
              <i class="bi bi-arrow-right"></i>
            </button>
          ` : ''}
        </div>

        <!-- Latest Booking Queries Card -->
        <div class="glass-card p-3">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="card-title" style="font-size:13.5px">
              <i class="bi bi-chat-left-dots me-2" style="color:var(--acc)"></i>Active CRM Queries
            </span>
            <button class="btn-ghost btn-sm" onclick="nav('queries')" style="padding:0 10px;height:26px;font-size:11px">
              View All
            </button>
          </div>
          <div>
            ${(G.queries || []).slice(0, 4).map(q => `
              <div style="padding:9px 6px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;cursor:pointer"
                   onclick="nav('queries')">
                <div style="min-width:0;flex:1">
                  <div style="font-weight:700;font-size:12.5px;color:var(--text)" class="text-truncate">${esc(q.client_name || 'Client')}</div>
                  <div class="t3" style="font-size:11px">${esc(q.phone || q.city || 'Inquiry')} · ${timeAgo(q.created_at)}</div>
                </div>
                <span class="pill pill-blue pill-bare" style="font-size:10px;height:20px;padding:0 7px">
                  ${esc(q.status || 'new')}
                </span>
              </div>`).join('') || '<div class="t3 text-center py-3" style="font-size:12px">No pending inquiries</div>'}
          </div>
        </div>

      </div>
    </div>

    <!-- RECENT ACTIVITY AUDIT TRAIL -->
    <div class="glass-card mt-3 p-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
          <span class="card-title"><i class="bi bi-clock-history me-2" style="color:var(--pri)"></i>Recent Activity & Audit Trail</span>
          <div class="t3" style="font-size:12px;margin-top:2px">Real-time log of hotel additions, rate changes and proposal exports</div>
        </div>
        ${isAdmin ? '<button class="btn-ghost btn-sm" onclick="nav(\'logs\')"><i class="bi bi-arrow-right me-1"></i>View Full Logs</button>' : ''}
      </div>
      <div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Action</th><th>Module</th><th>By User</th><th>When</th>
            </tr>
          </thead>
          <tbody>
            ${(d.recentLogs || []).slice(0, 8).map(l => `
              <tr>
                <td><span class="badge-action">${esc(l.action || '—')}</span></td>
                <td class="t2" style="font-size:11.5px">${esc(l.entity_type || '—')}</td>
                <td style="font-weight:700">${esc(l.username || '—')}</td>
                <td class="t3" style="font-size:11px;white-space:nowrap">${timeAgo(l.created_at)}</td>
              </tr>`).join('') || '<tr><td colspan="4" class="t3 text-center py-4">No activity yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  // Draw Charts
  const cityCtx = document.getElementById('chartCity');
  const quotCtx = document.getElementById('chartQuot');
  const drawCharts = () => {
    if (!window.Chart || !cityCtx?.isConnected) return;
    const cityData = cityStats;
    const quotData = quotStats;
    const colors   = ['#255446', '#c98a3c', '#4f86bd', '#bf6f55', '#7a8783'];

    // Trigger counter animations on KPI tiles after render
    setTimeout(() => {
      if (document.getElementById('kpiHotels')) animateCounter(document.getElementById('kpiHotels'), hotelsCnt, 1000);
      if (document.getElementById('kpiQuots')) animateCounter(document.getElementById('kpiQuots'), quotsCnt, 1100);
      if (document.getElementById('kpiQueries')) animateCounter(document.getElementById('kpiQueries'), queriesCnt, 1200);
      if (document.getElementById('kpiVendors')) animateCounter(document.getElementById('kpiVendors'), vendorsCnt, 1300);
    }, 180);

    if (cityCtx && cityData.length) {
      new Chart(cityCtx, {
        type: 'doughnut',
        data: {
          labels: cityData.map(r => r.city),
          datasets: [{ data: cityData.map(r => r.cnt), backgroundColor: colors, borderColor: '#fbfcfa', borderWidth: 4, hoverOffset: 7 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          layout: { padding: 6 },
          plugins: {
            legend: { position: 'bottom', labels: { color: '#59645e', usePointStyle: true, pointStyle: 'circle', padding: 16, boxWidth: 8, font: { family: 'Urbanist', size: 11, weight: '600' } } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmtNum(ctx.raw)} hotels` } }
          }
        }
      });
    }

    if (quotCtx && quotData.length) {
      new Chart(quotCtx, {
        type: 'bar',
        data: {
          labels: quotData.map(r => String(r.type || '').replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase())),
          datasets: [{ data: quotData.map(r => r.cnt), backgroundColor: ['#255446', '#c98a3c'], borderRadius: 10, borderSkipped: false, barPercentage: .5, categoryPercentage: .65 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 8, right: 8, left: 2 } },
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${fmtNum(ctx.raw)} quotations` } } },
          scales: {
            x: { border: { display: false }, ticks: { color: '#59645e', padding: 8, font: { family: 'Urbanist', size: 11, weight: '600' } }, grid: { display: false } },
            y: { beginAtZero: true, border: { display: false }, ticks: { color: '#7a8783', precision: 0, padding: 8, font: { family: 'Urbanist', size: 10 } }, grid: { color: 'rgba(20,32,27,0.07)', drawTicks: false } }
          }
        }
      });
    }
  };
  if (window.Chart) drawCharts();
  else loadUtilityScript('chart')
    .then(drawCharts)
    .catch(error => toast(`Dashboard charts unavailable: ${error.message}`, 'err'));
}

// ═══════════════════════════════════════════════════════════
//  PAGE: HOTELS
// ═══════════════════════════════════════════════════════════
const HOTEL_PAGE_SIZE = 20;
let _hotelPage = 1;

let _hotelDirectoryMeta = { page: 1, pages: 1, total: 0, limit: HOTEL_PAGE_SIZE };
let _hotelDirectoryRows = [];
let _hotelDirectoryTimer = null;
let _hotelDirectoryRequest = 0;

async function loadHotelDirectory(page = 1) {
  const requestId = ++_hotelDirectoryRequest;
  const params = new URLSearchParams({ summary: '1', paginate: '1', page: String(Math.max(1, page)), limit: String(HOTEL_PAGE_SIZE) });
  const q = $('#htlSearch')?.value.trim();
  const city = $('#htlCity')?.value;
  const status = $('#htlStatus')?.value;
  if (q) params.set('q', q);
  if (city) params.set('city', city);
  if (status) params.set('status', status);
  try {
    const data = await GET('/hotels?' + params.toString());
    if (requestId !== _hotelDirectoryRequest) return;
    _hotelDirectoryRows = data?.items || [];
    _hotelDirectoryMeta = { page: Number(data?.page || page), pages: Number(data?.pages || 1), total: Number(data?.total || 0), limit: Number(data?.limit || HOTEL_PAGE_SIZE) };
    _hotelPage = _hotelDirectoryMeta.page;
    renderHotelTable();
  } catch (err) {
    toast('Failed to load hotels: ' + err.message, 'error');
  }
}

async function pgHotels(forceRefresh = false) {
  const pg = document.getElementById('hotels');
  if (!pg) return;
  if (forceRefresh) pg.dataset.initialized = '';
  if (!forceRefresh && pg.dataset.initialized === 'true') return;
  pg.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="bi bi-building me-2" style="color:var(--pri)"></i>Hotels</h1>
          <span class="page-sub">${_hotelDirectoryMeta.total || G._hotelSummaryMeta?.total || 0} hotels in database</span>
        </div>
        <div class="page-actions">
          ${P('hotels','add') ? `<button class="btn-pri" onclick="openHotelModal()"><i class="bi bi-plus-lg me-1"></i>Add Hotel</button>` : ''}
          ${P('import','imp')  ? `<button class="btn-ghost" onclick="nav('import')"><i class="bi bi-upload me-1"></i>Import Excel</button>` : ''}
        </div>
      </div>

      <div class="glass-card p-3 mb-3">
        <div class="row g-2">
          <div class="col-md-4"><input class="form-inp" id="htlSearch" placeholder="Search hotels…" oninput="filterHotels()" type="search"></div>
          <div class="col-md-2">
            <select class="form-inp" id="htlCity" onchange="filterHotels()">
              <option value="">All Cities</option>
              <option>MAKKAH</option><option>MADINAH</option><option>JEDDAH</option>
            </select>
          </div>
          <div class="col-md-2">
            <select class="form-inp" id="htlStatus" onchange="filterHotels()">
              <option value="">All Status</option>
              <option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div class="glass-card">
        <div class="table-wrap">
          <table class="tbl" id="hotelsTable">
            <thead>
              <tr>
                <th>Hotel Name</th><th>City</th><th>Area</th><th>Stars</th>
                <th>Distance</th><th>Rates</th><th>Status</th><th style="width:100px">Actions</th>
              </tr>
            </thead>
            <tbody id="hotelsTbody"></tbody>
          </table>
        </div>
        <div id="hotelsPager" class="d-flex justify-content-between align-items-center gap-2 flex-wrap px-3 py-3"></div>
      </div>`;
  _hotelPage = 1;
  pg.dataset.initialized = 'true';
  await loadHotelDirectory(1);
}

function renderHotelRows(hotels) {
  if (!hotels.length) return `<tr><td colspan="8" class="t3 text-center py-4">No hotels found</td></tr>`;
  return hotels.map(h => {
    let vendors = [];
    try { vendors = Array.isArray(h.vendors) ? h.vendors : (h.vendors ? JSON.parse(h.vendors) : []); } catch (_) { vendors = []; }
    const rates = vendors.flatMap(v => getContractRateRows(v).map(([, rate]) => rate));
    const minRate = rates.length ? Math.min(...rates) : Number(h.min_rate || 0);
    const vendorCount = Number(h.vendor_count || vendors.length || 0);
    const stars   = Number(h.stars) > 0 ? `${Number(h.stars)}/5` : 'Standard';
    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:9px">
            ${h.image_url ? `<img class="hotel-thumb" src="${escAttr(h.image_url)}" alt="${escAttr(h.name)}" loading="lazy" onerror="this.style.display='none'">` : ''}
            <div style="font-weight:600;color:var(--t1)">${esc(h.name)}</div>
          </div>
          ${h.amenities ? `<div class="t3" style="font-size:11px">${esc(h.amenities).split(',').slice(0,3).join(' · ')}</div>` : ''}
        </td>
        <td><span class="pill pill-blue">${esc(h.city)}</span></td>
        <td class="t2">${esc(h.area || '—')}</td>
        <td class="t2">${stars}</td>
        <td class="t2">${esc(h.distance_text || '—')}</td>
        <td>${minRate ? `<span style="color:var(--ok);font-weight:600">${fmtSAR(minRate)}</span><div class="t3" style="font-size:11px">${vendorCount} contract${vendorCount !== 1 ? 's' : ''}</div>` : '<span class="t3">No rates</span>'}</td>
        <td><span class="badge-status ${h.status === 'active' ? 'bs-active' : 'bs-inactive'}">${h.status}</span></td>
        <td>
          <div class="action-btns">
            ${P('hotels','edit') ? `<button class="btn-icon" onclick="openHotelModal('${h.id}')" title="Edit"><i class="bi bi-pencil"></i></button>` : ''}
            ${P('hotels','del')  ? `<button class="btn-icon text-danger" onclick="deleteHotel('${h.id}','${esc(h.name)}')" title="Delete"><i class="bi bi-trash3"></i></button>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

function getFilteredHotels() {
  const q      = $('#htlSearch')?.value.toLowerCase() || '';
  const city   = $('#htlCity')?.value || '';
  const status = $('#htlStatus')?.value || '';
  return _hotelDirectoryRows.filter(h => {
    if (q && !String(h.name || '').toLowerCase().includes(q) && !String(h.city || '').toLowerCase().includes(q) && !String(h.area || '').toLowerCase().includes(q)) return false;
    if (city && normalizeHotelCity(h.city) !== normalizeHotelCity(city)) return false;
    if (status && h.status !== status) return false;
    return true;
  });
}

function renderHotelTable() {
  const filtered = _hotelDirectoryRows;
  const total = Number(_hotelDirectoryMeta.total || filtered.length);
  const totalPages = Math.max(1, Number(_hotelDirectoryMeta.pages || Math.ceil(total / HOTEL_PAGE_SIZE)));
  _hotelPage = Math.min(Math.max(1, _hotelPage), totalPages);
  const start = total ? ((_hotelPage - 1) * HOTEL_PAGE_SIZE) : 0;
  const tbody = document.getElementById('hotelsTbody');
  if (tbody) tbody.innerHTML = renderHotelRows(filtered);
  const pager = document.getElementById('hotelsPager');
  if (pager) {
    pager.innerHTML = `
      <span class="t3" style="font-size:12px">Showing ${total ? start + 1 : 0}-${Math.min(start + filtered.length, total)} of ${total} hotels</span>
      <div class="d-flex align-items-center gap-2">
        <button class="btn-ghost btn-sm" type="button" onclick="changeHotelPage(-1)" ${_hotelPage <= 1 ? 'disabled' : ''}>‹ Previous</button>
        <span class="t2" style="font-size:12px">Page ${_hotelPage} / ${totalPages}</span>
        <button class="btn-ghost btn-sm" type="button" onclick="changeHotelPage(1)" ${_hotelPage >= totalPages ? 'disabled' : ''}>Next ›</button>
      </div>`;
  }
}

function changeHotelPage(delta) {
  const next = _hotelPage + (Number(delta) || 0);
  if (next < 1 || next > (_hotelDirectoryMeta.pages || 1)) return;
  loadHotelDirectory(next);
}

function filterHotels() {
  clearTimeout(_hotelDirectoryTimer);
  _hotelDirectoryTimer = setTimeout(() => loadHotelDirectory(1), 220);
}

// ═══════════════════════════════════════════════════════════
//  PHASE 2: HOTEL MODAL ENGINE & DYNAMIC RATE CONTRACTS
// ═══════════════════════════════════════════════════════════
let _activeHotelId = null;

function switchHotelTab(tab) {
  const isProf = tab === 'profile';
  const profPane = document.getElementById('hTabProfile');
  const contPane = document.getElementById('hTabContracts');
  if (profPane) { profPane.style.display = isProf ? 'block' : 'none'; if (isProf) swipeIn(profPane, isProf ? 'right' : 'left'); }
  if (contPane) { contPane.style.display = isProf ? 'none' : 'block'; if (!isProf) swipeIn(contPane, 'right'); }
  document.getElementById('tabBtnProfile')?.classList.toggle('act', isProf);
  document.getElementById('tabBtnContracts')?.classList.toggle('act', !isProf);
}

function closeHotelModal() {
  closeModal('hotelModal');
}

async function openHotelModal(id = null) {
  _activeHotelId = id;
  const modal = document.getElementById('hotelModal');
  if (!modal) return;

  // Populate branch checkboxes
  const branchBox = document.getElementById('hBranchCheckboxes');
  if (branchBox) {
    branchBox.innerHTML = (G.branches || []).map(b => `
      <label class="d-flex align-items-center gap-1" style="font-size:12px;font-weight:600;color:var(--t2);cursor:pointer">
        <input type="checkbox" class="h-branch-chk" value="${b.id}" checked>
        <span>${esc(b.name)}</span>
      </label>
    `).join('') || '<span class="t3" style="font-size:11px">All branches (global)</span>';
  }

  const vendorList = document.getElementById('vendorListDatalist');
  if (vendorList) {
    const names = [...new Set((G.vendors || [])
      .filter(v => v.status !== 'inactive')
      .map(v => String(v.name || v.vendor_name || '').trim())
      .filter(Boolean))];
    vendorList.innerHTML = names.map(name => `<option value="${escAttr(name)}"></option>`).join('');
  }

  // Clear vendor contracts
  document.getElementById('vContractTbody').innerHTML = '';
  updateContractCount();
  removeHotelImage();
  switchHotelTab('profile');

  if (id) {
    document.getElementById('hModalTitle').textContent = 'Edit Hotel';
    showLoad('Loading hotel details…');
    try {
      const h = await GET(`/hotels/${id}`);
      document.getElementById('hId').value          = h.id || '';
      document.getElementById('hName').value        = h.name || '';
      document.getElementById('hCity').value        = (h.city || 'MAKKAH').toUpperCase();
      document.getElementById('hCountry').value     = h.country || 'Saudi Arabia';
      document.getElementById('hArea').value        = h.area || '';
      document.getElementById('hDist').value        = h.distance_text || '';
      document.getElementById('hDistMeters').value  = h.distance_meters || '';
      document.getElementById('hStars').value       = h.stars || 0;
      document.getElementById('hShuttle').value     = h.shuttle ? 1 : 0;
      document.getElementById('hStatus').value      = h.status || 'active';
      document.getElementById('hLocationUrl').value = h.location_url || '';
      document.getElementById('hAmenities').value   = h.amenities || '';
      document.getElementById('hDescription').value = h.description || '';
      document.getElementById('hModalStatusPill').textContent = (h.status || 'active').toUpperCase();

      // External image URL only; local media upload has been removed.
      document.getElementById('hImageUrl').value = h.image_url || '';

      // Branch visibility
      if (h.branch_visibility) {
        try {
          const vis = typeof h.branch_visibility === 'string' ? JSON.parse(h.branch_visibility) : h.branch_visibility;
          if (Array.isArray(vis)) {
            $$('.h-branch-chk').forEach(chk => {
              chk.checked = vis.includes(chk.value);
            });
          }
        } catch(_) {}
      }

      // Contracts
      const vendors = Array.isArray(h.vendors) ? h.vendors : (h.vendors ? JSON.parse(h.vendors) : []);
      vendors.forEach(v => addVContractRow(v));
      updateContractCount();

    } catch (err) {
      toast('Failed to load hotel: ' + err.message, 'error');
    } finally {
      hideLoad();
    }
  } else {
    document.getElementById('hModalTitle').textContent = 'Add New Hotel';
    document.getElementById('hId').value          = '';
    document.getElementById('hName').value        = '';
    document.getElementById('hCity').value        = 'MAKKAH';
    document.getElementById('hCountry').value     = 'Saudi Arabia';
    document.getElementById('hArea').value        = '';
    document.getElementById('hDist').value        = '';
    document.getElementById('hDistMeters').value  = '';
    document.getElementById('hStars').value       = '4';
    document.getElementById('hShuttle').value     = '0';
    document.getElementById('hStatus').value      = 'active';
    document.getElementById('hLocationUrl').value = '';
    document.getElementById('hAmenities').value   = '';
    document.getElementById('hDescription').value = '';
    document.getElementById('hModalStatusPill').textContent = 'NEW';
    // Add 1 blank contract row by default
    addVContractRow();
  }

  openModal('hotelModal');
  const hDialog = modal.querySelector('.glass-modal');
  if (hDialog) { hDialog.style.animation = 'none'; void hDialog.offsetWidth; hDialog.style.animation = ''; }
}

let _vrCounter = 0;
function addVContractRow(v = {}) {
  const tbody = document.getElementById('vContractTbody');
  if (!tbody) return;
  const uid = 'vr_' + (++_vrCounter);

  const roomTypes = catalogOptions('room_types', ['DOUBLE','TRIPLE','QUAD','SHARING','QUINT','HEXA','SUITE','FLAT']);
  const mealPlans = mealPlanOptions();
  const field = (label, control) => `<label class="v-contract-field"><span>${label}</span>${control}</label>`;
  const card = document.createElement('article');
  card.id = uid;
  card.className = 'v-contract-row';
  card.innerHTML = `
    <div class="v-contract-head">
      <strong class="v-contract-number"></strong>
      <input type="hidden" id="vdt_${uid}" value="${escAttr(v.days_type || 'ALL')}">
      <input type="hidden" id="vbr_${uid}" value="${numR(v.price_best) || ''}">
      <div class="v-contract-actions">
        <button type="button" class="btn-icon" onclick="duplicateVContractRow('${uid}')" title="Duplicate this vendor and date rate"><i class="bi bi-copy"></i></button>
        <button type="button" class="btn-icon text-danger" onclick="removeVContractRow('${uid}')" title="Remove rate row"><i class="bi bi-x-lg"></i></button>
      </div>
    </div>
    <div class="v-contract-fields">
      ${field('Vendor *', `<input class="form-inp" list="vendorListDatalist" id="vv_${uid}" placeholder="Vendor name" value="${escAttr(v.vendor_name || '')}">`)}
      ${field('Room Type', `<select class="form-inp" id="vrt_${uid}">${roomTypes.map(rt => `<option value="${escAttr(rt)}" ${rt === (v.room_type || 'DOUBLE') ? 'selected' : ''}>${esc(rt)}</option>`).join('')}</select>`)}
      ${field('Meal Plan', `<select class="form-inp" id="vmp_${uid}">${mealPlans.map(mp => `<option value="${escAttr(mp)}" ${mp === (v.meal_plan || 'RO') ? 'selected' : ''}>${esc(mp)}</option>`).join('')}</select>`)}
      ${field('All Days Rate', `<input class="form-inp" id="vp_${uid}" type="number" min="0" step="any" placeholder="SAR" value="${numR(v.price_all) || ''}">`)}
      ${field('Weekday Rate', `<input class="form-inp" id="vwd_${uid}" type="number" min="0" step="any" placeholder="SAR" value="${numR(v.price_weekday) || ''}">`)}
      ${field('Weekend Rate (Fri-Sat)', `<input class="form-inp" id="vwe_${uid}" type="number" min="0" step="any" placeholder="SAR" value="${numR(v.price_weekend) || ''}">`)}
      ${field('Check-In', `<input class="form-inp" id="vci_${uid}" type="date" value="${toDateStr(v.checkin_date)}">`)}
      ${field('Check-Out', `<input class="form-inp" id="vco_${uid}" type="date" value="${toDateStr(v.checkout_date)}">`)}
      ${field('Extra Bed', `<input class="form-inp" id="veb_${uid}" type="number" min="0" step="any" placeholder="SAR" value="${numR(v.extra_bed) || ''}">`)}
      ${field('Rate Notes', `<input class="form-inp" id="vrm_${uid}" placeholder="Optional terms / notes" value="${escAttr(v.remarks || '')}">`)}
    </div>
  `;

  tbody.appendChild(card);
  updateContractCount();
}

function addVContractRows(count = 1) {
  const existing = document.querySelectorAll('#vContractTbody .v-contract-row').length;
  const allowed = Math.min(Math.max(0, count), 100 - existing);
  for (let i = 0; i < allowed; i++) addVContractRow();
  if (allowed < count) toast('A hotel can have up to 100 vendor rate rows.', 'warn');
  if (allowed === 1) document.getElementById('vv_' + _vrCounter)?.focus();
}

function readVContractRow(uid) {
  const priceAll = document.getElementById(`vp_${uid}`)?.value || '';
  const priceWeekday = document.getElementById(`vwd_${uid}`)?.value || '';
  const priceWeekend = document.getElementById(`vwe_${uid}`)?.value || '';
  const hasAllRate = numR(priceAll) > 0;
  const hasWeekdayRate = numR(priceWeekday) > 0;
  const hasWeekendRate = numR(priceWeekend) > 0;
  const daysType = hasAllRate ? 'ALL'
    : hasWeekdayRate && hasWeekendRate ? 'SPLIT'
      : hasWeekdayRate ? 'WEEKDAY'
        : hasWeekendRate ? 'WEEKEND'
          : document.getElementById(`vdt_${uid}`)?.value || 'ALL';
  return {
    vendor_name: document.getElementById(`vv_${uid}`)?.value.trim() || '',
    room_type: document.getElementById(`vrt_${uid}`)?.value || 'DOUBLE',
    meal_plan: document.getElementById(`vmp_${uid}`)?.value || 'RO',
    days_type: daysType,
    price_all: priceAll,
    price_weekday: priceWeekday,
    price_weekend: priceWeekend,
    price_best: document.getElementById(`vbr_${uid}`)?.value || '',
    extra_bed: document.getElementById(`veb_${uid}`)?.value || '',
    checkin_date: document.getElementById(`vci_${uid}`)?.value || '',
    checkout_date: document.getElementById(`vco_${uid}`)?.value || '',
    remarks: document.getElementById(`vrm_${uid}`)?.value.trim() || ''
  };
}

function duplicateVContractRow(uid) {
  const source = document.getElementById(uid);
  if (!source) return;
  const rows = [...document.querySelectorAll('#vContractTbody .v-contract-row')];
  if (rows.length >= 100) {
    toast('A hotel can have up to 100 vendor rate rows.', 'warn');
    return;
  }
  const duplicate = readVContractRow(uid);
  addVContractRow(duplicate);
  const newRow = document.getElementById('vr_' + _vrCounter);
  source.after(newRow);
  updateContractCount();
  newRow.querySelector('input[list="vendorListDatalist"]')?.focus();
}

function removeVContractRow(uid) {
  document.getElementById(uid)?.remove();
  updateContractCount();
  if (!document.querySelector('#vContractTbody .v-contract-row')) addVContractRow();
}

function clearVContractRows() {
  if (!confirm('Remove every vendor rate row from this hotel form?')) return;
  const tbody = document.getElementById('vContractTbody');
  if (tbody) tbody.replaceChildren();
  updateContractCount();
}

function updateContractCount() {
  const rows = $$('#vContractTbody .v-contract-row');
  rows.forEach((row, index) => {
    const number = row.querySelector('.v-contract-number');
    if (number) number.textContent = `ROW #${index + 1}`;
  });
  $$('#hContractTabCount, #hContractCount').forEach(countEl => {
    countEl.textContent = rows.length;
  });
}

async function handleHotelImageUpload(fileInput) {
  if (!fileInput.files || !fileInput.files[0]) return;
  const file = fileInput.files[0];
  const fd = new FormData();
  fd.append('linked_type', 'hotel');
  fd.append('file', file);

  showLoad('Uploading image & generating URL…');
  try {
    const res = await UPL('/images/upload', fd);
    if (res?.url) {
      document.getElementById('hImageUrl').value = res.url;
      document.getElementById('hImgPreview').src  = res.url;
      document.getElementById('hImgPreview').style.display = 'block';
      document.getElementById('hImgPreviewWrap').style.display = 'block';
      document.getElementById('hImgPlaceholder').style.display = 'none';
      toast('Image uploaded with public URL!', 'success');
    }
  } catch (err) {
    toast('Image upload failed: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

function removeHotelImage() {
  document.getElementById('hImageUrl').value = '';
  document.getElementById('hImgPreview').src  = '';
  document.getElementById('hImgPreview').style.display = 'block';
  document.getElementById('hImgPreviewWrap').style.display = 'none';
  document.getElementById('hImgPlaceholder').style.display = 'block';
  document.getElementById('hImageFile').value = '';
}

async function saveHotelModal() {
  const name = document.getElementById('hName').value.trim();
  const city = document.getElementById('hCity').value.trim();
  if (!name || !city) {
    toast('Hotel name and city are required!', 'warn');
    switchHotelTab('profile');
    return;
  }

  // Branch visibility
  const branchVis = $$('.h-branch-chk:checked').map(c => c.value);

  // Gather vendor contract rows
  const vendors = [];
  let invalidContract = '';
  $$('#vContractTbody .v-contract-row').forEach(row => {
    const data = readVContractRow(row.id);
    const hasRateDetails = ['price_all', 'price_weekday', 'price_weekend', 'price_best',
      'extra_bed', 'checkin_date', 'checkout_date', 'remarks'].some(key => data[key] !== '');
    if (!data.vendor_name) {
      if (hasRateDetails) invalidContract = 'Enter a vendor name for each rate row.';
      return;
    }
    if (!!data.checkin_date !== !!data.checkout_date) {
      invalidContract = 'Enter both check-in and check-out dates for each dated rate.';
      return;
    }
    if (['price_all', 'price_weekday', 'price_weekend', 'price_best', 'extra_bed']
      .some(key => data[key] !== '' && numR(data[key]) < 0)) {
      invalidContract = `Rates cannot be negative (${data.vendor_name || 'rate row'}).`;
      return;
    }
    if (data.checkin_date && data.checkout_date && data.checkin_date >= data.checkout_date) {
      invalidContract = 'Rate check-out date must be after its check-in date.';
      return;
    }
    if (!['price_all', 'price_weekday', 'price_weekend', 'price_best'].some(key => numR(data[key]) > 0)) {
      invalidContract = `Enter at least one rate for ${data.vendor_name}.`;
      return;
    }
    vendors.push({
      ...data,
      price_all: numR(data.price_all),
      price_weekday: numR(data.price_weekday),
      price_weekend: numR(data.price_weekend),
      price_best: numR(data.price_best),
      extra_bed: numR(data.extra_bed),
      checkin_date: data.checkin_date || null,
      checkout_date: data.checkout_date || null,
      status: 'active'
    });
  });
  if (invalidContract) {
    toast(invalidContract, 'warn');
    switchHotelTab('contracts');
    return;
  }

  const payload = {
    name,
    city,
    country:           document.getElementById('hCountry').value.trim() || 'Saudi Arabia',
    area:              document.getElementById('hArea').value.trim() || null,
    distance_text:     document.getElementById('hDist').value.trim() || null,
    distance_meters:   parseInt(document.getElementById('hDistMeters').value) || 0,
    stars:             parseInt(document.getElementById('hStars').value) || 0,
    shuttle:           document.getElementById('hShuttle').value === '1',
    status:            document.getElementById('hStatus').value || 'active',
    amenities:         document.getElementById('hAmenities').value.trim() || null,
    description:       document.getElementById('hDescription').value.trim() || null,
    image_url:         document.getElementById('hImageUrl').value.trim() || null,
    location_url:      document.getElementById('hLocationUrl')?.value.trim() || null,
    branch_visibility: branchVis,
    vendors
  };

  const id = document.getElementById('hId').value;
  showLoad(id ? 'Updating hotel…' : 'Creating hotel…');

  try {
    if (id) {
      await PUT(`/hotels/${id}`, payload);
      toast('Hotel updated successfully!', 'success');
    } else {
      await POST('/hotels', payload);
      toast('Hotel created successfully!', 'success');
    }
    closeHotelModal();
    document.getElementById('ratelist')?.setAttribute('data-initialized', '');
    await pgHotels(true);
  } catch (err) {
    toast('Save failed: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

// ═══════════════════════════════════════════════════════════
//  COMPOUND CASCADING MARGIN ENGINE
// ═══════════════════════════════════════════════════════════
function getDisplayRate(raw, roomType) {
  const r = numR(raw);
  if (!r) return 0;
  if (G.user?.role === 'superadmin') return r; // Superadmin always sees raw supplier cost

  // Global Margin
  const gmMap = G.settings?.room_margins || {};
  const gm = gmMap[roomType] !== undefined ? numR(gmMap[roomType]) : numR(G.settings?.global_margin || 0);

  // Branch Margin
  let bm = 0;
  if (G.user?.branchId) {
    const br = G.branches.find(b => b.id === G.user.branchId);
    if (br && br.settings) {
      const bmMap = br.settings.room_margins || {};
      bm = bmMap[roomType] !== undefined ? numR(bmMap[roomType]) : numR(br.settings.margin || 0);
    }
  }
  return r + gm + bm;
}

function getContractRateRows(contract) {
  const dayType = (contract.days_type || 'ALL').toUpperCase();
  const allRate = numR(contract.price_all);
  const weekdayRate = numR(contract.price_weekday);
  const weekendRate = numR(contract.price_weekend);
  let rows = dayType === 'SPLIT'
    ? [['Weekday', weekdayRate || allRate], ['Weekend', weekendRate || allRate]]
    : dayType === 'WEEKDAY'
      ? [['Weekday', weekdayRate || allRate]]
      : dayType === 'WEEKEND'
        ? [['Weekend', weekendRate || allRate]]
        : [
            ...(allRate ? [['All Days', allRate]] : []),
            ...(weekdayRate ? [['Weekday', weekdayRate]] : []),
            ...(weekendRate ? [['Weekend', weekendRate]] : [])
          ];
  rows = rows.filter(([, rate]) => rate > 0);
  if (!rows.length && allRate) rows.push(['Night', allRate]);
  if (!rows.length && (weekdayRate || weekendRate)) rows.push(['Night', weekdayRate || weekendRate]);
  return rows;
}

// Search-only rate projection. A selected rate type must never fall back to
// another rate, otherwise Weekend/Weekday searches show misleading prices.
function getSearchRateRows(contract, rateType) {
  if (!rateType) return getContractRateRows(contract);
  const rates = {
    all: [['All Days', numR(contract.price_all)]],
    weekday: [['Weekday', numR(contract.price_weekday)]],
    weekend: [['Weekend', numR(contract.price_weekend)]]
  }[rateType] || [];
  return rates.filter(([, rate]) => rate > 0);
}

function getContractRatePattern(contract) {
  const allRate = numR(contract.price_all) > 0;
  const weekdayRate = numR(contract.price_weekday) > 0;
  const weekendRate = numR(contract.price_weekend) > 0;
  const legacyDayType = String(contract.days_type || 'ALL').toUpperCase();
  if (allRate && (weekdayRate || weekendRate)) return 'All days + overrides';
  if (weekdayRate && weekendRate) return 'Weekday / weekend';
  if (weekdayRate) return 'Weekdays only';
  if (weekendRate) return 'Fri-Sat only';
  if (legacyDayType === 'WEEKDAY') return 'Weekdays only';
  if (legacyDayType === 'WEEKEND') return 'Fri-Sat only';
  if (legacyDayType === 'SPLIT') return 'Weekday / weekend';
  return allRate ? 'All days' : 'Rate on request';
}

function normalizeHotelCity(city) {
  const value = String(city || '').trim().toUpperCase().replace(/[\s_-]+/g, '');
  if (['MAKKAH', 'MECCA', 'MAKKAHALMUKARRAMAH'].includes(value)) return 'MAKKAH';
  if (['MADINA', 'MADINAH', 'MEDINA', 'ALMADINA', 'ALMADINAH'].includes(value)) return 'MADINAH';
  if (['JEDDA', 'JEDDAH'].includes(value)) return 'JEDDAH';
  return value;
}

function _datePart(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function _contractNightRate(contract, date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  const isWeekend = day === 5 || day === 6;
  const dayType = String(contract.days_type || 'ALL').toUpperCase();
  if (dayType === 'WEEKDAY' && isWeekend) return 0;
  if (dayType === 'WEEKEND' && !isWeekend) return 0;

  const allRate = numR(contract.price_all);
  const specificRate = isWeekend ? numR(contract.price_weekend) : numR(contract.price_weekday);
  return specificRate || allRate;
}

function resolveHotelContractStay(contract, checkIn, checkOut) {
  const start = _datePart(checkIn);
  const end = _datePart(checkOut);
  if (!start && !end) {
    const rates = getContractRateRows(contract).map(([, rate]) => rate);
    if (!rates.length) return null;
    const rate = Math.min(...rates);
    return { total: rate, nightlyRate: rate, nights: 1 };
  }
  if (!start || !end || start >= end) return null;

  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const nights = Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
  if (!Number.isFinite(nights) || nights < 1 || nights > 730) return null;

  const contractStart = _datePart(contract.checkin_date);
  const contractEnd = _datePart(contract.checkout_date);
  if ((contractStart && contractStart > start) || (contractEnd && contractEnd < end)) return null;

  let total = 0;
  for (let offset = 0; offset < nights; offset++) {
    const nightDate = new Date(startDate.getTime() + offset * 86400000).toISOString().slice(0, 10);
    const rate = _contractNightRate(contract, nightDate);
    if (!rate) return null;
    total += rate;
  }
  return { total, nightlyRate: total / nights, nights };
}

function bestHotelContractRate(contracts, checkIn, checkOut) {
  const hasAnyDate = !!(_datePart(checkIn) || _datePart(checkOut));
  if (!!checkIn !== !!checkOut && hasAnyDate) return null;
  const choices = (contracts || []).map(contract => ({
    contract,
    stay: resolveHotelContractStay(contract, checkIn, checkOut)
  })).filter(choice => choice.stay);
  if (!choices.length) return null;

  const candidates = !hasAnyDate
    ? choices.filter(({ contract }) => !_datePart(contract.checkin_date) && !_datePart(contract.checkout_date))
    : choices;
  const ranked = candidates.length ? candidates : choices;
  ranked.sort((a, b) => a.stay.total - b.stay.total);
  return ranked[0];
}

// ═══════════════════════════════════════════════════════════
//  MATHEMATICAL DATE OVERLAP & COVERAGE EVALUATION
// ═══════════════════════════════════════════════════════════
function _dateOverlap(vi, vo, fi, fo) {
  if (!vi && !vo) return true;
  if (!fi && !fo) return true;
  const dVi = vi ? new Date(vi).getTime() : -Infinity;
  const dVo = vo ? new Date(vo).getTime() : Infinity;
  const dFi = fi ? new Date(fi).getTime() : -Infinity;
  const dFo = fo ? new Date(fo).getTime() : Infinity;
  return dVi <= dFo && dVo >= dFi;
}

function _coverageType(vi, vo, fi, fo) {
  if (!fi && !fo) return 'full';
  if (!vi || !vo) return 'full';
  const dVi = new Date(vi).getTime();
  const dVo = new Date(vo).getTime();
  const dFi = fi ? new Date(fi).getTime() : null;
  const dFo = fo ? new Date(fo).getTime() : null;
  const sMatch = !dFi || dVi <= dFi;
  const eMatch = !dFo || dVo >= dFo;
  if (sMatch && eMatch) {
    return (dFi && dFo && dVi === dFi && dVo === dFo) ? 'exact' : 'full';
  }
  if (sMatch && !eMatch) return 'partial-end';
  if (!sMatch && eMatch) return 'partial-start';
  return 'partial';
}

async function deleteHotel(id, name) {
  if (!confirm(`Delete hotel "${name}"? It will be moved to Recycle Bin (7-day recovery).`)) return;
  try {
    await DEL(`/hotels/${id}`);
    _hotelDirectoryRows = _hotelDirectoryRows.filter(h => h.id !== id);
    G._hotelsLoaded = true;
    document.getElementById('hotels')?.setAttribute('data-initialized', '');
    document.getElementById('ratelist')?.setAttribute('data-initialized', '');
    pgHotels(true);
    toast('Hotel moved to Recycle Bin', 'success');
  } catch (err) {
    toast('Delete failed: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════
//  PAGE: ADVANCED HOTEL SEARCH ENGINE (PHASE 2)
// ═══════════════════════════════════════════════════════════
let _lastHotelSearchResults = [];
let _hotelCostingSelections = Object.create(null);

async function pgSearch() {
  const pg = document.getElementById('search');
  if (!pg) return;
  // Keep the rendered result set when switching tabs. Re-running doSearch here
  // rebuilds hundreds of hotel cards and makes navigation feel like a reload.
  // Filter controls already call doSearch explicitly when the user changes them.
  if (pg.dataset.initialized === 'true') return;
  try { await ensureDetailedHotels(); }
  catch (err) { toast('Failed to load hotel rates: ' + err.message, 'error'); return; }
  const isStaff = G.user?.role === 'superadmin' || G.user?.role === 'admin';
  const searchRoomTypes = catalogOptions('room_types', ROOM_OPTIONS);
  const searchMealPlans = mealPlanOptions();
  const searchCities = [...new Set([
    'MAKKAH', 'MADINAH', 'JEDDAH',
    ...(G.hotels || []).map(h => normalizeHotelCity(h.city)).filter(Boolean)
  ])].sort();
  const searchAreas = [...new Set((G.hotels || []).map(h => String(h.area || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const searchVendors = [...new Set([
    ...(G.vendors || []).map(v => v.name || v.vendor_name).filter(Boolean),
    ...(G.hotels || []).flatMap(h => Array.isArray(h.vendors)
      ? h.vendors.map(v => v.vendor_name).filter(Boolean)
      : [])
  ])].sort((a, b) => a.localeCompare(b));

  pg.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title"><i class="bi bi-search me-2" style="color:var(--pri)"></i>Hotel Rate Search & Finder</h1>
        <span class="page-sub">Multi-criteria filtering with live margins, date overlap & quotation finder</span>
      </div>
      <div class="page-actions">
        <button class="btn-ghost" onclick="nav('ratelist')"><i class="bi bi-file-earmark-pdf me-1"></i>Rate Sheet View</button>
      </div>
    </div>

    <div class="hotel-rate-notice" role="note" aria-label="Hotel rate notice">
      <div class="hotel-rate-notice__title"><i class="bi bi-info-circle-fill me-2"></i>RATE NOTICE — TENTATIVE PRICES</div>
      <div class="hotel-rate-notice__text">The rates displayed on these hotels are <strong>tentative and subject to confirmation.</strong> Please send a query via the “Send Query” button or contact us on WhatsApp for confirmed rates.</div>
    </div>

    <!-- Filter Card -->
    <div class="glass-card hotel-search-filters p-3 mb-3">
      <div class="hotel-search-filter-grid">
        <div class="col-md-3">
          <label class="form-label" style="font-size:11px;font-weight:700">Keyword Query</label>
          <input class="form-inp" id="srchQ" placeholder="Hotel name, locality${isStaff ? ', vendor' : ''}…" type="search" onkeydown="if(event.key==='Enter')doSearch()">
        </div>
        <div class="col-md-2">
          <label class="form-label" style="font-size:11px;font-weight:700">City</label>
          <select class="form-inp" id="srchCity" onchange="updateSearchAreas()">
            <option value="">All Cities</option>
            ${searchCities.map(city => `<option value="${escAttr(city)}">${esc(city)}</option>`).join('')}
          </select>
        </div>
        <div class="col-md-2">
          <label class="form-label" style="font-size:11px;font-weight:700">Area</label>
          <select class="form-inp" id="srchArea" onchange="doSearch()">
            <option value="">All Areas</option>
            ${searchAreas.map(area => `<option value="${escAttr(area)}">${esc(area)}</option>`).join('')}
          </select>
        </div>
        <div class="col-md-2">
          <label class="form-label" style="font-size:11px;font-weight:700">Room Type</label>
          <select class="form-inp" id="srchRoom" onchange="doSearch()">
            <option value="">All Room Types</option>
            ${searchRoomTypes.map(room => `<option value="${escAttr(room)}">${esc(room)}</option>`).join('')}
          </select>
        </div>
        <div class="col-md-2">
          <label class="form-label" style="font-size:11px;font-weight:700">Meal Plan</label>
          <select class="form-inp" id="srchMeal" onchange="doSearch()">
            <option value="">All Meals</option>
            ${searchMealPlans.map(meal => `<option value="${escAttr(meal)}">${esc(meal)}</option>`).join('')}
          </select>
        </div>
        <div class="col-md-2">
          <label class="form-label" style="font-size:11px;font-weight:700">Days</label>
          <select class="form-inp" id="srchRateType" onchange="doSearch()">
            <option value="">All Days</option>
            <option value="all">All Day Rate</option>
            <option value="weekday">Weekday Rate</option>
            <option value="weekend">Weekend Rate</option>
          </select>
        </div>
        <!-- Date Overlap & Advanced Criteria -->
        <div class="col-md-2">
          <label class="form-label" style="font-size:11px;font-weight:700">Check-In Date</label>
          <input class="form-inp" id="srchCin" type="date" onchange="doSearch()">
        </div>
        <div class="col-md-2">
          <label class="form-label" style="font-size:11px;font-weight:700">Check-Out Date</label>
          <input class="form-inp" id="srchCout" type="date" onchange="doSearch()">
        </div>
        <div class="col-md-2">
          <label class="form-label" style="font-size:11px;font-weight:700">Distance (m)</label>
          <input class="form-inp" id="srchDist" type="text" inputmode="numeric" placeholder="e.g. 500 or 300-350" onchange="doSearch()">
        </div>
        <div class="col-md-2">
          <label class="form-label" style="font-size:11px;font-weight:700">Min Price (SAR)</label>
          <input class="form-inp" id="srchMinPrice" type="number" min="0" placeholder="0" onchange="doSearch()">
        </div>
        <div class="col-md-2">
          <label class="form-label" style="font-size:11px;font-weight:700">Max Price (SAR)</label>
          <input class="form-inp" id="srchMaxPrice" type="number" min="0" placeholder="0" onchange="doSearch()">
        </div>
        <div class="col-md-2">
          <label class="form-label" style="font-size:11px;font-weight:700">Minimum Rating</label>
          <select class="form-inp" id="srchStars" onchange="doSearch()">
            <option value="">Any Rating</option>
            <option value="1">1/5 or higher</option>
            <option value="2">2/5 or higher</option>
            <option value="3">3/5 or higher</option>
            <option value="4">4/5 or higher</option>
            <option value="5">5/5 only</option>
          </select>
        </div>
        <div class="col-md-2">
          <label class="form-label" style="font-size:11px;font-weight:700">Shuttle Service</label>
          <select class="form-inp" id="srchShuttle" onchange="doSearch()">
            <option value="">All Hotels</option>
            <option value="yes">With Shuttle 🚌</option>
            <option value="no">Without Shuttle</option>
          </select>
        </div>
        <div class="col-md-2">
          <label class="form-label" style="font-size:11px;font-weight:700">Sort By</label>
          <select class="form-inp" id="srchSort" onchange="doSearch()">
            <option value="">Default</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="name">Name A-Z</option>
            <option value="dist">Distance to Haram</option>
            <option value="stars">Star Rating</option>
          </select>
        </div>

        <div class="col-md-2">
            <label class="form-label" style="font-size:11px;font-weight:700">Supplier / Vendor</label>
            <select class="form-inp" id="srchVendor" onchange="doSearch()">
              <option value="">All Suppliers</option>
              ${searchVendors.map(name => `<option value="${escAttr(name)}">${esc(name)}</option>`).join('')}
            </select>
        </div>

        <div class="col-12 d-flex justify-content-between align-items-center mt-2 pt-2" style="border-top:1px dashed rgba(126,200,227,0.25)">
          <label style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--t2);cursor:pointer;margin:0">
            <input type="checkbox" id="srchStrict" onchange="doSearch()" style="accent-color:var(--pri)">
            <span>Strict: 100% full stay coverage only (hide partial dates)</span>
          </label>
          <div class="d-flex gap-2">
            <button class="btn-pri btn-sm" onclick="doSearch()">
              <i class="bi bi-funnel-fill me-1"></i>Apply Filters
            </button>
            <button class="btn-ghost btn-sm" onclick="resetSearchFilters()" title="Reset Filters">
              <i class="bi bi-arrow-counterclockwise me-1"></i>Reset
            </button>
            <button class="btn-ghost btn-sm" onclick="refreshHotelSearch()" title="Refresh hotel rates">
              <i class="bi bi-arrow-repeat me-1"></i>Refresh
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Filters & Results Summary Banner -->
    <div id="searchSummaryBanner"></div>

    <!-- Results Container -->
    <div id="searchResults">
      <div class="glass-card p-4 text-center t3">Select search criteria or click Search to view live inventory rates.</div>
    </div>`;

  pg.dataset.initialized = 'true';
  // Keep the initial view light: show only a small recommendation set until
  // the user actually enters search criteria.
  doSearch({ recommended: true });
}

function resetSearchFilters() {
  ['srchQ','srchCity','srchArea','srchRoom','srchMeal','srchRateType','srchCin','srchCout','srchDist','srchMinPrice','srchMaxPrice','srchStars','srchShuttle','srchSort','srchVendor'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const chk = document.getElementById('srchStrict');
  if (chk) chk.checked = false;
  doSearch();
}

async function refreshHotelSearch() {
  try {
    const filterIds = ['srchQ','srchCity','srchArea','srchRoom','srchMeal','srchRateType','srchCin','srchCout','srchDist','srchMinPrice','srchMaxPrice','srchStars','srchShuttle','srchSort','srchVendor'];
    const filterState = Object.fromEntries(filterIds.map(id => [id, document.getElementById(id)?.value || '']));
    filterState.srchStrict = !!document.getElementById('srchStrict')?.checked;
    showLoad('Refreshing hotel rates…');
    G.hotels = (await GET('/hotels?include_vendors=1')) || [];
    G._hotelsLoaded = true;
    G._hotelsDetailedLoaded = true;
    const page = document.getElementById('search');
    if (page) page.dataset.initialized = '';
    pgSearch();
    filterIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = filterState[id];
    });
    const strictEl = document.getElementById('srchStrict');
    if (strictEl) strictEl.checked = filterState.srchStrict;
    doSearch();
    toast('Hotel rates refreshed', 'success');
  } catch (err) {
    toast('Refresh failed: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}


// Add hotel from search results to active costing
function addHotelToCostingLegacy(hotelId, hotelName, city) {
  // Switch to costing page
  nav('costing');
  setTimeout(() => {
    toast('🏨 ' + hotelName + ' loaded — select option to add it', 'info');
    // Pre-fill search
    const inp = document.getElementById('cHotelSearch');
    if (inp) { inp.value = hotelName; inp.dispatchEvent(new Event('input')); }
  }, 400);
}

async function openHotelCostingChooser(selectionKey) {
  const selection = _hotelCostingSelections[selectionKey];
  if (!selection) { toast('This hotel rate is no longer available. Refresh search results.', 'warn'); return; }
  try {
    showLoad('Loading your quotations…');
    const ownId = G.user?.id || G.user?.userId || '';
    const ownQuotations = ((await GET('/quotations?type=private&mine=1')) || [])
      .filter(q => !ownId || String(q.created_by || '') === String(ownId));
    const modal = document.getElementById('hotelCostingModal');
    const list = document.getElementById('hotelCostingQuotationList');
    if (!modal || !list) return;
    modal.dataset.selectionKey = selectionKey;
    document.getElementById('hotelCostingSelectionSummary').innerHTML = `<strong>${esc(selection.hotelName)}</strong> · ${esc(selection.city || '')} · ${esc(selection.roomType)} / ${esc(selection.meal)} <span class="pill pill-green ms-2">${fmtSAR(selection.rate)} / night</span>`;
    list.innerHTML = ownQuotations.length
      ? ownQuotations.map(q => `<option value="${escAttr(q.id)}">${esc(q.invoice_no || 'Quotation')} — ${esc(q.client_name || 'Unnamed client')} (${esc(q.status || 'pending')})</option>`).join('')
      : '<option value="">No existing quotations found</option>';
    const existingBtn = document.getElementById('hotelCostingExistingBtn');
    if (existingBtn) existingBtn.disabled = !ownQuotations.length;
    hideLoad();
    openModal('hotelCostingModal');
  } catch (err) {
    hideLoad();
    toast('Could not load your quotations: ' + err.message, 'error');
  }
}

function useHotelInNewQuotation() {
  const modal = document.getElementById('hotelCostingModal');
  const selection = _hotelCostingSelections[modal?.dataset.selectionKey];
  closeModal('hotelCostingModal');
  if (!selection) return;
  nav('pvt');
  setTimeout(() => insertHotelIntoPrivateCosting(selection), 550);
}

async function useHotelInExistingQuotation() {
  const modal = document.getElementById('hotelCostingModal');
  const selection = _hotelCostingSelections[modal?.dataset.selectionKey];
  const quotationId = document.getElementById('hotelCostingQuotationList')?.value;
  if (!selection || !quotationId) return;
  try {
    showLoad('Opening your quotation…');
    const quotation = await GET(`/quotations/${quotationId}?mine=1`);
    if (!quotation) throw new Error('Quotation not found');
    closeModal('hotelCostingModal');
    nav('pvt');
    setTimeout(() => {
      restorePrivateQuotation({ ...quotation, options: parseQuotationOptions(quotation.options) });
      setTimeout(() => insertHotelIntoPrivateCosting(selection), 250);
    }, 550);
  } catch (err) {
    toast('Could not open quotation: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

function insertHotelIntoPrivateCosting(selection) {
  const body = document.getElementById('hBodyA');
  if (!body) { toast('Private costing editor is not available.', 'error'); return; }
  addHotelRow('A', 'h');
  const row = [...body.querySelectorAll('tr')].at(-1);
  if (!row) return;
  const idx = row.id.split('_').pop();
  const city = String(selection.city || '').toLowerCase();
  const values = {
    [`hCityA${idx}`]: city.includes('madinah') ? 'madina' : city.includes('jeddah') ? 'jeddah' : 'makkah',
    [`hA${idx}`]: selection.hotelName, [`hRA${idx}`]: selection.roomType, [`hMA${idx}`]: selection.meal,
    [`hHInA${idx}`]: selection.checkIn || '', [`hHOutA${idx}`]: selection.checkOut || '',
    [`hNA${idx}`]: selection.nights || 1, [`hRtA${idx}`]: selection.rate || ''
  };
  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  row.dataset.img = selection.image_url || '';
  row.dataset.loc = selection.location_url || '';
  updateHotelDates('h', 'A', Number(idx));
  triggerCostingCalc();
  toast(`Hotel added to costing: ${selection.hotelName} (${fmtSAR(selection.rate)}/night)`, 'success');
}

async function doSearch(searchOptions = {}) {
  const q       = $('#srchQ')?.value.trim().toLowerCase() || '';
  const city    = $('#srchCity')?.value || '';
  const area    = $('#srchArea')?.value.trim().toLowerCase() || '';
  const room    = $('#srchRoom')?.value || '';
  const meal    = $('#srchMeal')?.value || '';
  const rateType = $('#srchRateType')?.value || '';
  const cin     = $('#srchCin')?.value || null;
  const cout    = $('#srchCout')?.value || null;
  const distanceText = $('#srchDist')?.value.trim() || '';
  const distanceParts = distanceText.split(/\s*(?:-|to)\s*/i).map(Number).filter(Number.isFinite);
  const minDist = distanceParts.length > 1 ? Math.min(...distanceParts) : 0;
  const maxDist = distanceParts.length ? Math.max(...distanceParts) : 0;
  const minPrice = parseFloat($('#srchMinPrice')?.value) || 0;
  const maxPrice = parseFloat($('#srchMaxPrice')?.value) || 0;
  const minStars = parseInt($('#srchStars')?.value) || 0;
  const shuttle = $('#srchShuttle')?.value || '';
  const sortBy  = $('#srchSort')?.value || '';
  const vendorQ = $('#srchVendor')?.value.trim().toLowerCase() || '';
  const strict  = !!$('#srchStrict')?.checked;
  const hasCriteria = !!(q || city || area || room || meal || rateType || cin || cout || distanceText || minPrice || maxPrice || minStars || shuttle || sortBy || vendorQ || strict);
  const recommendedMode = searchOptions.recommended === true || !hasCriteria;

  const isSuper = G.user?.role === 'superadmin';
  const isStaff = G.user?.role === 'superadmin' || G.user?.role === 'admin';
  const container = document.getElementById('searchResults');
  if (cin && cout && cin >= cout) {
    if (container) container.innerHTML = '<div class="glass-card p-4 text-center t3">Check-out must be after check-in.</div>';
    return;
  }

  try {
    let searchHotels = G.hotels || [];
    if (hasCriteria && !searchOptions.localOnly) {
      const params = new URLSearchParams({ include_vendors: '1', paginate: '1', page: '1', limit: '100' });
      if (q) params.set('q', q);
      if (city) params.set('city', city);
      if (area) params.set('area', area);
      if (minStars) params.set('stars', String(minStars));
      if (shuttle) params.set('shuttle', shuttle === 'yes' ? 'true' : 'false');
      const data = await GET('/hotels?' + params.toString());
      searchHotels = data?.items || data || [];
    }
    const hotels = recommendedMode
      ? [...(G.hotels || [])]
        .sort((a, b) => (Number(b.stars || 0) - Number(a.stars || 0)) || String(a.name || '').localeCompare(String(b.name || '')))
        .slice(0, 40)
      : searchHotels;

    // Multi-tier filtering
    let results = [];
    (hotels || []).forEach(h => {
      if (city && normalizeHotelCity(h.city) !== normalizeHotelCity(city)) return;
      if (area && String(h.area || '').trim().toLowerCase() !== area) return;

      // Distance filter
      if (maxDist > 0 && (!Number.isFinite(Number(h.distance_meters)) || Number(h.distance_meters) < minDist || Number(h.distance_meters) > maxDist)) return;
      if (minStars > 0 && Number(h.stars || 0) < minStars) return;

      // Shuttle filter
      if (shuttle === 'yes' && !h.shuttle) return;
      if (shuttle === 'no' && h.shuttle) return;

      // Text query match on hotel
      const hText = `${h.name} ${h.city} ${h.area||''} ${h.amenities||''}`.toLowerCase();
      const hMatches = !q || hText.includes(q);

      const allVendors = Array.isArray(h.vendors) ? h.vendors : (h.vendors ? JSON.parse(h.vendors) : []);

      // Filter contracts
      const matchingContracts = allVendors.filter(v => {
        // Staff vendor filter
        if (vendorQ && (v.vendor_name || '').trim().toLowerCase() !== vendorQ) return false;

        // Text match on vendor name (only if staff or matching query)
        const vMatches = !q || hMatches || (isStaff && (v.vendor_name||'').toLowerCase().includes(q));
        if (!vMatches) return false;

        // Room Type
        if (room && (v.room_type || '').toUpperCase() !== room.toUpperCase()) return false;

        // Meal Plan
        if (meal && (v.meal_plan || '').toUpperCase() !== meal.toUpperCase()) return false;

        // Rate type is an exact filter: do not show fallback or mixed rate rows.
        if (rateType && !getSearchRateRows(v, rateType).length) return false;

        // Price range applies to the currently selected rate type only.
        const contractRates = getSearchRateRows(v, rateType).map(([, rate]) => rate);
        if ((minPrice > 0 || maxPrice > 0) && !contractRates.some(rate =>
          (!minPrice || rate >= minPrice) && (!maxPrice || rate <= maxPrice)
        )) return false;

        // Date Overlap
        if (cin || cout) {
          const overlap = _dateOverlap(v.checkin_date, v.checkout_date, cin, cout);
          if (!overlap) return false;
          if (strict) {
            const cov = _coverageType(v.checkin_date, v.checkout_date, cin, cout);
            if (cov !== 'exact' && cov !== 'full') return false;
          }
        }

        return true;
      }).map(contract => ({
        ...contract,
        _stayRate: (() => {
          if (!cin || !cout) return null;
          const stay = resolveHotelContractStay(contract, cin, cout);
          if (!stay) return null;
          const displayNightlyRate = getDisplayRate(stay.nightlyRate, contract.room_type);
          return {
            ...stay,
            displayNightlyRate,
            displayTotal: displayNightlyRate * stay.nights
          };
        })()
      }));

      const hasRateFilters = !!(room || meal || rateType || cin || cout || vendorQ || area || minPrice || maxPrice || minDist || maxDist);
      if (matchingContracts.length > 0 || (!allVendors.length && hMatches && !hasRateFilters)) {
        results.push({ ...h, _contracts: matchingContracts });
      }
    });

    // Sorting
    if (sortBy === 'price_asc' || sortBy === 'price_desc') {
      results.sort((a, b) => {
        const minRate = hotel => {
          if (cin && cout) {
            return Math.min(...hotel._contracts.map(contract =>
              contract._stayRate ? contract._stayRate.displayTotal : Infinity
            ));
          }
          const rates = hotel._contracts.flatMap(contract => getSearchRateRows(contract, rateType).map(([, rate]) => rate));
          return rates.length ? Math.min(...rates) : Infinity;
        };
        const minA = minRate(a);
        const minB = minRate(b);
        return sortBy === 'price_asc' ? minA - minB : minB - minA;
      });
    } else if (sortBy === 'name') {
      results.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'dist') {
      results.sort((a, b) => (a.distance_meters || 9999) - (b.distance_meters || 9999));
    } else if (sortBy === 'stars') {
      results.sort((a, b) => (b.stars || 0) - (a.stars || 0));
    }
    if (recommendedMode) {
      results.sort((a, b) => (Number(b.stars || 0) - Number(a.stars || 0)) || String(a.name || '').localeCompare(String(b.name || '')));
      results = results.slice(0, 10);
    }
    _lastHotelSearchResults = results;

    const bannerEl = document.getElementById('searchSummaryBanner');
    if (bannerEl) {
      if (cin || cout) {
        const totalContracts = results.reduce((acc, h) => acc + h._contracts.length, 0);
        bannerEl.innerHTML = `
          <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:11.5px;color:var(--t2)">
            <div style="font-weight:700;color:#b45309;display:flex;align-items:center;gap:6px">
              <i class="bi bi-calendar-range"></i> Stay Period: <b>${cin || 'Open'} → ${cout || 'Open'}</b>
            </div>
            <div class="mt-1" style="font-size:11px;color:var(--t3)">
              Found <b>${results.length}</b> hotels with <b>${totalContracts}</b> contracts overlapping your dates. Stay totals are shown only for full-stay rates.
            </div>
          </div>`;
      } else {
        bannerEl.innerHTML = '';
      }
    }

    if (!container) return;

    if (!results.length) {
      container.innerHTML = `
        <div class="glass-card p-5 text-center t3">
          <i class="bi bi-building-x" style="font-size:42px;color:var(--pri)"></i>
          <div class="mt-3" style="font-size:15px;font-weight:700;color:var(--t1)">No matching hotel rates found</div>
          <div class="mt-1">Try adjusting your stay dates, meal plan or distance criteria.</div>
        </div>`;
      return;
    }

    _hotelCostingSelections = Object.create(null);
    container.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <span class="t2" style="font-weight:700">${recommendedMode ? 'Recommended hotels' : `${results.length} Hotels matched`} (${results.reduce((acc,h)=>acc+h._contracts.length,0)} rate contracts)</span>
        <button class="btn-ghost btn-sm" onclick="exportFilteredRateListPDF()">
          <i class="bi bi-file-earmark-pdf me-1"></i>Download PDF Rate Sheet
        </button>
      </div>

      ${results.map(h => {
        const contracts = [...(h._contracts || [])].sort((a, b) =>
          (a._stayRate?.displayTotal ?? Infinity) - (b._stayRate?.displayTotal ?? Infinity)
        );
        const bestStayContract = contracts.find(contract => contract._stayRate) || null;
        const bestRateValue = bestStayContract?._stayRate?.displayNightlyRate ?? Math.min(...contracts.flatMap(contract =>
          getSearchRateRows(contract, rateType).map(([, rate]) => getDisplayRate(rate, contract.room_type))
        ).filter(Number.isFinite));
        const bestRateLabel = Number.isFinite(bestRateValue) ? fmtSAR(bestRateValue) : null;
        return `
          <article class="glass-card hotel-search-card p-3 mb-3">
            <div class="hotel-search-card__head d-flex justify-content-between align-items-start gap-3">
              <div class="d-flex gap-3 align-items-start">
                ${h.image_url ? `
                  <img src="${escAttr(h.image_url)}" alt="${escAttr(h.name)}" style="width:90px;height:75px;object-fit:cover;object-position:center;border-radius:10px;box-shadow:0 4px 10px rgba(0,0,0,0.1)" onerror="this.style.display='none'">
                ` : `
                  <div style="width:75px;height:75px;border-radius:10px;background:rgba(126,200,227,0.14);border:1px solid var(--glass-border);display:flex;align-items:center;justify-content:center;font-size:28px">🏨</div>
                `}
                <div class="hotel-search-card__identity">
                  <div class="d-flex align-items-center gap-2">
                    <span style="font-size:16px;font-weight:800;color:var(--t1)">${esc(h.name)}</span>
                    <span class="pill pill-blue">${esc(h.city)}</span>
                    ${h.shuttle ? `<span class="pill pill-peach"><i class="bi bi-bus-front me-1"></i>Shuttle</span>` : ''}
                    ${h.location_url ? `<a href="${escAttr(h.location_url)}" target="_blank" style="color:#ef4444;text-decoration:none" title="Google Maps Location">📍</a>` : ''}
                  </div>
                  <div class="t2 mt-1" style="font-size:12px">
                    ${h.area ? `<span><i class="bi bi-geo-alt me-1"></i>${esc(h.area)}</span>` : ''}
                    ${h.distance_text ? `<span class="ms-2">· 📏 ${esc(h.distance_text)}</span>` : ''}
                    <span class="ms-2 t3">${Number(h.stars) > 0 ? `Rating: ${Number(h.stars)}/5` : 'Standard'}</span>
                  </div>
                  ${h.amenities ? `<div class="t3 mt-1" style="font-size:11px">${esc(h.amenities)}</div>` : ''}
                </div>
              </div>

              <!-- Top Action -->
              <div class="hotel-search-card__actions d-flex gap-2 align-items-center">
                ${bestRateLabel ? `<div class="hotel-best-rate" title="Lowest available nightly hotel rate">
                  <span class="hotel-best-rate__label"><i class="bi bi-stars me-1"></i>Best Rate</span>
                  <strong>${bestRateLabel}</strong><small>/ night</small>
                </div>` : ''}
                <button class="btn-ghost btn-sm" onclick="shareWhatsAppHotel('${h.id}')" title="Share via WhatsApp">
                  <i class="bi bi-whatsapp me-1" style="color:#25D366"></i>Quote WA
                </button>
                ${P('hotels','edit') ? `<button class="btn-icon" onclick="openHotelModal('${h.id}')" title="Edit Hotel"><i class="bi bi-pencil"></i></button>` : ''}
              </div>
            </div>

            ${cin && cout ? `<div class="text-end" style="min-width:145px">
              ${bestStayContract ? `
                <div class="pill pill-green">Best stay rate</div>
                <div style="font-size:15px;font-weight:800;color:var(--ok);margin-top:4px">${fmtSAR(bestStayContract._stayRate.displayTotal)}</div>
                <div class="t3" style="font-size:10px">SAR ${fmtNum(bestStayContract._stayRate.displayNightlyRate, 2)} avg/night · ${bestStayContract._stayRate.nights} nights</div>
              ` : `<div class="pill pill-peach">No full-stay rate</div>`}
            </div>` : ''}

            <!-- Rate Contracts Table -->
            <div class="hotel-search-card__rates mt-3 pt-2" style="border-top:1px solid rgba(126,200,227,0.15)">
              <div class="table-wrap" style="max-height:none">
                <table class="tbl">
                  <thead>
                    <tr>
                      <th>Room Type</th>
                      <th>Meal</th>
                      <th class="rate-col-all">All</th>
                      <th class="rate-col-weekday">Weekday</th>
                      <th class="rate-col-weekend">Weekend</th>
                      ${cin && cout ? '<th>Selected Stay</th>' : ''}
                      <th>Coverage / Status</th>
                      ${isStaff ? '<th>Supplier</th>' : ''}
                      <th>Contract Dates</th>
                      <th>Extra Bed</th>
                      <th>Costing</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${contracts.length ? contracts.map(v => {
                      const rateRows = getSearchRateRows(v, rateType);
                      const rateValues = {
                        all: numR(v.price_all) ? getDisplayRate(v.price_all, v.room_type) : null,
                        weekday: numR(v.price_weekday) ? getDisplayRate(v.price_weekday, v.room_type) : null,
                        weekend: numR(v.price_weekend) ? getDisplayRate(v.price_weekend, v.room_type) : null
                      };
                      const rateCell = (value, kind) => value == null
                        ? '<span class="t3 rate-empty">—</span>'
                        : `<span class="hotel-rate-value ${rateType === kind ? 'is-selected' : ''}">${fmtSAR(value)}</span>`;
                      const coverage = (cin || cout) ? _coverageType(v.checkin_date, v.checkout_date, cin, cout) : null;
                      const covBadge = coverage === 'exact' ? '<span class="pill pill-blue">Exact Match</span>' :
                                       coverage === 'full'  ? '<span class="pill pill-lav">Full Stay</span>' :
                                       coverage ? '<span class="pill pill-peach">Partial</span>' : '<span class="pill pill-blue">Standard</span>';
                      const costingKey = `${h.id}-${v.id || `${v.room_type}-${v.meal_plan}-${v.checkin_date || 'season'}`}`;
                      const numericRates = Object.values(rateValues).filter(Number.isFinite);
                      const selectedRate = (cin && cout && v._stayRate)
                        ? v._stayRate.displayNightlyRate
                        : (rateType ? rateValues[rateType] : Math.min(...numericRates));
                      _hotelCostingSelections[costingKey] = {
                        hotelId: h.id, hotelName: h.name, city: h.city,
                        roomType: v.room_type || 'DOUBLE', meal: v.meal_plan || 'RO',
                        rate: Number.isFinite(selectedRate) ? selectedRate : 0,
                        checkIn: cin || v.checkin_date || '', checkOut: cout || v.checkout_date || '',
                        nights: (cin && cout) ? Math.max(1, Math.round((new Date(cout) - new Date(cin)) / 86400000)) : 1,
                        distance: h.distance_text || '', image_url: h.image_url || '', location_url: h.location_url || ''
                      };

                      return `
                        <tr${v === bestStayContract ? ' style="background:rgba(16,185,129,0.06)"' : ''}>
                          <td data-label="Room"><span class="pill pill-lav">${esc(v.room_type)}</span></td>
                          <td data-label="Meal"><span class="pill pill-peach">${esc(v.meal_plan)}</span></td>
                          <td data-label="All" class="hotel-rate-cell rate-col-all">${rateCell(rateValues.all, 'all')}</td>
                          <td data-label="Weekday" class="hotel-rate-cell rate-col-weekday">${rateCell(rateValues.weekday, 'weekday')}</td>
                          <td data-label="Weekend" class="hotel-rate-cell rate-col-weekend">${rateCell(rateValues.weekend, 'weekend')}</td>
                          ${cin && cout ? `<td>${v._stayRate ? `<span class="t2" style="font-weight:700">${fmtSAR(v._stayRate.displayTotal)}</span><div class="t3" style="font-size:10px">SAR ${fmtNum(v._stayRate.displayNightlyRate, 2)} avg/night</div>${v === bestStayContract ? '<span class="pill pill-green">Best</span>' : ''}` : '<span class="t3">No full-stay rate</span>'}</td>` : ''}
                          <td data-label="Status">${covBadge}</td>
                          ${isStaff ? `<td data-label="Supplier" class="t2" style="font-weight:600">${esc(v.vendor_name || 'Direct')}</td>` : ''}
                          <td data-label="Dates">${v.checkin_date && v.checkout_date
                            ? `<span class="t2" style="font-size:11px;font-weight:600">${fmtDate(v.checkin_date)} → ${fmtDate(v.checkout_date)}</span>`
                            : '<span class="pill pill-green" style="font-size:10px">All Season</span>'}</td>
                          <td class="t3">${numR(v.extra_bed) ? fmtSAR(v.extra_bed) : '—'}</td>
                          <td><button type="button" class="btn-pri btn-sm hotel-costing-btn" onclick="openHotelCostingChooser('${escAttr(costingKey)}')" title="Use this hotel rate in costing"><i class="bi bi-calculator me-1"></i>Use in Costing</button></td>
                        </tr>
                      `;
                    }).join('') : `<tr><td colspan="${9 + ((cin && cout) ? 1 : 0) + (isStaff ? 1 : 0)}" class="t3 py-3">No supplier rate is on file yet. Add a vendor contract before quoting this hotel.</td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>
          </article>
        `;
      }).join('')}
    `;

  } catch (err) {
    toast('Search failed: ' + err.message, 'error');
  }
}

function updateSearchAreas() {
  const city = String(document.getElementById('srchCity')?.value || '').trim().toLowerCase();
  const areaEl = document.getElementById('srchArea');
  if (!areaEl) { doSearch(); return; }
  const areas = [...new Set((G.hotels || [])
    .filter(h => !city || normalizeHotelCity(h.city).toLowerCase() === city)
    .map(h => String(h.area || '').trim())
    .filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const allAreasOption = city ? '' : '<option value="">All Areas</option>';
  areaEl.innerHTML = `${allAreasOption}${areas.map(area => `<option value="${escAttr(area)}">${esc(area)}</option>`).join('')}`;
  areaEl.value = '';
  doSearch();
}

function shareWhatsAppHotel(hotelId) {
  const hotel = G.hotels.find(h => h.id === hotelId);
  if (!hotel) return;

  const vendors = Array.isArray(hotel.vendors) ? hotel.vendors : (hotel.vendors ? JSON.parse(hotel.vendors) : []);
  const contracts = hotel._contracts || vendors;

  let text = `🏨 *${normName(hotel.name)}*\n`;
  text += `📍 City: ${hotel.city} ${hotel.area ? '| ' + hotel.area : ''}\n`;
  if (hotel.distance_text) text += `📏 Distance: ${hotel.distance_text}\n`;
  if (hotel.stars) text += `Rating: ${hotel.stars}/5\n`;
  if (hotel.shuttle) text += `🚌 Free Shuttle: Yes\n`;

  text += `\n📋 *AVAILABLE RATES & ROOM TYPES:*\n`;

  contracts.slice(0, 8).forEach(v => {
    const rates = getContractRateRows(v)
      .map(([label, rate]) => `${label}: ${fmtSAR(getDisplayRate(rate, v.room_type))}`)
      .join(' | ');
    text += `• *${v.room_type}* | Meal: ${v.meal_plan} | ${rates || 'Rate on request'}/night\n`;
    if (v.checkin_date && v.checkout_date) {
      text += `  🗓️ ${fmtDate(v.checkin_date)} → ${fmtDate(v.checkout_date)}\n`;
    }
  });

  text += `\n💬 _Rates subject to availability at confirmation._\n`;
  text += `*Pak Globe Travels*\n`;
  text += `📞 03100376111 | info@pakglobetravels.com`;

  window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

// ═══════════════════════════════════════════════════════════
//  PAGE: BRANDED RATE LIST & PDF GENERATOR
// ═══════════════════════════════════════════════════════════
async function pgRateList(forceRefresh = false) {
  const pg = document.getElementById('ratelist');
  if (!pg) return;
  if (!forceRefresh && pg.dataset.initialized === 'true') return;
  if (forceRefresh || !G._hotelsDetailedLoaded) {
    showLoad('Loading rate list…');
    try {
      G.hotels = (await GET('/hotels?status=active&include_vendors=1')) || [];
      G._hotelsLoaded = true;
      G._hotelsDetailedLoaded = true;
    } catch (err) {
      toast('Failed to load rate list: ' + err.message, 'error');
      return;
    } finally {
      hideLoad();
    }
  }

  pg.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="bi bi-file-earmark-text me-2" style="color:var(--pri)"></i>Hotel Rate List</h1>
          <span class="page-sub">Branded wholesale rate sheet for client quotation & printing</span>
        </div>
        <div class="page-actions">
          <button class="btn-pri" onclick="exportAllRateListPDF()">
            <i class="bi bi-file-earmark-pdf-fill me-1"></i>Download PDF Rate Sheet
          </button>
        </div>
      </div>

      <div class="glass-card mb-3 p-3">
        <div class="row g-2">
          <div class="col-md-4">
            <input class="form-inp" id="rlFilter" placeholder="Filter hotel or supplier…" oninput="filterRateListTable()">
          </div>
          <div class="col-md-3">
            <select class="form-inp" id="rlCity" onchange="filterRateListTable()">
              <option value="">All Cities</option>
              <option>MAKKAH</option><option>MADINAH</option><option>JEDDAH</option>
            </select>
          </div>
        </div>
      </div>

      <div class="glass-card">
        <div class="table-wrap" id="rlTableWrap">
          ${renderRateListTable(G.hotels)}
        </div>
      </div>
    `;
  pg.dataset.initialized = 'true';
}

function renderRateListTable(hotels) {
  const isStaff = G.user?.role === 'superadmin' || G.user?.role === 'admin';
  let rows = [];
  hotels.forEach(h => {
    const vendors = Array.isArray(h.vendors) ? h.vendors : (h.vendors ? JSON.parse(h.vendors) : []);
    vendors.forEach(v => {
      const rates = getContractRateRows(v)
        .map(([label, rate]) => `${label}: ${fmtSAR(getDisplayRate(rate, v.room_type))}`)
        .join(' | ');
      rows.push({
        hotel: h.name,
        city: h.city,
        area: h.area || '—',
        stars: h.stars || 0,
        dist: h.distance_text || '—',
        vendor: v.vendor_name,
        room: v.room_type,
        meal: v.meal_plan,
        pattern: getContractRatePattern(v),
        rate: rates || 'Rate on request',
        cin: v.checkin_date,
        cout: v.checkout_date
      });
    });
  });

  if (!rows.length) return `<div class="p-4 text-center t3">No active rate contracts in system.</div>`;

  return `
    <table class="tbl" id="tblRateList">
      <thead>
        <tr>
          <th>Hotel</th>
          <th>City</th>
          <th>Room</th>
          <th>Meal</th>
          <th>Rate Pattern</th>
          <th>Rate (SAR/Night)</th>
          ${isStaff ? '<th>Supplier</th>' : '<th>Available Dates</th>'}
          ${isStaff ? '<th>Dates Validity</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td data-label="Hotel"><strong>${esc(r.hotel)}</strong></td>
            <td data-label="City"><span class="pill pill-blue">${esc(r.city)}</span></td>
            <td data-label="Room"><span class="pill pill-lav">${esc(r.room)}</span></td>
            <td data-label="Meal"><span class="pill pill-peach">${esc(r.meal)}</span></td>
            <td data-label="Rate Pattern" class="t3">${esc(r.pattern)}</td>
            <td data-label="Rate (SAR/Night)"><strong style="color:var(--ok)">${esc(r.rate)}</strong></td>
            ${isStaff ? `
              <td data-label="Supplier" class="t2">${esc(r.vendor || 'Direct')}</td>
              <td class="t3" style="font-size:11px">${r.cin ? fmtDate(r.cin) + ' → ' + fmtDate(r.cout) : 'Open Season'}</td>
            ` : `
              <td data-label="Available Dates">
                ${r.cin ? `
                  <span class="t2" style="font-size:11px;font-weight:600">${fmtDate(r.cin)} → ${fmtDate(r.cout)}</span>
                ` : `
                  <span class="pill pill-green" style="font-size:10px">All Season Available</span>
                `}
              </td>
            `}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function filterRateListTable() {
  const q = document.getElementById('rlFilter')?.value.toLowerCase() || '';
  const c = document.getElementById('rlCity')?.value || '';
  const filtered = G.hotels.filter(h => {
    if (c && normalizeHotelCity(h.city) !== normalizeHotelCity(c)) return false;
    if (q && !h.name.toLowerCase().includes(q) && !(h.area||'').toLowerCase().includes(q)) return false;
    return true;
  });
  const wrap = document.getElementById('rlTableWrap');
  if (wrap) wrap.innerHTML = renderRateListTable(filtered);
}

// ═══════════════════════════════════════════════════════════
//  JSPDF BRANDED EXPORT ENGINE
// ═══════════════════════════════════════════════════════════
function exportAllRateListPDF() {
  exportFilteredRateListPDF(G.hotels);
}

async function exportFilteredRateListPDF(hotels = _lastHotelSearchResults) {
  showLoad('Generating branded PDF rate sheet…');
  try {
    await loadUtilityScript('jspdf');
    await loadUtilityScript('autotable');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // Header Background Pill
    doc.setFillColor(58, 148, 186); // Powder Blue primary
    doc.rect(0, 0, 210, 24, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('PAK GLOBE TRAVELS', 14, 12);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('HOTEL INVENTORY RATE SHEET — CONFIDENTIAL / CLIENT PROPOSAL', 14, 18);

    doc.text(new Date().toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' }), 196, 18, { align: 'right' });

    // Flatten rate table
    const tableData = [];
    hotels.forEach(h => {
      const vendors = Array.isArray(h.vendors) ? h.vendors : (h.vendors ? JSON.parse(h.vendors) : []);
      const contracts = h._contracts || vendors;
      contracts.forEach(v => {
        const rates = getContractRateRows(v)
          .map(([label, rate]) => `${label}: SAR ${fmtNum(getDisplayRate(rate, v.room_type), 0)}`)
          .join(' | ');
        const stayRate = v._stayRate
          ? `SAR ${fmtNum(v._stayRate.displayTotal, 0)} total · SAR ${fmtNum(v._stayRate.displayNightlyRate, 2)}/night`
          : '—';
        tableData.push([
          h.name,
          h.city,
          v.room_type,
          v.meal_plan,
          getContractRatePattern(v),
          rates || 'Rate on request',
          stayRate,
          v.checkin_date ? `${fmtDate(v.checkin_date)} to ${fmtDate(v.checkout_date)}` : 'Open',
          v.vendor_name || '—'
        ]);
      });
    });

    if (!doc.autoTable) throw new Error('PDF table plugin is unavailable');
    doc.autoTable({
        startY: 28,
        head: [['Hotel Name', 'City', 'Room Type', 'Meal', 'Rate Pattern', 'Rate/Night', 'Selected Stay', 'Stay Validity', 'Supplier']],
        body: tableData,
        theme: 'striped',
        styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [46, 125, 159], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 248, 254] },
        columnStyles: {
          5: { fontStyle: 'bold', textColor: [5, 150, 105] },
          6: { fontStyle: 'bold', textColor: [5, 150, 105] }
        },
        margin: { top: 28, left: 12, right: 12, bottom: 20 },
        didDrawPage: function (data) {
          // Footer
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(130, 144, 164);
          doc.text('Pak Globe Travels · Head Office: Hyderabad | Phone: 03100376111 | info@pakglobetravels.com', 14, 290);
          doc.text('Page ' + data.pageNumber + ' of ' + pageCount, 196, 290, { align: 'right' });
        }
      });

    doc.save(`PakGlobe_Rates_${new Date().toISOString().slice(0,10)}.pdf`);
    toast('PDF Rate List exported successfully!', 'success');
  } catch (err) {
    console.error('PDF error:', err);
    toast('PDF generation failed: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}


// ═══════════════════════════════════════════════════════════
//  GLOBAL UTILITY & MODAL HELPERS
// ═══════════════════════════════════════════════════════════
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  el.style.setProperty('display', 'flex', 'important');
  const dialog = el.querySelector('.glass-modal');
  if (dialog) { dialog.style.animation = 'none'; void dialog.offsetWidth; dialog.style.animation = ''; }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('open');
    el.style.setProperty('display', 'none', 'important');
  }
}
function n(val) {
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
}
function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

// Autocomplete dropdown helper for hotel master lookup with Auto-Rate, Available Dates & Photos
let _hideActiveHotelAutocomplete = null;
function setupHotelAutocomplete(inputEl, cityElId, distElId, rateElId, inDateElId, outDateElId, rowId, roomElId, mealElId) {
  if (!inputEl) return;
  if (!inputEl.dataset.hasAc) {
    inputEl.dataset.hasAc = '1';

    let drop = document.createElement('div');
    drop.className = 'ac-dropdown hotel-autocomplete-portal';
    drop.style.cssText = 'position:fixed;max-height:220px;overflow-y:auto;background:#ffffff;border:1px solid rgba(126,200,227,0.45);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,0.18);z-index:9997;display:none;';
    document.body.appendChild(drop);

    const row = rowId ? document.getElementById(rowId) : inputEl.closest('tr');
    const rateEl = rateElId ? document.getElementById(rateElId) : null;
    const hotelContracts = hotel => Array.isArray(hotel?.vendors)
      ? hotel.vendors
      : (hotel?.vendors ? JSON.parse(hotel.vendors) : []);
    const currentRequirements = () => ({
      room: roomElId ? document.getElementById(roomElId)?.value || '' : '',
      meal: mealElId ? document.getElementById(mealElId)?.value || '' : '',
      checkIn: inDateElId ? document.getElementById(inDateElId)?.value || '' : '',
      checkOut: outDateElId ? document.getElementById(outDateElId)?.value || '' : ''
    });
    const matchingContracts = hotel => {
      const requirements = currentRequirements();
      return hotelContracts(hotel).filter(contract =>
        (!requirements.room || String(contract.room_type || '').trim().toUpperCase() === requirements.room.trim().toUpperCase()) &&
        (!requirements.meal || String(contract.meal_plan || '').trim().toUpperCase() === requirements.meal.trim().toUpperCase())
      );
    };
    const suggestRate = clearIfMissing => {
      const hotel = (G.hotels || []).find(item => String(item.id) === String(row?.dataset.hotelId));
      if (!rateEl || !hotel) return null;
      const requirements = currentRequirements();
      const best = bestHotelContractRate(
        matchingContracts(hotel),
        requirements.checkIn,
        requirements.checkOut
      );
      if (best) {
        rateEl.value = Number(best.stay.nightlyRate.toFixed(2));
        rateEl.dataset.autoRate = '1';
      } else if (clearIfMissing) {
        rateEl.value = '';
        rateEl.dataset.autoRate = '1';
      }
      if (G._currentPage === 'grp') gCalc();
      else triggerCostingCalc();
      return best;
    };
    const positionDrop = () => {
      if (drop.style.display === 'none') return;
      const rect = inputEl.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const width = Math.min(340, Math.max(0, viewportWidth - 16));
      const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8));
      const below = Math.max(0, viewportHeight - rect.bottom - 8);
      const above = Math.max(0, rect.top - 8);
      const naturalHeight = Math.min(drop.scrollHeight, 220);
      const openAbove = below < naturalHeight && above > below;
      const available = openAbove ? above : below;
      const maxHeight = Math.max(0, Math.min(220, available - 4));
      drop.style.width = `${width}px`;
      drop.style.left = `${left}px`;
      drop.style.maxHeight = `${maxHeight}px`;
      drop.style.top = `${openAbove
        ? Math.max(8, rect.top - Math.min(drop.scrollHeight, maxHeight) - 4)
        : Math.min(viewportHeight - maxHeight - 8, rect.bottom + 4)}px`;
    };
    const hideDrop = () => {
      drop.style.display = 'none';
      window.removeEventListener('scroll', positionDrop, true);
      window.removeEventListener('resize', positionDrop);
      if (_hideActiveHotelAutocomplete === hideDrop) _hideActiveHotelAutocomplete = null;
    };

    [roomElId, mealElId, inDateElId, outDateElId].filter(Boolean).forEach(id => {
      const requirementEl = document.getElementById(id);
      if (!requirementEl || requirementEl.dataset.hasHotelRateHook) return;
      requirementEl.addEventListener('change', () => {
        if (rateEl?.dataset.autoRate === '1') suggestRate(true);
      });
      requirementEl.dataset.hasHotelRateHook = '1';
    });
    if (rateEl && !rateEl.dataset.hasHotelRateHook) {
      rateEl.addEventListener('input', () => { rateEl.dataset.autoRate = '0'; });
      rateEl.dataset.hasHotelRateHook = '1';
    }

    function showList(filterText = '') {
      const city = cityElId ? normalizeHotelCity(document.getElementById(cityElId)?.value || 'makkah') : 'MAKKAH';
      const q = (filterText || '').trim().toLowerCase();

      const list = (G.hotels || []).filter(h => {
        const matchCity = !city || normalizeHotelCity(h.city) === city;
        const matchName = !q || (h.name || '').toLowerCase().includes(q) || (h.area || '').toLowerCase().includes(q);
        return matchCity && matchName;
      }).slice(0, 12);

      if (!list.length) {
        drop.innerHTML = '<div style="padding:8px 10px;font-size:10.5px;color:#94a3b8;text-align:center">No hotels found in ' + (city||'city') + '</div>';
        drop.style.display = 'block';
        positionDrop();
        return;
      }

      drop.innerHTML = list.map(h => {
        const requirements = currentRequirements();
        const bestChoice = bestHotelContractRate(
          matchingContracts(h),
          requirements.checkIn,
          requirements.checkOut
        );
        const bestRate = bestChoice?.stay.nightlyRate || 0;
        const bestContract = bestChoice?.contract || null;
        const rateLabel = bestChoice
          ? requirements.checkIn && requirements.checkOut
            ? `Stay SAR ${fmtNum(bestChoice.stay.total, 2)} · SAR ${fmtNum(bestRate, 2)}/night`
            : `From SAR ${fmtNum(bestRate, 2)}/night`
          : '';

        return `
          <div class="ac-item" data-id="${h.id}" data-name="${escAttr(h.name)}" data-dist="${escAttr(h.distance_text || (h.distance_meters ? h.distance_meters + 'm' : ''))}" data-img="${escAttr(h.image_url || '')}" data-loc="${escAttr(h.location_url || '')}" style="padding:6px 9px;cursor:pointer;border-bottom:1px solid #f1f5f9;font-size:11px;text-align:left">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="display:flex;align-items:center;gap:7px;font-weight:700;color:#1e293b">
                ${h.image_url ? `<img src="${escAttr(h.image_url)}" alt="" style="width:34px;height:30px;object-fit:cover;border-radius:4px">` : ''}
                ${esc(h.name)}
              </span>
              ${bestRate ? `<span style="font-weight:800;color:#059669;font-size:10.5px">${rateLabel}</span>` : ''}
            </div>
            <div style="font-size:9.5px;color:#64748b;display:flex;gap:6px;align-items:center;margin-top:2px">
              <span>${Number(h.stars) > 0 ? `Rating ${Number(h.stars)}/5` : 'Standard'}</span>
              <span>${h.distance_text || (h.distance_meters ? h.distance_meters + 'm' : '')}</span>
              ${h.area ? `<span>· ${esc(h.area)}</span>` : ''}
              ${bestContract?.checkin_date ? `<span style="color:#2563eb">· Valid: ${fmtDate(bestContract.checkin_date)}</span>` : ''}
            </div>
          </div>`;
      }).join('');

      drop.style.display = 'block';
      positionDrop();

      drop.querySelectorAll('.ac-item').forEach(item => {
        item.addEventListener('mousedown', (e) => {
          e.preventDefault();
          const hId = item.dataset.id;
          const hName = item.dataset.name;
          const hDist = item.dataset.dist;
          const hImg = item.dataset.img;
          const hLoc = item.dataset.loc;

          inputEl.value = hName;

          if (distElId) {
            const distEl = document.getElementById(distElId);
            if (distEl) distEl.value = hDist;
          }

          const selectedRow = rowId ? document.getElementById(rowId) : inputEl.closest('tr');
          if (selectedRow) {
            selectedRow.dataset.img = hImg || '';
            selectedRow.dataset.loc = hLoc || '';
            selectedRow.dataset.hotelId = hId;
          }

          suggestRate(true);

          hideDrop();
        });
      });
    }

    inputEl.addEventListener('focus', () => {
      _hideActiveHotelAutocomplete?.();
      _hideActiveHotelAutocomplete = hideDrop;
      window.addEventListener('scroll', positionDrop, true);
      window.addEventListener('resize', positionDrop);
      showList(inputEl.value);
    });
    inputEl.addEventListener('input', () => showList(inputEl.value));
    inputEl.addEventListener('blur', () => {
      setTimeout(hideDrop, 200);
    });
  }
}

// ═══════════════════════════════════════════════════════════
//  PHASE 3: PRIVATE UMRAH COSTING ENGINE (Option A, B, C)
// ═══════════════════════════════════════════════════════════
let _activePvtOpt = 'A';
let _editingPvtId = null;
let _currentQuotationData = null;
let _activeProposalType = null;
let _activeProposalData = null;

const AIRLINE_OPTIONS = [
  'SAUDI AIRLINE', 'PIA', 'AIRBLUE', 'SERENE AIR', 'FLYNAS',
  'EMIRATES', 'QATAR AIRWAYS', 'GULF AIR', 'AIR ARABIA', 'SALAMAIR',
  'TURKISH AIRLINES', 'KUWAIT AIRWAYS', 'JAZEERA AIRWAYS', 'OMAN AIR', 'OTHER'
];
const CABIN_OPTIONS = ['ECONOMY', 'BUSINESS', 'FIRST'];
const ROOM_OPTIONS = ['SHARING', 'DOUBLE', 'TRIPLE', 'QUAD', 'QUINT', 'HEXA', 'SUITE', 'FLAT'];
const MEAL_OPTIONS = ['RO (Room Only)', 'BB (Bed & Breakfast)', 'HB (Half Board)', 'FB (Full Board)'];
const VEHICLE_OPTIONS = ['CAR (1-3 PAX)', 'GMC (4-7 PAX)', 'HIACE (8-10 PAX)', 'COASTER (12-18 PAX)', 'BUS (45-50 PAX)', 'AUTO', 'SHARING'];
const BAGGAGE_OPTIONS = ['1PC', '2PC', '23KG', '30KG', '7KG + 20KG'];
const SECTOR_OPTIONS = [
  'JED-MAK-MED-JED', 'JED-MAK-JED', 'MED-MAK-JED', 'MAK-MED', 'MED-MAK',
  'MAK ZIYARAT', 'MED ZIYARAT', 'TAIF ZIYARAT', 'BADAR ZIYARAT'
];

function catalogOptions(category, defaults) {
  const configured = G.settings?.catalog_options?.[category];
  return Array.isArray(configured) && configured.length ? configured : defaults;
}

function mealPlanOptions() {
  return catalogOptions('meal_plans', ['RO', 'BB', 'HB', 'FB', 'Suhoor', 'Iftar']);
}

function vehicleTypeOptions() {
  const configured = catalogOptions('vehicle_types', VEHICLE_OPTIONS);
  return configured.some(value => /sharing/i.test(String(value)))
    ? configured
    : [...configured, 'SHARING'];
}

function isSharingTransport(value) {
  return /sharing/i.test(String(value || ''));
}

function syncPrivateTransportQty(L, index) {
  const vehicle = document.getElementById(`tV${L}${index}`);
  const qty = document.getElementById(`tQ${L}${index}`);
  if (!vehicle || !qty) return;
  if (isSharingTransport(vehicle.value)) {
    qty.value = String(Math.max(0, n(document.getElementById(`aP${L}`)?.value) || 0));
    qty.dataset.sharingAuto = '1';
  } else {
    delete qty.dataset.sharingAuto;
  }
  triggerCostingCalc();
}

function pgPrivate(force = false) {
  const pg = document.getElementById('pvt');
  if (!pg) return;
  if (!force && pg.dataset.initialized === 'true') return;

  pg.classList.add('costing-page', 'costing-private');
  _editingPvtId = null;
  _currentQuotationData = null;
  _activePvtOpt = 'A';
  const roeDef = G.settings?.default_roe || 78;

  pg.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title"><i class="bi bi-person-vcard me-2" style="color:var(--pri)"></i>Private Package</h1>
        <div class="d-flex align-items-center gap-2 mt-1">
          <span class="page-sub">Multi-Option (A/B/C) dynamic comparison & Proposal voucher</span>
          <span id="pEditTag"></span>
        </div>
      </div>
      <div class="page-actions flex-wrap">
        <button type="button" class="btn-ghost btn-sm" onclick="nav('dash')"><i class="bi bi-x-lg me-1"></i>Cancel</button>
        <button type="button" class="btn-ghost btn-sm" onclick="newPrivateCosting()"><i class="bi bi-arrow-counterclockwise me-1"></i>New</button>
        <button type="button" class="btn-ghost btn-sm" onclick="loadPrivateDraft()"><i class="bi bi-folder2-open me-1"></i>Load Draft</button>
        <button type="button" class="btn-ghost btn-sm" onclick="pSaveDraft()"><i class="bi bi-bookmark me-1"></i>Save Draft</button>
        <button type="button" class="btn-ghost btn-sm" onclick="pPreview()"><i class="bi bi-eye me-1"></i>Preview</button>
        <button type="button" class="btn-ghost btn-sm" style="color:#25D366;border-color:rgba(37,211,102,0.4)" onclick="shareWhatsAppPvt()"><i class="bi bi-whatsapp me-1"></i>WhatsApp</button>
        <button type="button" class="btn-ghost btn-sm" style="color:#7C3AED;border-color:rgba(124,58,237,0.4)" onclick="printCostingPvt()"><i class="bi bi-calculator me-1"></i>Costing Sheet</button>
        <button type="button" class="btn-pri btn-sm" id="pSaveBtn" onclick="pSave()"><i class="bi bi-check2-circle me-1"></i>Save & Print</button>
      </div>
    </div>

    <!-- Master Booking Info Card -->
    <div class="sec-box mb-3">
      <div class="row g-3">
        <div class="col-md-3">
          <label class="form-label">Client Name <span style="color:var(--err)">*</span></label>
          <input class="form-inp" id="pN" placeholder="e.g. Muhammad Ali">
        </div>
        <div class="col-md-3">
          <label class="form-label">Contact / WhatsApp</label>
          <input class="form-inp" id="pPh" placeholder="0300-1234567">
        </div>
        <div class="col-md-2">
          <label class="form-label">Travel Dates</label>
          <input class="form-inp" id="pDt" placeholder="e.g. 15 Nov - 30 Nov">
        </div>
        <div class="col-md-2">
          <label class="form-label">Default ROE (SAR → PKR)</label>
          <input class="form-inp" type="number" id="pROE" value="${roeDef}" oninput="triggerCostingCalc()">
        </div>
        <div class="col-md-2 d-flex align-items-end">
          <label class="d-flex align-items-center gap-2 p-2 w-100" style="border:1px solid var(--glass-border);border-radius:10px;cursor:pointer;background:rgba(255,255,255,0.7);font-size:12px;font-weight:600">
            <input type="checkbox" id="pIsIntl" onchange="triggerCostingCalc()">
            <span>🌍 Intl Package</span>
          </label>
        </div>
        <div class="col-md-6">
          <label class="form-label">Package Includes</label>
          <input class="form-inp" id="pInc" value="FLIGHT, HOTEL, VISA, TRANSPORT">
        </div>
        <div class="col-md-6">
          <label class="form-label">Additional Note (Prints on Client Voucher)</label>
          <input class="form-inp" id="pNote" placeholder="Special requirements, direct flights, ziyarat included…">
        </div>
      </div>
    </div>

    <!-- Option Selection Tabs -->
    <div class="cost-tabs" id="pTabs">
      <div class="cost-tab act" id="pTabBtnA" onclick="pTab('A')">Option A</div>
      <div class="cost-tab" id="pTabBtnB" style="display:none" onclick="pTab('B')">
        Option B <span class="cost-tab-del" onclick="event.stopPropagation();removeOpt('B')" title="Remove Option B">✕</span>
      </div>
      <div class="cost-tab" id="pTabBtnC" style="display:none" onclick="pTab('C')">
        Option C <span class="cost-tab-del" onclick="event.stopPropagation();removeOpt('C')" title="Remove Option C">✕</span>
      </div>
      <button type="button" class="btn-ghost btn-sm" id="pAddOptBtn" onclick="addNextOpt()"><i class="bi bi-plus-lg me-1"></i>Add Option</button>
      <button type="button" class="btn-ghost btn-sm" onclick="openCopyOptionModal()"><i class="bi bi-copy me-1"></i>Copy Option</button>
    </div>

    <!-- Multi-Option Tab Panels Container -->
    <div id="pTP">
      ${['A','B','C'].map(l => buildOptionHtml(l)).join('')}
    </div>

    <!-- Sticky Grand Summary Bar -->
    <div class="grand-summary-bar" id="costGrandBar">
      <div class="d-flex align-items-center gap-4 flex-wrap">
        <div class="grand-item">
          <span class="grand-item-lbl">Adult Selling / Pax</span>
          <span class="grand-item-val" style="color:var(--pri)" id="gSumAdult">PKR 0</span>
        </div>
        <div class="grand-item">
          <span class="grand-item-lbl">Child Selling / Pax</span>
          <span class="grand-item-val" style="color:var(--wrn)" id="gSumChild">PKR 0</span>
        </div>
        <div class="grand-item">
          <span class="grand-item-lbl">Infant Selling / Pax</span>
          <span class="grand-item-val" style="color:var(--err)" id="gSumInfant">PKR 0</span>
        </div>
      </div>
      <div class="d-flex align-items-center gap-3">
        <div class="grand-item text-end">
          <span class="grand-item-lbl">Total Estimated Package</span>
          <span class="grand-item-val" style="color:#059669;font-size:22px" id="gSumTotal">PKR 0</span>
        </div>
        <button type="button" class="btn-pri" onclick="pSave()">
          <i class="bi bi-printer me-1"></i>Save & Print Voucher
        </button>
      </div>
    </div>`;

    decorateCostingTables(pg);
    pTab('A');
    attachCostingListeners();
  triggerCostingCalc();
  pg.dataset.initialized = 'true';
}

function buildOptionHtml(L) {
  const roe = G.settings?.default_roe || 78;
  const visaSAR = G.settings?.default_visa_adult || 560;

  return `
    <div class="opt-panel ${L === 'A' ? 'act' : ''}" id="pOptPanel${L}" style="display:${L === 'A' ? 'block' : 'none'}">
      
      <!-- 1. FLIGHT DETAILS -->
      <div class="sec-box">
        <div class="sec-box-title">
                <span>Flight — ${L}</span>
          <button type="button" class="btn-ghost btn-sm" onclick="addFlightRow('${L}')"><i class="bi bi-plus-lg me-1"></i>Add Flight</button>
        </div>
        <div class="calc-table-wrap">
          <table class="calc-tbl" id="fTable${L}">
            <thead>
              <tr>
                <th style="width:11%">Date</th>
                <th style="width:14%">Airline</th>
                <th style="width:8%">Class</th>
                <th style="width:8%">Sector</th>
                <th style="width:7%">Dep</th>
                <th style="width:7%">Arr</th>
                <th style="width:8%">Layover</th>
                <th style="width:8%">Sec 2</th>
                <th style="width:7%">Dep 2</th>
                <th style="width:7%">Arr 2</th>
                <th style="width:12%">Luggage</th>
                <th style="width:3%"></th>
              </tr>
            </thead>
            <tbody id="fBody${L}">
              ${[0, 1].map(i => renderFlightRowHtml(L, i)).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 2. ADULT COSTING -->
      <div class="sec-box">
        <div class="sec-box-title">
          <div class="d-flex align-items-center gap-2">
            <span>Adult — ${L}</span>
            <span class="sec-badge-pax" id="aPaxBadge${L}">2 Adults</span>
          </div>
          <div class="d-flex align-items-center gap-3">
            <span class="t3" style="font-size:12px">Per Adult:</span>
            <span style="font-size:16px;font-weight:900;color:var(--pri)" id="aPP${L}">PKR 0</span>
          </div>
        </div>

        <!-- Compact Adult Info Row -->
        <div class="d-flex align-items-center flex-wrap gap-2 mb-2 p-2 cost-person-meta" style="background:rgba(255,255,255,0.8);border:1px solid rgba(126,200,227,0.25);border-radius:8px">
          <div class="d-flex align-items-center gap-1">
            <label class="form-label mb-0" style="white-space:nowrap">Adult PAX:</label>
            <input class="calc-inp text-center" type="number" id="aP${L}" value="2" min="1" style="width:50px !important" oninput="syncPaxToQuantities('${L}')">
          </div>
          <div class="d-flex align-items-center gap-1">
            <label class="form-label mb-0" style="white-space:nowrap">Category:</label>
            <input class="calc-inp" id="aCt${L}" value="4-Star Luxury" style="width:130px !important">
          </div>
          <div class="d-flex align-items-center gap-1">
            <label class="form-label mb-0" style="white-space:nowrap">Total Days:</label>
            <input class="calc-inp text-center" type="number" id="dDy${L}" placeholder="Auto" style="width:55px !important">
          </div>
          <div class="d-flex align-items-center gap-1 flex-1">
            <label class="form-label mb-0" style="white-space:nowrap">Travel Dates:</label>
            <input class="calc-inp flex-1" id="pDt${L}" placeholder="Auto from flights / hotels" style="max-width:240px">
          </div>
          <div class="d-flex align-items-center gap-1">
            <label class="form-label mb-0" style="white-space:nowrap">Per Pax:</label>
            <input class="calc-inp text-center" id="aPPInput${L}" value="PKR 0" readonly style="width:105px !important">
          </div>
        </div>

        <!-- Ticket Section (Compact Fitted Bar) -->
        <div class="cost-section-label">Ticket</div>
        <div class="p-2 mb-2 d-flex align-items-center justify-content-between flex-wrap gap-2" style="background:rgba(126,200,227,0.08);border:1px solid rgba(126,200,227,0.25);border-radius:8px">
          <div class="d-flex align-items-center gap-2">
            <span style="font-weight:700;font-size:11.5px;color:var(--t1)">🎫 Air Ticket PKR / Pax:</span>
            <input class="calc-inp text-center" type="number" id="tk${L}" placeholder="Rate PKR" style="width:110px !important" oninput="triggerCostingCalc()">
            <span class="t3" style="font-size:11px">×</span>
            <input class="calc-inp text-center" type="number" id="tkQ${L}" value="2" placeholder="Qty" style="width:48px !important" oninput="this.dataset.manual='1';triggerCostingCalc()">
            <span class="t3" style="font-size:11px">PAX</span>
          </div>
          <div style="font-weight:800;font-size:12.5px;color:var(--pri)" id="tkT${L}">Total: PKR 0</div>
        </div>

        <!-- Hotels Table -->
        <div class="cost-section-label">Hotels</div>
        <div class="mb-2">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span style="font-weight:700;font-size:12px;color:var(--t1)">🏨 Hotel Accommodation</span>
            <button type="button" class="btn-ghost btn-sm" onclick="addHotelRow('${L}','h')"><i class="bi bi-plus-lg me-1"></i>Add Hotel Row</button>
          </div>
          <div class="calc-table-wrap">
            <table class="calc-tbl" id="hTable${L}">
              <thead>
                <tr>
                  <th style="width:8%">City</th>
                  <th style="width:23%">Hotel Name</th>
                  <th style="width:9%">Room</th>
                  <th style="width:6%">Meal</th>
                  <th style="width:10%">Check-in</th>
                  <th style="width:10%">Check-out</th>
                  <th style="width:4%">Ngt</th>
                  <th style="width:6%">SAR</th>
                  <th style="width:4%">Qty</th>
                  <th style="width:5%">Dist</th>
                  <th style="width:4%">ROE</th>
                  <th style="width:8%">Total PKR</th>
                  <th style="width:3%"></th>
                </tr>
              </thead>
              <tbody id="hBody${L}">
                ${[0, 1].map(i => renderHotelRowHtml(L, 'h', i)).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Visa Table (Compact Fitted Bar) -->
        <div class="cost-section-label">Visa</div>
        <div class="p-2 mb-2 d-flex align-items-center justify-content-between flex-wrap gap-2" style="background:rgba(196,181,253,0.12);border:1px solid rgba(196,181,253,0.3);border-radius:8px">
          <div class="d-flex align-items-center gap-2">
            <span style="font-weight:700;font-size:11.5px;color:var(--sec)">📄 Umrah Visa SAR / Pax:</span>
            <input class="calc-inp text-center" type="number" id="vR${L}" value="${visaSAR}" style="width:75px !important" oninput="triggerCostingCalc()">
            <span class="t3" style="font-size:11px">SAR ×</span>
            <input class="calc-inp text-center" type="number" id="vQ${L}" value="2" placeholder="Qty" style="width:48px !important" oninput="this.dataset.manual='1';triggerCostingCalc()">
            <span class="t3" style="font-size:11px">PAX × ROE</span>
            <input class="calc-inp text-center" type="number" id="vE${L}" value="${roe}" style="width:52px !important" oninput="triggerCostingCalc()">
          </div>
          <div style="font-weight:800;font-size:12.5px;color:var(--sec)" id="vT${L}">Total: PKR 0</div>
        </div>

        <!-- Transport Table -->
        <div class="cost-section-label">Transport</div>
        <div class="mb-2">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span style="font-weight:700;font-size:12px;color:var(--t1)">🚗 Ground Transport</span>
            <button type="button" class="btn-ghost btn-sm" onclick="addTransportRow('${L}')"><i class="bi bi-plus-lg me-1"></i>Add Route</button>
          </div>
          <div class="calc-table-wrap">
            <table class="calc-tbl" id="tTable${L}">
              <thead>
                <tr>
                  <th style="width:36%">Sector / Route</th>
                  <th style="width:28%">Vehicle Type</th>
                  <th style="width:9%">SAR</th>
                  <th style="width:6%">Qty</th>
                  <th style="width:6%">ROE</th>
                  <th style="width:12%">Total PKR</th>
                  <th style="width:3%"></th>
                </tr>
              </thead>
              <tbody id="tBody${L}">
                ${[0].map(i => renderTransportRowHtml(L, i)).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Adult Markup & Grand Adult Total -->
        <div class="cost-section-label">Total</div>
        <div class="d-flex justify-content-between align-items-center p-2 mb-2" style="background:rgba(255,255,255,0.95);border:1px solid var(--priBrd);border-radius:8px">
          <div class="d-flex align-items-center gap-2">
            <span style="font-weight:700;font-size:11px">Add/Less Markup (PKR / Adult):</span>
            <input class="calc-inp text-center" type="number" id="mk${L}" value="5000" style="width:90px !important" oninput="triggerCostingCalc()">
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="t3" style="font-size:11px">Total Adults Cost:</span>
            <span style="font-weight:900;font-size:14px;color:var(--pri)" id="aT${L}">PKR 0</span>
          </div>
        </div>

      </div>

      <!-- 3. CHILD COSTING SECTION -->
      <div class="sec-box">
        <div class="sec-box-title">
          <div class="d-flex align-items-center gap-2">
            <span>Child W/O Bed — ${L}</span>
            <span class="sec-badge-pax" id="cPaxBadge${L}">0 Child</span>
          </div>
          <div class="d-flex align-items-center gap-3">
            <span class="t3" style="font-size:12px">Per Child:</span>
            <input class="calc-inp text-center" id="cPPInput${L}" value="PKR 0" readonly style="width:105px !important">
            <span style="display:none" id="cPP${L}">PKR 0</span>
          </div>
        </div>

        <div class="d-flex align-items-center flex-wrap gap-3 mb-2 p-2" style="background:rgba(255,255,255,0.7);border-radius:8px">
          <div class="d-flex align-items-center gap-1">
            <label class="form-label mb-0" style="white-space:nowrap">Child PAX:</label>
            <input class="calc-inp text-center" type="number" id="cP${L}" value="0" min="0" style="width:48px !important" oninput="triggerCostingCalc()">
          </div>
          <div class="d-flex align-items-center gap-1">
            <label class="form-label mb-0" style="white-space:nowrap">Air Ticket PKR:</label>
            <input class="calc-inp text-center" type="number" id="ctk${L}" placeholder="Rate PKR" style="width:100px !important" oninput="triggerCostingCalc()">
          </div>
          <div class="d-flex align-items-center gap-1">
            <label class="form-label mb-0" style="white-space:nowrap">Visa SAR:</label>
            <input class="calc-inp text-center" type="number" id="cvR${L}" value="${visaSAR}" style="width:65px !important" oninput="triggerCostingCalc()">
          </div>
          <div class="d-flex align-items-center gap-1">
            <label class="form-label mb-0" style="white-space:nowrap">Trp SAR:</label>
            <input class="calc-inp text-center" type="number" id="cTrR${L}" placeholder="SAR" style="width:65px !important" oninput="triggerCostingCalc()">
          </div>
          <div class="d-flex align-items-center gap-1">
            <label class="form-label mb-0" style="white-space:nowrap">Trp Qty:</label>
            <input class="calc-inp text-center" type="number" id="cTrQ${L}" value="0" min="0" style="width:45px !important" oninput="triggerCostingCalc()">
          </div>
          <div class="d-flex align-items-center gap-1">
            <label class="form-label mb-0" style="white-space:nowrap">Markup PKR:</label>
            <input class="calc-inp text-center" type="number" id="cMk${L}" value="3000" style="width:80px !important" oninput="triggerCostingCalc()">
          </div>
          <div class="ms-auto" style="font-weight:800;font-size:12px;color:var(--sec)" id="cT${L}">Total: PKR 0</div>
        </div>
      </div>

      <!-- 4. INFANT COSTING SECTION -->
      <div class="sec-box">
        <div class="sec-box-title">
          <div class="d-flex align-items-center gap-2">
            <span>Infant — ${L}</span>
            <span class="sec-badge-pax" id="iPaxBadge${L}">0 Infant</span>
          </div>
          <div class="d-flex align-items-center gap-3">
            <span class="t3" style="font-size:12px">Per Infant:</span>
            <input class="calc-inp text-center" id="iPPInput${L}" value="PKR 0" readonly style="width:105px !important">
            <span style="display:none" id="iPP${L}">PKR 0</span>
          </div>
        </div>

        <div class="d-flex align-items-center flex-wrap gap-3 mb-2 p-2" style="background:rgba(255,255,255,0.7);border-radius:8px">
          <div class="d-flex align-items-center gap-1">
            <label class="form-label mb-0" style="white-space:nowrap">Infant PAX:</label>
            <input class="calc-inp text-center" type="number" id="iP${L}" value="0" min="0" style="width:48px !important" oninput="triggerCostingCalc()">
          </div>
          <div class="d-flex align-items-center gap-1">
            <label class="form-label mb-0" style="white-space:nowrap">Air Ticket PKR:</label>
            <input class="calc-inp text-center" type="number" id="itk${L}" placeholder="Rate PKR" style="width:100px !important" oninput="triggerCostingCalc()">
          </div>
          <div class="d-flex align-items-center gap-1">
            <label class="form-label mb-0" style="white-space:nowrap">Visa SAR:</label>
            <input class="calc-inp text-center" type="number" id="ivR${L}" value="150" style="width:65px !important" oninput="triggerCostingCalc()">
          </div>
          <div class="d-flex align-items-center gap-1">
            <label class="form-label mb-0" style="white-space:nowrap">Markup PKR:</label>
            <input class="calc-inp text-center" type="number" id="iMk${L}" value="2000" style="width:80px !important" oninput="triggerCostingCalc()">
          </div>
          <div class="ms-auto" style="font-weight:800;font-size:12px;color:#DC2626" id="iT${L}">Total: PKR 0</div>
        </div>
      </div>

    </div>`;
}

function renderFlightRowHtml(L, i) {
  return `
    <tr id="fRow${L}_${i}">
      <td style="width:11%"><input class="calc-inp" type="date" id="fD${L}${i}" onchange="syncTravelDatesFromFlights('${L}')"></td>
      <td style="width:14%">
        <select class="calc-inp" id="fA${L}${i}">
          ${catalogOptions('airlines', AIRLINE_OPTIONS).map(a => `<option value="${escAttr(a)}">${esc(a)}</option>`).join('')}
        </select>
      </td>
      <td style="width:8%">
        <select class="calc-inp" id="fC${L}${i}">
          ${catalogOptions('cabin_classes', CABIN_OPTIONS).map(c => `<option value="${escAttr(c)}">${esc(c)}</option>`).join('')}
        </select>
      </td>
      <td style="width:8%"><input class="calc-inp text-center" id="fS${L}${i}" placeholder="KHI-JED" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></td>
      <td style="width:7%"><input class="calc-inp time-inp" type="time" id="fDp${L}${i}" value="${i===0?'04:30':'09:00'}"></td>
      <td style="width:7%"><input class="calc-inp time-inp" type="time" id="fAr${L}${i}" value="${i===0?'07:15':'14:30'}"></td>
      <td style="width:8%">
        <select class="calc-inp" id="fLy${L}${i}">
          <option value="Direct">Direct</option>
          <option value="Indirect">Indirect</option>
          <option value="-">-</option>
        </select>
      </td>
      <td style="width:8%"><input class="calc-inp text-center" id="fS2${L}${i}" placeholder="JED-KHI" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()"></td>
      <td style="width:7%"><input class="calc-inp time-inp" type="time" id="fD2${L}${i}" value=""></td>
      <td style="width:7%"><input class="calc-inp time-inp" type="time" id="fA2${L}${i}" value=""></td>
      <td style="width:12%">
        <input class="calc-inp lug-inp" id="fL${L}${i}" value="2PC" list="baggageOptions${L}${i}" placeholder="2PC" onblur="fmtLug(this)">
        <datalist id="baggageOptions${L}${i}">
          ${catalogOptions('baggage_allowances', BAGGAGE_OPTIONS).map(option => `<option value="${escAttr(option)}"></option>`).join('')}
        </datalist>
      </td>
      <td style="width:3%"><button type="button" class="btn-icon" onclick="removeTableRow('fRow${L}_${i}')" title="Delete"><i class="bi bi-x"></i></button></td>
    </tr>`;
}

function renderHotelRowHtml(L, kind, i) {
  const roe = G.settings?.default_roe || 78;
  const prefix = kind === 'cH' ? 'cH' : 'h';

  return `
    <tr id="${prefix}Row${L}_${i}">
      <td style="width:8%">
        <select class="calc-inp" id="${prefix}City${L}${i}">
          <option value="makkah" ${i%2===0?'selected':''}>Makkah</option>
          <option value="madina" ${i%2===1?'selected':''}>Madinah</option>
          <option value="jeddah">Jeddah</option>
        </select>
      </td>
      <td style="width:23%">
        <div style="position:relative">
          <input class="calc-inp" id="${prefix}${L}${i}" placeholder="Type or select hotel…" autocomplete="off" onfocus="setupHotelAutocomplete(this, '${prefix}City${L}${i}', '${prefix}D${L}${i}', '${prefix}Rt${L}${i}', '${prefix}HIn${L}${i}', '${prefix}HOut${L}${i}', '${prefix}Row${L}_${i}', '${prefix}R${L}${i}', '${prefix}M${L}${i}')">
        </div>
      </td>
      <td style="width:9%">
        <select class="calc-inp" id="${prefix}R${L}${i}" onchange="triggerCostingCalc()">
          ${catalogOptions('room_types', ROOM_OPTIONS).map(r => `<option value="${escAttr(r)}">${esc(r)}</option>`).join('')}
        </select>
      </td>
      <td style="width:6%">
        <select class="calc-inp" id="${prefix}M${L}${i}" onchange="triggerCostingCalc()">
          ${mealPlanOptions().map(m => `<option value="${escAttr(m)}">${esc(m)}</option>`).join('')}
        </select>
      </td>
      <td style="width:10%"><input class="calc-inp" type="date" id="${prefix}HIn${L}${i}" onchange="updateHotelDates('${prefix}','${L}',${i})"></td>
      <td style="width:10%"><input class="calc-inp" type="date" id="${prefix}HOut${L}${i}" onchange="updateHotelDates('${prefix}','${L}',${i})"></td>
      <td style="width:4%"><input class="calc-inp text-center" type="number" id="${prefix}N${L}${i}" value="7" min="1" oninput="triggerCostingCalc()"></td>
      <td style="width:6%"><input class="calc-inp text-center" type="number" id="${prefix}Rt${L}${i}" placeholder="SAR" oninput="triggerCostingCalc()"></td>
      <td style="width:4%"><input class="calc-inp text-center" type="number" id="${prefix}Q${L}${i}" value="1" min="1" oninput="triggerCostingCalc()"></td>
      <td style="width:5%"><input class="calc-inp text-center" id="${prefix}D${L}${i}" placeholder="50m"></td>
      <td style="width:4%"><input class="calc-inp text-center" type="number" id="${prefix}E${L}${i}" value="${roe}" oninput="triggerCostingCalc()"></td>
      <td style="width:8%" class="calc-inp-ro text-end" id="${prefix}T${L}${i}">0</td>
      <td style="width:3%"><button type="button" class="btn-icon" onclick="removeTableRow('${prefix}Row${L}_${i}')" title="Delete"><i class="bi bi-x"></i></button></td>
    </tr>`;
}

function renderTransportRowHtml(L, i) {
  const roe = G.settings?.default_roe || 78;
  return `
    <tr id="tRow${L}_${i}">
      <td style="width:36%">
        <select class="calc-inp" id="tS${L}${i}">
          ${catalogOptions('transport_sectors', SECTOR_OPTIONS).map(s => `<option value="${escAttr(s)}">${esc(s)}</option>`).join('')}
        </select>
      </td>
      <td style="width:28%">
        <select class="calc-inp" id="tV${L}${i}" onchange="syncPrivateTransportQty('${L}', ${i})">
          ${vehicleTypeOptions().map(v => `<option value="${escAttr(v)}">${esc(v)}</option>`).join('')}
        </select>
      </td>
      <td style="width:9%"><input class="calc-inp text-center" type="number" id="tR${L}${i}" placeholder="SAR" oninput="triggerCostingCalc()"></td>
      <td style="width:6%"><input class="calc-inp text-center" type="number" id="tQ${L}${i}" value="1" min="0" oninput="triggerCostingCalc()"></td>
      <td style="width:6%"><input class="calc-inp text-center" type="number" id="tE${L}${i}" value="${roe}" oninput="triggerCostingCalc()"></td>
      <td style="width:12%" class="calc-inp-ro text-end" id="tT${L}${i}">0</td>
      <td style="width:3%"><button type="button" class="btn-icon" onclick="removeTableRow('tRow${L}_${i}')" title="Delete"><i class="bi bi-x"></i></button></td>
    </tr>`;
}

function addFlightRow(L) {
  const tb = document.getElementById(`fBody${L}`);
  if (!tb) return;
  const idx = nextGroupRowIndex(tb, `fRow${L}_`);
  const tr = document.createElement('tr');
  tr.id = `fRow${L}_${idx}`;
  tr.innerHTML = renderFlightRowHtml(L, idx).replace(/<tr[^>]*>|<\/tr>/g, '');
  tb.appendChild(tr);
  decorateCostingTables(document.getElementById('pvt'));
  attachCostingListeners();
}

function addHotelRow(L, kind) {
  const prefix = kind === 'cH' ? 'cH' : 'h';
  const tb = document.getElementById(`${prefix}Body${L}`);
  if (!tb) return;
  const idx = nextGroupRowIndex(tb, `${prefix}Row${L}_`);
  const tr = document.createElement('tr');
  tr.id = `${prefix}Row${L}_${idx}`;
  tr.innerHTML = renderHotelRowHtml(L, kind, idx).replace(/<tr[^>]*>|<\/tr>/g, '');
  tb.appendChild(tr);
  decorateCostingTables(document.getElementById('pvt'));
  attachCostingListeners();
}

function addTransportRow(L) {
  const tb = document.getElementById(`tBody${L}`);
  if (!tb) return;
  const idx = nextGroupRowIndex(tb, `tRow${L}_`);
  const tr = document.createElement('tr');
  tr.id = `tRow${L}_${idx}`;
  tr.innerHTML = renderTransportRowHtml(L, idx).replace(/<tr[^>]*>|<\/tr>/g, '');
  tb.appendChild(tr);
  decorateCostingTables(document.getElementById('pvt'));
  attachCostingListeners();
}

function decorateCostingTables(scope) {
  if (!scope?.querySelectorAll) return;
  scope.querySelectorAll('.calc-tbl').forEach(table => {
    const labels = [...(table.querySelectorAll('thead th') || [])]
      .map(cell => cell.textContent.trim().replace(/\s+/g, ' '));
    table.querySelectorAll('tbody tr').forEach(row => {
      [...row.cells].forEach((cell, index) => {
        const label = labels[index];
        if (label) {
          cell.dataset.label = label;
          delete cell.dataset.mobileAction;
        } else {
          delete cell.dataset.label;
          cell.dataset.mobileAction = 'true';
        }
      });
      row.querySelectorAll('.calc-inp').forEach(input => {
        input.style.removeProperty('width');
        input.style.removeProperty('max-width');
      });
    });
  });
}

function removeTableRow(id) {
  const el = document.getElementById(id);
  const isGroupRow = Boolean(el?.closest('#grp'));
  if (el) el.remove();
  if (isGroupRow) gCalc();
  else triggerCostingCalc();
}

// Chained check-in and checkout date calculation
function updateHotelDates(prefix, L, i) {
  const inEl = document.getElementById(`${prefix}HIn${L}${i}`);
  const outEl = document.getElementById(`${prefix}HOut${L}${i}`);
  const ngtEl = document.getElementById(`${prefix}N${L}${i}`);

  if (inEl && outEl && inEl.value && outEl.value) {
    const d1 = new Date(inEl.value);
    const d2 = new Date(outEl.value);
    const diff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    if (diff > 0 && ngtEl) {
      ngtEl.value = diff;
    }
  } else if (inEl && inEl.value && ngtEl && n(ngtEl.value) > 0 && outEl && !outEl.value) {
    const d = new Date(inEl.value);
    d.setDate(d.getDate() + n(ngtEl.value));
    outEl.value = d.toISOString().slice(0, 10);
  }

  // Auto-chain to next row: Next row check-in = Current row checkout
  const nextIn = document.getElementById(`${prefix}HIn${L}${i + 1}`);
  if (nextIn && outEl && outEl.value && !nextIn.value) {
    nextIn.value = outEl.value;
    updateHotelDates(prefix, L, i + 1);
  }

  syncTravelDatesFromFlights(L);
  triggerCostingCalc();
}

function syncTravelDatesFromFlights(L) {
  const dates = [];
  document.querySelectorAll(`#fBody${L} input[type="date"], #hBody${L} input[type="date"]`).forEach(inp => {
    if (inp.value) dates.push(inp.value);
  });
  if (!dates.length) return;
  dates.sort();
  const range = dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} to ${dates[dates.length - 1]}`;
  const optDt = document.getElementById(`pDt${L}`);
  if (optDt && !optDt.dataset.manual) optDt.value = range;
  const masterDt = document.getElementById('pDt');
  if (masterDt && !masterDt.dataset.manual && L === 'A') masterDt.value = range;
}

function syncPaxToQuantities(L) {
  const aP = n(document.getElementById(`aP${L}`)?.value) || 1;
  const tkQ = document.getElementById(`tkQ${L}`);
  const vQ = document.getElementById(`vQ${L}`);
  if (tkQ && !tkQ.dataset.manual) tkQ.value = aP;
  if (vQ && !vQ.dataset.manual) vQ.value = aP;

  const badge = document.getElementById(`aPaxBadge${L}`);
  if (badge) badge.textContent = `${aP} Adult${aP > 1 ? 's' : ''}`;

  triggerCostingCalc();
}

function pTab(L) {
  const prevL = _activePvtOpt;
  _activePvtOpt = L;
  ['A', 'B', 'C'].forEach(l => {
    const btn = document.getElementById(`pTabBtn${l}`);
    const panel = document.getElementById(`pOptPanel${l}`);
    if (btn) btn.classList.toggle('act', l === L);
    if (panel) {
      const wasVisible = panel.style.display !== 'none';
      panel.style.display = l === L ? 'block' : 'none';
      if (l === L && !wasVisible) {
        // Animate the new panel in from direction
        const A = ['A','B','C'];
        const prevIdx = A.indexOf(prevL);
        const nextIdx = A.indexOf(L);
        panel.style.animation = 'none';
        void panel.offsetWidth;
        panel.style.animation = nextIdx >= prevIdx
          ? 'tabSwipeIn 0.24s cubic-bezier(0.16, 1, 0.3, 1)'
          : 'tabSwipeLeft 0.24s cubic-bezier(0.16, 1, 0.3, 1)';
      }
    }
  });
  triggerCostingCalc();
}

function addNextOpt() {
  const b = document.getElementById('pTabBtnB');
  const c = document.getElementById('pTabBtnC');
  if (b && b.style.display === 'none') {
    b.style.display = 'inline-flex';
    pTab('B');
  } else if (c && c.style.display === 'none') {
    c.style.display = 'inline-flex';
    pTab('C');
    document.getElementById('pAddOptBtn').style.display = 'none';
  }
}

function removeOpt(L) {
  if (L === 'B') {
    const b = document.getElementById('pTabBtnB');
    if (b) b.style.display = 'none';
    pTab('A');
  } else if (L === 'C') {
    const c = document.getElementById('pTabBtnC');
    if (c) c.style.display = 'none';
    const addBtn = document.getElementById('pAddOptBtn');
    if (addBtn) addBtn.style.display = 'inline-flex';
    pTab('B');
  }
  triggerCostingCalc();
}

function openCopyOptionModal() {
  const src = document.getElementById('copyOptSource');
  const dst = document.getElementById('copyOptTarget');
  if (src && dst) {
    src.value = _activePvtOpt;
    dst.value = _activePvtOpt === 'A' ? 'B' : (_activePvtOpt === 'B' ? 'C' : 'A');
  }
  openModal('copyOptModal');
}

function executeCopyOption() {
  const src = document.getElementById('copyOptSource')?.value || 'A';
  const dst = document.getElementById('copyOptTarget')?.value || 'B';

  if (src === dst) {
    toast('Source and target options cannot be the same', 'warn');
    return;
  }

  // Ensure target option tab is visible
  if (dst === 'B') {
    const b = document.getElementById('pTabBtnB');
    if (b) b.style.display = 'inline-flex';
  } else if (dst === 'C') {
    const b = document.getElementById('pTabBtnB');
    const c = document.getElementById('pTabBtnC');
    if (b) b.style.display = 'inline-flex';
    if (c) c.style.display = 'inline-flex';
    document.getElementById('pAddOptBtn').style.display = 'none';
  }

  const cpHotels = document.getElementById('cpSecHotels')?.checked;
  const cpFlights = document.getElementById('cpSecFlights')?.checked;
  const cpTrans = document.getElementById('cpSecTransport')?.checked;
  const cpVisa = document.getElementById('cpSecVisa')?.checked;
  const cpPax = document.getElementById('cpSecPax')?.checked;

  if (cpPax) {
    ['aP', 'aCt', 'dDy', 'pDt', 'tk', 'tkQ', 'mk', 'cP', 'ctk', 'ctkQ', 'cTrR', 'cTrQ', 'cTrE', 'cMk', 'iP', 'itk', 'ivR', 'iMk'].forEach(field => {
      const s = document.getElementById(field + src);
      const d = document.getElementById(field + dst);
      if (s && d) d.value = s.value;
    });
  }

  if (cpVisa) {
    ['vR', 'vQ', 'vE', 'cvR', 'cvQ'].forEach(field => {
      const s = document.getElementById(field + src);
      const d = document.getElementById(field + dst);
      if (s && d) d.value = s.value;
    });
  }

  if (cpFlights) {
    const sBody = document.getElementById(`fBody${src}`);
    const dBody = document.getElementById(`fBody${dst}`);
    if (sBody && dBody) {
      dBody.innerHTML = '';
      sBody.querySelectorAll('tr').forEach(r => {
        const srcIdx = r.id.match(/_(\d+)$/)?.[1];
        addFlightRow(dst);
        const dstIdx = dBody.querySelector('tr:last-child')?.id.match(/_(\d+)$/)?.[1];
        ['fD', 'fA', 'fC', 'fS', 'fDp', 'fAr', 'fLy', 'fS2', 'fD2', 'fA2', 'fL'].forEach(prefix => {
          const s = document.getElementById(`${prefix}${src}${srcIdx}`);
          const d = document.getElementById(`${prefix}${dst}${dstIdx}`);
          if (s && d) d.value = s.value;
        });
      });
    }
  }

  if (cpHotels) {
    const sBody = document.getElementById(`hBody${src}`);
    const dBody = document.getElementById(`hBody${dst}`);
    if (sBody && dBody) {
      dBody.innerHTML = '';
      sBody.querySelectorAll('tr').forEach(r => {
        const srcIdx = r.id.match(/_(\d+)$/)?.[1];
        addHotelRow(dst, 'h');
        const dstIdx = dBody.querySelector('tr:last-child')?.id.match(/_(\d+)$/)?.[1];
        ['hCity', 'h', 'hR', 'hM', 'hHIn', 'hHOut', 'hN', 'hRt', 'hQ', 'hD', 'hE'].forEach(prefix => {
          const s = document.getElementById(`${prefix}${src}${srcIdx}`);
          const d = document.getElementById(`${prefix}${dst}${dstIdx}`);
          if (s && d) d.value = s.value;
        });
      });
    }
  }

  if (cpTrans) {
    const sBody = document.getElementById(`tBody${src}`);
    const dBody = document.getElementById(`tBody${dst}`);
    if (sBody && dBody) {
      dBody.innerHTML = '';
      sBody.querySelectorAll('tr').forEach(r => {
        const srcIdx = r.id.match(/_(\d+)$/)?.[1];
        addTransportRow(dst);
        const dstIdx = dBody.querySelector('tr:last-child')?.id.match(/_(\d+)$/)?.[1];
        ['tS', 'tV', 'tR', 'tQ', 'tE'].forEach(prefix => {
          const s = document.getElementById(`${prefix}${src}${srcIdx}`);
          const d = document.getElementById(`${prefix}${dst}${dstIdx}`);
          if (s && d) d.value = s.value;
        });
      });
    }
  }

  closeModal('copyOptModal');
  pTab(dst);
  triggerCostingCalc();
  toast(`Copied Option ${src} to Option ${dst} successfully!`, 'success');
}

let _calcDebounce = null;
function triggerCostingCalc() {
  clearTimeout(_calcDebounce);
  _calcDebounce = setTimeout(() => pCalc(true), 60);
}

function attachCostingListeners() {
  document.querySelectorAll('#pvt input, #pvt select').forEach(el => {
    if (!el.dataset.hasCostHook) {
      el.addEventListener('input', triggerCostingCalc);
      el.addEventListener('change', triggerCostingCalc);
      el.dataset.hasCostHook = '1';
    }
  });
}

// ═══════════════════════════════════════════════════════════
//  THE CORE COSTING ENGINE FORMULAS (Adult, Child, Infant)
// ═══════════════════════════════════════════════════════════
function pCalc(silent = false) {
  let activeResults = {};

  ['A', 'B', 'C'].forEach(L => {
    const panel = document.getElementById(`pOptPanel${L}`);
    if (!panel) return;

    // 1. Adult Calculation
    const aP = n(document.getElementById(`aP${L}`)?.value) || 1;

    // Hotels
    let hTotal = 0;
    let totalNgts = 0;
    const hRows = document.querySelectorAll(`#hBody${L} tr`);
    hRows.forEach(r => {
      const ngtInp = r.querySelector('input[id*="N"]');
      const rtInp  = r.querySelector('input[id*="Rt"]');
      const qtyInp = r.querySelector('input[id*="Q"]');
      const roeInp = r.querySelector('input[id*="E"]');
      const cell   = r.querySelector('[id*="T"]');

      const ngt = n(ngtInp?.value);
      totalNgts += ngt;
      const rt = n(rtInp?.value);
      const qty = n(qtyInp?.value) || 1;
      const roe = n(roeInp?.value) || 78;
      const rowTot = rt * qty * ngt * roe;
      if (cell) cell.textContent = fmtNum(rowTot);
      hTotal += rowTot;
    });

    const dDy = document.getElementById(`dDy${L}`);
    if (dDy && !dDy.dataset.manual && totalNgts > 0) dDy.value = totalNgts + 1;

    // Air Ticket
    const tkRate = n(document.getElementById(`tk${L}`)?.value);
    const tkQty = n(document.getElementById(`tkQ${L}`)?.value) || aP;
    const tkTotal = tkRate * tkQty;
    const tkCell = document.getElementById(`tkT${L}`);
    if (tkCell) tkCell.textContent = 'Total: PKR ' + fmtNum(tkTotal);

    // Visa
    const vRate = n(document.getElementById(`vR${L}`)?.value);
    const vQty = n(document.getElementById(`vQ${L}`)?.value) || aP;
    const vRoe = n(document.getElementById(`vE${L}`)?.value) || 78;
    const vTotal = vRate * vQty * vRoe;
    const vCell = document.getElementById(`vT${L}`);
    if (vCell) vCell.textContent = 'Total: PKR ' + fmtNum(vTotal);

    // Transport
    let tTotal = 0;
    const tRows = document.querySelectorAll(`#tBody${L} tr`);
    tRows.forEach(r => {
      const vehicle = r.querySelector('select[id*="tV"]');
      const rtInp  = r.querySelector('input[id*="R"]');
      const qtyInp = r.querySelector('input[id*="Q"]');
      const roeInp = r.querySelector('input[id*="E"]');
      const cell   = r.querySelector('[id*="T"]');

      // A shared vehicle is one transport unit per passenger.
      if (vehicle && qtyInp && isSharingTransport(vehicle.value)) {
        qtyInp.value = String(Math.max(0, aP));
        qtyInp.dataset.sharingAuto = '1';
      }

      const rt = n(rtInp?.value);
      const qty = n(qtyInp?.value);
      const roe = n(roeInp?.value) || 78;
      const rowTot = rt * qty * roe;
      if (cell) cell.textContent = fmtNum(rowTot);
      tTotal += rowTot;
    });

    // Adult Grand Total & Per Person
    const markup = n(document.getElementById(`mk${L}`)?.value);
    const aGrand = hTotal + tkTotal + vTotal + tTotal + (markup * aP);
    const aPerPax = Math.round(aGrand / aP);

    const aCell = document.getElementById(`aT${L}`);
    if (aCell) aCell.textContent = 'PKR ' + fmtNum(aGrand);
    const aPPCell = document.getElementById(`aPP${L}`);
    if (aPPCell) aPPCell.textContent = 'PKR ' + fmtNum(aPerPax);
    const aPPInput = document.getElementById(`aPPInput${L}`);
    if (aPPInput) aPPInput.value = 'PKR ' + fmtNum(aPerPax);

    // 2. Child Calculation (STRICT TRANSPORT RULE)
    const cP = n(document.getElementById(`cP${L}`)?.value);
    const ctkRate = n(document.getElementById(`ctk${L}`)?.value);
    const ctkQty = n(document.getElementById(`ctkQ${L}`)?.value) || cP;
    const ctkTotal = ctkRate * ctkQty;

    const cvRate = n(document.getElementById(`cvR${L}`)?.value);
    const cvQty = n(document.getElementById(`cvQ${L}`)?.value) || cP;
    const cvRoe = n(document.getElementById(`pROE`)?.value) || 78;
    const cvTotal = cvRate * cvQty * cvRoe;

    // Strict Transport Rule: Under NO circumstances does child transport auto-populate
    const cTrR = n(document.getElementById(`cTrR${L}`)?.value);
    const cTrQ = n(document.getElementById(`cTrQ${L}`)?.value);
    const cTrE = n(document.getElementById(`cTrE${L}`)?.value) || cvRoe;
    let cTrTotal = 0;
    if (cTrR > 0 && cTrQ > 0) {
      cTrTotal = cTrR * cTrQ * cTrE;
    }
    const cTrCell = document.getElementById(`cTr${L}`);
    if (cTrCell) cTrCell.textContent = 'PKR ' + fmtNum(cTrTotal);

    const cMarkup = n(document.getElementById(`cMk${L}`)?.value);
    const cGrand = ctkTotal + cvTotal + cTrTotal + (cMarkup * cP);
    const cPerPax = cP > 0 ? Math.round(cGrand / cP) : 0;

    const cTotCell = document.getElementById(`cTot${L}`);
    if (cTotCell) cTotCell.textContent = 'PKR ' + fmtNum(cGrand);
    const cPPCell = document.getElementById(`cPP${L}`);
    if (cPPCell) cPPCell.textContent = cP > 0 ? 'PKR ' + fmtNum(cPerPax) : 'PKR 0';
    const cPPInput = document.getElementById(`cPPInput${L}`);
    if (cPPInput) cPPInput.value = cP > 0 ? 'PKR ' + fmtNum(cPerPax) : 'PKR 0';

    const cBadge = document.getElementById(`cPaxBadge${L}`);
    if (cBadge) cBadge.textContent = `${cP} Child${cP !== 1 ? 'ren' : ''}`;

    // 3. Infant Calculation
    const iP = n(document.getElementById(`iP${L}`)?.value);
    const itk = n(document.getElementById(`itk${L}`)?.value) * (iP || 1);
    const iv = n(document.getElementById(`ivR${L}`)?.value) * (iP || 1) * (n(G.settings?.default_roe) || 77);
    const iMarkup = n(document.getElementById(`iMk${L}`)?.value) * iP;
    const iGrand = iP > 0 ? (itk + iv + iMarkup) : 0;
    const iPerPax = iP > 0 ? Math.round(iGrand / iP) : 0;

    const iTotCell = document.getElementById(`iTot${L}`);
    if (iTotCell) iTotCell.textContent = 'PKR ' + fmtNum(iGrand);
    const iPPCell = document.getElementById(`iPP${L}`);
    if (iPPCell) iPPCell.textContent = iP > 0 ? 'PKR ' + fmtNum(iPerPax) : 'PKR 0';
    const iPPInput = document.getElementById(`iPPInput${L}`);
    if (iPPInput) iPPInput.value = iP > 0 ? 'PKR ' + fmtNum(iPerPax) : 'PKR 0';

    const iBadge = document.getElementById(`iPaxBadge${L}`);
    if (iBadge) iBadge.textContent = `${iP} Infant${iP !== 1 ? 's' : ''}`;

    activeResults[L] = {
      adultPax: aP, adultPerPax: aPerPax, adultGrand: aGrand,
      childPax: cP, childPerPax: cPerPax, childGrand: cGrand,
      infantPax: iP, infantPerPax: iPerPax, infantGrand: iGrand,
      totalPackage: aGrand + cGrand + iGrand
    };
  });

  // Update Grand Summary Bar for active option
  const cur = activeResults[_activePvtOpt] || activeResults['A'];
  if (cur) {
    const sAdult = document.getElementById('gSumAdult');
    if (sAdult) animateCounter(sAdult, cur.adultPerPax, 500, 'PKR ');
    const sChild = document.getElementById('gSumChild');
    if (sChild) {
      if (cur.childPax > 0) animateCounter(sChild, cur.childPerPax, 500, 'PKR ');
      else sChild.textContent = '—';
    }
    const sInfant = document.getElementById('gSumInfant');
    if (sInfant) {
      if (cur.infantPax > 0) animateCounter(sInfant, cur.infantPerPax, 500, 'PKR ');
      else sInfant.textContent = '—';
    }
    const sTotal = document.getElementById('gSumTotal');
    if (sTotal) animateCounter(sTotal, cur.totalPackage, 700, 'PKR ');
  }

  if (!silent) toast('Calculations updated', 'info');
  return activeResults;
}

// Build structured quotation JSON object ready for DB save
function collectQuotationData() {
  pCalc(true);

  const clientName = document.getElementById('pN')?.value.trim();
  if (!clientName) return null;

  const data = {
    type: 'private',
    client_name: clientName,
    contact_no: document.getElementById('pPh')?.value.trim() || '',
    travel_dates: document.getElementById('pDt')?.value.trim() || '',
    includes: document.getElementById('pInc')?.value.trim() || 'FLIGHT, HOTEL, VISA, TRANSPORT',
    notes: document.getElementById('pNote')?.value.trim() || '',
    is_intl: !!document.getElementById('pIsIntl')?.checked,
    options: {}
  };

  let maxAdult = 0, maxChild = 0, maxInfant = 0;

  ['A', 'B', 'C'].forEach(L => {
    const btn = document.getElementById(`pTabBtn${L}`);
    if (L !== 'A' && btn && btn.style.display === 'none') return;

    const aP = n(document.getElementById(`aP${L}`)?.value) || 1;
    const cP = n(document.getElementById(`cP${L}`)?.value) || 0;
    const iP = n(document.getElementById(`iP${L}`)?.value) || 0;

    maxAdult = Math.max(maxAdult, aP);
    maxChild = Math.max(maxChild, cP);
    maxInfant = Math.max(maxInfant, iP);

    const opt = {
      travelDates: document.getElementById(`pDt${L}`)?.value || data.travel_dates,
      notes: data.notes,
      isIntl: data.is_intl,
      roe: n(document.getElementById('pROE')?.value) || 78,
      adultPax: aP,
      childPax: cP,
      infantPax: iP,
      ticketPKR: n(document.getElementById(`tk${L}`)?.value),
      ticketQty: n(document.getElementById(`tkQ${L}`)?.value) || aP,
      visa: {
        rate: n(document.getElementById(`vR${L}`)?.value),
        qty: n(document.getElementById(`vQ${L}`)?.value) || aP,
        roe: n(document.getElementById(`vE${L}`)?.value) || 78
      },
      markup: n(document.getElementById(`mk${L}`)?.value),
      flights: [],
      hotels: [],
      transports: [],
      child: {
        ticketPKR: n(document.getElementById(`ctk${L}`)?.value),
        ticketQty: n(document.getElementById(`ctkQ${L}`)?.value) || cP,
        visaRate: n(document.getElementById(`cvR${L}`)?.value),
        visaQty: n(document.getElementById(`cvQ${L}`)?.value) || cP,
        transportRate: n(document.getElementById(`cTrR${L}`)?.value),
        transportQty: n(document.getElementById(`cTrQ${L}`)?.value),
        transportRoe: n(document.getElementById(`cTrE${L}`)?.value) || n(document.getElementById('pROE')?.value) || 78,
        markup: n(document.getElementById(`cMk${L}`)?.value)
      },
      infant: {
        ticketPKR: n(document.getElementById(`itk${L}`)?.value),
        visaRate: n(document.getElementById(`ivR${L}`)?.value),
        visaROE: n(G.settings?.default_roe) || 77,
        markup: n(document.getElementById(`iMk${L}`)?.value)
      }
    };

    // Collect flights directly from DOM row
    document.querySelectorAll(`#fBody${L} tr`).forEach(r => {
      const date = r.querySelector('input[type="date"]')?.value || '';
      const airline = r.querySelector('select[id*="fA"]')?.value || '';
      const sec = r.querySelector('input[id*="fS"]:not([id*="fS2"])')?.value || '';
      if (sec || date) {
        opt.flights.push({
          date, airline, sec,
          cls: r.querySelector('select[id*="fC"]')?.value || 'ECONOMY',
          dep: r.querySelector('input[id*="fDp"]')?.value || '',
          arr: r.querySelector('input[id*="fAr"]')?.value || '',
          layover: r.querySelector('select[id*="fLy"]')?.value || 'Direct',
          sec2: r.querySelector('input[id*="fS2"]')?.value || '',
          dep2: r.querySelector('input[id*="fD2"]')?.value || '',
          arr2: r.querySelector('input[id*="fA2"]')?.value || '',
          luggage: r.querySelector('input[id*="fL"]')?.value || '2PC'
        });
      }
    });

    // Collect hotels directly from DOM row
    document.querySelectorAll(`#hBody${L} tr`).forEach(r => {
      const name = r.querySelector('input[id^="h"]:not([id*="City"]):not([id*="HIn"]):not([id*="HOut"]):not([id*="Rt"]):not([id*="N"]):not([id*="Q"]):not([id*="D"]):not([id*="E"]):not([id*="T"]):not([id*="R"]):not([id*="M"])')?.value ||
                   r.querySelector('input[placeholder*="hotel" i]')?.value;
      if (name && name.trim()) {
        const hotelObj = (G.hotels || []).find(h => (h.name || '').trim().toLowerCase() === name.trim().toLowerCase());
        const imageUrl = r.dataset.img || hotelObj?.image_url || '';
        const locationUrl = r.dataset.loc || hotelObj?.location_url || '';

        opt.hotels.push({
          city: r.querySelector('select[id*="City"]')?.value || 'makkah',
          name: name.trim(),
          roomType: r.querySelector('select[id*="R"]')?.value || 'DOUBLE',
          meal: r.querySelector('select[id*="M"]')?.value || 'RO',
          checkIn: r.querySelector('input[id*="HIn"]')?.value || '',
          checkOut: r.querySelector('input[id*="HOut"]')?.value || '',
          nights: n(r.querySelector('input[id*="N"]')?.value) || 1,
          rate: n(r.querySelector('input[id*="Rt"]')?.value),
          qty: n(r.querySelector('input[id*="Q"]')?.value) || 1,
          distance: r.querySelector('input[id*="D"]')?.value || '',
          roe: n(r.querySelector('input[id*="E"]')?.value) || 78,
          image_url: imageUrl,
          location_url: locationUrl
        });
      }
    });

    // Collect transports directly from DOM row
    document.querySelectorAll(`#tBody${L} tr`).forEach(r => {
      const sec = r.querySelector('select[id*="tS"]')?.value || r.querySelector('input[id*="tS"]')?.value;
      const rate = n(r.querySelector('input[id*="tR"]')?.value);
      if (sec && sec.trim() && (rate > 0 || n(r.querySelector('input[id*="tQ"]')?.value) > 1)) {
        opt.transports.push({
          sector: sec.trim(),
          vehicle: r.querySelector('select[id*="tV"]')?.value || 'CAR',
          date: r.querySelector('input[id*="tD"]')?.value || '',
          rate,
          qty: n(r.querySelector('input[id*="tQ"]')?.value) || 1,
          roe: n(r.querySelector('input[id*="tE"]')?.value) || 78
        });
      }
    });

    data.options[L] = opt;
  });

  data.adult_pax = maxAdult;
  data.child_pax = maxChild;
  data.infant_pax = maxInfant;

  return data;
}

// ═══════════════════════════════════════════════════════════
//  SAVING, PREVIEWING & WHATSAPP SHARING
// ═══════════════════════════════════════════════════════════
async function pSave() {
  const data = collectQuotationData();
  if (!data) {
    toast('Please enter client name', 'warn');
    document.getElementById('pN')?.focus();
    return;
  }

  data.status = _currentQuotationData?.status || 'pending';
  showLoad('Saving quotation to MySQL…');
  try {
    let res;
    if (_editingPvtId) {
      res = await PUT(`/quotations/${_editingPvtId}`, data);
      toast('Quotation updated successfully!', 'success');
      data.id = _editingPvtId;
      data.invoice_no = _currentQuotationData?.invoice_no;
    } else {
      res = await POST('/quotations', data);
      toast(`Quotation created: ${res.invoice_no}`, 'success');
      _editingPvtId = res.id;
      data.id = res.id;
      data.invoice_no = res.invoice_no;

      const tag = document.getElementById('pEditTag');
      if (tag) tag.innerHTML = `<span class="pill pill-blue">Editing ${res.invoice_no}</span>`;
    }

    _currentQuotationData = data;
    hideLoad();
    pPreview(); // Open proposal preview voucher directly!
  } catch (err) {
    hideLoad();
    toast('Save failed: ' + err.message, 'error');
  }
}

function pSaveDraft() {
  const data = collectQuotationData();
  if (!data) { toast('Enter client name to save draft', 'warn'); return; }
  try {
    localStorage.setItem('pgt_pvt_draft', JSON.stringify(data));
    toast('Draft saved to local storage', 'success');
  } catch (err) {
    toast('Unable to save draft: ' + err.message, 'error');
  }
}

function loadPrivateDraft() {
  try {
    const raw = localStorage.getItem('pgt_pvt_draft');
    if (!raw) { toast('No saved private costing draft was found on this device', 'info'); return; }
    restorePrivateQuotation(JSON.parse(raw), true);
    toast('Private costing draft loaded', 'success');
  } catch (err) {
    toast('Unable to load private draft: ' + err.message, 'error');
  }
}

function newPrivateCosting() {
  _editingPvtId = null;
  _currentQuotationData = null;
  const tag = document.getElementById('pEditTag');
  if (tag) tag.innerHTML = '';
  pgPrivate(true);
  toast('Started new quotation', 'info');
}

function restorePrivateQuotation(quotation, isDraft = false) {
  const options = parseQuotationOptions(quotation.options);
  const setValue = (id, value) => {
    const element = document.getElementById(id);
    if (element && value !== undefined && value !== null) element.value = value;
  };
  setValue('pN', quotation.client_name || '');
  setValue('pPh', quotation.contact_no || '');
  setValue('pDt', quotation.travel_dates || '');
  setValue('pInc', quotation.includes || 'FLIGHT, HOTEL, VISA, TRANSPORT');
  const firstOption = options.A || options.B || options.C || {};
  setValue('pNote', quotation.notes || firstOption.notes || '');
  const intl = document.getElementById('pIsIntl');
  if (intl) intl.checked = Boolean(quotation.is_intl ?? firstOption.isIntl);
  setValue('pROE', firstOption.visa?.roe ?? G.settings?.default_roe ?? 78);
  const optionKeys = ['A', 'B', 'C'].filter(key => options[key]);
  while (document.getElementById('pTabBtnB')?.style.display === 'none' && optionKeys.includes('B')) addNextOpt();
  if (optionKeys.includes('C') && document.getElementById('pTabBtnC')?.style.display === 'none') addNextOpt();

  optionKeys.forEach(key => {
    const option = options[key] || {};
    const child = option.child || {};
    const infant = option.infant || {};
    setValue(`pDt${key}`, option.travelDates || quotation.travel_dates || '');
    setValue(`aP${key}`, option.adultPax ?? quotation.adult_pax ?? 2);
    setValue(`cP${key}`, option.childPax ?? quotation.child_pax ?? 0);
    setValue(`iP${key}`, option.infantPax ?? quotation.infant_pax ?? 0);
    setValue(`tk${key}`, option.ticketPKR ?? 0);
    setValue(`tkQ${key}`, option.ticketQty ?? option.adultPax ?? 2);
    setValue(`mk${key}`, option.markup ?? 0);
    setValue(`vR${key}`, option.visa?.rate ?? 560);
    setValue(`vQ${key}`, option.visa?.qty ?? option.adultPax ?? 2);
    setValue(`vE${key}`, option.visa?.roe ?? G.settings?.default_roe ?? 78);
    setValue(`ctk${key}`, child.ticketPKR ?? 0);
    setValue(`ctkQ${key}`, child.ticketQty ?? option.childPax ?? 0);
    setValue(`cvR${key}`, child.visaRate ?? G.settings?.default_visa_child ?? 560);
    setValue(`cvQ${key}`, child.visaQty ?? option.childPax ?? 0);
    setValue(`cTrR${key}`, child.transportRate ?? 0);
    setValue(`cTrQ${key}`, child.transportQty ?? 0);
    setValue(`cTrE${key}`, child.transportRoe ?? option.visa?.roe ?? G.settings?.default_roe ?? 78);
    setValue(`cMk${key}`, child.markup ?? 0);
    setValue(`itk${key}`, infant.ticketPKR ?? 0);
    setValue(`ivR${key}`, infant.visaRate ?? G.settings?.default_visa_infant ?? 150);
    setValue(`iMk${key}`, infant.markup ?? 0);
    const ticketQty = document.getElementById(`tkQ${key}`);
    const visaQty = document.getElementById(`vQ${key}`);
    if (ticketQty) ticketQty.dataset.manual = option.ticketQty != null ? '1' : '';
    if (visaQty) visaQty.dataset.manual = option.visa?.qty != null ? '1' : '';

    const flights = Array.isArray(option.flights) ? option.flights : [];
    const flightBody = document.getElementById(`fBody${key}`);
    while (flightBody && flightBody.rows.length < flights.length) addFlightRow(key);
    [...(flightBody?.querySelectorAll('tr') || [])].forEach((row, i) => {
      const flight = flights[i];
      if (!flight) return;
      const idx = row.id.match(/_(\d+)$/)?.[1];
      const fields = {
        [`fD${key}${idx}`]: flight.date || '',
        [`fA${key}${idx}`]: flight.airline || '',
        [`fC${key}${idx}`]: flight.cls || 'ECONOMY',
        [`fS${key}${idx}`]: flight.sec || '',
        [`fDp${key}${idx}`]: flight.dep || '',
        [`fAr${key}${idx}`]: flight.arr || '',
        [`fLy${key}${idx}`]: flight.layover || flight.lay || 'Direct',
        [`fS2${key}${idx}`]: flight.sec2 || '',
        [`fD2${key}${idx}`]: flight.dep2 || '',
        [`fA2${key}${idx}`]: flight.arr2 || '',
        [`fL${key}${idx}`]: flight.luggage || flight.lug || '2PC'
      };
      Object.entries(fields).forEach(([id, value]) => setValue(id, value));
    });

    const hotels = Array.isArray(option.hotels) ? option.hotels : [];
    const hotelBody = document.getElementById(`hBody${key}`);
    while (hotelBody && hotelBody.rows.length < hotels.length) addHotelRow(key, 'h');
    [...(hotelBody?.querySelectorAll('tr') || [])].forEach((row, i) => {
      const hotel = hotels[i];
      if (!hotel) return;
      const idx = row.id.match(/_(\d+)$/)?.[1];
      const fields = {
        [`hCity${key}${idx}`]: hotel.city || 'makkah',
        [`h${key}${idx}`]: hotel.name || '',
        [`hR${key}${idx}`]: hotel.roomType || hotel.room_type || 'DOUBLE',
        [`hM${key}${idx}`]: hotel.meal || 'RO',
        [`hHIn${key}${idx}`]: hotel.checkIn || hotel.check_in || '',
        [`hHOut${key}${idx}`]: hotel.checkOut || hotel.check_out || '',
        [`hN${key}${idx}`]: hotel.nights ?? 1,
        [`hRt${key}${idx}`]: hotel.rate ?? hotel.rate_sar ?? '',
        [`hQ${key}${idx}`]: hotel.qty ?? 1,
        [`hD${key}${idx}`]: hotel.distance || '',
        [`hE${key}${idx}`]: hotel.roe ?? G.settings?.default_roe ?? 78
      };
      Object.entries(fields).forEach(([id, value]) => setValue(id, value));
      row.dataset.img = hotel.image_url || '';
      row.dataset.loc = hotel.location_url || '';
    });

    const transports = Array.isArray(option.transports) ? option.transports : [];
    const transportBody = document.getElementById(`tBody${key}`);
    while (transportBody && transportBody.rows.length < transports.length) addTransportRow(key);
    [...(transportBody?.querySelectorAll('tr') || [])].forEach((row, i) => {
      const route = transports[i];
      if (!route) return;
      const idx = row.id.match(/_(\d+)$/)?.[1];
      const fields = {
        [`tS${key}${idx}`]: route.sector || '',
        [`tV${key}${idx}`]: route.vehicle || '',
        [`tR${key}${idx}`]: route.rate ?? route.rate_sar ?? '',
        [`tQ${key}${idx}`]: route.qty ?? 1,
        [`tE${key}${idx}`]: route.roe ?? G.settings?.default_roe ?? 78
      };
      Object.entries(fields).forEach(([id, value]) => setValue(id, value));
    });
  });

  _editingPvtId = isDraft ? null : quotation.id || null;
  _currentQuotationData = isDraft ? null : quotation;
  const tag = document.getElementById('pEditTag');
  if (tag) tag.innerHTML = !isDraft && quotation.invoice_no
    ? `<span class="pill pill-blue">Editing ${esc(quotation.invoice_no)}</span>` : '';
  pTab('A');
  attachCostingListeners();
  triggerCostingCalc();
}

function pPreview() {
  const data = collectQuotationData();
  if (!data) { toast('Please enter client name first', 'warn'); return; }
  if (_currentQuotationData?.id) data.id = _currentQuotationData.id;
  if (_currentQuotationData?.invoice_no) data.invoice_no = _currentQuotationData.invoice_no;
  _activeProposalType = 'private';
  _activeProposalData = data;

  const branchId = G.user?.branchId || G.user?.branch_id;
  const branch = G.branches.find(b => b.id === branchId) || {
    name: 'Pak Globe Travels', phone: '0310-0376111', license_no: '5807',
    address: 'Office # A/03, Upper Side of Broadway Pizza, Autobhan Road, Hyderabad',
    brand_color: '#3A94BA'
  };

  const html = renderProposalA4Html(data, branch);
  const container = document.getElementById('proposalPreviewBody');
  if (container) container.innerHTML = html;
  const title = document.getElementById('proposalModalTitle');
  if (title) title.textContent = 'Quotation Proposal Preview';

  // Generate QR Code
  generateProposalQrCode(data);

  openModal('proposalModal');
}

function calculatePrivateQuotationOptions(options = {}) {
  const results = {};
  ['A', 'B', 'C'].forEach(key => {
    const option = options[key];
    if (!option) return;
    const adultPax = Math.max(1, n(option.adultPax) || 1);
    const childPax = Math.max(0, n(option.childPax));
    const infantPax = Math.max(0, n(option.infantPax));
    const hotels = Array.isArray(option.hotels) ? option.hotels : [];
    const transports = Array.isArray(option.transports) ? option.transports : [];
    const hotelTotal = hotels.reduce((sum, hotel) =>
      sum + n(hotel.rate ?? hotel.rateSAR) * (n(hotel.qty) || 1) * (n(hotel.nights) || 1) * (n(hotel.roe) || option.roe || 78), 0);
    const ticketTotal = n(option.ticketPKR) * (n(option.ticketQty) || adultPax);
    const visaTotal = n(option.visa?.rate) * (n(option.visa?.qty) || adultPax) * (n(option.visa?.roe) || option.roe || 78);
    const transportTotal = transports.reduce((sum, route) =>
      sum + n(route.rate ?? route.rateSAR) * (n(route.qty) || 1) * (n(route.roe) || option.roe || 78), 0);
    const adultGrand = hotelTotal + ticketTotal + visaTotal + transportTotal + n(option.markup) * adultPax;

    const child = option.child || {};
    const childTransport = n(child.transportRate) > 0 && n(child.transportQty) > 0
      ? n(child.transportRate) * n(child.transportQty) * (n(child.transportRoe) || option.roe || 78) : 0;
    const childGrand = childPax > 0
      ? n(child.ticketPKR) * (n(child.ticketQty) || childPax) +
        n(child.visaRate) * (n(child.visaQty) || childPax) * (n(option.roe) || 78) +
        childTransport + n(child.markup) * childPax : 0;
    const infant = option.infant || {};
    const infantGrand = infantPax > 0
      ? (n(infant.ticketPKR) + n(infant.visaRate) * (n(infant.visaROE) || 77) + n(infant.markup)) * infantPax : 0;

    results[key] = {
      adultPerPax: Math.round(adultGrand / adultPax),
      childPerPax: childPax ? Math.round(childGrand / childPax) : 0,
      infantPerPax: infantPax ? Math.round(infantGrand / infantPax) : 0,
      totalPackage: adultGrand + childGrand + infantGrand
    };
  });
  return results;
}

function renderProposalA4Html(data, branch, brandingSettings = G.settings || {}) {
  const quoteBranch = (branch && branch.name) ? branch : (
    (data.branch_id ? G.branches?.find(b => b.id === data.branch_id) : null) ||
    (G.user?.branchId ? G.branches?.find(b => b.id === G.user.branchId) : null) || {}
  );
  const branchName = quoteBranch.name || brandingSettings.company_name || 'Pak Globe Travels';
  branch = {
    ...quoteBranch,
    name: branchName,
    tagline: quoteBranch.tagline || brandingSettings.tagline || '',
    phone: quoteBranch.phone || brandingSettings.phone || '',
    email: quoteBranch.email || brandingSettings.email || '',
    address: quoteBranch.address || brandingSettings.address || '',
    license_no: quoteBranch.license_no || brandingSettings.license_no || '',
    logo_url: quoteBranch.logo_url || brandingSettings.logo_url || '',
    brand_color: quoteBranch.brand_color || brandingSettings.brand_color || '#0f2c59',
    terms_text: quoteBranch.terms_text || brandingSettings.terms_text || '',
    disclaimer_text: quoteBranch.disclaimer_text || brandingSettings.disclaimer_text || ''
  };
  const inv = data.invoice_no || 'PGT-QUOT';
  const cName = data.client_name || 'Valued Client';
  const phone = data.contact_no || '—';
  const dates = data.travel_dates || '—';
  const compName = branch.name || 'Pak Globe Travels';
  const lic = branch.license_no ? 'GL # ' + branch.license_no : '';
  const addr = branch.address || '';
  const bPhone = branch.phone || '';
  const bEmail = branch.email || '';

  const optKeys = Object.keys(data.options || {});
  const activeOpt = optKeys[0] || 'A';
  const o = (data.options || {})[activeOpt] || {};
  const calcAll = calculatePrivateQuotationOptions(data.options || {});
  const calcRes = calcAll[activeOpt] || { adultPerPax: 0, childPerPax: 0, infantPerPax: 0, totalPackage: 0 };

  const validHotels = (o.hotels || []).filter(h => h && h.name);
  const flights = (o.flights || []).filter(f => f && (f.sec || f.airline));
  const transports = (o.transports || []).filter(t => t && t.sector);

  return `
    <!-- PAGE 1: PROPOSAL VOUCHER -->
    <div class="pp pp-single" style="--brand:#0F2C59;font-family:'Segoe UI',Arial,sans-serif">
      
      <!-- Top Header -->
      <div class="hdr" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div style="display:flex;gap:14px;align-items:center">
          <div class="logo-wrap" style="width:75px;height:75px">
            ${branch.logo_url ? `<img src="${escAttr(branch.logo_url)}" alt="Logo" style="max-height:65px;max-width:70px">` : `<div class="logo-fb" style="font-size:26px;font-weight:900">${esc(compName.charAt(0))}</div>`}
          </div>
          <div class="co-info">
            <h1 style="font-size:18px;font-weight:900;color:#0F2C59;margin:0 0 2px">${esc(compName)}</h1>
            ${branch.tagline ? `<div style="font-size:9px;color:#475569;margin-bottom:3px">${esc(branch.tagline)}</div>` : ''}
            <div style="font-size:9.5px;color:#475569;margin-bottom:3px">${esc(addr)}</div>
            <div style="font-size:10px;font-weight:600;color:#1e293b;display:flex;gap:12px">
              <span>📞 ${esc(bPhone)}</span>
              <span>✉ ${esc(bEmail)}</span>
            </div>
          </div>
        </div>
        <div class="hdr-qr" style="text-align:center">
          <div class="pp-qr-box" id="proposalHeaderQrBox" style="width:65px;height:65px;border:1px solid #cbd5e1;padding:2px;background:#fff"></div>
          <div class="hq-cap" style="font-size:8px;font-weight:800;color:#0F2C59;letter-spacing:1px;margin-top:2px">SCAN ME</div>
        </div>
      </div>

      <!-- Blue Ribbon with Gold Underline -->
      <div style="background:#0F2C59;border-bottom:2.5px solid #F59E0B;border-radius:4px;padding:6px 10px;text-align:center;color:#ffffff;font-size:12.5px;font-weight:900;letter-spacing:2px;margin-bottom:8px">
        CUSTOMIZED UMRAH PACKAGE ${activeOpt !== 'A' ? '— OPTION ' + activeOpt : ''}
      </div>

      <!-- 4 Metadata Cards -->
      <div class="icards" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px">
        <div class="icard" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px;text-align:center">
          <div style="font-size:12px">📄</div>
          <div style="font-size:8.5px;font-weight:800;color:#64748b;text-transform:uppercase">Invoice #</div>
          <div style="font-size:11px;font-weight:900;color:#0F2C59">${esc(inv)}</div>
        </div>
        <div class="icard" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px;text-align:center">
          <div style="font-size:12px">📅</div>
          <div style="font-size:8.5px;font-weight:800;color:#64748b;text-transform:uppercase">Date</div>
          <div style="font-size:11px;font-weight:900;color:#0F2C59">${fmtDate(new Date())}</div>
        </div>
        <div class="icard" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px;text-align:center">
          <div style="font-size:12px">👤</div>
          <div style="font-size:8.5px;font-weight:800;color:#64748b;text-transform:uppercase">Prepared By</div>
          <div style="font-size:11px;font-weight:900;color:#0F2C59">${esc(G.user?.full_name || G.user?.username || 'Shahzaman')}</div>
        </div>
        <div class="icard" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px;text-align:center">
          <div style="font-size:12px">🏷️</div>
          <div style="font-size:8.5px;font-weight:800;color:#64748b;text-transform:uppercase">Package Type</div>
          <div style="font-size:11px;font-weight:900;color:#0F2C59">${esc(o.adultCat || data.heading || 'Customized Umrah')}</div>
        </div>
      </div>

      <!-- 2-Column Client Summary Box -->
      <div style="border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;background:#f8fafc;display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:10.5px;margin-bottom:8px">
        <div>
          <div style="display:flex;margin-bottom:3px"><b style="width:65px;color:#334155">Client:</b><span style="font-weight:700;color:#0F2C59">${esc(cName)}</span></div>
          <div style="display:flex;margin-bottom:3px"><b style="width:65px;color:#334155">Adults:</b><span>${data.adult_pax || 2} Pax</span></div>
          <div style="display:flex;margin-bottom:3px"><b style="width:65px;color:#334155">Child:</b><span>${data.child_pax || 0} Pax</span></div>
          <div style="display:flex;margin-bottom:3px"><b style="width:65px;color:#334155">Infant:</b><span>${data.infant_pax || 0} Pax</span></div>
          <div style="display:flex"><b style="width:65px;color:#334155">Days:</b><span>${data.days || o.totalDays || 15}</span></div>
        </div>
        <div>
          <div style="display:flex;margin-bottom:3px"><b style="width:75px;color:#334155">📞 Contact:</b><span>${esc(phone || '—')}</span></div>
          <div style="display:flex;margin-bottom:3px"><b style="width:75px;color:#334155">📅 Travel:</b><span>${esc(dates)}</span></div>
          <div style="display:flex"><b style="width:75px;color:#334155">✅ Includes:</b><span style="font-weight:700;color:#0F2C59">${esc(data.includes || 'FLIGHT, HOTEL, VISA, TRANSPORT')}</span></div>
        </div>
      </div>

      <!-- Divider -->
      <div style="text-align:center;font-size:10px;font-weight:800;letter-spacing:3px;color:#64748b;margin:6px 0">
        ✈️ T R A V E L &nbsp; D E T A I L S ✈️
      </div>

      <!-- 1. Flight Details -->
      ${flights.length ? `
        <div style="background:#0F2C59;color:#fff;font-size:9.5px;font-weight:800;padding:4px 8px;border-radius:4px 4px 0 0;letter-spacing:0.5px">
          ✈ FLIGHT DETAILS
        </div>
        <table class="ftbl" style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:8px">
          <thead>
            <tr style="background:#0F2C59;color:#fff;text-align:center">
              <th rowspan="2" style="border:1px solid #1e3a8a;padding:2px 3px;width:24px">FLT#</th>
              <th rowspan="2" style="border:1px solid #1e3a8a;padding:2px 4px;width:65px">DATE</th>
              <th rowspan="2" style="border:1px solid #1e3a8a;padding:2px 4px;width:85px">AIRLINE</th>
              <th rowspan="2" style="border:1px solid #1e3a8a;padding:2px 3px;width:45px">CLASS</th>
              <th colspan="3" style="border:1px solid #1e3a8a;padding:2px 4px">SECTOR 1</th>
              <th rowspan="2" style="border:1px solid #1e3a8a;padding:2px 4px;width:60px">LAYOVER</th>
              <th colspan="3" style="border:1px solid #1e3a8a;padding:2px 4px">SECTOR 2</th>
              <th rowspan="2" style="border:1px solid #1e3a8a;padding:2px 3px;width:45px">LUG</th>
              <th rowspan="2" style="border:1px solid #1e3a8a;padding:2px 4px;width:95px">⏱ STAY/TRANSIT TIME</th>
            </tr>
            <tr style="background:#1e3a8a;color:#fff;text-align:center">
              <th style="border:1px solid #2563eb;padding:1px 3px">SECTOR</th>
              <th style="border:1px solid #2563eb;padding:1px 3px">DEP</th>
              <th style="border:1px solid #2563eb;padding:1px 3px">ARR</th>
              <th style="border:1px solid #2563eb;padding:1px 3px">SECTOR</th>
              <th style="border:1px solid #2563eb;padding:1px 3px">DEP</th>
              <th style="border:1px solid #2563eb;padding:1px 3px">ARR</th>
            </tr>
          </thead>
          <tbody>
            ${flights.map((f, i) => {
              const isIndirect = (f.layover || '').toLowerCase() === 'indirect';
              const transitBadge = isIndirect
                ? `<div style="display:inline-block;background:rgba(34,197,94,0.15);color:#15803d;border:1px solid rgba(34,197,94,0.3);border-radius:10px;padding:1px 5px;font-size:8px;font-weight:700">🕒 2h 35m<br>TRANSIT</div>`
                : '-';

              return `
                <tr style="text-align:center;border-bottom:1px solid #e2e8f0;background:${i%2===0?'#fff':'#f8fafc'}">
                  <td style="padding:3px 2px;border:1px solid #e2e8f0">${i+1}</td>
                  <td style="padding:3px 2px;border:1px solid #e2e8f0">${fmtDate(f.date)}</td>
                  <td style="padding:3px 2px;border:1px solid #e2e8f0;font-weight:700">${esc(f.airline)}</td>
                  <td style="padding:3px 2px;border:1px solid #e2e8f0">${esc(f.cls ? f.cls.slice(0,3) : 'ECO')}</td>
                  <td style="padding:3px 2px;border:1px solid #e2e8f0;font-weight:700">${esc(f.sec || '—')}</td>
                  <td style="padding:3px 2px;border:1px solid #e2e8f0">${esc(f.dep || '—')}</td>
                  <td style="padding:3px 2px;border:1px solid #e2e8f0">${esc(f.arr || '—')}</td>
                  <td style="padding:3px 2px;border:1px solid #e2e8f0;text-transform:uppercase">${esc(f.layover || 'DIRECT')}</td>
                  <td style="padding:3px 2px;border:1px solid #e2e8f0">${esc(f.sec2 || '—')}</td>
                  <td style="padding:3px 2px;border:1px solid #e2e8f0">${esc(f.dep2 || '—')}</td>
                  <td style="padding:3px 2px;border:1px solid #e2e8f0">${esc(f.arr2 || '—')}</td>
                  <td style="padding:3px 2px;border:1px solid #e2e8f0">${esc(f.luggage || '25 Kg')}</td>
                  <td style="padding:3px 2px;border:1px solid #e2e8f0">${transitBadge}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      ` : ''}

      <!-- 2. Hotel Accommodation -->
      ${validHotels.length ? `
        <div style="background:#0F2C59;color:#fff;font-size:9.5px;font-weight:800;padding:4px 8px;border-radius:4px 4px 0 0;letter-spacing:0.5px">
          🏨 HOTEL ACCOMMODATION
        </div>
        <div style="display:grid;grid-template-columns:repeat(${Math.min(validHotels.length, 3)}, 1fr);gap:6px;margin-bottom:8px">
          ${validHotels.map(h => {
            const hPhoto = h.image_url || '';
            const hDist = h.distance || '500m - 600m';
            const locUrl = h.location_url || ('https://maps.google.com/?q=' + encodeURIComponent(h.name + ' ' + (h.city||'')));

            return `
              <div style="border:1px solid #cbd5e1;border-radius:6px;padding:6px;background:#fff;display:flex;gap:8px;align-items:flex-start">
                ${hPhoto ? `
                  <img src="${escAttr(hPhoto)}" alt="${escAttr(h.name)}" style="width:75px;height:75px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;flex-shrink:0">
                ` : `
                  <div style="width:75px;height:75px;border-radius:6px;background:#f1f5f9;border:1px solid #e2e8f0;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">🏨</div>
                `}
                <div style="flex:1;min-width:0;font-size:9.5px;line-height:1.35">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
                    <span style="font-size:8.5px;font-weight:800;color:#0F2C59;letter-spacing:0.4px">${(h.city||'MAKKAH').toUpperCase()} HOTEL</span>
                    <a href="${escAttr(locUrl)}" target="_blank" style="color:#ef4444;text-decoration:none;font-size:13px;line-height:1" title="View location on Google Maps">📍</a>
                  </div>
                  <div style="font-weight:900;font-size:10.5px;color:#0F2C59;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px">${esc(h.name)}</div>
                  <div style="color:#334155">
                    <div><b>Check-in:</b> ${fmtDate(h.checkIn)}</div>
                    <div><b>Check-out:</b> ${fmtDate(h.checkOut)}</div>
                    <div><b>Nights:</b> ${h.nights || 7}</div>
                    <div><b>Room:</b> ${esc(h.roomType || 'DOUBLE')}x${h.qty||1}</div>
                    <div><b>Meal:</b> ${esc((h.meal||'RO').toUpperCase())}</div>
                    <div><b>Dist:</b> ${esc(hDist)}</div>
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>
      ` : ''}

      <!-- 3. Transport Table -->
      ${transports.length ? `
        <div style="background:#0F2C59;color:#fff;font-size:9.5px;font-weight:800;padding:4px 8px;border-radius:4px 4px 0 0;letter-spacing:0.5px">
          🚗 TRANSPORT
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:8px">
          <thead>
            <tr style="background:#0F2C59;color:#fff;text-align:center">
              <th style="border:1px solid #1e3a8a;padding:3px;text-align:left;width:70%">SECTOR</th>
              <th style="border:1px solid #1e3a8a;padding:3px;width:20%">VEHICLE</th>
              <th style="border:1px solid #1e3a8a;padding:3px;width:10%">QTY</th>
            </tr>
          </thead>
          <tbody>
            ${transports.map((t, idx) => `
              <tr style="background:${idx%2===0?'#fff':'#f8fafc'};border-bottom:1px solid #e2e8f0;text-align:center">
                <td style="padding:3px;border:1px solid #e2e8f0;text-align:left;font-weight:700">${esc(t.sector)}</td>
                <td style="padding:3px;border:1px solid #e2e8f0">${esc(t.vehicle)}</td>
                <td style="padding:3px;border:1px solid #e2e8f0">${t.qty || 1}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      <!-- 4. Visa Details -->
      <div style="background:#0F2C59;color:#fff;font-size:9.5px;font-weight:800;padding:4px 8px;border-radius:4px 4px 0 0;letter-spacing:0.5px">
        🛂 VISA DETAILS
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:8px">
        <thead>
          <tr style="background:#0F2C59;color:#fff;text-align:center">
            <th style="border:1px solid #1e3a8a;padding:3px;text-align:left;width:70%">VISA TYPE</th>
            <th style="border:1px solid #1e3a8a;padding:3px;width:15%">CAT</th>
            <th style="border:1px solid #1e3a8a;padding:3px;width:15%">QTY</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #e2e8f0;text-align:center">
            <td style="padding:3px;border:1px solid #e2e8f0;text-align:left;font-weight:700">UMRAH VISA</td>
            <td style="padding:3px;border:1px solid #e2e8f0">FT</td>
            <td style="padding:3px;border:1px solid #e2e8f0">${data.adult_pax || 2}</td>
          </tr>
          ${data.child_pax ? `
            <tr style="border-bottom:1px solid #e2e8f0;text-align:center;background:#f8fafc">
              <td style="padding:3px;border:1px solid #e2e8f0;text-align:left;font-weight:700">UMRAH VISA (CHILD)</td>
              <td style="padding:3px;border:1px solid #e2e8f0">FT</td>
              <td style="padding:3px;border:1px solid #e2e8f0">${data.child_pax}</td>
            </tr>` : ''}
          ${data.infant_pax ? `
            <tr style="border-bottom:1px solid #e2e8f0;text-align:center;background:#f8fafc">
              <td style="padding:3px;border:1px solid #e2e8f0;text-align:left;font-weight:700">UMRAH VISA (INFANT)</td>
              <td style="padding:3px;border:1px solid #e2e8f0">FT</td>
              <td style="padding:3px;border:1px solid #e2e8f0">${data.infant_pax}</td>
            </tr>` : ''}
        </tbody>
      </table>

      <!-- Right-Aligned Price Box -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
        <div style="border:1.5px solid #0F2C59;border-radius:6px;padding:6px 14px;background:#f8fafc;min-width:240px;font-size:11px">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <span style="font-weight:700;color:#334155">Adult Per Pax:</span>
            <b style="color:#0F2C59;font-size:12px">PKR ${fmtNum(calcRes.adultPerPax || 0)}</b>
          </div>
          ${data.child_pax ? `
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <span style="font-weight:700;color:#334155">Child Per Pax:</span>
              <b style="color:#0F2C59;font-size:12px">PKR ${fmtNum(calcRes.childPerPax || 0)}</b>
            </div>` : ''}
          ${data.infant_pax ? `
            <div style="display:flex;justify-content:space-between">
              <span style="font-weight:700;color:#334155">Infant Per Pax:</span>
              <b style="color:#DC2626;font-size:12px">PKR ${fmtNum(calcRes.infantPerPax || 0)}</b>
            </div>` : ''}
        </div>
      </div>

      <!-- Footer Notes -->
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:8px;color:#64748b;margin-bottom:4px">
        <div>ℹ️ Note: All Rates are Subject to availability & May change without Prior Notice</div>
        <div>Developed by Shahzaman</div>
      </div>

      <!-- Bottom Thank You Banner -->
      <div style="background:#0F2C59;color:#ffffff;text-align:center;padding:5px;border-radius:4px;font-size:10px;font-weight:800;letter-spacing:1px">
        ✈️ Thank you for choosing ${esc(compName)} ✈️
      </div>

    </div>

    <!-- PAGE 2: TERMS & CONDITIONS (Exact Match) -->
    <div class="pp pp-single" style="margin-top:24px;font-family:'Segoe UI',Arial,sans-serif">
      <div style="background:#EA580C;padding:8px 12px;border-radius:4px;text-align:center;color:#ffffff;font-size:13px;font-weight:900;letter-spacing:2px;margin-bottom:8px">
        TERMS & CONDITIONS
      </div>

      <div style="text-align:center;font-family:'Jameel Noori Nastaleeq','Noto Nastaliq Urdu','Segoe UI',serif;direction:rtl;font-size:13.5px;color:#334155;margin:10px 0 14px">
        آپ انگریزی نہیں پڑھ سکتے یا نہیں سمجھ سکتے تو آپ ہمارے نمائندے سے مشورہ کر سکتے ہیں، وہ آپ کے لیے پڑھے گا۔
      </div>

      <div style="text-align:center;font-weight:800;font-size:13px;color:#9a3412;margin-bottom:14px">
        Travel Service Agreement
      </div>

      ${branch.terms_text || branch.disclaimer_text ? `
        <div style="font-size:9.5px;color:#334155;line-height:1.55;margin-bottom:12px;padding:8px;border:1px solid #fed7aa;border-radius:5px;background:#fff7ed">
          ${branch.terms_text ? `<div style="white-space:pre-line;margin-bottom:${branch.disclaimer_text ? '6px' : '0'}">${esc(branch.terms_text)}</div>` : ''}
          ${branch.disclaimer_text ? `<div style="white-space:pre-line">${esc(branch.disclaimer_text)}</div>` : ''}
        </div>` : ''}

      <div style="font-size:9.5px;color:#334155;line-height:1.5">
        <div style="margin-bottom:7px">
          <b>1. Services Provided</b><br>
          ${esc(compName)} provides travel booking services including flights, hotels, visas, transport, and other travel-related services.
        </div>
        <div style="margin-bottom:7px">
          <b>2. Client Responsibilities</b><br>
          The client is responsible for providing accurate documents and personal information. Any errors may result in additional charges.
        </div>
        <div style="margin-bottom:7px">
          <b>3. Visa & Immigration</b><br>
          Visa approval or rejection is solely at the discretion of the relevant embassy or immigration authorities.
        </div>
        <div style="margin-bottom:7px">
          <b>4. Third-Party Services</b><br>
          ${esc(compName)} acts only as a booking agent and is not responsible for the actions or services of airlines, hotels, transport providers, or other third parties.
        </div>
        <div style="margin-bottom:7px">
          <b>5. Payment Policy</b><br>
          Only payments made to the official ${esc(compName)} bank account are accepted. Payments made to any personal account will not be considered valid.
        </div>
        <div style="margin-bottom:7px">
          <b>6. Flight Changes</b><br>
          ${esc(compName)} is not responsible for flight delays, cancellations, rescheduling, missed connections, or baggage issues caused by the airline.
        </div>
        <div style="margin-bottom:7px">
          <b>7. Hotel Changes</b><br>
          Hotel room allocation, early check-in, late check-out, or operational changes are subject to hotel policies and availability.
        </div>
        <div style="margin-bottom:7px">
          <b>8. Cancellation & Refund</b><br>
          Refunds and cancellations are subject to the airline, hotel, visa provider, or supplier's policies.
        </div>
        <div style="margin-bottom:7px">
          <b>9. Force Majeure</b><br>
          ${esc(compName)} is not liable for delays or cancellations due to weather, natural disasters, government restrictions, strikes, or other circumstances beyond its control.
        </div>
        <div style="margin-bottom:7px">
          <b>10. Acceptance</b><br>
          Payment for any booking confirms that the client has read and accepted these Terms & Conditions.
        </div>
        <div>
          <b>11. Timely Payment</b><br>
          The Client must make payment within the given time. Any increase in airfare, hotel, visa, transport, or other travel costs due to delayed payment will be borne by the Client.
        </div>
      </div>
    </div>`;
}

function generateProposalQrCode(data) {
  const targets = ['proposalHeaderQrBox', 'proposalQrCode'];
  targets.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    try {
      if (typeof QRCode !== 'undefined') {
        const url = window.location.origin + '/?inv=' + encodeURIComponent(data.invoice_no || 'DRAFT');
        new QRCode(el, {
          text: url,
          width: 85,
          height: 85,
          colorDark: '#1F4AA8',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      }
    } catch (e) { console.warn('QR code generation error', e); }
  });
}

function triggerProposalPrint() {
  const container = document.getElementById('proposalPreviewBody');
  if (!container) return;
  const proposalStatus = _activeProposalData?.status || 'draft';
  const proposalMarkup = `<div class="proposal-print-status"><span>QUOTATION STATUS</span><strong>${esc(proposalStatus.replace('_', ' ').toUpperCase())}</strong></div>${container.innerHTML}`;

  const frame = document.getElementById('printFrame') || document.createElement('iframe');
  frame.id = 'printFrame';
  frame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;';
  if (!document.getElementById('printFrame')) document.body.appendChild(frame);

  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${document.title || 'Quotation Proposal'}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Outfit:wght@400;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 0; }
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: #fff; font-family: 'Segoe UI', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .pp { background: #fff; color: #0f172a; padding: 6mm 9mm 9mm; font-size: 9.5px; width: 210mm; max-width: 210mm; min-height: 297mm; margin: 0 auto; display: flex; flex-direction: column; position: relative; overflow: hidden; }
          .pp .hdr { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 2px solid var(--brand, #1F4AA8); }
          .pp .hdr .logo-wrap { width: 38mm; height: 38mm; display: flex; align-items: center; justify-content: center; }
          .pp .hdr .logo-wrap img { width: 100%; height: 100%; object-fit: contain; }
          .pp .hdr .logo-fb { width: 100%; height: 100%; background: var(--brand, #1F4AA8); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 42px; font-weight: 800; }
          .pp .hdr .co-info { text-align: center; }
          .pp .hdr .co-info h1 { font-size: 20px; font-weight: 800; color: var(--brand, #1F4AA8); margin: 0; line-height: 1.15; letter-spacing: .4px; }
          .pp .hdr .co-info .lic { font-size: 9px; color: #0f172a; font-weight: 800; letter-spacing: 1px; margin-top: 3px; }
          .pp .hdr .co-info .addr-top { font-size: 8.5px; color: #1e293b; font-weight: 800; margin-top: 3px; line-height: 1.3; }
          .pp .hdr .co-info .addr-bot { font-size: 7.5px; color: #475569; font-weight: 700; margin-top: 1px; }
          .pp .hdr .co-info .co-contact { font-size: 8.5px; font-weight: 700; color: #334155; margin-top: 3px; }
          .pp .hdr-qr { width: 38mm; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 2px; }
          .pp .hdr-qr .pp-qr-box { width: 27mm; height: 27mm; border: 1px solid #dbe2ea; border-radius: 4px; background: #fff; overflow: hidden; display: flex; align-items: center; justify-content: center; }
          .pp .hdr-qr .pp-qr-box img { width: 27mm; height: 27mm; display: block; }
          .pp .hdr-qr .hq-cap { width: 27mm; text-align: center; font-size: 7.5px; font-weight: 800; letter-spacing: 1.2px; color: #0f172a; }
          .pp .title { text-align: center; padding: 7px 6px; font-size: 13px; font-weight: 800; letter-spacing: 3px; color: #fff; background: linear-gradient(135deg, var(--brand, #1F4AA8), #1e3a8a); margin-bottom: 8px; border-radius: 8px; border-bottom: 3px solid #f59e0b; }
          .pp .icards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px; }
          .pp .icard { border: 1px solid #dbe2ea; background: linear-gradient(180deg, #fff, #F3F6FB); border-radius: 8px; padding: 5px 4px 4px; text-align: center; border-top: 2px solid var(--brand, #1F4AA8); }
          .pp .icard .ic-ico { font-size: 12px; color: var(--brand, #1F4AA8); margin-bottom: 1px; }
          .pp .icard .ic-lbl { font-size: 7px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 1px; }
          .pp .icard .ic-val { color: var(--brand, #1F4AA8); font-weight: 800; font-size: 9.5px; line-height: 1.2; }
          .pp .cinfo { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 18px; background: #F5F7FA; border: 1px solid #dbe2ea; border-left: 3px solid var(--brand, #1F4AA8); border-radius: 8px; padding: 6px 12px; margin-bottom: 8px; }
          .pp .cinfo .ci-item { display: flex; gap: 6px; font-size: 9px; padding: 1.5px 0; align-items: baseline; }
          .pp .cinfo .ci-item b { font-weight: 700; color: #334155; min-width: 65px; display: inline-block; }
          .pp .cinfo .ci-item span { color: #0f172a; font-weight: 700; }
          .pp .sec { display: flex; align-items: center; height: 21px; color: #fff; font-weight: 800; padding: 0 8px; font-size: 8.5px; margin: 6px 0 4px; background: linear-gradient(135deg, var(--brand, #1F4AA8), #1e3a8a); border-radius: 5px; letter-spacing: .4px; text-transform: uppercase; }
          .pp .sec .ic { font-size: 9.5px; margin-right: 4px; }
          .pp table { border-collapse: collapse; width: 100%; margin-bottom: 5px; font-size: 8px; }
          .pp th { background: var(--brand, #1F4AA8); color: #fff; padding: 3px 2px; font-size: 7px; border: 1px solid var(--brand, #1F4AA8); text-transform: uppercase; font-weight: 800; text-align: center; }
          .pp td { padding: 3px 2px; font-size: 8px; border: 1px solid #dbe2ea; background: #fff; color: #0f172a; text-align: center; }
          .pp td.flt-time { font-weight: 800; color: var(--brand, #1F4AA8); font-family: monospace; }
          .pp td.sec-cell { font-weight: 800; text-transform: uppercase; }
          .pp tr:nth-child(even) td { background: #f8fafc; }
          .pp .hotel-boxes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; margin-bottom: 6px; width: 100%; }
          .pp .hotel-boxes.hotel-count-1 { grid-template-columns: 1fr; }
          .pp .hotel-boxes.hotel-count-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .pp .hotel-boxes.hotel-count-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .pp .h-box { display: flex; flex-direction: row; align-items: stretch; min-height: 26mm; height: 26mm; border: 1px solid #dbe2ea; border-radius: 8px; overflow: hidden; background: #fff; box-shadow: 0 1px 3px rgba(15,23,42,.07); }
          .pp .h-photo { flex: 0 0 26mm; width: 26mm; min-width: 26mm; height: 26mm; background: #eef1f5; overflow: hidden; display: flex; align-items: center; justify-content: center; }
          .pp .h-photo img { width: 100%; height: 100%; object-fit: cover; }
          .pp .h-photo-ph { flex: 0 0 26mm; width: 26mm; height: 26mm; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #94a3b8; background: #eef1f5; }
          .pp .h-info { flex: 1; padding: 4px 6px; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; }
          .pp .h-box .h-lbl { display: flex; align-items: center; justify-content: space-between; font-weight: 800; font-size: 7px; color: var(--brand, #1F4AA8); text-transform: uppercase; background: #eef2f9; border-radius: 4px; padding: 1.5px 4px; margin-bottom: 2px; }
          .pp .h-box .h-pin { text-decoration: none; font-size: 11px; }
          .pp .h-box .h-nm { font-weight: 800; font-size: 8.8px; color: #0f172a; margin-bottom: 2px; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .pp .h-box .h-dt { font-size: 7.2px; color: #334155; line-height: 1.35; display: grid; grid-template-columns: 1fr 1fr; gap: 1px 4px; }
          .pp .h-box .h-dt b { color: #64748b; font-weight: 700; }
          .pp .summary-wrap { display: flex; justify-content: flex-end; margin: 6px 0 4px; }
          .pp .summary-box { border: 1.5px solid var(--brand, #1F4AA8); border-radius: 8px; overflow: hidden; min-width: 65mm; }
          .pp .sum-row { display: flex; justify-content: space-between; gap: 10px; padding: 4px 10px; font-size: 9px; font-weight: 700; background: #F5F7FA; }
          .pp .sum-row:not(:last-child) { border-bottom: 1px solid #dbe2ea; }
          .pp .sum-row b { color: var(--brand, #1F4AA8); font-size: 10.5px; font-weight: 800; }
          .pp .sum-row.inf b { color: #c2410c; }
          .pp .ftr2 { padding-top: 5px; border-top: 1px solid #dbe2ea; display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: auto; }
          .pp .ftr2-note { font-size: 7.2px; color: #64748b; }
          .pp .ftr2-dev { font-size: 7.2px; color: #94a3b8; font-weight: 600; }
          .pp .thankbar { margin-top: 5px; background: linear-gradient(135deg, var(--brand, #1F4AA8), #1e3a8a); color: #fff; text-align: center; padding: 5px; border-radius: 6px; font-style: italic; font-size: 8.5px; letter-spacing: .5px; border-top: 2px solid #f59e0b; }
          .pp.instr-page { page-break-before: always; break-before: page; }
          .pp .instr { margin: 0; padding: 10px 14px; background: #fffbeb; border: 1px solid #fde68a; border-left: 3px solid #f59e0b; border-radius: 4px; font-size: 8.5px; color: #78350f; line-height: 1.6; }
          .pp .instr .instr-title { font-weight: 800; font-size: 12px; margin-bottom: 6px; text-align: center; padding: 6px; background: #f59e0b; color: #fff; border-radius: 3px; letter-spacing: 1px; }
          .pp .instr .urdu-line { direction: rtl; text-align: right; font-family: 'Noto Nastaliq Urdu', 'Segoe UI', Arial, sans-serif; font-size: 11.5px; line-height: 2.1; margin-bottom: 6px; padding: 4px 6px; color: #78350f; font-weight: 600; }
          .proposal-print-status { width: 210mm; max-width: 210mm; margin: 0 auto 4mm; padding: 6px 10px; display: flex; justify-content: space-between; border: 1px solid #bfdbfe; border-left: 4px solid #1F4AA8; border-radius: 6px; background: #eff6ff; color: #1e3a8a; font-size: 8px; font-weight: 800; letter-spacing: .08em; }
          .proposal-print-status strong { font-size: 9px; }
        </style>
      </head>
      <body>
        ${proposalMarkup}
      </body>
    </html>`);
  doc.close();

  // Wait for images and fonts to be ready
  const printWhenReady = () => {
    const fontWait = doc.fonts ? doc.fonts.ready : Promise.resolve();
    const images = Array.from(doc.images || []);
    const imgWait = Promise.all(images.map(img => {
      if (img.complete && img.naturalWidth > 0) {
        return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
      }
      return new Promise(res => { img.onload = img.onerror = res; setTimeout(res, 2500); });
    }));
    Promise.all([fontWait, imgWait]).then(() => {
      setTimeout(() => {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      }, 300);
    });
  };

  if (frame.contentWindow.document.readyState === 'complete') {
    printWhenReady();
  } else {
    frame.onload = printWhenReady;
  }
}

function triggerCostingPrint() {
  const container = document.getElementById('costingSheetBody');
  if (!container) return;

  const frame = document.getElementById('printFrame') || document.createElement('iframe');
  frame.id = 'printFrame';
  frame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;';
  if (!document.getElementById('printFrame')) document.body.appendChild(frame);

  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${document.title || 'Internal Costing Sheet'}</title>
        <style>
          @page { size: A4; margin: 8mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; }
          body { background: #fff; color: #0f172a; font-size: 8.5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .cost-pg { width: 100%; max-width: 210mm; margin: 0 auto; padding: 4mm 6mm; }
          .cost-hdr { background: #1e3a8a; color: #fff; padding: 6px 10px; border-radius: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
          .cost-hdr h1 { font-size: 12px; font-weight: 800; letter-spacing: 1px; color: #fff; }
          .cost-hdr .sub { font-size: 7.5px; opacity: .88; color: #fff; }
          .cost-meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-bottom: 8px; }
          .cost-meta .m-item { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 3px 6px; font-size: 8px; }
          .cost-meta .m-item b { display: block; font-size: 6.8px; color: #64748b; text-transform: uppercase; margin-bottom: 1px; }
          .cost-sec-title { background: #334155; color: #fff; padding: 3px 6px; font-size: 7.5px; font-weight: 700; text-transform: uppercase; margin: 6px 0 3px; border-radius: 3px; }
          .cost-tbl { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 7.8px; }
          .cost-tbl th { background: #e2e8f0; color: #334155; padding: 2px 4px; font-weight: 700; text-transform: uppercase; border: 1px solid #cbd5e1; text-align: center; }
          .cost-tbl td { padding: 2px 4px; border: 1px solid #e2e8f0; text-align: center; }
          .cost-tbl td.lbl { text-align: left; font-weight: 600; background: #f8fafc; }
          .cost-tbl tr.total-row td { background: #eff6ff !important; font-weight: 800; color: #1e40af; border-top: 1.5px solid #1e40af; }
        </style>
      </head>
      <body>
        ${container.innerHTML}
      </body>
    </html>`);
  doc.close();

  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }, 350);
}

function shareWhatsAppPvt() {
  const data = collectQuotationData();
  if (!data) { toast('Enter client name first', 'warn'); return; }

  const calcs = pCalc(true);
  const optKeys = Object.keys(data.options);
  let text = `🕌 *PAK GLOBE TRAVELS* 🕌\n*CUSTOMIZED UMRAH PROPOSAL*\n`;
  text += `Invoice: ${data.invoice_no || 'DRAFT'}\n`;
  text += `Client: ${data.client_name} (${data.adult_pax} Adults${data.child_pax ? ', ' + data.child_pax + ' Children' : ''})\n`;
  text += `Travel: ${data.travel_dates || 'As per itinerary'}\n\n`;

  optKeys.forEach(L => {
    const o = data.options[L];
    const c = calcs[L];
    text += `*OPTION ${L}:*\n`;
    (o.hotels || []).forEach(h => {
      text += `• ${h.city.toUpperCase()}: ${h.name} (${h.roomType}, ${h.nights} Nts, ${h.distance})\n`;
    });
    (o.flights || []).forEach(f => {
      text += `• Flight: ${f.airline} (${f.sec})\n`;
    });
    text += `💰 *Adult Per Person: PKR ${fmtNum(c.adultPerPax)}*\n`;
    if (o.childPax > 0) text += `💰 *Child Per Person: PKR ${fmtNum(c.childPerPax)}*\n`;
    text += `Includes: ${data.includes}\n\n`;
  });

  text += `Contact us to confirm: 0310-0376111`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function shareCurrentProposalWhatsApp() {
  if (_activeProposalType === 'group') shareWhatsAppGroupData(_activeProposalData);
  else shareWhatsAppPvt();
}

function printCostingPvt() {
  const data = collectQuotationData();
  if (!data) { toast('Please enter client name first', 'warn'); return; }
  const title = document.getElementById('costingModalTitle');
  if (title) title.textContent = 'Internal Private Costing Breakdown Sheet';
  const branchId = G.user?.branchId || G.user?.branch_id;
  const branch = G.branches.find(b => b.id === branchId) || { name: 'PAK GLOBE TRAVELS' };
  const html = renderCostingA4Html(data, branch);
  const container = document.getElementById('costingSheetBody');
  if (container) container.innerHTML = html;
  openModal('costingModal');
}

function triggerCostingPrint() {
  const content = document.getElementById('costingSheetBody');
  if (!content) return;
  const frame = document.getElementById('printFrame');
  if (!frame) return;
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(`<html><body style="font-family:monospace;padding:20px">${content.innerHTML}</body></html>`);
  doc.close();
  setTimeout(() => { frame.contentWindow.print(); }, 300);
}

// ═══════════════════════════════════════════════════════════
//  PHASE 3: GROUP UMRAH COSTING ENGINE
// ═══════════════════════════════════════════════════════════
let _editingGrpId = null;
let _currentGroupData = null;

function pgGroup(force = false) {
  const pg = document.getElementById('grp');
  if (!pg) return;
  if (!force && pg.dataset.initialized === 'true') return;

  pg.classList.add('costing-page', 'costing-group');
  _editingGrpId = null;
  _currentGroupData = null;
  const roeDef = G.settings?.default_roe || 78;

  pg.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title"><i class="bi bi-people-fill me-2" style="color:var(--sec)"></i>Group Costing</h1>
        <span class="page-sub">Seat proration, Double, Triple, Quad, Quint room-tier costing matrix</span>
      </div>
      <div class="page-actions flex-wrap">
        <button type="button" class="btn-ghost btn-sm" onclick="newGroupCosting()"><i class="bi bi-plus-lg me-1"></i>New</button>
        <button type="button" class="btn-ghost btn-sm" onclick="loadGroupDraft()"><i class="bi bi-folder2-open me-1"></i>Load Draft</button>
        <button type="button" class="btn-ghost btn-sm" onclick="gSaveDraft()"><i class="bi bi-bookmark me-1"></i>Save Draft</button>
        <button type="button" class="btn-ghost btn-sm" onclick="gPreview()"><i class="bi bi-eye me-1"></i>Preview</button>
        <button type="button" class="btn-ghost btn-sm" style="color:#25D366;border-color:rgba(37,211,102,0.4)" onclick="shareWhatsAppGrp()"><i class="bi bi-whatsapp me-1"></i>WhatsApp</button>
        <button type="button" class="btn-ghost btn-sm" style="color:#7C3AED;border-color:rgba(124,58,237,0.4)" onclick="printCostingGrp()"><i class="bi bi-calculator me-1"></i>Costing Sheet</button>
        <button type="button" class="btn-sec btn-sm" id="gSaveBtn" onclick="gSave()"><i class="bi bi-check2-circle me-1"></i>Save & Print</button>
      </div>
    </div>

    <!-- Group Master Info -->
    <div class="sec-box mb-3">
      <div class="row g-3">
        <div class="col-md-3">
          <label class="form-label">Group / Client Name <span style="color:var(--err)">*</span></label>
          <input class="form-inp" id="gN" placeholder="e.g. November Group Charter 40 PAX">
        </div>
        <div class="col-md-3">
          <label class="form-label">Contact / WhatsApp</label>
          <input class="form-inp" id="gPh" placeholder="0300-1234567">
        </div>
        <div class="col-md-3">
          <label class="form-label">Travel Dates</label>
          <input class="form-inp" id="gDt" placeholder="e.g. 20 Nov - 05 Dec">
        </div>
        <div class="col-md-3">
          <label class="form-label">Total Group PAX</label>
          <input class="form-inp" type="number" id="gPax" min="1" value="40" oninput="gCalc()">
        </div>
        <div class="col-md-6">
          <label class="form-label">Package Includes</label>
          <input class="form-inp" id="gInc" value="FLIGHT, HOTEL, VISA, TRANSPORT">
        </div>
        <div class="col-md-6">
          <label class="form-label">Package Heading / Banner</label>
          <input class="form-inp" id="gHd" value="SUPER LUXURY UMRAH GROUP">
        </div>
        <div class="col-md-3">
          <label class="form-label">Airline</label>
          <select class="form-inp" id="gAir">
            ${catalogOptions('airlines', AIRLINE_OPTIONS).map(a => `<option value="${escAttr(a)}">${esc(a)}</option>`).join('')}
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label">Ticket / Person PKR</label>
          <input class="form-inp" type="number" id="gTk" value="185000" oninput="gCalc()">
        </div>
        <div class="col-md-3">
          <label class="form-label">Total Days</label>
          <input class="form-inp" type="number" id="gDays" value="15">
        </div>
        <div class="col-12">
          <label class="form-label">Additional Note</label>
          <textarea class="form-inp" id="gNote" rows="2" placeholder="Special requirements or client-facing notes"></textarea>
        </div>
      </div>
    </div>

    <!-- Hotels Table -->
    <div class="sec-box mb-3">
      <div class="sec-box-title">
        <span>🏨 Group Hotels</span>
        <button type="button" class="btn-ghost btn-sm" onclick="addGHRow()"><i class="bi bi-plus-lg me-1"></i>Add Hotel</button>
      </div>
      <div class="calc-table-wrap">
        <table class="calc-tbl" id="gHTable" style="table-layout:fixed;width:100%">
          <thead>
            <tr>
              <th style="width:7%">City</th>
              <th style="width:23%">Hotel Name</th>
              <th style="width:8%">Room</th>
              <th style="width:5%">Meal</th>
              <th style="width:7%">Check-In</th>
              <th style="width:7%">Check-Out</th>
              <th style="width:7%">SAR</th>
              <th style="width:4%">Qty</th>
              <th style="width:5%">Dist</th>
              <th style="width:4%">Ngt</th>
              <th style="width:5%">ROE</th>
              <th style="width:15%">Total PKR</th>
              <th style="width:3%"></th>
            </tr>
          </thead>
          <tbody id="gHBody">
            ${[0, 1].map(i => `
              <tr id="gHRow_${i}">
                <td style="width:7%">
                  <select class="calc-inp" id="gHCity${i}">
                    <option value="makkah" ${i===0?'selected':''}>Makkah</option>
                    <option value="madina" ${i===1?'selected':''}>Madinah</option>
                    <option value="jeddah">Jeddah</option>
                  </select>
                </td>
                <td style="width:23%"><input class="calc-inp" id="gH${i}" placeholder="Hotel name…" onfocus="setupHotelAutocomplete(this, 'gHCity${i}', 'gHD${i}', 'gHR${i}', 'gHIn${i}', 'gHOut${i}', 'gHRow_${i}', 'gHC${i}', 'gHM${i}')"></td>
                <td style="width:8%"><select class="calc-inp" id="gHC${i}">${catalogOptions('room_types', ROOM_OPTIONS).map(r=>`<option value="${escAttr(r)}">${esc(r)}</option>`).join('')}</select></td>
                <td style="width:5%"><select class="calc-inp" id="gHM${i}">${mealPlanOptions().map(m=>`<option value="${escAttr(m)}">${esc(m)}</option>`).join('')}</select></td>
                <td style="width:7%"><input class="calc-inp" type="date" id="gHIn${i}" onchange="updateGroupHotelDates(${i})"></td>
                <td style="width:7%"><input class="calc-inp" type="date" id="gHOut${i}" onchange="updateGroupHotelDates(${i})"></td>
                <td style="width:7%"><input class="calc-inp text-center" type="number" id="gHR${i}" value="${i===0?850:720}" oninput="gCalc()"></td>
                <td style="width:4%"><input class="calc-inp text-center" type="number" id="gHQ${i}" value="10" oninput="gCalc()"></td>
                <td style="width:5%"><input class="calc-inp text-center" id="gHD${i}" value="100m"></td>
                <td style="width:4%"><input class="calc-inp text-center" type="number" id="gHN${i}" value="7" oninput="gCalc()"></td>
                <td style="width:5%"><input class="calc-inp text-center" type="number" id="gHE${i}" value="${roeDef}" oninput="gCalc()"></td>
                <td style="width:15%" class="calc-inp-ro text-end" id="gHT${i}">0</td>
                <td style="width:3%"><button type="button" class="btn-icon" onclick="removeTableRow('gHRow_${i}')"><i class="bi bi-x"></i></button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Visa & Transport Summary -->
    <div class="row g-3 mb-3">
      <div class="col-md-5">
        <div class="sec-box h-100">
          <div class="sec-box-title"><span>📄 Group Visa</span></div>
          <div class="group-visa-inputs">
            <div>
              <label class="form-label">Visa SAR</label>
              <input class="calc-inp" type="number" id="gVR" value="560" oninput="gCalc()">
            </div>
            <div>
              <label class="form-label">Qty</label>
              <input class="calc-inp" type="number" id="gVQ" value="40" min="0" oninput="this.dataset.manual='1';gCalc()">
            </div>
            <div>
              <label class="form-label">ROE</label>
              <input class="calc-inp" type="number" id="gVE" value="${roeDef}" oninput="gCalc()">
            </div>
            <div>
              <label class="form-label">Per Pax PKR</label>
              <input class="calc-inp calc-inp-ro" id="gVPP" readonly value="PKR 0">
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-7">
        <div class="sec-box h-100">
          <div class="sec-box-title">
            <span>🚗 Group Transport Routes</span>
            <button type="button" class="btn-ghost btn-sm" onclick="addGroupTransportRow()"><i class="bi bi-plus-lg me-1"></i>Add Route</button>
          </div>
          <div class="calc-table-wrap">
            <table class="calc-tbl">
              <thead><tr><th>Sector / Route</th><th>Vehicle</th><th>SAR</th><th>Qty</th><th>ROE</th><th>Total PKR</th><th></th></tr></thead>
              <tbody id="gTBody">${renderGroupTransportRow(0)}</tbody>
            </table>
          </div>
          <div class="text-end mt-2" style="font-weight:800;color:var(--sec)" id="gTT">Total: PKR 0</div>
        </div>
      </div>
    </div>

    <!-- Profit / Person Tier Controls -->
    <div class="sec-box mb-3">
      <div class="sec-box-title"><span>💰 Profit Margin / Person per Room Tier (PKR)</span></div>
      <div class="row g-3">
        <div class="col-3">
          <label class="form-label">Quint (5 Pax)</label>
          <input class="calc-inp" type="number" id="gPQ" value="15000" oninput="gCalc()">
        </div>
        <div class="col-3">
          <label class="form-label">Quad (4 Pax)</label>
          <input class="calc-inp" type="number" id="gPQd" value="15000" oninput="gCalc()">
        </div>
        <div class="col-3">
          <label class="form-label">Triple (3 Pax)</label>
          <input class="calc-inp" type="number" id="gPT" value="15000" oninput="gCalc()">
        </div>
        <div class="col-3">
          <label class="form-label">Double (2 Pax)</label>
          <input class="calc-inp" type="number" id="gPD" value="15000" oninput="gCalc()">
        </div>
      </div>
    </div>

    <!-- Final Room Tier Results Matrix -->
    <div class="sec-box">
      <div class="sec-box-title"><span>📊 Group Package Results Matrix</span></div>
      <div class="table-wrap">
        <table class="tbl text-center">
          <thead>
            <tr>
              <th style="text-align:left">Metric</th>
              <th>QUINT (5 Bed)</th>
              <th>QUAD (4 Bed)</th>
              <th>TRIPLE (3 Bed)</th>
              <th>DOUBLE (2 Bed)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align:left;font-weight:600">Hotel Bed Cost</td>
              <td id="gR5">PKR 0</td><td id="gR4">PKR 0</td><td id="gR3">PKR 0</td><td id="gR2">PKR 0</td>
            </tr>
            <tr>
              <td style="text-align:left;font-weight:600">Net Cost / Pax (Flight + Visa + Trans)</td>
              <td id="gN5">PKR 0</td><td id="gN4">PKR 0</td><td id="gN3">PKR 0</td><td id="gN2">PKR 0</td>
            </tr>
            <tr>
              <td style="text-align:left;font-weight:600">Profit Margin</td>
              <td id="gP5">PKR 15,000</td><td id="gP4">PKR 15,000</td><td id="gP3">PKR 15,000</td><td id="gP2">PKR 15,000</td>
            </tr>
            <tr style="background:rgba(58,148,186,0.12);font-weight:900;font-size:15px;color:var(--pri)">
              <td style="text-align:left;font-weight:900">FINAL SELLING PRICE / PERSON</td>
              <td id="gS5">PKR 0</td><td id="gS4">PKR 0</td><td id="gS3">PKR 0</td><td id="gS2">PKR 0</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>`;

    decorateCostingTables(pg);
    gCalc();
  pg.dataset.initialized = 'true';
}

function renderGroupTransportRow(idx) {
  const roe = G.settings?.default_roe || 78;
  return `
    <tr id="gTRow_${idx}">
      <td><select class="calc-inp" id="gTS${idx}">${catalogOptions('transport_sectors', SECTOR_OPTIONS).map(s => `<option value="${escAttr(s)}">${esc(s)}</option>`).join('')}</select></td>
      <td><select class="calc-inp" id="gTV${idx}" onchange="syncGroupTransportQty(${idx})">${vehicleTypeOptions().map(v => `<option value="${escAttr(v)}">${esc(v)}</option>`).join('')}</select></td>
      <td><input class="calc-inp text-center" type="number" id="gTR${idx}" min="0" placeholder="SAR" oninput="gCalc()"></td>
      <td><input class="calc-inp text-center" type="number" id="gTQ${idx}" min="0" value="1" oninput="gCalc()"></td>
      <td><input class="calc-inp text-center" type="number" id="gTE${idx}" min="0" value="${roe}" oninput="gCalc()"></td>
      <td class="calc-inp-ro text-end" id="gTT${idx}">0</td>
      <td><button type="button" class="btn-icon" onclick="removeTableRow('gTRow_${idx}')" title="Delete route"><i class="bi bi-x"></i></button></td>
    </tr>`;
}

function syncGroupTransportQty(index) {
  const vehicle = document.getElementById(`gTV${index}`)?.value || '';
  const qty = document.getElementById(`gTQ${index}`);
  if (qty && isSharingTransport(vehicle)) {
    qty.value = Math.max(1, n(document.getElementById('gPax')?.value) || 1);
    gCalc();
  }
}

function nextGroupRowIndex(tbody, prefix) {
  const indices = [...(tbody?.querySelectorAll('tr') || [])]
    .map(row => Number((row.id.match(new RegExp(`^${prefix}(\\d+)$`)) || [])[1]))
    .filter(Number.isInteger);
  return indices.length ? Math.max(...indices) + 1 : 0;
}

function addGroupTransportRow() {
  const tbody = document.getElementById('gTBody');
  if (!tbody) return;
  const index = nextGroupRowIndex(tbody, 'gTRow_');
  tbody.insertAdjacentHTML('beforeend', renderGroupTransportRow(index));
  decorateCostingTables(document.getElementById('grp'));
  gCalc();
}

function addGHRow() {
  const tb = document.getElementById('gHBody');
  if (!tb) return;
  const idx = nextGroupRowIndex(tb, 'gHRow_');
  const roe = G.settings?.default_roe || 78;
  const tr = document.createElement('tr');
  tr.id = 'gHRow_' + idx;
  tr.innerHTML = `
    <td style="width:7%">
      <select class="calc-inp" id="gHCity${idx}">
        <option value="makkah">Makkah</option>
        <option value="madina">Madinah</option>
        <option value="jeddah">Jeddah</option>
      </select>
    </td>
    <td style="width:23%"><input class="calc-inp" id="gH${idx}" placeholder="Hotel name…" onfocus="setupHotelAutocomplete(this, 'gHCity${idx}', 'gHD${idx}', 'gHR${idx}', 'gHIn${idx}', 'gHOut${idx}', 'gHRow_${idx}', 'gHC${idx}', 'gHM${idx}')"></td>
    <td style="width:8%"><select class="calc-inp" id="gHC${idx}">${catalogOptions('room_types', ROOM_OPTIONS).map(r=>`<option value="${escAttr(r)}">${esc(r)}</option>`).join('')}</select></td>
    <td style="width:5%"><select class="calc-inp" id="gHM${idx}">${mealPlanOptions().map(m=>`<option value="${escAttr(m)}">${esc(m)}</option>`).join('')}</select></td>
    <td style="width:7%"><input class="calc-inp" type="date" id="gHIn${idx}" onchange="updateGroupHotelDates(${idx})"></td>
    <td style="width:7%"><input class="calc-inp" type="date" id="gHOut${idx}" onchange="updateGroupHotelDates(${idx})"></td>
    <td style="width:7%"><input class="calc-inp text-center" type="number" id="gHR${idx}" value="650" oninput="gCalc()"></td>
    <td style="width:4%"><input class="calc-inp text-center" type="number" id="gHQ${idx}" value="10" oninput="gCalc()"></td>
    <td style="width:5%"><input class="calc-inp text-center" id="gHD${idx}" value="100m"></td>
    <td style="width:4%"><input class="calc-inp text-center" type="number" id="gHN${idx}" value="7" oninput="gCalc()"></td>
    <td style="width:5%"><input class="calc-inp text-center" type="number" id="gHE${idx}" value="${roe}" oninput="gCalc()"></td>
    <td style="width:15%" class="calc-inp-ro text-end" id="gHT${idx}">0</td>
    <td style="width:3%"><button type="button" class="btn-icon" onclick="removeTableRow('gHRow_${idx}')"><i class="bi bi-x"></i></button></td>
  `;
  tb.appendChild(tr);
  decorateCostingTables(document.getElementById('grp'));
  gCalc();
}

function updateGroupHotelDates(index) {
  const checkIn = document.getElementById(`gHIn${index}`);
  const checkOut = document.getElementById(`gHOut${index}`);
  const nights = document.getElementById(`gHN${index}`);
  if (checkIn?.value && checkOut?.value) {
    const diff = (Date.parse(`${checkOut.value}T00:00:00Z`) - Date.parse(`${checkIn.value}T00:00:00Z`)) / 86400000;
    if (diff > 0 && nights) nights.value = diff;
  } else if (checkIn?.value && nights && n(nights.value) > 0 && checkOut && !checkOut.value) {
    const date = new Date(`${checkIn.value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + n(nights.value));
    checkOut.value = date.toISOString().slice(0, 10);
  }
  gCalc();
}

function calculateGroupCosting(options = {}, paxValue) {
  const pax = Math.max(1, n(paxValue) || n(options.groupPax) || 40);
  const visa = options.visa || {};
  const visaQty = Math.max(0, n(visa.qty ?? pax));
  const visaTotal = n(visa.rate) * visaQty * (n(visa.roe) || 78);
  const transports = Array.isArray(options.transports) ? options.transports : [];
  const transportTotal = transports.reduce((sum, route) =>
    sum + n(route.rate) * n(route.qty) * (n(route.roe) || 78), 0);
  const hotels = Array.isArray(options.hotels) ? options.hotels : [];
  const roomCostPerNightStay = hotels.reduce((sum, hotel) =>
    sum + n(hotel.rate) * (n(hotel.nights) || 1) * (n(hotel.roe) || 78), 0);
  const ticketPKR = n(options.ticketPKR ?? options.ticket_pkr);
  const margins = options.margins || {};
  const visaPerPax = visaTotal / pax;
  const transportPerPax = transportTotal / pax;
  const tiers = {};

  [['quint', 5], ['quad', 4], ['triple', 3], ['double', 2]].forEach(([key, capacity]) => {
    const hotelPerPax = Math.round(roomCostPerNightStay / capacity);
    const netPerPax = hotelPerPax + ticketPKR + visaPerPax + transportPerPax;
    const legacyLabel = `selling${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    const legacyPrice = Number(String(options[legacyLabel] || '').replace(/[^\d.-]/g, ''));
    const hasMargin = Object.prototype.hasOwnProperty.call(margins, key);
    const profit = hasMargin ? n(margins[key]) : Number.isFinite(legacyPrice) && legacyPrice > 0
      ? legacyPrice - netPerPax : 15000;
    const sellingPerPax = !hasMargin && Number.isFinite(legacyPrice) && legacyPrice > 0
      ? legacyPrice : netPerPax + profit;
    tiers[key] = {
      capacity, hotelPerPax, ticketPerPax: ticketPKR, visaPerPax,
      transportPerPax, netPerPax, profit, sellingPerPax,
      groupTotal: sellingPerPax * pax
    };
  });
  return { pax, visaTotal, visaPerPax, transportTotal, transportPerPax, tiers };
}

function collectGroupQuotationData() {
  const clientName = document.getElementById('gN')?.value.trim();
  if (!clientName) return null;
  const groupPax = Math.max(1, n(document.getElementById('gPax')?.value) || 40);
  const calculated = gCalc();
  const hotels = [...document.querySelectorAll('#gHBody tr')].map(row => ({
    city: row.querySelector('select[id^="gHCity"]')?.value || 'makkah',
    name: row.querySelector('input[id^="gH"]:not([id^="gHR"])')?.value.trim() || '',
    roomType: row.querySelector('select[id^="gHC"]')?.value || 'DOUBLE',
    meal: row.querySelector('select[id^="gHM"]')?.value || 'RO',
    checkIn: row.querySelector('input[id^="gHIn"]')?.value || '',
    checkOut: row.querySelector('input[id^="gHOut"]')?.value || '',
    rate: n(row.querySelector('input[id^="gHR"]')?.value),
    qty: n(row.querySelector('input[id^="gHQ"]')?.value) || 1,
    distance: row.querySelector('input[id^="gHD"]')?.value || '',
    nights: n(row.querySelector('input[id^="gHN"]')?.value) || 1,
    roe: n(row.querySelector('input[id^="gHE"]')?.value) || 78
  })).filter(hotel => hotel.name || hotel.rate > 0);
  const transports = [...document.querySelectorAll('#gTBody tr')].map(row => ({
    sector: row.querySelector('select[id^="gTS"]')?.value || '',
    vehicle: row.querySelector('select[id^="gTV"]')?.value || '',
    date: row.querySelector('input[id^="gTD"]')?.value || '',
    rate: n(row.querySelector('input[id^="gTR"]')?.value),
    qty: n(row.querySelector('input[id^="gTQ"]')?.value) || 0,
    roe: n(row.querySelector('input[id^="gTE"]')?.value) || 78
  })).filter(route => route.sector && route.rate > 0);
  const options = {
    schemaVersion: 2,
    heading: document.getElementById('gHd')?.value.trim() || 'UMRAH GROUP PACKAGE',
    airline: document.getElementById('gAir')?.value || '',
    ticketPKR: n(document.getElementById('gTk')?.value),
    totalDays: n(document.getElementById('gDays')?.value),
    groupPax,
    note: document.getElementById('gNote')?.value.trim() || '',
    visa: {
      rate: n(document.getElementById('gVR')?.value),
      qty: n(document.getElementById('gVQ')?.value),
      roe: n(document.getElementById('gVE')?.value) || 78
    },
    hotels,
    transports,
    margins: {
      quint: n(document.getElementById('gPQ')?.value),
      quad: n(document.getElementById('gPQd')?.value),
      triple: n(document.getElementById('gPT')?.value),
      double: n(document.getElementById('gPD')?.value)
    },
    tierResults: calculated.tiers,
    sellingDouble: 'PKR ' + fmtNum(calculated.tiers.double.sellingPerPax),
    sellingTriple: 'PKR ' + fmtNum(calculated.tiers.triple.sellingPerPax),
    sellingQuad: 'PKR ' + fmtNum(calculated.tiers.quad.sellingPerPax),
    sellingQuint: 'PKR ' + fmtNum(calculated.tiers.quint.sellingPerPax)
  };
  return {
    type: 'group',
    client_name: clientName,
    contact_no: document.getElementById('gPh')?.value.trim() || '',
    travel_dates: document.getElementById('gDt')?.value.trim() || '',
    includes: document.getElementById('gInc')?.value.trim() || '',
    adult_pax: groupPax,
    child_pax: 0,
    infant_pax: 0,
    options
  };
}

function gCalc() {
  const groupPax = Math.max(1, n(document.getElementById('gPax')?.value) || 40);
  const visaQty = document.getElementById('gVQ');
  if (visaQty && !visaQty.dataset.manual) visaQty.value = groupPax;
  document.querySelectorAll('#gTBody tr').forEach(row => {
    const vehicle = row.querySelector('select[id^="gTV"]')?.value || '';
    const qty = row.querySelector('input[id^="gTQ"]');
    if (qty && isSharingTransport(vehicle)) qty.value = groupPax;
  });

  const hotels = [...document.querySelectorAll('#gHBody tr')].map(row => {
    const hotel = {
      rate: n(row.querySelector('input[id^="gHR"]')?.value),
      qty: n(row.querySelector('input[id^="gHQ"]')?.value) || 1,
      nights: n(row.querySelector('input[id^="gHN"]')?.value) || 1,
      roe: n(row.querySelector('input[id^="gHE"]')?.value) || 78
    };
    const totalCell = row.querySelector('[id^="gHT"]');
    if (totalCell) totalCell.textContent = fmtNum(hotel.rate * hotel.qty * hotel.nights * hotel.roe);
    return hotel;
  });
  const transports = [...document.querySelectorAll('#gTBody tr')].map(row => {
    const route = {
      rate: n(row.querySelector('input[id^="gTR"]')?.value),
      date: row.querySelector('input[id^="gTD"]')?.value || '',
      qty: n(row.querySelector('input[id^="gTQ"]')?.value) || 0,
      roe: n(row.querySelector('input[id^="gTE"]')?.value) || 78
    };
    const totalCell = row.querySelector('[id^="gTT"]');
    if (totalCell) totalCell.textContent = fmtNum(route.rate * route.qty * route.roe);
    return route;
  });
  const options = {
    groupPax,
    ticketPKR: n(document.getElementById('gTk')?.value),
    visa: {
      rate: n(document.getElementById('gVR')?.value),
      qty: n(visaQty?.value),
      roe: n(document.getElementById('gVE')?.value) || 78
    },
    hotels,
    transports,
    margins: {
      quint: n(document.getElementById('gPQ')?.value),
      quad: n(document.getElementById('gPQd')?.value),
      triple: n(document.getElementById('gPT')?.value),
      double: n(document.getElementById('gPD')?.value)
    }
  };
  const result = calculateGroupCosting(options, groupPax);
  const visaCell = document.getElementById('gVPP');
  if (visaCell) visaCell.value = 'PKR ' + fmtNum(result.visaPerPax);
  const transportCell = document.getElementById('gTT');
  if (transportCell) transportCell.textContent = 'Total: PKR ' + fmtNum(result.transportTotal);

  Object.entries({ quint: 5, quad: 4, triple: 3, double: 2 }).forEach(([key, capacity]) => {
    const tier = result.tiers[key];
    const suffix = String(capacity);
    const roomCell = document.getElementById(`gR${suffix}`);
    const netCell = document.getElementById(`gN${suffix}`);
    const profitCell = document.getElementById(`gP${suffix}`);
    const sellingCell = document.getElementById(`gS${suffix}`);
    if (roomCell) roomCell.textContent = 'PKR ' + fmtNum(tier.hotelPerPax);
    if (netCell) netCell.textContent = 'PKR ' + fmtNum(tier.netPerPax);
    if (profitCell) profitCell.textContent = 'PKR ' + fmtNum(tier.profit);
    if (sellingCell) sellingCell.textContent = 'PKR ' + fmtNum(tier.sellingPerPax);
  });
  return result;
}

function parseQuotationOptions(options) {
  if (!options) return {};
  if (typeof options !== 'string') {
    return typeof options === 'object' && !Array.isArray(options) ? options : {};
  }
  try {
    const parsed = JSON.parse(options);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    throw new Error('Quotation contains invalid costing data: ' + err.message);
  }
}

function restoreGroupQuotation(quotation, isDraft = false) {
  const options = parseQuotationOptions(quotation.options);
  const setValue = (id, value) => {
    const element = document.getElementById(id);
    if (element && value !== undefined && value !== null) element.value = value;
  };
  const pax = n(quotation.adult_pax) || n(options.groupPax) || 40;
  setValue('gN', quotation.client_name || '');
  setValue('gPh', quotation.contact_no || '');
  setValue('gDt', quotation.travel_dates || '');
  setValue('gInc', quotation.includes || 'FLIGHT, HOTEL, VISA, TRANSPORT');
  setValue('gPax', pax);
  setValue('gHd', options.heading || 'SUPER LUXURY UMRAH GROUP');
  setValue('gAir', options.airline || '');
  setValue('gTk', options.ticketPKR ?? options.ticket_pkr ?? 0);
  setValue('gDays', options.totalDays ?? options.total_days ?? 15);
  setValue('gNote', options.note || options.notes || '');
  setValue('gVR', options.visa?.rate ?? options.visa?.rate_sar ?? 560);
  setValue('gVQ', options.visa?.qty ?? pax);
  setValue('gVE', options.visa?.roe ?? G.settings?.default_roe ?? 78);
  const visaQty = document.getElementById('gVQ');
  if (visaQty) visaQty.dataset.manual = options.visa?.qty != null ? '1' : '';
  const margins = options.margins || {};
  setValue('gPQ', margins.quint ?? 15000);
  setValue('gPQd', margins.quad ?? 15000);
  setValue('gPT', margins.triple ?? 15000);
  setValue('gPD', margins.double ?? 15000);

  const hotels = Array.isArray(options.hotels) ? options.hotels : [];
  const hotelBody = document.getElementById('gHBody');
  if (hotelBody) {
    hotelBody.innerHTML = '';
    for (let i = 0; i < Math.max(1, hotels.length); i++) addGHRow();
    [...hotelBody.querySelectorAll('tr')].forEach((row, i) => {
      const hotel = hotels[i];
      const idx = row.id.match(/_(\d+)$/)?.[1];
      if (!hotel) {
        const rateInput = row.querySelector(`input[id="gHR${idx}"]`);
        if (rateInput) rateInput.value = '';
        return;
      }
      const values = {
        [`gHCity${idx}`]: hotel.city || 'makkah',
        [`gH${idx}`]: hotel.name || '',
        [`gHC${idx}`]: hotel.roomType || hotel.room_type || 'DOUBLE',
        [`gHM${idx}`]: hotel.meal || 'RO',
        [`gHIn${idx}`]: hotel.checkIn || hotel.check_in || '',
        [`gHOut${idx}`]: hotel.checkOut || hotel.check_out || '',
        [`gHR${idx}`]: hotel.rate ?? hotel.rate_sar ?? '',
        [`gHQ${idx}`]: hotel.qty ?? 1,
        [`gHD${idx}`]: hotel.distance || '',
        [`gHN${idx}`]: hotel.nights ?? 1,
        [`gHE${idx}`]: hotel.roe ?? G.settings?.default_roe ?? 78
      };
      Object.entries(values).forEach(([id, value]) => setValue(id, value));
    });
  }

  const transports = Array.isArray(options.transports) ? options.transports : [];
  const transportBody = document.getElementById('gTBody');
  if (transportBody) {
    transportBody.innerHTML = '';
    for (let i = 0; i < Math.max(1, transports.length); i++) {
      transportBody.insertAdjacentHTML('beforeend', renderGroupTransportRow(i));
    }
    [...transportBody.querySelectorAll('tr')].forEach((row, i) => {
      const route = transports[i];
      if (!route) return;
      const idx = row.id.match(/_(\d+)$/)?.[1];
      const values = {
        [`gTS${idx}`]: route.sector || '',
        [`gTV${idx}`]: route.vehicle || '',
        [`gTR${idx}`]: route.rate ?? route.rate_sar ?? '',
        [`gTQ${idx}`]: route.qty ?? 1,
        [`gTE${idx}`]: route.roe ?? G.settings?.default_roe ?? 78,
        [`gTD${idx}`]: route.date || route.transportDate || ''
      };
      Object.entries(values).forEach(([id, value]) => setValue(id, value));
    });
  }

  _editingGrpId = isDraft ? null : quotation.id || null;
  _currentGroupData = isDraft ? null : quotation;
  const tag = document.getElementById('gEditTag');
  if (tag) tag.innerHTML = !isDraft && quotation.invoice_no
    ? `<span class="pill pill-blue">Editing ${esc(quotation.invoice_no)}</span>` : '';
  gCalc();
}

async function gSave() {
  const data = collectGroupQuotationData();
  if (!data) { toast('Please enter group or client name', 'warn'); document.getElementById('gN')?.focus(); return; }
  data.status = _currentGroupData?.status || 'pending';
  showLoad('Saving group quotation…');
  try {
    let response;
    if (_editingGrpId) {
      response = await PUT(`/quotations/${_editingGrpId}`, data);
      data.id = _editingGrpId;
      data.invoice_no = _currentGroupData?.invoice_no;
      toast('Group quotation updated successfully', 'success');
    } else {
      response = await POST('/quotations', data);
      data.id = response.id;
      data.invoice_no = response.invoice_no;
      _editingGrpId = response.id;
      toast(`Group quotation created: ${response.invoice_no}`, 'success');
      const tag = document.getElementById('gEditTag');
      if (tag) tag.innerHTML = `<span class="pill pill-blue">Editing ${esc(response.invoice_no)}</span>`;
    }
    _currentGroupData = data;
    hideLoad();
    gPreview(data);
  } catch (err) {
    hideLoad();
    toast('Group save failed: ' + err.message, 'error');
  }
}

function gSaveDraft() {
  const data = collectGroupQuotationData();
  if (!data) { toast('Enter a group name before saving the draft', 'warn'); return; }
  try {
    localStorage.setItem('pgt_grp_draft', JSON.stringify(data));
    toast('Group costing draft saved on this device', 'success');
  } catch (err) {
    toast('Unable to save group draft: ' + err.message, 'error');
  }
}

function loadGroupDraft() {
  try {
    const raw = localStorage.getItem('pgt_grp_draft');
    if (!raw) { toast('No saved group draft was found on this device', 'info'); return; }
    restoreGroupQuotation(JSON.parse(raw), true);
    toast('Group costing draft loaded', 'success');
  } catch (err) {
    toast('Unable to load group draft: ' + err.message, 'error');
  }
}

function newGroupCosting() {
  _editingGrpId = null;
  _currentGroupData = null;
  pgGroup(true);
  nav('grp');
  toast('Started a new group costing', 'info');
}

function groupBranch(quotation = {}) {
  return G.branches.find(branch => branch.id === quotation.branch_id) ||
    G.branches.find(branch => branch.id === (G.user?.branchId || G.user?.branch_id)) || {
      name: quotation.branch_name || G.settings?.company_name || 'Pak Globe Travels',
      phone: G.settings?.phone || '',
      email: G.settings?.email || '',
      address: G.settings?.address || '',
      license_no: G.settings?.license_no || '',
      logo_url: G.settings?.logo_url || '',
      brand_color: G.settings?.brand_color || '#3A94BA'
    };
}

function renderGroupProposalA4Html(quotation, branch, brandingSettings = G.settings || {}) {
  // Resolve branch identity: quotation branch > user branch > settings fallback
  const qBranchId = quotation.branch_id;
  const resolvedBranch = (branch && branch.name) ? branch :
    (qBranchId ? G.branches?.find(b => b.id === qBranchId) : null) ||
    (G.user?.branchId ? G.branches?.find(b => b.id === G.user.branchId) : null) || {};
  branch = { ...resolvedBranch };
  // Overlay brandingSettings only for null/empty branch fields — never overwrite a real branch name
  const resolvedName = branch.name || brandingSettings?.company_name || 'Pak Globe Travels';
  branch.name        = resolvedName;
  branch.phone       = branch.phone       || brandingSettings?.phone       || '';
  branch.email       = branch.email       || brandingSettings?.email       || '';
  branch.address     = branch.address     || brandingSettings?.address     || '';
  branch.license_no  = branch.license_no  || brandingSettings?.license_no  || '';
  branch.logo_url    = branch.logo_url    || brandingSettings?.logo_url    || '';
  branch.brand_color = branch.brand_color || brandingSettings?.brand_color || '#0f2c59';
  branch.terms_text  = branch.terms_text  || brandingSettings?.terms_text  || '';
  branch.disclaimer_text = branch.disclaimer_text || brandingSettings?.disclaimer_text || '';
  const options = parseQuotationOptions(quotation.options);
  const results = calculateGroupCosting(options, quotation.adult_pax);
  const company = branch.name || 'Pak Globe Travels';
  const tierRows = ['quint', 'quad', 'triple', 'double'].map(key => {
    const tier = results.tiers[key];
    return `<tr><td>${key.charAt(0).toUpperCase() + key.slice(1)} (${tier.capacity} sharing)</td><td>PKR ${fmtNum(tier.sellingPerPax)}</td></tr>`;
  }).join('');
  const hotels = (options.hotels || []).filter(hotel => hotel.name).map(hotel =>
    `<tr><td>${esc(hotel.city || '')}</td><td>${esc(hotel.name)}</td><td>${esc(hotel.roomType || '')}</td><td>${esc(hotel.meal || '')}</td><td>${esc(hotel.checkIn || hotel.check_in || '—')}</td><td>${esc(hotel.checkOut || hotel.check_out || '—')}</td><td>${fmtNum(hotel.nights || 1)}</td></tr>`
  ).join('');
  const routes = (options.transports || []).filter(route => route.sector).map(route =>
    `<tr><td>${esc(route.sector)}</td><td>${esc(route.vehicle || '')}</td></tr>`
  ).join('');
  const logo = branch.logo_url
    ? `<img src="${escAttr(branch.logo_url)}" alt="" style="max-width:70px;max-height:60px;object-fit:contain">` : '';
  const hasBranchInstructions = Boolean(branch.terms_text || branch.disclaimer_text);
  return `
    <div class="pp pp-single" style="font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#0f172a;padding:20px;max-width:210mm;margin:auto;border:1px solid #e2e8f0">
      <header style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #0f2c59;padding-bottom:12px">
        ${logo}
        <div style="flex:1"><h1 style="margin:0;color:#0f2c59;font-size:22px">${esc(company)}</h1>
          <div style="font-size:10px;color:#475569">${esc(branch.address || '')}</div>
          <div style="font-size:10px;color:#475569">${esc(branch.phone || '')}${branch.email ? ' · ' + esc(branch.email) : ''}</div>
          ${branch.license_no ? `<div style="font-size:9px;color:#475569">License: ${esc(branch.license_no)}</div>` : ''}
        </div>
        <div style="text-align:right"><strong>${esc(quotation.invoice_no || 'GROUP PACKAGE')}</strong><br><span style="font-size:10px">${fmtDate(new Date())}</span></div>
      </header>
      <div style="margin:14px 0;padding:9px;text-align:center;background:#0f2c59;color:#fff;font-size:16px;font-weight:800">${esc(options.heading || 'UMRAH GROUP PACKAGE')}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
        <div><b>Group / Client</b><br>${esc(quotation.client_name || '')}</div>
        <div><b>Contact</b><br>${esc(quotation.contact_no || '—')}</div>
        <div><b>Travel Dates</b><br>${esc(quotation.travel_dates || '—')}</div>
        <div><b>Total PAX</b><br>${fmtNum(results.pax)}</div>
        <div><b>Airline</b><br>${esc(options.airline || '—')}</div>
        <div><b>Duration</b><br>${n(options.totalDays ?? options.total_days) ? `${fmtNum(options.totalDays ?? options.total_days)} days` : '—'}</div>
      </div>
      <div style="margin:10px 0"><b>Package Includes:</b> ${esc(quotation.includes || '—')}</div>
      ${hotels ? `<h3 style="color:#0f2c59;font-size:13px;margin:12px 0 5px">Accommodation</h3><table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr>${['City','Hotel','Room','Meal','Check-In','Check-Out','Nights'].map(label => `<th style="padding:6px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left">${label}</th>`).join('')}</tr></thead><tbody>${hotels}</tbody></table>` : ''}
      ${routes ? `<h3 style="color:#0f2c59;font-size:13px;margin:12px 0 5px">Transport</h3><table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr>${['Route','Vehicle'].map(label => `<th style="padding:6px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left">${label}</th>`).join('')}</tr></thead><tbody>${routes}</tbody></table>` : ''}
      <h3 style="color:#0f2c59;font-size:13px;margin:14px 0 5px">Package Rates (per person)</h3>
      <table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr><th style="padding:7px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left">Room Sharing</th><th style="padding:7px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left">Selling Price</th></tr></thead><tbody>${tierRows}</tbody></table>
      ${options.note ? `<div style="margin-top:12px;padding:8px;border-left:3px solid #0f2c59;background:#f8fafc"><b>Note:</b> ${esc(options.note)}</div>` : ''}
      <footer style="margin-top:18px;border-top:1px solid #cbd5e1;padding-top:8px;text-align:center;color:#64748b;font-size:9px">${esc(branch.phone || '')} · Rates are subject to availability and confirmation.</footer>
    </div>
    ${hasBranchInstructions ? `
      <div class="pp pp-single" style="font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#0f172a;padding:20px;max-width:210mm;margin:24px auto 0;border:1px solid #e2e8f0;page-break-before:always">
        <h2 style="margin:0 0 16px;padding:10px;text-align:center;background:#0f2c59;color:#fff;font-size:16px">TERMS &amp; BRANCH INSTRUCTIONS</h2>
        ${branch.terms_text ? `<section style="margin-bottom:16px"><h3 style="font-size:12px;color:#0f2c59">Terms &amp; Conditions</h3><div style="white-space:pre-line;font-size:11px;line-height:1.6">${esc(branch.terms_text)}</div></section>` : ''}
        ${branch.disclaimer_text ? `<section><h3 style="font-size:12px;color:#0f2c59">Custom Instructions</h3><div style="white-space:pre-line;font-size:11px;line-height:1.6">${esc(branch.disclaimer_text)}</div></section>` : ''}
      </div>` : ''}`;
}

function renderGroupCostingA4Html(quotation, branch) {
  const options = parseQuotationOptions(quotation.options);
  const results = calculateGroupCosting(options, quotation.adult_pax);
  const hotels = (options.hotels || []).map(hotel => {
    const total = n(hotel.rate) * (n(hotel.qty) || 1) * (n(hotel.nights) || 1) * (n(hotel.roe) || 78);
    return `<tr><td>${esc(hotel.city || '')}</td><td>${esc(hotel.name || '')}</td><td>${esc(hotel.roomType || '')}</td><td>${esc(hotel.checkIn || hotel.check_in || '—')}</td><td>${esc(hotel.checkOut || hotel.check_out || '—')}</td><td>${fmtNum(hotel.rate)}</td><td>${fmtNum(hotel.qty || 1)}</td><td>${fmtNum(hotel.nights || 1)}</td><td>${fmtNum(hotel.roe || 78)}</td><td>${fmtNum(total)}</td></tr>`;
  }).join('');
  const transports = (options.transports || []).map(route => {
    const total = n(route.rate) * n(route.qty) * (n(route.roe) || 78);
    return `<tr><td>${esc(route.sector || '')}</td><td>${esc(route.vehicle || '')}</td><td>${fmtNum(route.rate)}</td><td>${fmtNum(route.qty)}</td><td>${fmtNum(route.roe || 78)}</td><td>${fmtNum(total)}</td></tr>`;
  }).join('');
  const tierRows = ['quint', 'quad', 'triple', 'double'].map(key => {
    const tier = results.tiers[key];
    return `<tr><td>${key.toUpperCase()} (${tier.capacity})</td><td>${fmtNum(tier.hotelPerPax)}</td><td>${fmtNum(tier.ticketPerPax)}</td><td>${fmtNum(tier.visaPerPax)}</td><td>${fmtNum(tier.transportPerPax)}</td><td>${fmtNum(tier.netPerPax)}</td><td>${fmtNum(tier.profit)}</td><td><strong>${fmtNum(tier.sellingPerPax)}</strong></td></tr>`;
  }).join('');
  const tableStyle = 'width:100%;border-collapse:collapse;font-size:9px';
  const thStyle = 'padding:4px;border:1px solid #cbd5e1;background:#f1f5f9;text-align:left';
  const tdStyle = 'padding:4px;border:1px solid #cbd5e1';
  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;background:#fff;padding:14px;color:#1e293b">
      <header style="display:flex;justify-content:space-between;border-bottom:2px solid #7c3aed;padding-bottom:8px;margin-bottom:10px">
        <div><div style="font-size:18px;font-weight:900;color:#0f2c59">${esc(branch.name || 'Pak Globe Travels')}</div><div style="font-size:10px">GROUP COSTING — CONFIDENTIAL / INTERNAL USE</div></div>
        <div style="text-align:right;font-size:10px"><b>${esc(quotation.invoice_no || '')}</b><br>${fmtDate(new Date())}</div>
      </header>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;font-size:10px;margin-bottom:10px">
        <div><b>Client</b><br>${esc(quotation.client_name || '')}</div><div><b>PAX</b><br>${fmtNum(results.pax)}</div>
        <div><b>Travel Dates</b><br>${esc(quotation.travel_dates || '—')}</div><div><b>Airline / Ticket</b><br>${esc(options.airline || '—')} / PKR ${fmtNum(options.ticketPKR ?? options.ticket_pkr)}</div>
      </div>
      <h3 style="font-size:11px;margin:10px 0 4px">Hotels (SAR rates converted using row ROE)</h3>
      <table style="${tableStyle}"><thead><tr>${['City','Hotel','Room','Check-In','Check-Out','SAR','Qty','Nights','ROE','Total PKR'].map(v => `<th style="${thStyle}">${v}</th>`).join('')}</tr></thead><tbody>${hotels || `<tr><td colspan="10" style="${tdStyle}">No hotel rates entered</td></tr>`}</tbody></table>
      <h3 style="font-size:11px;margin:10px 0 4px">Ground Transport</h3>
      <table style="${tableStyle}"><thead><tr>${['Route','Vehicle','SAR','Qty','ROE','Total PKR'].map(v => `<th style="${thStyle}">${v}</th>`).join('')}</tr></thead><tbody>${transports || `<tr><td colspan="6" style="${tdStyle}">No transport rates entered</td></tr>`}</tbody></table>
      <div style="margin-top:8px;font-size:10px"><b>Visa:</b> ${fmtNum(options.visa?.rate)} SAR × ${fmtNum(options.visa?.qty)} × ROE ${fmtNum(options.visa?.roe)} = PKR ${fmtNum(results.visaTotal)}</div>
      <h3 style="font-size:11px;margin:10px 0 4px">Per-Person Cost & Selling Matrix (PKR)</h3>
      <table style="${tableStyle}"><thead><tr>${['Sharing','Hotel','Ticket','Visa','Transport','Net Cost','Profit','Selling'].map(v => `<th style="${thStyle}">${v}</th>`).join('')}</tr></thead><tbody>${tierRows}</tbody></table>
      <div style="margin-top:8px;font-size:9px;color:#64748b">Group totals are estimated per-person selling rate × ${fmtNum(results.pax)} PAX. Confidential: do not share with clients.</div>
    </div>`;
}

function gPreview(quotation = null) {
  const data = quotation || collectGroupQuotationData();
  if (!data) { toast('Please enter a group name first', 'warn'); return; }
  if (!data.id && _currentGroupData?.id) data.id = _currentGroupData.id;
  if (!data.invoice_no && _currentGroupData?.invoice_no) data.invoice_no = _currentGroupData.invoice_no;
  _activeProposalType = 'group';
  _activeProposalData = data;
  const body = document.getElementById('proposalPreviewBody');
  const title = document.getElementById('proposalModalTitle');
  if (!body) { toast('Proposal preview is unavailable', 'error'); return; }
  body.innerHTML = renderGroupProposalA4Html(data, groupBranch(data), data.brand_settings || G.settings || {});
  if (title) title.textContent = 'Group Package Proposal Preview';
  generateProposalQrCode(data);
  openModal('proposalModal');
}

function shareWhatsAppGrp() {
  const data = collectGroupQuotationData();
  if (!data) { toast('Please enter a group name first', 'warn'); return; }
  shareWhatsAppGroupData(data);
}

function shareWhatsAppGroupData(data) {
  if (!data) { toast('Group proposal data is unavailable', 'error'); return; }
  const options = parseQuotationOptions(data.options);
  const results = calculateGroupCosting(options, data.adult_pax);
  const text = [
    `🕌 *${groupBranch(data).name || 'PAK GLOBE TRAVELS'}* 🕌`,
    `*UMRAH GROUP PACKAGE: ${data.client_name}*`,
    data.travel_dates ? `Travel dates: ${data.travel_dates}` : '',
    `Group size: ${fmtNum(results.pax)} PAX`,
    '',
    '*RATES PER PERSON:*',
    `• Quint (5 in room): PKR ${fmtNum(results.tiers.quint.sellingPerPax)}`,
    `• Quad (4 in room): PKR ${fmtNum(results.tiers.quad.sellingPerPax)}`,
    `• Triple (3 in room): PKR ${fmtNum(results.tiers.triple.sellingPerPax)}`,
    `• Double (2 in room): PKR ${fmtNum(results.tiers.double.sellingPerPax)}`,
    '',
    `Includes: ${data.includes || '—'}`,
    options.note ? `Note: ${options.note}` : '',
    data.contact_no ? `Contact: ${data.contact_no}` : ''
  ].filter(Boolean).join('\n');
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function printCostingGrp() {
  const data = collectGroupQuotationData();
  if (!data) { toast('Please enter a group name first', 'warn'); return; }
  const body = document.getElementById('costingSheetBody');
  if (!body) { toast('Costing sheet is unavailable', 'error'); return; }
  body.innerHTML = renderGroupCostingA4Html(data, groupBranch(data));
  const title = document.getElementById('costingModalTitle');
  if (title) title.textContent = 'Internal Group Costing Breakdown';
  openModal('costingModal');
}

// ═══════════════════════════════════════════════════════════
//  PHASE 4: ALL QUOTATIONS LEDGER & CRUD
// ═══════════════════════════════════════════════════════════

// Clone a quotation
async function cloneQuotationById(id) {
  if (!confirm('Clone this quotation? A copy will be created with "Copy of" prefix.')) return;
  showLoad('Cloning quotation…');
  try {
    const q = await GET('/quotations/' + id);
    if (!q) throw new Error('Quotation not found');
    const payload = {
      client_name:    'Copy of ' + (q.client_name || 'Quotation'),
      contact_no:     q.contact_no || '',
      adults:         q.adults || 2,
      children:       q.children || 0,
      infants:        q.infants || 0,
      departure_date: q.departure_date || '',
      return_date:    q.return_date || '',
      branch_id:      q.branch_id || null,
      notes:          q.notes || '',
      status:         'draft',
    };
    await POST('/quotations', payload);
    toast('✅ Quotation cloned successfully!', 'success');
    await pgAllQuotations();
  } catch(err) {
    toast('Clone failed: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

async function pgAllQuotations(statusOnly = '') {
  const pageId = statusOnly === 'pending' ? 'pendingquot' : statusOnly === 'mine' ? 'myquot' : 'allquot';
  const pg = document.getElementById(pageId);
  if (!pg) return;
  showLoad('Loading quotations…');

  try {
    const endpoint = statusOnly === 'pending'
      ? '/quotations?status=pending'
      : statusOnly === 'mine'
        ? '/quotations?mine=1&status=approved'
        : '/quotations?status=approved';
    const quots = await GET(endpoint);
    G.quotations = quots || [];

    pg.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="bi ${statusOnly === 'pending' ? 'bi-hourglass-split' : statusOnly === 'mine' ? 'bi-person-lines-fill' : 'bi-folder2-open'} me-2" style="color:var(--sec)"></i>${statusOnly === 'pending' ? 'Pending Quotations' : statusOnly === 'mine' ? 'My Quotations' : 'All Quotations'}</h1>
          <span class="page-sub">${G.quotations.length} ${statusOnly === 'pending' ? 'quotations waiting for processing' : statusOnly === 'mine' ? 'quotations created by you' : 'saved proposals and package vouchers'}</span>
        </div>
        <div class="page-actions">
          <button class="btn-pri" onclick="nav('pvt')"><i class="bi bi-plus-lg me-1"></i>New Private Costing</button>
          <button class="btn-sec" onclick="nav('grp')"><i class="bi bi-plus-lg me-1"></i>New Group Costing</button>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="sec-box mb-3">
        <div class="row g-2">
          <div class="col-md-5">
            <input class="form-inp" id="quotSearchInp" placeholder="Search client name, invoice number, phone…" oninput="filterQuotationsTable()">
          </div>
          <div class="col-md-3">
            <select class="form-inp" id="quotTypeFilter" onchange="filterQuotationsTable()">
              <option value="">All Package Types</option>
              <option value="private">Private Umrah</option>
              <option value="group">Group Umrah</option>
            </select>
          </div>
          <div class="col-md-4">
            <select class="form-inp" id="quotStatusFilter" onchange="filterQuotationsTable()">
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_process">Process</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      <div class="glass-card">
        <div class="table-wrap">
          <table class="tbl" id="quotTable">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Client Details</th>
                <th>Type</th>
                <th>Travel Dates</th>
                <th>PAX</th>
                <th>Status</th>
                <th>Branch</th>
                <th>Created</th>
                <th style="width:130px">Actions</th>
              </tr>
            </thead>
            <tbody id="quotTbody">
              ${renderQuotationRows(G.quotations)}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    toast('Error loading quotations: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

function renderQuotationRows(list) {
  if (!list || !list.length) {
    return '<tr><td colspan="9" class="t3 text-center py-4">No quotations found ✨</td></tr>';
  }

  return list.map(q => {
    return `
      <tr>
        <td><code style="font-weight:700;color:var(--pri)">${esc(q.invoice_no)}</code></td>
        <td>
          <div style="font-weight:700;color:var(--t1)">${esc(q.client_name)}</div>
          <div class="t3" style="font-size:11px">${esc(q.contact_no || 'No contact')}</div>
          <div class="quot-component-statuses">${renderQuotationComponentStatuses(q)}</div>
        </td>
        <td><span class="pill ${q.type === 'private' ? 'pill-blue' : 'pill-lav'}">${q.type}</span></td>
        <td class="t2">${esc(q.travel_dates || '—')}</td>
        <td style="font-weight:600">${q.adult_pax||0}A ${q.child_pax?q.child_pax+'C':''} ${q.infant_pax?q.infant_pax+'I':''}</td>
        <td><span class="badge-status bs-${q.status}">${q.status}</span></td>
        <td class="t3">${esc(q.branch_name || 'Head Office')}</td>
        <td class="t3">${fmtDate(q.created_at)}</td>
        <td>
          <div class="action-btns">
            <button class="btn-icon" title="View Proposal Voucher" onclick="previewQuotationById('${q.id}')"><i class="bi bi-eye"></i></button>
            <button class="btn-icon" title="Edit in Costing Editor" onclick="editQuotationById('${q.id}')"><i class="bi bi-pencil"></i></button>
            <button class="btn-icon" title="Delete (Move to Recycle Bin)" onclick="deleteQuotationById('${q.id}')" style="color:var(--err)"><i class="bi bi-trash"></i></button>
            <button class="btn-clone" title="Clone this quotation" onclick="cloneQuotationById('${q.id}')"><i class="bi bi-copy"></i> Clone</button>
            ${q.status === 'pending' ? `<button class="btn-icon" title="Move to In Process" onclick="updateQuotationStatus('${q.id}','in_process')"><i class="bi bi-play-circle"></i></button>` : ''}
            ${['superadmin','admin','branch_admin'].includes(G.user?.role) ? `<select class="form-inp form-inp-sm quot-status-select" title="Change quotation status" onchange="updateQuotationStatus('${q.id}', this.value)">
              <option value="">Status</option>
              <option value="in_process" ${q.status === 'in_process' ? 'selected' : ''}>Process</option>
              <option value="approved" ${q.status === 'approved' ? 'selected' : ''}>Approve</option>
              <option value="rejected" ${q.status === 'rejected' ? 'selected' : ''}>Reject</option>
              <option value="cancelled" ${q.status === 'cancelled' ? 'selected' : ''}>Cancel</option>
              <option value="closed" ${q.status === 'closed' ? 'selected' : ''}>Closed</option>
            </select>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');
}

function quotationComponentDepartments(q) {
  const text = `${q.includes || ''} ${JSON.stringify(q.options || '')}`.toLowerCase();
  return ['ticket', 'visa', 'hotel', 'transport'].filter(department => text.includes(department) || (department === 'ticket' && text.includes('flight')));
}

function renderQuotationComponentStatuses(q) {
  const current = typeof q.component_statuses === 'string' ? (() => { try { return JSON.parse(q.component_statuses); } catch (_) { return {}; } })() : (q.component_statuses || {});
  const labels = { ticket: 'Flight', visa: 'Visa', hotel: 'Hotel', transport: 'Transport' };
  const canEdit = ['superadmin', 'admin', 'branch_admin'].includes(G.user?.role);
  return quotationComponentDepartments(q).map(department => canEdit
    ? `<label class="quot-component-status" title="${labels[department]} workflow"><span>${labels[department]}</span><select class="form-inp form-inp-sm" onchange="updateQuotationComponentStatus('${q.id}','${department}',this.value)"><option value="pending" ${(current[department] || 'pending') === 'pending' ? 'selected' : ''}>Pending</option><option value="in_process" ${current[department] === 'in_process' ? 'selected' : ''}>In Process</option><option value="done" ${current[department] === 'done' ? 'selected' : ''}>Done</option></select></label>`
    : `<span class="quot-component-status-readonly"><b>${labels[department]}</b> ${String(current[department] || 'pending').replace('_', ' ')}</span>`).join('');
}

async function updateQuotationComponentStatus(id, department, status) {
  try {
    await PUT(`/quotations/${id}/component-status`, { department, status });
    toast(`${department} marked ${status.replace('_', ' ')}`, status === 'done' ? 'success' : 'info');
    const current = G._currentPage === 'pendingquot' ? 'pending' : G._currentPage === 'myquot' ? 'mine' : '';
    await pgAllQuotations(current);
  } catch (error) { toast('Component status update failed: ' + error.message, 'error'); }
}
window.updateQuotationComponentStatus = updateQuotationComponentStatus;

async function updateQuotationStatus(id, status) {
  if (!status) return;
  const labels = { in_process: 'Process', approved: 'Approve', rejected: 'Reject', cancelled: 'Cancel', closed: 'Close' };
  if (['rejected', 'cancelled'].includes(status) && !confirm(`${labels[status]} this quotation?`)) return;
  try {
    showLoad(`Moving quotation to ${status.replace('_',' ')}…`);
    const result = await PUT(`/quotations/${id}`, { status });
    const emailMessage = status === 'approved' ? (result.email?.queued > 0 ? ` ${result.email.queued} department reminder(s) scheduled.` : ` Email not scheduled: ${result.email?.reason || 'no matching date or department user'}.`) : '';
    toast(`Quotation marked ${status.replace('_',' ')}.${emailMessage}`, status === 'approved' ? 'success' : 'info');
    await pgAllQuotations(G._currentPage === 'pendingquot' ? 'pending' : G._currentPage === 'myquot' ? 'mine' : '');
  } catch (e) { toast(e.message, 'error'); } finally { hideLoad(); }
}
window.updateQuotationStatus = updateQuotationStatus;

/* Package Creating: a simple finance-ready package ledger with split receipts. */
async function pgPackages() {
  const pg = document.getElementById('packages'); if (!pg) return;
  try {
    const rows = await GET('/packages');
    pg.innerHTML = `<div class="page-header"><div><h1 class="page-title"><i class="bi bi-box-seam me-2" style="color:var(--pri)"></i>Package Creating</h1><span class="page-sub">Client package, costing lines and multiple dated receipts</span></div><button class="btn-pri" onclick="openPackageCreate()"><i class="bi bi-plus-lg me-1"></i>Create Package</button></div>
      <div class="glass-card"><div class="table-wrap"><table class="tbl" id="packagesTable"><thead><tr><th>Client</th><th>Visa</th><th>Tickets</th><th>Transport</th><th>Hotel + Others</th><th>Total</th><th>Received</th><th>Remaining</th><th>Actions</th></tr></thead><tbody>${rows.length ? rows.map(p => `<tr><td data-label="Client"><strong>${esc(p.client_name)}</strong></td><td data-label="Visa">${fmtNum(p.visa_qty)} × ${fmtNum(p.visa_rate)}</td><td data-label="Tickets">${fmtNum(p.ticket_qty)} × ${fmtNum(p.ticket_rate)}</td><td data-label="Transport">${fmtNum(p.transport_qty)} × ${fmtNum(p.transport_rate)}</td><td data-label="Hotel + Others">${fmtNum(Number(p.hotel_amount||0)+Number(p.other_amount||0))}</td><td data-label="Total"><strong>${fmtNum(p.total_amount)}</strong></td><td data-label="Received" class="text-success">${fmtNum(p.received_amount)}</td><td data-label="Remaining" class="text-danger"><strong>${fmtNum(p.remaining_amount)}</strong></td><td data-label="Actions"><div class="action-btns d-flex align-items-center gap-1"><button class="btn-icon" title="Print package voucher" onclick="printPackageById('${p.id}')"><i class="bi bi-printer"></i></button><button class="btn-icon" title="Add payment installment" style="color:var(--ok)" onclick="openAddPackagePaymentModal('${p.id}', '${escAttr(p.client_name)}', ${p.remaining_amount})"><i class="bi bi-cash-stack"></i></button><button class="btn-icon" title="Delete package" style="color:var(--err)" onclick="deletePackage('${p.id}')"><i class="bi bi-trash3"></i></button></div></td></tr>`).join('') : '<tr><td colspan="9" class="t3 text-center py-4">No packages created yet</td></tr>'}</tbody></table></div></div>`;
  } catch (e) { toast('Package loading failed: ' + e.message, 'error'); }
}

function openAddPackagePaymentModal(packageId, clientName, remaining) {
  const modal = document.getElementById('packagePaymentAddModal');
  if (!modal) return;
  document.getElementById('pkgPayPkgId').value = packageId;
  document.getElementById('pkgPayClientName').textContent = clientName || 'Client';
  document.getElementById('pkgPayRemaining').textContent = fmtNum(remaining || 0);
  document.getElementById('pkgPayAmount').value = remaining > 0 ? remaining : '';
  document.getElementById('pkgPayDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('pkgPayMethod').value = 'Cash';
  document.getElementById('pkgPayNote').value = '';
  openModal('packagePaymentAddModal');
}
window.openAddPackagePaymentModal = openAddPackagePaymentModal;

async function submitPackagePayment() {
  const packageId = document.getElementById('pkgPayPkgId')?.value;
  const amount = Number(document.getElementById('pkgPayAmount')?.value);
  const date = document.getElementById('pkgPayDate')?.value;
  const method = document.getElementById('pkgPayMethod')?.value;
  const note = document.getElementById('pkgPayNote')?.value;

  if (!packageId || !(amount > 0)) {
    toast('Please enter a valid payment amount', 'warn');
    return;
  }

  try {
    showLoad('Recording installment payment…');
    await POST(`/packages/${packageId}/payments`, {
      amount,
      received_on: date,
      method,
      note
    });
    closeModal('packagePaymentAddModal');
    toast('Installment payment recorded successfully!', 'success');
    await pgPackages();
  } catch (err) {
    toast('Failed to record payment: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}
window.submitPackagePayment = submitPackagePayment;

async function deletePackage(id) {
  if (!confirm('Are you sure you want to delete this package and its payment records?')) return;
  try {
    showLoad('Deleting package…');
    await DEL(`/packages/${id}`);
    toast('Package deleted', 'success');
    await pgPackages();
  } catch (err) {
    toast('Failed to delete package: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}
window.deletePackage = deletePackage;

async function printPackageById(id) {
  try {
    showLoad('Preparing package voucher…');
    const p = await GET(`/packages/${id}`);
    const details = typeof p.details === 'string' ? (() => { try { return JSON.parse(p.details); } catch (_) { return {}; } })() : (p.details || {});
    const payments = p.payments || [];
    const total = Number(p.total_amount || 0), received = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0), remaining = Math.max(0, total - received);
    const line = (label, qty, rate, amount) => `<tr><td>${label}</td><td class="num">${qty || 0}</td><td class="num">${fmtNum(rate || 0)}</td><td class="num">${fmtNum(amount || 0)}</td></tr>`;
    const adults = Number(details.adults || p.visa_qty || 0), children = Number(details.children || 0);
    const packageRows = `${line('Adult package', adults, details.adult_rate || 0, Number(details.adult_amount || 0))}${line('Child package', children, details.child_rate || 0, Number(details.child_amount || 0))}${line('Visa',p.visa_qty,p.visa_rate,Number(p.visa_qty||0)*Number(p.visa_rate||0))}${line('Return air ticket',p.ticket_qty,p.ticket_rate,Number(p.ticket_qty||0)*Number(p.ticket_rate||0))}${line('Transport / other charges',p.transport_qty,p.transport_rate,Number(p.transport_qty||0)*Number(p.transport_rate||0))}${line('Hotels',1,0,p.hotel_amount)}${line('Other services',1,0,p.other_amount)}`;
    const inclusions = Array.isArray(details.inclusions) ? details.inclusions : String(details.inclusions || 'Return Air Ticket, Umrah Visa, Makkah Hotel Accommodation, Madinah Hotel Accommodation, Airport Transfers').split(',').map(item => item.trim()).filter(Boolean);
    const hotelBlock = details.hotels || details.hotel_details || 'Hotel accommodation details to be confirmed';
    const currentPayment = payments.length ? payments[payments.length - 1] : null;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Umrah Package Quotation - ${escAttr(p.client_name)}</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#18372d;margin:0;background:#fff}.sheet{border:1px solid #d5e4dc;border-radius:16px;overflow:hidden}.top{padding:25px 30px;background:linear-gradient(135deg,#163c30,#37846a);color:#fff;display:flex;justify-content:space-between}.brand{font-size:21px;font-weight:800;letter-spacing:.08em}.sub{font-size:10px;opacity:.8;letter-spacing:.14em;margin-top:5px}.title{font-size:21px;font-weight:800;text-align:right}.content{padding:24px 30px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#f3f8f5;border-radius:12px;padding:15px;margin-bottom:18px}.field{font-size:10px;color:#72847c;text-transform:uppercase;letter-spacing:.06em}.field b{display:block;color:#18372d;font-size:13px;text-transform:none;letter-spacing:0;margin-top:4px}.section{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#2f8066;font-weight:800;margin:19px 0 7px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#eaf4ee;color:#315d4d;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.06em}th,td{padding:8px;border-bottom:1px solid #e0ebe5}.num{text-align:right}.two{display:grid;grid-template-columns:1fr 1fr;gap:18px}.box{background:#f8fbf9;border:1px solid #e1ece6;border-radius:10px;padding:13px;font-size:11px;line-height:1.6}.box ul{margin:6px 0 0;padding-left:18px}.totals{margin:15px 0 0 auto;width:55%;font-size:11px}.total-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #e1ebe5}.grand{font-size:16px;font-weight:800;color:#173d31;border-top:2px solid #2f8066;margin-top:3px}.receipt{margin-top:28px;padding-top:18px;border-top:2px dashed #b8d1c4}.balance{background:#edf8f1;border:1px solid #b9ddc7;border-radius:10px;padding:14px;display:flex;justify-content:space-between;align-items:center}.balance strong{font-size:20px;color:#22754e}.sign{display:grid;grid-template-columns:1fr 1fr;gap:70px;margin-top:28px;font-size:10px;color:#64776e}.sign div{border-top:1px solid #9caea5;padding-top:7px}.footer{margin-top:22px;padding-top:12px;border-top:1px solid #dce8e1;text-align:center;color:#718178;font-size:9px}</style></head><body><div class="sheet"><div class="top"><div><div class="brand">PAK GLOBE TRAVELS</div><div class="sub">UMRAH PACKAGE · YOUR TRUSTED TRAVEL PARTNER</div></div><div><div class="title">UMRAH PACKAGE QUOTATION</div><div style="font-size:10px;text-align:right;margin-top:6px">Quotation No: ${esc(details.quotation_no || `PGT-UM-${p.id.slice(0,6).toUpperCase()}`)}<br>Date: ${fmtDate(p.created_at)}</div></div></div><div class="content"><div class="meta"><div><span class="field">Client Name</span><b>${esc(p.client_name)}</b></div><div><span class="field">Contact No.</span><b>${esc(details.contact || '—')}</b></div><div><span class="field">Total Passengers</span><b>${fmtNum(adults + children)} Persons</b></div><div><span class="field">Adults / Children</span><b>${fmtNum(adults)} / ${fmtNum(children)}</b></div><div><span class="field">Travel Date</span><b>${esc(details.travel_date || '—')}</b></div><div><span class="field">Return Date</span><b>${esc(details.return_date || '—')}</b></div></div><div class="section">Package details</div><div class="two"><div class="box"><b>MAKKAH HOTEL</b><br>${esc(details.makkah_hotel || hotelBlock)}<br><span style="color:#718178">Stay: ${esc(details.makkah_nights || '—')} Nights</span></div><div class="box"><b>MADINAH HOTEL</b><br>${esc(details.madinah_hotel || hotelBlock)}<br><span style="color:#718178">Stay: ${esc(details.madinah_nights || '—')} Nights</span></div></div><div class="section">Package inclusions</div><div class="box"><ul>${inclusions.map(item => `<li>${esc(item)}</li>`).join('')}</ul></div><div class="section">Price breakdown</div><table><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount (PKR)</th></tr></thead><tbody>${packageRows}</tbody></table><div class="totals"><div class="total-row"><span>Grand Total</span><strong>${fmtNum(total)}</strong></div><div class="total-row grand"><span>TOTAL PACKAGE PRICE</span><strong>PKR ${fmtNum(total)}</strong></div></div><div class="receipt"><div class="section" style="margin-top:0">Payment receipt</div><div class="meta"><div><span class="field">Receipt No.</span><b>${esc(details.receipt_no || `PGT-R-${p.id.slice(0,6).toUpperCase()}`)}</b></div><div><span class="field">Payment Date</span><b>${fmtDate(currentPayment?.received_on || new Date())}</b></div><div><span class="field">Previous Received</span><b>PKR ${fmtNum(Math.max(0, received - Number(currentPayment?.amount || 0)))}</b></div><div><span class="field">Current Received</span><b>PKR ${fmtNum(currentPayment?.amount || 0)}</b></div></div><div class="balance"><span>OUTSTANDING BALANCE<br><small>${remaining ? 'PARTIALLY PAID' : 'PAID IN FULL'}</small></span><strong>PKR ${fmtNum(remaining)}</strong></div><div class="box" style="margin-top:12px">Payment Method: ${esc(currentPayment?.method || details.payment_method || 'Cash / Bank Transfer')}<br>Transaction ID: ${esc(details.transaction_id || '________________')}<br>Received By: ${esc(details.received_by || '________________')}</div><div class="sign"><div>Client Signature</div><div>Authorized Signature</div></div></div><div class="footer">Note: Actual hotel, airline, visa and transport details must be confirmed before issuance.<br>Thank you for choosing Pak Globe Travels.</div></div></div><script>window.onload=()=>setTimeout(()=>window.print(),250);</script></body></html>`;
    const paymentRows = payments.map((payment, index) => `<tr><td>${index + 1}</td><td>${fmtDate(payment.received_on)}</td><td>${esc(payment.method || '—')}</td><td>${esc(payment.note || '—')}</td><td class="num">PKR ${fmtNum(payment.amount || 0)}</td></tr>`).join('');
    const premiumPrintCss = `.premium-history{margin-top:14px}.premium-history table{font-size:10px}.premium-history th{background:#173d31;color:#fff}.premium-history td{padding:7px}.premium-history .num{text-align:right}.premium-mark{display:inline-block;margin-top:8px;padding:5px 9px;border:1px solid rgba(255,255,255,.35);border-radius:999px;font-size:9px;letter-spacing:.08em;text-transform:uppercase}@media print{body{background:#fff!important}.sheet{border:0!important;box-shadow:none!important}.top{-webkit-print-color-adjust:exact;print-color-adjust:exact}.box,.meta,.balance,th{break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      .premium-history{page-break-inside:avoid}`;
    const paymentState = remaining > 0 ? 'PARTIALLY PAID' : 'PAID IN FULL';
    const enhancedHtml = html
      .replace('<div class="content">', `<div class="status-ribbon"><span>PAYMENT STATUS</span><strong>${paymentState}</strong></div><div class="content">`)
      .replace('</style></head>', `<style>.status-ribbon{display:flex;justify-content:space-between;align-items:center;margin:0 30px;padding:8px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;border-radius:8px;color:#166534;font-size:10px;letter-spacing:.08em}.status-ribbon strong{font-size:12px}.premium-history{page-break-inside:avoid}</style></head>`);
    const printableHtml = enhancedHtml.replace('<div class="box" style="margin-top:12px">Payment Method:', `<div class="premium-history"><div class="section" style="margin-top:0">Payment history</div><table><thead><tr><th>#</th><th>Date</th><th>Method</th><th>Reference</th><th class="num">Amount</th></tr></thead><tbody>${paymentRows || '<tr><td colspan="5">No payments recorded</td></tr>'}</tbody></table></div><div class="box" style="margin-top:12px">Payment Method:`).replace('</head>', `<style>${premiumPrintCss}</style></head>`);
    const frame = document.getElementById('printFrame');
    frame.onload = () => { frame.contentWindow.focus(); frame.contentWindow.print(); };
    frame.srcdoc = printableHtml;
  } catch (e) { toast('Print failed: ' + e.message, 'error'); } finally { hideLoad(); }
}

let packagePaymentRowSeq = 0;

function addPackagePaymentRow(payment = {}) {
  const wrap = document.getElementById('packagePaymentsList');
  if (!wrap) return;
  const row = document.createElement('div');
  row.className = 'package-payment-row';
  row.innerHTML = `<div class="package-payment-grid">
    <input class="form-inp pkg-payment-amount" type="number" min="0" step="0.01" placeholder="Amount" value="${escAttr(payment.amount || '')}">
    <input class="form-inp pkg-payment-date" type="date" value="${escAttr(payment.received_on || '')}">
    <select class="form-inp pkg-payment-method"><option value="">Payment method</option><option>Cash</option><option>Bank Transfer</option><option>Online</option><option>Cheque</option></select>
    <input class="form-inp pkg-payment-note" placeholder="Transaction ID / note" value="${escAttr(payment.note || '')}">
    <button type="button" class="btn-icon package-payment-remove" title="Remove payment" aria-label="Remove payment"><i class="bi bi-trash3"></i></button>
  </div>`;
  wrap.appendChild(row);
  const method = row.querySelector('.pkg-payment-method');
  if (method && payment.method) method.value = payment.method;
  row.querySelector('.package-payment-remove')?.addEventListener('click', () => {
    if (wrap.children.length > 1) row.remove();
    else row.querySelectorAll('input').forEach(input => { input.value = ''; });
  });
}

function readPackagePayments() {
  return [...document.querySelectorAll('#packagePaymentsList .package-payment-row')].map(row => ({
    amount: Number(row.querySelector('.pkg-payment-amount')?.value || 0),
    received_on: row.querySelector('.pkg-payment-date')?.value || new Date().toISOString().slice(0, 10),
    method: row.querySelector('.pkg-payment-method')?.value || '',
    note: row.querySelector('.pkg-payment-note')?.value || ''
  })).filter(payment => payment.amount > 0);
}

function openPackageCreate() {
  const body = document.getElementById('packageModalBody');
  if (!body) return;
  body.innerHTML = `<div class="row g-3"><div class="col-md-6"><label class="form-label">Client Name *</label><input id="pkgClient" class="form-inp" required></div><div class="col-md-6"><label class="form-label">Contact No.</label><input id="pkgContact" class="form-inp" placeholder="03XX-XXXXXXX"></div>
    <div class="col-md-3"><label class="form-label">Adults</label><input id="pkgAdults" type="number" class="form-inp" value="0"></div><div class="col-md-3"><label class="form-label">Children</label><input id="pkgChildren" type="number" class="form-inp" value="0"></div><div class="col-md-3"><label class="form-label">Travel Date</label><input id="pkgTravelDate" type="date" class="form-inp"></div><div class="col-md-3"><label class="form-label">Return Date</label><input id="pkgReturnDate" type="date" class="form-inp"></div>
    <div class="col-md-4"><label class="form-label">Visa — rate / qty</label><div class="input-group"><input id="pkgVisaRate" type="number" class="form-inp" placeholder="Rate"><input id="pkgVisaQty" type="number" class="form-inp" placeholder="Qty" value="0"></div></div>
    <div class="col-md-4"><label class="form-label">Tickets — rate / qty</label><div class="input-group"><input id="pkgTicketRate" type="number" class="form-inp" placeholder="Rate"><input id="pkgTicketQty" type="number" class="form-inp" placeholder="Qty" value="0"></div></div>
    <div class="col-md-4"><label class="form-label">Transport — rate / qty</label><div class="input-group"><input id="pkgTransportRate" type="number" class="form-inp" placeholder="Rate"><input id="pkgTransportQty" type="number" class="form-inp" placeholder="Qty" value="0"></div></div>
    <div class="col-md-6"><label class="form-label">Hotels amount</label><input id="pkgHotel" type="number" class="form-inp" value="0"></div><div class="col-md-6"><label class="form-label">Others amount</label><input id="pkgOther" type="number" class="form-inp" value="0"></div>
    <div class="col-md-6"><label class="form-label">Makkah Hotel / Nights</label><input id="pkgMakkahHotel" class="form-inp" placeholder="Hotel name · 10 nights"></div><div class="col-md-6"><label class="form-label">Madinah Hotel / Nights</label><input id="pkgMadinahHotel" class="form-inp" placeholder="Hotel name · 5 nights"></div>
    <div class="col-12"><label class="form-label">Package Inclusions</label><input id="pkgInclusions" class="form-inp" value="Return Air Ticket, Umrah Visa, Makkah Hotel Accommodation, Madinah Hotel Accommodation, Airport Transfers, Makkah–Madinah Transport"></div>
    <div class="col-12"><div class="package-payments-heading"><label class="form-label mb-0">Payments Received</label><button type="button" class="btn-ghost btn-sm" id="addPackagePaymentBtn"><i class="bi bi-plus-lg"></i> Add payment</button></div><div id="packagePaymentsList"></div><div class="package-payments-help">Add each installment separately with its date, method and transaction reference.</div></div><div class="col-md-6"><label class="form-label">Received By</label><input id="pkgReceivedBy" class="form-inp"></div></div>`;
  packagePaymentRowSeq = 0;
  openModal('packageModal');
  addPackagePaymentRow();
  document.getElementById('addPackagePaymentBtn')?.addEventListener('click', () => addPackagePaymentRow());
}

// Package Creating supports any number of dated installment payments.
async function savePackage() {
  const v = id => document.getElementById(id)?.value || 0;
  if (!String(v('pkgClient')).trim()) return toast('Client name is required', 'warn');
  try {
    showLoad('Saving package…');
    await POST('/packages', {
      client_name: v('pkgClient'), visa_rate: v('pkgVisaRate'), visa_qty: v('pkgVisaQty'),
      ticket_rate: v('pkgTicketRate'), ticket_qty: v('pkgTicketQty'),
      transport_rate: v('pkgTransportRate'), transport_qty: v('pkgTransportQty'),
      hotel_amount: v('pkgHotel'), other_amount: v('pkgOther'),
      details: {
        contact: v('pkgContact'), adults: v('pkgAdults'), children: v('pkgChildren'),
        travel_date: v('pkgTravelDate'), return_date: v('pkgReturnDate'),
        makkah_hotel: v('pkgMakkahHotel'), madinah_hotel: v('pkgMadinahHotel'),
        inclusions: String(v('pkgInclusions')).split(',').map(item => item.trim()).filter(Boolean),
        received_by: v('pkgReceivedBy')
      },
      payments: readPackagePayments()
    });
    closeModal('packageModal');
    toast('Package created successfully', 'success');
    await pgPackages();
  } catch (e) { toast(e.message, 'error'); }
  finally { hideLoad(); }
}
window.savePackage = savePackage;

function filterQuotationsTable() {
  const qStr = document.getElementById('quotSearchInp')?.value.trim().toLowerCase() || '';
  const typeF = document.getElementById('quotTypeFilter')?.value || '';
  const statF = document.getElementById('quotStatusFilter')?.value || '';

  const filtered = (G.quotations || []).filter(q => {
    const matchSearch = !qStr ||
      (q.client_name || '').toLowerCase().includes(qStr) ||
      (q.invoice_no || '').toLowerCase().includes(qStr) ||
      (q.contact_no || '').toLowerCase().includes(qStr);
    const matchType = !typeF || q.type === typeF;
    const matchStat = !statF || q.status === statF;
    return matchSearch && matchType && matchStat;
  });

  const tb = document.getElementById('quotTbody');
  if (tb) tb.innerHTML = renderQuotationRows(filtered);
}

async function previewQuotationById(id) {
  showLoad('Loading quotation preview…');
  try {
    const q = await GET(`/quotations/${id}`);
    if (!q) throw new Error('Quotation not found');

    const branch = G.branches.find(b => b.id === q.branch_id) || {
      name: q.branch_name || 'Pak Globe Travels',
      phone: '0310-0376111', license_no: '5807',
      address: 'Autobhan Road, Hyderabad', brand_color: '#3A94BA'
    };

    const parsedOptions = parseQuotationOptions(q.options);
    const fullData = { ...q, options: parsedOptions };

    const isGroup = q.type === 'group';
    const html = isGroup
      ? renderGroupProposalA4Html(fullData, branch, q.brand_settings)
      : renderProposalA4Html(fullData, branch, q.brand_settings);
    _activeProposalType = q.type;
    _activeProposalData = fullData;
    document.getElementById('proposalPreviewBody').innerHTML = html;
    const title = document.getElementById('proposalModalTitle');
    if (title) title.textContent = isGroup ? 'Group Package Proposal Preview' : 'Quotation Proposal Preview';
    generateProposalQrCode(fullData);
    hideLoad();
    openModal('proposalModal');
  } catch (err) {
    hideLoad();
    toast('Error: ' + err.message, 'error');
  }
}

async function editQuotationById(id) {
  showLoad('Loading quotation into editor…');
  try {
    const q = await GET(`/quotations/${id}`);
    if (!q) throw new Error('Quotation not found');

    const fullData = { ...q, options: parseQuotationOptions(q.options) };
    if (q.type === 'group') {
      nav('grp');
      restoreGroupQuotation(fullData);
    } else {
      nav('pvt');
      restorePrivateQuotation(fullData);
    }
    toast(`Loaded ${q.invoice_no} into the ${q.type === 'group' ? 'group' : 'private'} costing editor`, 'info');
    hideLoad();
  } catch (err) {
    hideLoad();
    toast('Failed to load quotation: ' + err.message, 'error');
  }
}

async function deleteQuotationById(id) {
  if (!confirm('Move this quotation to the recycle bin? It can be restored within 30 days.')) return;
  try {
    await DELETE(`/quotations/${id}`);
    toast('Quotation moved to Recycle Bin', 'success');
    pgAllQuotations();
  } catch (err) {
    toast('Delete failed: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════
//  PHASE 4: BOOKING INQUIRIES & LIVE CHAT PIPELINE
// ═══════════════════════════════════════════════════════════

// Advance a query to next stage
const QUERY_STAGES = ['inquire', 'checking_rates', 'proposal_sent', 'confirm_whatsapp', 'booked', 'completed', 'cancelled'];
async function advanceQueryStage(id, currentStatus) {
  const activeStages = ['inquire', 'checking_rates', 'proposal_sent', 'confirm_whatsapp', 'booked', 'completed'];
  const idx = activeStages.indexOf(currentStatus);
  if (idx < 0 || idx >= activeStages.length - 1) {
    toast('Cannot advance further from ' + (currentStatus || '').replace(/_/g, ' '), 'warn'); return;
  }
  const nextStage = activeStages[idx + 1];
  if (!confirm('Move query to "' + nextStage.replace(/_/g, ' ').toUpperCase() + '"?')) return;
  showLoad('Updating stage…');
  try {
    await PUT('/queries/' + id, { status: nextStage });
    toast('✅ Query advanced to ' + nextStage.replace(/_/g, ' '), 'success');
    await pgQueries();
  } catch(err) {
    toast('Stage update failed: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}
window.advanceQueryStage = advanceQueryStage;

async function deleteQuery(id) {
  if (!confirm('Are you sure you want to delete this booking inquiry?')) return;
  showLoad('Deleting inquiry…');
  try {
    await DEL('/queries/' + id);
    toast('Booking inquiry deleted', 'success');
    await pgQueries();
  } catch(err) {
    toast('Delete failed: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}
window.deleteQuery = deleteQuery;

async function pgQueries() {
  const pg = document.getElementById('queries');
  if (!pg) return;
  showLoad('Loading queries…');

  try {
    const queries = await GET('/queries');
    G.queries = queries || [];

    const STAGES = [
      { id: 'inquire', label: '1. Inquire' },
      { id: 'checking_rates', label: '2. Checking Rates' },
      { id: 'proposal_sent', label: '3. Proposal Sent' },
      { id: 'confirm_whatsapp', label: '4. WhatsApp Confirm' },
      { id: 'booked', label: '5. Booked' },
      { id: 'completed', label: '6. Completed' },
      { id: 'cancelled', label: '7. Cancelled' },
    ];

    pg.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="bi bi-chat-dots me-2" style="color:var(--acc)"></i>Booking Queries Pipeline</h1>
          <span class="page-sub">7-stage booking workflow, WhatsApp tracking & Live client notes</span>
        </div>
        <button class="btn-pri" onclick="openNewQueryModal()"><i class="bi bi-plus-lg me-1"></i>New Query</button>
      </div>

      <div class="sec-box mb-3">
        <div class="row g-2">
          <div class="col-md-8">
            <input class="form-inp" id="qFilterSearch" placeholder="Filter inquiries by client, hotel, or contact…" oninput="filterQueriesTable()">
          </div>
          <div class="col-md-4">
            <select class="form-inp" id="qFilterStage" onchange="filterQueriesTable()">
              <option value="">All 7 Pipeline Stages</option>
              ${STAGES.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="glass-card">
        <div class="table-wrap">
          <table class="tbl" id="queriesTable">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Client Name & Contact</th>
                <th>Hotel Inquiry</th>
                <th>Travel Dates</th>
                <th>Pipeline Stage</th>
                <th>Branch</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="queriesTbody">
              ${renderQueryRows(G.queries)}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    toast('Error loading queries: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

function renderQueryRows(list) {
  if (!list || !list.length) {
    return '<tr><td colspan="8" class="t3 text-center py-4">No booking queries found ✨</td></tr>';
  }

  const stageBadge = {
    inquire: 'bs-new', checking_rates: 'bs-info', proposal_sent: 'bs-warn',
    confirm_whatsapp: 'bs-warn', booked: 'bs-active', completed: 'bs-active', cancelled: 'bs-inactive'
  };

  const branchMap = new Map((G.branches || []).map(b => [b.id, b.name]));

  return list.map(q => {
    const branchName = q.branch_id ? (branchMap.get(q.branch_id) || 'Branch') : 'Head Office';
    const canAdvance = !['completed', 'cancelled'].includes(q.status);
    return `
    <tr>
      <td><code style="color:var(--acc);font-weight:700">${esc(q.ref_code||'—')}</code></td>
      <td>
        <div style="font-weight:700;color:var(--t1)">${esc(q.client_name)}</div>
        <div class="t3" style="font-size:11px">${esc(q.client_phone||'No phone')}</div>
      </td>
      <td>${esc(q.hotel_name||'Custom Package')}</td>
      <td class="t2">${q.checkin_date ? fmtDate(q.checkin_date) + ' → ' + fmtDate(q.checkout_date) : 'Flexible'}</td>
      <td><span class="badge-status ${stageBadge[q.status]||'bs-info'}">${(q.status||'').replace(/_/g,' ')}</span></td>
      <td class="t3">${esc(branchName)}</td>
      <td class="t3">${timeAgo(q.updated_at || q.created_at)}</td>
      <td>
        <div class="action-btns d-flex align-items-center gap-1">
          <button class="btn-ghost btn-sm" onclick="openQueryModal('${q.id}')">
            <i class="bi bi-chat-left-text me-1"></i>Update
          </button>
          ${canAdvance ? `
          <button class="btn-stage" onclick="advanceQueryStage('${q.id}', '${q.status}')" title="Advance to next stage">
            <i class="bi bi-arrow-right me-1"></i>Next
          </button>` : ''}
          <button class="btn-icon" style="color:var(--err)" onclick="deleteQuery('${q.id}')" title="Delete inquiry">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterQueriesTable() {
  const str = document.getElementById('qFilterSearch')?.value.trim().toLowerCase() || '';
  const stage = document.getElementById('qFilterStage')?.value || '';

  const filtered = (G.queries || []).filter(q => {
    const matchStr = !str ||
      (q.client_name || '').toLowerCase().includes(str) ||
      (q.hotel_name || '').toLowerCase().includes(str) ||
      (q.client_phone || '').toLowerCase().includes(str);
    const matchStage = !stage || q.status === stage;
    return matchStr && matchStage;
  });

  const tb = document.getElementById('queriesTbody');
  if (tb) tb.innerHTML = renderQueryRows(filtered);
}

let _activeQueryObj = null;

function openNewQueryModal(initialData = {}) {
  _activeQueryObj = null;
  document.getElementById('qId').value = '';
  document.getElementById('qClientName').value = initialData.client_name || '';
  document.getElementById('qPhone').value = initialData.client_phone || '';
  document.getElementById('qTravelDates').value = initialData.travel_dates || '';
  document.getElementById('qStatus').value = 'inquire';

  const brSelect = document.getElementById('qBranch');
  if (brSelect) {
    brSelect.innerHTML = G.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  }

  const chat = document.getElementById('qChatHistory');
  if (chat) chat.innerHTML = '<div class="t3 text-center py-2" style="font-size:12px">New inquiry initiated. Post first note below.</div>';

  openModal('queryModal');
}

async function openQueryModal(id) {
  showLoad('Loading query notes…');
  try {
    const q = (G.queries || []).find(item => item.id === id) || await GET(`/queries/${id}`);
    if (!q) throw new Error('Query not found');

    _activeQueryObj = q;
    document.getElementById('qId').value = q.id;
    document.getElementById('qClientName').value = q.client_name || '';
    document.getElementById('qPhone').value = q.client_phone || '';
    document.getElementById('qTravelDates').value = q.checkin_date ? `${q.checkin_date} to ${q.checkout_date}` : '';
    document.getElementById('qStatus').value = q.status || 'inquire';

    const brSelect = document.getElementById('qBranch');
    if (brSelect) {
      brSelect.innerHTML = G.branches.map(b => `<option value="${b.id}" ${b.id === q.branch_id ? 'selected' : ''}>${b.name}</option>`).join('');
    }

    renderQueryChatLog(q.workflow_history || q.chat_history);
    hideLoad();
    openModal('queryModal');
  } catch (err) {
    hideLoad();
    toast('Error: ' + err.message, 'error');
  }
}

function renderQueryChatLog(history) {
  const box = document.getElementById('qChatHistory');
  if (!box) return;

  let messages = [];
  try {
    messages = typeof history === 'string' ? JSON.parse(history) : (history || []);
  } catch (e) { messages = []; }

  if (!messages.length) {
    box.innerHTML = '<div class="t3 text-center py-2" style="font-size:12px">No notes logged yet. Type below.</div>';
    return;
  }

  box.innerHTML = messages.map(m => {
    const sender = m.user || m.from || 'Staff';
    const isOut = sender === G.user?.username;
    const body = m.message || m.text || m.notes || m.action || '';
    const actionLabel = m.action && m.message ? `<span class="badge bg-secondary me-1" style="font-size:9px">${esc(m.action)}</span>` : '';
    return `
      <div class="chat-bubble ${isOut ? 'chat-out' : 'chat-in'}" style="margin-bottom:6px;padding:8px 12px;border-radius:10px;background:${isOut ? 'var(--priBg, #e0f2fe)' : '#f1f5f9'}">
        <div style="font-size:10px;opacity:0.8;margin-bottom:2px"><strong>${esc(sender)}</strong> · ${timeAgo(m.ts)}</div>
        <div style="font-size:12px">${actionLabel}${esc(body)}</div>
      </div>`;
  }).join('');
  box.scrollTop = box.scrollHeight;
}

async function addQueryMessage() {
  const inp = document.getElementById('qNewMessage');
  const txt = inp?.value.trim();
  if (!txt) return;

  const qId = document.getElementById('qId')?.value;
  if (!qId) { toast('Save inquiry first before adding notes', 'warn'); return; }

  try {
    const res = await POST(`/queries/${qId}/chat`, { message: txt });
    if (_activeQueryObj) _activeQueryObj.workflow_history = res.history;
    inp.value = '';
    renderQueryChatLog(res.history);
    toast('Note logged', 'success');
  } catch (err) {
    toast('Error: ' + err.message, 'error');
  }
}

async function saveQueryModal() {
  const qId = document.getElementById('qId')?.value;
  const client_name = document.getElementById('qClientName')?.value.trim();
  const client_phone = document.getElementById('qPhone')?.value.trim();
  const status = document.getElementById('qStatus')?.value;
  const branch_id = document.getElementById('qBranch')?.value;

  if (!client_name) { toast('Client name required', 'warn'); return; }

  try {
    showLoad('Saving inquiry…');
    if (qId) {
      await PUT(`/queries/${qId}`, { client_name, client_phone, status, branch_id });
      toast('Inquiry updated!', 'success');
    } else {
      await POST('/queries', { client_name, client_phone, status, branch_id });
      toast('Inquiry created!', 'success');
    }
    closeModal('queryModal');
    await pgQueries();
  } catch (err) {
    toast('Save error: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

// ═══════════════════════════════════════════════════════════
//  PHASE 5: USERS, BRANCHES, AND ADMINISTRATION
// ═══════════════════════════════════════════════════════════
async function pgUsers() {
  const pg = document.getElementById('users');
  if (!pg) return;
  showLoad('Loading users…');
  try {
    const users = await GET('/users');
    G.users = users || [];
    if (!G.branches || !G.branches.length) {
      try { G.branches = (await GET('/branches')) || []; } catch (_) { G.branches = []; }
    }

    // Keep the user directory branch-first: each branch expands into its own user list.
    const branchMap = new Map((G.branches || []).map(b => [b.id, b]));
    const grouped = new Map();
    G.users.forEach(u => {
      const key = u.branch_id || '__head_office__';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(u);
    });
    const orderedGroups = [...grouped.entries()].sort((a, b) => {
      if (a[0] === '__head_office__') return 1;
      if (b[0] === '__head_office__') return -1;
      return (branchMap.get(a[0])?.name || a[0]).localeCompare(branchMap.get(b[0])?.name || b[0]);
    });
    const branchUserGroups = orderedGroups.map(([branchId, branchUsers], index) => {
      const branch = branchMap.get(branchId);
      const branchName = branch?.name || (branchId === '__head_office__' ? 'Head Office / Global Users' : branchId);
      const branchCode = branch?.code || (branchId === '__head_office__' ? 'GLOBAL' : 'BRANCH');
      return `
        <details class="branch-user-group" ${index === 0 ? 'open' : ''}>
          <summary>
            <span class="branch-user-title"><i class="bi bi-building"></i><span>${esc(branchName)}</span><code>${esc(branchCode)}</code></span>
            <span class="branch-user-count">${branchUsers.length} user${branchUsers.length === 1 ? '' : 's'} <i class="bi bi-chevron-down"></i></span>
          </summary>
          <div class="table-wrap branch-user-table-wrap">
            <table class="tbl branch-user-table">
              <thead><tr><th>Username</th><th>Full Name</th><th>Department</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
              <tbody>${branchUsers.map(u => `
                <tr>
                  <td data-label="Username"><code style="color:var(--pri);font-weight:700">${esc(u.username)}</code></td>
                  <td data-label="Full Name" style="font-weight:700">${esc(u.full_name)}</td>
                  <td class="t2">${esc(u.department || '—')}</td>
                  <td data-label="Role"><span class="role-badge role-${u.role}">${u.role}</span></td>
                  <td data-label="Status"><span class="badge-status ${u.status === 'active' ? 'bs-active' : 'bs-inactive'}">${u.status}</span></td>
                  <td class="t3">${u.last_login ? timeAgo(u.last_login) : 'Never'}</td>
                  <td data-label="Actions"><div class="action-btns"><button class="btn-icon" title="Edit User" onclick="openUserModal('${u.id}')"><i class="bi bi-pencil"></i></button></div></td>
                </tr>`).join('')}</tbody>
            </table>
          </div>
        </details>`;
    }).join('');

    pg.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="bi bi-person-gear me-2" style="color:var(--pri)"></i>User Management</h1>
          <span class="page-sub">Role-Based Access Control (RBAC), branches, and status</span>
        </div>
        <button class="btn-pri" onclick="openUserModal()"><i class="bi bi-plus-lg me-1"></i>Add New User</button>
      </div>
      <div class="branch-user-directory">${branchUserGroups || '<div class="empty-state">No users found.</div>'}</div>`;
  } catch (err) { toast('Error loading users: ' + err.message, 'error'); }
  finally { hideLoad(); }
}


function toggleAllRbac(checked) {
  document.querySelectorAll('.rbac-chk').forEach(c => {
    if (!c.disabled) c.checked = !!checked;
  });
}

function onUserRoleChanged() {
  const role = document.getElementById('uRole')?.value;
  const isGlobal = GLOBAL_ADMIN_ROLES.has(role);
  const notice = document.getElementById('userRbacGlobalNotice');
  const brSelect = document.getElementById('uBranch');
  const checkAllBtn = document.getElementById('rbacCheckAllBtn');
  const clearAllBtn = document.getElementById('rbacClearAllBtn');

  if (notice) notice.style.display = isGlobal ? 'block' : 'none';
  if (brSelect) {
    if (isGlobal) {
      brSelect.value = '';
      brSelect.disabled = true;
    } else {
      brSelect.disabled = false;
    }
  }

  const chks = document.querySelectorAll('.rbac-chk');
  if (isGlobal) {
    chks.forEach(c => { c.checked = true; c.disabled = true; });
    if (checkAllBtn) checkAllBtn.disabled = true;
    if (clearAllBtn) clearAllBtn.disabled = true;
  } else {
    chks.forEach(c => c.disabled = false);
    if (checkAllBtn) checkAllBtn.disabled = false;
    if (clearAllBtn) clearAllBtn.disabled = false;
  }
}
window.onUserRoleChanged = onUserRoleChanged;

function openUserModal(userId = null) {
  document.getElementById('uId').value = userId || '';
  const brSelect = document.getElementById('uBranch');
  if (brSelect) {
    brSelect.disabled = false;
    brSelect.innerHTML = '<option value="">Head Office (Global)</option>' +
      G.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  }

  // Build RBAC matrix rows dynamically
  const rbacTbody = document.getElementById('userRbacTbody');
  if (rbacTbody && !rbacTbody.dataset.built) {
    const MODULES = [
      ['dash',           '📊 Dashboard'],
      ['hotels',         '🏨 Hotels Inventory'],
      ['search',         '🔍 Hotel Search'],
      ['vendors',        '🏢 Vendors & Suppliers'],
      ['queries',        '📞 Booking CRM Queries'],
      ['ratelist',       '📝 Rate List'],
      ['quotations_pvt', '🧾 Private Costing'],
      ['quotations_grp', '👥 Group Costing'],
      ['allquot',        '📋 All Quotations'],
      ['packages',       '📦 Package Creating'],
      ['transport',      '🚌 Transport & Vehicles'],
      ['import',         '📊 Import / Export'],
      ['dedup',          '🔍 Hotel Deduplication'],
      ['users',          '👤 User Accounts & RBAC'],
      ['branches',       '🏪 Branches White-label'],
      ['logs',           '📜 Audit & Activity Logs'],
      ['recycle',        '♻️ Recycle Bin'],
      ['backup',         '💾 Backup'],
      ['settings',       '⚙️ Platform Settings']
    ];
    rbacTbody.innerHTML = MODULES.map(([mod, title]) => `
      <tr>
        <td style="text-align:left;padding-left:8px;font-weight:700;white-space:nowrap">${title}</td>
        <td><input type="checkbox" class="rbac-chk" data-mod="${mod}" data-act="view" style="accent-color:var(--pri);width:16px;height:16px"></td>
        <td><input type="checkbox" class="rbac-chk" data-mod="${mod}" data-act="add"  style="accent-color:var(--pri);width:16px;height:16px"></td>
        <td><input type="checkbox" class="rbac-chk" data-mod="${mod}" data-act="edit" style="accent-color:var(--pri);width:16px;height:16px"></td>
        <td><input type="checkbox" class="rbac-chk" data-mod="${mod}" data-act="del"  style="accent-color:var(--err);width:16px;height:16px"></td>
        <td><input type="checkbox" class="rbac-chk" data-mod="${mod}" data-act="exp"  style="accent-color:var(--pri);width:16px;height:16px"></td>
        <td><input type="checkbox" class="rbac-chk" data-mod="${mod}" data-act="imp"  style="accent-color:var(--pri);width:16px;height:16px"></td>
      </tr>`).join('');
    rbacTbody.dataset.built = '1';
  }

  // Enable all checkboxes and wire change listener
  document.querySelectorAll('.rbac-chk').forEach(c => c.disabled = false);
  const roleSelect = document.getElementById('uRole');
  if (roleSelect) roleSelect.onchange = onUserRoleChanged;

  toggleAllRbac(false);

  if (userId) {
    const u = G.users.find(x => x.id === userId);
    if (u) {
      document.getElementById('uUsername').value = u.username;
      document.getElementById('uUsername').disabled = true;
      document.getElementById('uFullName').value = u.full_name;
      document.getElementById('uEmail').value = u.email || '';
      document.getElementById('uDepartment').value = u.department || '';
      document.getElementById('uPassword').value = '';
      document.getElementById('uRole').value = u.role;
      if (brSelect) brSelect.value = u.branch_id || '';
      document.getElementById('uStatus').value = u.status;
      document.getElementById('userModalTitle').textContent = 'Edit User: ' + u.username;

      // Populate permissions matrix
      let perms = u.permissions;
      if (typeof perms === 'string') {
        try { perms = JSON.parse(perms); } catch(_) { perms = {}; }
      }
      perms = perms || {};

      if (u.role === 'superadmin' || u.role === 'admin') {
        toggleAllRbac(true);
      } else {
        Object.entries(perms).forEach(([mod, acts]) => {
          if (Array.isArray(acts)) {
            acts.forEach(act => {
              const chk = document.querySelector(`.rbac-chk[data-mod="${mod}"][data-act="${act}"]`);
              if (chk) chk.checked = true;
            });
          }
        });
      }
    }
  } else {
    document.getElementById('uUsername').value = '';
    document.getElementById('uUsername').disabled = false;
    document.getElementById('uFullName').value = '';
    document.getElementById('uEmail').value = '';
    document.getElementById('uDepartment').value = '';
    document.getElementById('uPassword').value = '';
    document.getElementById('uRole').value = 'user';
    document.getElementById('uStatus').value = 'active';
    document.getElementById('userModalTitle').textContent = 'Add New User';

    // Default permissions for new standard user
    ['hotels', 'quotations_pvt', 'quotations_grp', 'queries', 'search', 'ratelist'].forEach(mod => {
      ['view', 'add', 'edit'].forEach(act => {
        const chk = document.querySelector(`.rbac-chk[data-mod="${mod}"][data-act="${act}"]`);
        if (chk) chk.checked = true;
      });
    });
  }

  onUserRoleChanged();
  openModal('userModal');
}

async function saveUserModal() {
  const userId = document.getElementById('uId')?.value;
  const username = document.getElementById('uUsername')?.value.trim();
  const full_name = document.getElementById('uFullName')?.value.trim();
  const email = document.getElementById('uEmail')?.value.trim();
  const department = document.getElementById('uDepartment')?.value;
  const password = document.getElementById('uPassword')?.value;
  const role = document.getElementById('uRole')?.value;
  const branch_id = document.getElementById('uBranch')?.value || null;
  const status = document.getElementById('uStatus')?.value;

  if (!username || !full_name) { toast('Username and full name required', 'warn'); return; }

  // Validate branch assignment rules
  const isGlobalRole = GLOBAL_ADMIN_ROLES.has(role);
  if (isGlobalRole && branch_id) {
    toast('Admin / Superadmin cannot be assigned to a branch. Clear the branch field or choose a branch role.', 'warn');
    return;
  }
  if (!isGlobalRole && role !== 'branch_admin' && !branch_id) {
    // branch_admin, editor, viewer, user need a branch
    if (['editor', 'viewer', 'user'].includes(role) && !branch_id) {
      toast('Please select a branch for this user role.', 'warn');
      return;
    }
  }

  // Collect Granular RBAC Permissions Matrix
  // Admin/Superadmin: do NOT save custom permissions (they get role-level full access)
  let permissions = null;
  if (!isGlobalRole) {
    permissions = {};
    document.querySelectorAll('.rbac-chk:checked').forEach(chk => {
      const mod = chk.dataset.mod;
      const act = chk.dataset.act;
      if (!permissions[mod]) permissions[mod] = [];
      permissions[mod].push(act);
    });
  }

  showLoad('Saving user account & RBAC…');
  try {
    if (userId) {
      await PUT(`/users/${userId}`, { full_name, email, department, role, branch_id, status, password, permissions });
      toast('User updated with RBAC matrix!', 'success');
    } else {
      if (!password) { toast('Password required for new user', 'warn'); hideLoad(); return; }
      await POST('/users', { username, full_name, email, department, password, role, branch_id, permissions });
      toast('User created with RBAC permissions!', 'success');
    }
    closeModal('userModal');
    pgUsers();
  } catch (err) {
    toast('User save failed: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

async function pgBranches(forceRefresh = false) {
  const pg = document.getElementById('branches');
  if (!pg) return;
  if (forceRefresh || !G._branchesLoaded || Date.now() - G._branchesLoadedAt >= PAGE_CACHE_TTL) {
    showLoad('Loading branches…');
    try {
      G.branches = (await GET('/branches')) || [];
      G._branchesLoaded = true;
      G._branchesLoadedAt = Date.now();
    } catch (err) {
      toast('Error loading branches: ' + err.message, 'error');
      return;
    } finally {
      hideLoad();
    }
  }
  try {
    pg.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="bi bi-diagram-3 me-2" style="color:var(--acc)"></i>Branch Management</h1>
          <span class="page-sub">White-label branding, contact details & invoice sequences</span>
        </div>
        ${P('branches','add') ? `<button class="btn-pri" onclick="openBranchModal()"><i class="bi bi-plus-lg me-1"></i>Add New Branch</button>` : ''}
      </div>
      <div class="kpi-grid mb-4" style="grid-template-columns:repeat(auto-fit, minmax(280px, 1fr))">
        ${G.branches.map(b => `
          <div class="glass-card p-4" style="border-left:4px solid ${b.brand_color||'#3A94BA'}">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div style="font-weight:900;font-size:16px;color:var(--t1)">${esc(b.name)}</div>
              <span class="pill pill-blue">${esc(b.code||'PGT')}</span>
            </div>
            <div class="t3" style="font-size:11.5px;margin-bottom:8px">📍 ${esc(b.address||'No address registered')}</div>
            <div class="t2" style="font-size:12px;margin-bottom:12px">📞 ${esc(b.phone||'—')} · License #${esc(b.license_no||'—')}</div>
            ${P('branches','edit') || ['admin','superadmin'].includes(G.user?.role) ? `<button class="btn-ghost btn-sm w-100" onclick="openBranchModal('${b.id}')"><i class="bi bi-pencil me-1"></i>${P('branches','edit') ? 'Edit Branch' : 'Edit Quotation Instructions'}</button>` : ''}
          </div>`).join('')}
      </div>`;
    pg.dataset.initialized = 'true';
  } catch (err) { toast('Error loading branches: ' + err.message, 'error'); }
}

function openBranchModal(branchId = null) {
  const canEditBranch = P('branches','edit');
  ['brName','brCode','brPhone','brEmail','brAddress','brLicense','brColor'].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.disabled = !canEditBranch;
  });
  ['brTerms','brDisclaimer','brEmailHotel','brEmailVisa','brEmailTicket','brEmailTransport','brEmailBooking'].forEach(id => {
    const field = document.getElementById(id);
    if (field) field.disabled = !canEditBranch && !['admin','superadmin'].includes(G.user?.role);
  });
  const routingFields = ['brEmailAutomation','brEmailHotel','brEmailVisa','brEmailTicket','brEmailTransport','brEmailBooking'];
  routingFields.forEach(id => { const field = document.getElementById(id); if (field) field.disabled = !canEditBranch; });
  document.getElementById('brId').value = branchId || '';
  if (branchId) {
    const b = G.branches.find(x => x.id === branchId);
    if (b) {
      document.getElementById('brName').value = b.name;
      document.getElementById('brCode').value = b.code || '';
      document.getElementById('brPhone').value = b.phone || '';
      document.getElementById('brEmail').value = b.email || '';
      const routing = b.email_recipients || {};
      document.getElementById('brEmailAutomation').checked = b.email_automation_enabled !== false;
      ['hotel','visa','ticket','transport','booking'].forEach(key => { document.getElementById(`brEmail${key[0].toUpperCase()}${key.slice(1)}`).value = (routing[key] || []).join(',\n'); });
      document.getElementById('brAddress').value = b.address || '';
      document.getElementById('brLicense').value = b.license_no || '';
      document.getElementById('brColor').value = b.brand_color || '#3A94BA';
      document.getElementById('brTerms').value = b.terms_text || '';
      document.getElementById('brDisclaimer').value = b.disclaimer_text || '';
      document.getElementById('brModalTitle').textContent = 'Edit Branch: ' + b.name;
    }
  } else {
    document.getElementById('brName').value = '';
    document.getElementById('brCode').value = '';
    document.getElementById('brPhone').value = '';
    document.getElementById('brEmail').value = '';
    document.getElementById('brEmailAutomation').checked = true;
    ['Hotel','Visa','Ticket','Transport','Booking'].forEach(key => { document.getElementById(`brEmail${key}`).value = ''; });
    document.getElementById('brAddress').value = '';
    document.getElementById('brLicense').value = '';
    document.getElementById('brColor').value = '#3A94BA';
    document.getElementById('brTerms').value = '';
    document.getElementById('brDisclaimer').value = '';
    document.getElementById('brModalTitle').textContent = 'Add New Branch';
  }
  openModal('branchModal');
}

async function saveBranchModal() {
  const branchId = document.getElementById('brId')?.value;
  const name = document.getElementById('brName')?.value.trim();
  const code = document.getElementById('brCode')?.value.trim();
  const phone = document.getElementById('brPhone')?.value.trim();
  const email = document.getElementById('brEmail')?.value.trim();
  const parseEmailList = id => [...new Set(String(document.getElementById(id)?.value || '').split(/[;,\n]/).map(value => value.trim().toLowerCase()).filter(Boolean))];
  const email_recipients = {
    hotel: parseEmailList('brEmailHotel'),
    visa: parseEmailList('brEmailVisa'),
    ticket: parseEmailList('brEmailTicket'),
    transport: parseEmailList('brEmailTransport'),
    booking: parseEmailList('brEmailBooking')
  };
  const allRoutingEmails = Object.values(email_recipients).flat();
  if (allRoutingEmails.some(value => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) { toast('Please enter valid department email addresses.', 'warn'); return; }
  const address = document.getElementById('brAddress')?.value.trim();
  const license_no = document.getElementById('brLicense')?.value.trim();
  const brand_color = document.getElementById('brColor')?.value;
  const terms_text = document.getElementById('brTerms')?.value.trim() || '';
  const disclaimer_text = document.getElementById('brDisclaimer')?.value.trim() || '';

  if (!name) { toast('Branch name is required', 'warn'); return; }

  showLoad('Saving branch…');
  try {
    if (branchId) {
      if (P('branches','edit')) {
        await PUT(`/branches/${branchId}`, { name, code, phone, email, address, license_no, brand_color, terms_text, disclaimer_text, email_recipients, email_automation_enabled: document.getElementById('brEmailAutomation')?.checked !== false });
        toast('Branch updated!', 'success');
      } else {
        await PUT(`/branches/${branchId}/instructions`, { terms_text, disclaimer_text });
        toast('Branch quotation instructions updated!', 'success');
      }
    } else {
      await POST('/branches', { name, code, phone, email, address, license_no, brand_color, terms_text, disclaimer_text, email_recipients, email_automation_enabled: document.getElementById('brEmailAutomation')?.checked !== false });
      toast('Branch created!', 'success');
    }
    closeModal('branchModal');
    pgBranches(true);
  } catch (err) {
    toast('Branch error: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

const SETTINGS_OPTION_CATEGORIES = {
  airlines: { label: 'Airlines', defaults: AIRLINE_OPTIONS },
  cabin_classes: { label: 'Cabin Classes', defaults: CABIN_OPTIONS },
  room_types: { label: 'Hotel Room Types', defaults: ROOM_OPTIONS },
  meal_plans: { label: 'Meal Plans', defaults: ['RO', 'BB', 'HB', 'FB', 'Suhoor', 'Iftar'] },
  vehicle_types: { label: 'Transport Vehicles', defaults: VEHICLE_OPTIONS },
  transport_sectors: { label: 'Transport Routes', defaults: SECTOR_OPTIONS },
  baggage_allowances: { label: 'Baggage Allowances', defaults: BAGGAGE_OPTIONS }
};

function renderSettingsOptionChips(container, key, values, editable) {
  container.innerHTML = values.map(value => `
    <span class="sett-option-chip" data-option-value="${escAttr(value)}"
      style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px;margin:3px;border-radius:20px;background:var(--priB);font-size:11px">
      ${esc(value)}${editable ? '<button type="button" aria-label="Remove option" style="border:0;background:none;color:var(--t3);padding:0 2px">×</button>' : ''}
    </span>`).join('');
  if (editable) {
    container.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => {
        button.closest('.sett-option-chip')?.remove();
        window.markSettingsDirty?.();
      });
    });
  }
}

function addSettingsOption(key) {
  const input = document.getElementById(`settOptionInput-${key}`);
  const own = document.getElementById(`settOptionOwn-${key}`);
  const inherited = document.getElementById(`settOptionInherited-${key}`);
  const value = input?.value.trim();
  if (!value || !own) return;
  const allValues = [...own.querySelectorAll('[data-option-value]'), ...(inherited?.querySelectorAll('[data-option-value]') || [])]
    .map(item => item.dataset.optionValue.toLocaleLowerCase());
  if (allValues.includes(value.toLocaleLowerCase())) {
    toast('This option already exists.', 'warn');
    return;
  }
  const chip = document.createElement('span');
  chip.className = 'sett-option-chip';
  chip.dataset.optionValue = value;
  chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:4px 8px;margin:3px;border-radius:20px;background:var(--priB);font-size:11px';
  const label = document.createElement('span');
  label.textContent = value;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.setAttribute('aria-label', `Remove ${value}`);
  remove.textContent = '×';
  remove.style.cssText = 'border:0;background:none;color:var(--t3);padding:0 2px';
  remove.addEventListener('click', () => { chip.remove(); window.markSettingsDirty?.(); });
  chip.append(label, remove);
  own.appendChild(chip);
  input.value = '';
  window.markSettingsDirty?.();
}

function renderSettingsOptionManager(settings, branchMode, canEdit) {
  const ownCatalog = settings.own_catalog_options || {};
  const globalCatalog = settings.global_catalog_options || {};
  return Object.entries(SETTINGS_OPTION_CATEGORIES).map(([key, category]) => {
    const defaultValues = category.defaults;
    const inheritedValues = branchMode
      ? (globalCatalog[key]?.length ? globalCatalog[key] : defaultValues)
      : [];
    const ownValues = ownCatalog[key]?.length
      ? ownCatalog[key]
      : (!branchMode && !globalCatalog[key]?.length ? defaultValues : []);
    return `
      <div class="col-lg-6">
        <div class="p-3 h-100" style="border:1px solid var(--glass-brd);border-radius:10px">
          <div class="fw-bold mb-2" style="font-size:12px">${category.label}</div>
          ${branchMode ? `<div style="font-size:10px;color:var(--t3)">Shared options</div><div id="settOptionInherited-${key}" class="mb-2"></div>` : ''}
          <div style="font-size:10px;color:var(--t3)">${branchMode ? 'Branch options' : 'Available options'}</div>
          <div id="settOptionOwn-${key}" class="mb-2"></div>
          ${canEdit ? `<div class="d-flex gap-2">
            <input class="form-inp py-1" id="settOptionInput-${key}" maxlength="100" placeholder="Add ${category.label.toLowerCase()} option">
            <button type="button" class="btn-ghost" onclick="addSettingsOption('${key}')">Add</button>
          </div>` : ''}
        </div>
      </div>`;
  }).join('');
}

async function handleSettingsLogoUpload(fileInput) {
  if (!fileInput.files || !fileInput.files[0]) return;
  const form = new FormData();
  form.append('linked_type', 'logo');
  form.append('file', fileInput.files[0]);
  showLoad('Uploading company logo…');
  try {
    const result = await UPL('/images/upload', form);
    if (!result?.url) throw new Error('The image service did not return a public URL');
    document.getElementById('settLogoUrl').value = result.url;
    document.getElementById('settLogoPreview').src = result.url;
    document.getElementById('settLogoPreview').hidden = false;
    toast('Logo uploaded successfully.', 'success');
  } catch (err) {
    toast('Logo upload failed: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

async function pgSettings(forceRefresh = false) {
  const pg = document.getElementById('settings');
  if (!pg) return;

  try {
    if (P('users') && !G.users.length) {
      try { G.users = await GET('/users') || []; } catch (_) { G.users = G.users || []; }
    }
    if (forceRefresh || !G._settingsLoaded || Date.now() - G._settingsLoadedAt >= PAGE_CACHE_TTL) {
      showLoad('Loading settings…');
      try {
        G.settings = await GET('/settings') || {};
        G._settingsLoaded = true;
        G._settingsLoadedAt = Date.now();
      } finally {
        hideLoad();
      }
    }
    const sett = G.settings || {};
    let emailStatus = { provider: 'Resend', configured: false, sandbox: false, from: '', scheduler: 'Every 15 minutes' };
    try { emailStatus = await GET('/email/status') || emailStatus; } catch (_) { /* status is informational */ }
    updateBrandLogos();
    const mealChoices = [...new Set([...mealPlanOptions(), ...(sett.default_meal ? [sett.default_meal] : [])])];
    const branchId = G.user?.branchId || G.user?.branch_id;
    const branchMode = G.user?.role !== 'superadmin' && !!branchId;
    const settingsPermission = G.user?.permissions?.settings;
    const hasCustomSettingsEdit = settingsPermission === true || settingsPermission?.edit === true;
    const canEditSettings = G.user?.role === 'superadmin' ||
      (!!branchId && (G.user?.role === 'branch_admin' || hasCustomSettingsEdit));

    pg.innerHTML = `
      <div class="page-header settings-page-header" style="flex-wrap:wrap;gap:12px">
        <div>
          <div class="settings-eyebrow"><i class="bi bi-sliders2-vertical"></i> CONTROL CENTER</div>
          <h1 class="page-title"><i class="bi bi-gear-wide-connected me-2" style="color:var(--pri)"></i>${branchMode ? 'Branch Settings' : 'System & Platform Settings'}</h1>
          <span class="page-sub">${branchMode ? 'Settings, branding, quotation instructions and custom options for your branch' : 'Global rates, branding, company info, invoice sequencing & terms'}</span>
        </div>
        <div class="settings-header-actions">
          <span class="settings-save-state" id="settingsSaveState"><i class="bi bi-check-circle-fill"></i> All changes saved</span>
          ${canEditSettings ? `<button class="btn-pri settings-save-btn" id="saveSettingsBtn" onclick="saveSettingsForm()">
          <i class="bi bi-cloud-check me-1"></i>Save All Settings
        </button>` : '<span class="page-sub">Read-only settings</span>'}
        </div>
      </div>

      <div class="settings-quickbar" aria-label="Settings sections">
        <span class="settings-quick-title"><i class="bi bi-compass"></i> Quick access</span>
        <button type="button" onclick="document.getElementById('settingsFinance')?.scrollIntoView({behavior:'smooth',block:'start'})">Finance</button>
        <button type="button" onclick="document.getElementById('settingsCompany')?.scrollIntoView({behavior:'smooth',block:'start'})">Company</button>
        <button type="button" onclick="document.getElementById('settingsTerms')?.scrollIntoView({behavior:'smooth',block:'start'})">Terms</button>
        <button type="button" onclick="document.getElementById('settingsPreferences')?.scrollIntoView({behavior:'smooth',block:'start'})">Preferences</button>
        <button type="button" onclick="document.getElementById('settingsWhatsApp')?.scrollIntoView({behavior:'smooth',block:'start'})">WhatsApp</button>
        <button type="button" onclick="document.getElementById('settingsEmailAutomation')?.scrollIntoView({behavior:'smooth',block:'start'})">Email API</button>
        <button type="button" onclick="document.getElementById('settingsOptions')?.scrollIntoView({behavior:'smooth',block:'start'})">Travel options</button>
      </div>

      <div class="row g-3">

        <!-- LEFT COLUMN -->
        <div class="col-md-6">

          <!-- Currency & Exchange -->
          <div class="sec-box mb-3" id="settingsFinance">
            <div class="sec-box-title"><span>💱 Currency & Exchange Rates</span></div>
            <div class="row g-2">
              <div class="col-6">
                <label class="form-label">Default ROE (SAR → PKR)</label>
                <div style="position:relative">
                  <input class="form-inp" type="number" step="0.01" id="settROE" value="${sett.default_roe || 78}" placeholder="78">
                  <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--t3);pointer-events:none">PKR/SAR</span>
                </div>
              </div>
              <div class="col-6">
                <label class="form-label">Global Markup % (Auto-add)</label>
                <div style="position:relative">
                  <input class="form-inp" type="number" step="0.5" id="settMarkup" value="${sett.global_markup || 0}" placeholder="0">
                  <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:11px;color:var(--t3);pointer-events:none">%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Visa Rates -->
          <div class="sec-box mb-3" id="settingsVisa">
            <div class="sec-box-title"><span>🛂 Default Visa Rates (SAR)</span></div>
            <div class="row g-2">
              <div class="col-4">
                <label class="form-label">Adult</label>
                <input class="form-inp" type="number" id="settVisaAdult" value="${sett.default_visa_adult || 560}">
              </div>
              <div class="col-4">
                <label class="form-label">Child</label>
                <input class="form-inp" type="number" id="settVisaChild" value="${sett.default_visa_child || 560}">
              </div>
              <div class="col-4">
                <label class="form-label">Infant</label>
                <input class="form-inp" type="number" id="settVisaInfant" value="${sett.default_visa_infant || 150}">
              </div>
            </div>
          </div>

          <!-- Invoice & Sequencing -->
          <div class="sec-box mb-3" id="settingsInvoice">
            <div class="sec-box-title"><span>🧾 Invoice Sequencing</span></div>
            <div class="row g-2">
              <div class="col-6">
                <label class="form-label">Invoice Prefix</label>
                <input class="form-inp" id="settInvPrefix" value="${esc(sett.invoice_prefix || 'PGT')}" placeholder="PGT">
              </div>
              <div class="col-6">
                <label class="form-label">Next Invoice # (Starting)</label>
                <input class="form-inp" type="number" id="settInvStart" value="${sett.invoice_start || 1001}" placeholder="1001">
              </div>
            </div>
            <div class="mt-2 p-2 rounded" style="background:var(--priB);font-size:11.5px;color:var(--t2)">
              <i class="bi bi-info-circle me-1"></i>
              Next invoice will be: <strong>${esc(sett.invoice_prefix||'PGT')}-${sett.invoice_start||1001}</strong>
            </div>
          </div>

          <!-- Terms & Conditions -->
          <div class="sec-box" id="settingsTerms">
            <div class="sec-box-title"><span>📋 ${branchMode ? 'Branch Quotation Terms & Instructions' : 'Global Quotation Terms & Instructions'}</span></div>
            <textarea class="form-inp" id="settTerms" rows="6" style="font-size:12px;line-height:1.6">${esc(sett.terms_text || '1. All rates are subject to availability.\n2. Visa approval subject to Saudi MOFA rules.\n3. Hotel bookings are non-refundable after confirmation.\n4. Package rates are calculated as per current exchange rates.\n5. Flight tickets are issued after full payment confirmation.')}</textarea>
            <label class="form-label mt-2">${branchMode ? 'Custom Instructions for This Branch' : 'Default Quotation Instructions / Disclaimer'}</label>
            <textarea class="form-inp" id="settDisclaimer" rows="3" placeholder="${branchMode ? 'Instructions shown on this branch’s customer proposals' : 'Default instructions shown on customer proposals'}">${esc(sett.disclaimer_text || '')}</textarea>
            <div style="font-size:11px;color:var(--t3);margin-top:4px">${branchMode ? 'These terms and instructions are saved for this branch and print on its customer proposals.' : "These are the global defaults. Branch-specific settings can override them on that branch's proposals."}</div>
          </div>
        </div>

        <!-- RIGHT COLUMN -->
        <div class="col-md-6">

          <!-- Company Info -->
          <div class="sec-box mb-3" id="settingsCompany">
            <div class="sec-box-title"><span>🏢 Company Information</span></div>
            <div class="mb-3">
              <label class="form-label">Company / Branch Logo</label>
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <img id="settLogoPreview" src="${escAttr(sett.logo_url || '')}" alt="Company logo preview" ${sett.logo_url ? '' : 'hidden'} style="max-width:150px;max-height:70px;object-fit:contain;border:1px solid var(--glass-brd);border-radius:6px;padding:5px">
                <input class="form-inp" type="url" id="settLogoUrl" value="__ESC__" placeholder="https://example.com/logo.png" style="max-width:320px">
                <button type="button" class="btn-ghost" onclick="document.getElementById('settLogoUrl').value='';document.getElementById('settLogoPreview').hidden=true">Remove</button>
              </div>
            </div>
            <div class="mb-2">
              <label class="form-label">Company Legal Name</label>
              <input class="form-inp" id="settCompanyName" value="${esc(sett.company_name || 'Pak Globe Travels')}" placeholder="Pak Globe Travels">
            </div>
            <div class="mb-2">
              <label class="form-label">Company Tagline</label>
              <input class="form-inp" id="settTagline" value="${esc(sett.tagline || 'Your Trusted Umrah Partner')}" placeholder="Your Trusted Umrah Partner">
            </div>
            <div class="row g-2 mb-2">
              <div class="col-6">
                <label class="form-label">Phone / WhatsApp</label>
                <input class="form-inp" id="settPhone" value="${esc(sett.company_phone || '')}" placeholder="+92 300 1234567">
              </div>
              <div class="col-6">
                <label class="form-label">Email Address</label>
                <input class="form-inp" id="settEmail" value="${esc(sett.company_email || '')}" placeholder="info@pakglobe.com">
              </div>
            </div>
            <div class="mb-2">
              <label class="form-label">Company Address (Print Footer)</label>
              <input class="form-inp" id="settAddress" value="${esc(sett.company_address || '')}" placeholder="Office address for vouchers">
            </div>
            <div class="mb-2">
              <label class="form-label">License / IATA Number</label>
              <input class="form-inp" id="settLicense" value="${esc(sett.license_no || '')}" placeholder="e.g. IATA-123456">
            </div>
            <div>
              <label class="form-label">WhatsApp Number (Queries Button)</label>
              <div style="position:relative">
                <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--ok);font-size:16px">📱</span>
                <input class="form-inp" id="settWA" value="${esc(sett.whatsapp_number || '')}" placeholder="923001234567" style="padding-left:36px">
              </div>
              <div style="font-size:11px;color:var(--t3);margin-top:3px">International format without + (e.g. 923001234567)</div>
            </div>
          </div>

          <!-- System Preferences -->
          <div class="sec-box mb-3" id="settingsPreferences">
            <div class="sec-box-title"><span>⚙️ System Preferences</span></div>
            <div class="row g-2">
              <div class="col-6">
                <label class="form-label">Default Package City Order</label>
                <select class="form-inp" id="settCityOrder">
                  <option value="makkah_first" ${(sett.city_order||'makkah_first')==='makkah_first'?'selected':''}>Makkah → Madinah</option>
                  <option value="madina_first"  ${(sett.city_order||'')==='madina_first'?'selected':''}>Madinah → Makkah</option>
                </select>
              </div>
              <div class="col-6">
                <label class="form-label">Default Meal Plan</label>
                <select class="form-inp" id="settMealPlan">
                  ${mealChoices.map(meal => `<option value="${escAttr(meal)}" ${meal===(sett.default_meal||'BB')?'selected':''}>${esc(meal)}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="row g-2 mt-1">
              <div class="col-6">
                <label class="form-label">Default Package Duration (Days)</label>
                <input class="form-inp" type="number" id="settDuration" value="${sett.default_duration || 15}" min="7" max="30">
              </div>
              <div class="col-6">
                <label class="form-label">Session Timeout (Minutes)</label>
                <input class="form-inp" type="number" id="settTimeout" value="${sett.session_timeout || 480}" min="30">
              </div>
            </div>
          </div>

          <!-- WhatsApp Templates -->
          <div class="sec-box mb-3" id="settingsWhatsApp">
            <div class="sec-box-title"><span>📱 WhatsApp Message Templates</span></div>
            <div class="mb-2">
              <label class="form-label">Client Quote Greeting Template</label>
              <textarea class="form-inp" id="settWATemplate" rows="4" style="font-size:11.5px;line-height:1.6" placeholder="As-salamu alaykum {client_name}! Umrah package proposal...">${esc(sett.wa_quote_template || '')}</textarea>
              <div style="font-size:11px;color:var(--t3);margin-top:3px">Variables: {client_name}, {invoice_no}, {total_pkr}, {departure_date}</div>
            </div>
            <div>
              <label class="form-label">Follow-up Reminder Template</label>
              <textarea class="form-inp" id="settWAFollowup" rows="3" style="font-size:11.5px;line-height:1.6" placeholder="Assalam Alaikum {client_name}, just a friendly reminder...">${esc(sett.wa_followup_template || '')}</textarea>
            </div>
          </div>

          <!-- System Info -->
          <div class="sec-box mb-3" id="settingsEmailAutomation">
            <div class="sec-box-title"><span><i class="bi bi-envelope-paper me-1"></i>Email Automation</span></div>
            <div class="settings-email-status ${emailStatus.configured && !emailStatus.sandbox ? 'is-ready' : 'is-warning'}">
              <div class="settings-email-status-icon"><i class="bi ${emailStatus.configured && !emailStatus.sandbox ? 'bi-check2-circle' : 'bi-exclamation-triangle'}"></i></div>
              <div>
                <strong>${!emailStatus.configured ? 'Resend API is not configured' : emailStatus.sandbox ? 'Resend sandbox mode is active' : 'Resend API is connected'}</strong>
                <div>${!emailStatus.configured ? 'Add RESEND_API_KEY and RESEND_FROM_EMAIL to the server .env file.' : emailStatus.sandbox ? 'Verify your sending domain at resend.com/domains, then use a verified From address for external recipients.' : `Sending from ${esc(emailStatus.from || 'server configuration')}`}</div>
                <small>Approval emails and scheduled reminders are processed ${esc(emailStatus.scheduler || 'every 15 minutes')}. API key stays server-side.</small>
              </div>
            </div>
          </div>

          <!-- System Info -->
          <div class="sec-box" style="background:var(--priB)">
            <div class="sec-box-title"><span>📊 System Information</span></div>
            <div style="font-size:12px;line-height:2;color:var(--t2)">
              <div>🏨 Hotels in DB: <strong>${G._hotelSummaryMeta?.total || G._dashData?.hotels || G.hotels.length}</strong></div>
              <div>👥 Vendors: <strong>${G.vendors.length}</strong></div>
              <div>🏢 Branches: <strong>${G.branches.length}</strong></div>
              <div>👤 Users: <strong>${G.users.length}</strong></div>
              <div>📋 Quotations: <strong>${G._dashData?.quotations || G.quotations.length}</strong></div>
              <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--glass-brd)">
                <span style="font-size:11px;color:var(--t3)">Pak Globe Unified Platform v2.0 · ${new Date().getFullYear()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    pg.insertAdjacentHTML('beforeend', `
      <div class="sec-box mt-3" id="settingsOptions">
        <div class="sec-box-title"><span>🧩 Configurable Travel Options</span></div>
        <div style="font-size:11px;color:var(--t3);margin-bottom:10px">
          ${branchMode ? 'Shared options remain available; branch additions are kept separate and combined in forms.' : 'These lists feed hotel contracts, private/group costing, transport details and flight baggage suggestions.'}
        </div>
        <div class="row g-2">${renderSettingsOptionManager(sett, branchMode, canEditSettings)}</div>
      </div>`);
    Object.entries(SETTINGS_OPTION_CATEGORIES).forEach(([key, category]) => {
      const own = document.getElementById(`settOptionOwn-${key}`);
      const inherited = document.getElementById(`settOptionInherited-${key}`);
      const ownCatalog = sett.own_catalog_options || {};
      const globalCatalog = sett.global_catalog_options || {};
      const ownValues = ownCatalog[key]?.length
        ? ownCatalog[key]
        : (!branchMode && !globalCatalog[key]?.length ? category.defaults : []);
      if (own) renderSettingsOptionChips(own, key, ownValues, canEditSettings);
      if (inherited) {
        const values = globalCatalog[key]?.length ? globalCatalog[key] : category.defaults;
        renderSettingsOptionChips(inherited, key, values, false);
      }
    });
    const markSettingsDirty = () => {
      const state = document.getElementById('settingsSaveState');
      if (state) state.innerHTML = '<i class="bi bi-exclamation-circle-fill"></i> Unsaved changes';
      state?.classList.add('is-dirty');
    };
    window.markSettingsDirty = markSettingsDirty;
    pg.querySelectorAll('input, textarea, select').forEach(control => {
      control.addEventListener('input', markSettingsDirty);
      control.addEventListener('change', markSettingsDirty);
    });
    if (!canEditSettings) {
      pg.querySelectorAll('input, textarea, select, button').forEach(control => { control.disabled = true; });
    }
    pg.dataset.initialized = 'true';
  } catch (err) { toast('Settings error: ' + err.message, 'error'); }
}

async function saveSettingsForm() {
  showLoad('Saving all settings…');
  try {
    const v = id => document.getElementById(id)?.value?.trim() || '';
    const nv = id => parseFloat(document.getElementById(id)?.value) || 0;
    const roe = nv('settROE');
    const duration = parseInt(document.getElementById('settDuration')?.value, 10) || 0;
    const timeout = parseInt(document.getElementById('settTimeout')?.value, 10) || 0;
    const email = v('settEmail');
    const whatsapp = v('settWA');
    if (roe <= 0) throw new Error('Default ROE must be greater than 0.');
    if (duration < 1 || duration > 365) throw new Error('Package duration must be between 1 and 365 days.');
    if (timeout < 5 || timeout > 10080) throw new Error('Session timeout must be between 5 minutes and 7 days.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid company email address.');
    if (whatsapp && !/^\d{8,15}$/.test(whatsapp.replace(/^\+/, ''))) throw new Error('WhatsApp number should contain 8–15 digits.');
    const catalog = Object.fromEntries(Object.keys(SETTINGS_OPTION_CATEGORIES).map(key => [
      key,
      [...(document.getElementById(`settOptionOwn-${key}`)?.querySelectorAll('[data-option-value]') || [])]
        .map(item => item.dataset.optionValue)
    ]));
    await PUT('/settings', {
      default_roe:          roe,
      global_markup:        nv('settMarkup'),
      default_visa_adult:   nv('settVisaAdult'),
      default_visa_child:   nv('settVisaChild'),
      default_visa_infant:  nv('settVisaInfant'),
      company_name:         v('settCompanyName'),
      tagline:              v('settTagline'),
      company_phone:        v('settPhone'),
      company_email:        v('settEmail'),
      company_address:      v('settAddress'),
      license_no:           v('settLicense'),
      whatsapp_number:      v('settWA'),
      logo_url:             v('settLogoUrl'),
      invoice_prefix:       v('settInvPrefix'),
      invoice_start:        parseInt(document.getElementById('settInvStart')?.value) || 1001,
      city_order:           v('settCityOrder'),
      default_meal:         v('settMealPlan'),
      default_duration:     duration || 15,
      session_timeout:      timeout || 480,
      terms_text:           v('settTerms'),
      disclaimer_text:      v('settDisclaimer'),
      wa_quote_template:    v('settWATemplate'),
      wa_followup_template: v('settWAFollowup'),
      catalog_options:      catalog,
    });
    // Update global settings cache
    const updated = await GET('/settings');
    if (updated) {
      G.settings = updated;
      G._settingsLoaded = true;
      G._settingsLoadedAt = Date.now();
    }
    updateBrandLogos();
    const state = document.getElementById('settingsSaveState');
    if (state) {
      state.innerHTML = '<i class="bi bi-check-circle-fill"></i> All changes saved';
      state.classList.remove('is-dirty');
    }
    toast('✅ All settings saved successfully!', 'success');
  } catch (err) {
    toast('Failed to save settings: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

async function pgLogs() {
  const pg = document.getElementById('logs');
  if (!pg) return;
  showLoad('Loading audit logs…');
  try {
    const logs = await GET('/logs?limit=200');
    G.logs = logs || [];

    const entities = [...new Set((G.logs || []).map(l => l.entity_type).filter(Boolean))];

    pg.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="bi bi-clock-history me-2" style="color:var(--pri)"></i>Audit & Security Logs</h1>
          <span class="page-sub">Comprehensive tracking of system activities, user operations, and data changes</span>
        </div>
      </div>

      <div class="sec-box mb-3">
        <div class="row g-2">
          <div class="col-md-7">
            <input class="form-inp" id="logSearchInp" placeholder="Search by action, user, entity ID, or details…" oninput="filterLogsTable()">
          </div>
          <div class="col-md-5">
            <select class="form-inp" id="logEntityFilter" onchange="filterLogsTable()">
              <option value="">All Entity Types</option>
              ${entities.map(e => `<option value="${esc(e)}">${esc(e.toUpperCase())}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="glass-card">
        <div class="table-wrap">
          <table class="tbl" id="logsTable">
            <thead>
              <tr>
                <th>Action</th>
                <th>Operated By</th>
                <th>Entity Target</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody id="logsTbody">
              ${renderLogRows(G.logs)}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    toast('Error loading logs: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

function renderLogRows(list) {
  if (!list || !list.length) {
    return '<tr><td colspan="4" class="t3 text-center py-4">No audit logs found ✨</td></tr>';
  }
  return list.map(l => `
    <tr>
      <td><span class="badge-action">${esc(l.action || 'OPERATION')}</span></td>
      <td style="font-weight:700;color:var(--text)">${esc(l.username || 'System')}</td>
      <td class="t2">${esc(l.entity_type || '—')} <code style="color:var(--pri);font-size:10px">${esc(l.entity_id || '')}</code></td>
      <td class="t3" style="font-size:11px;white-space:nowrap">${fmtDate(l.created_at)} · ${timeAgo(l.created_at)}</td>
    </tr>`).join('');
}

function filterLogsTable() {
  const q = document.getElementById('logSearchInp')?.value.trim().toLowerCase() || '';
  const ent = document.getElementById('logEntityFilter')?.value || '';
  const filtered = (G.logs || []).filter(l => {
    const matchQ = !q ||
      (l.action || '').toLowerCase().includes(q) ||
      (l.username || '').toLowerCase().includes(q) ||
      (l.entity_type || '').toLowerCase().includes(q) ||
      (l.entity_id || '').toLowerCase().includes(q);
    const matchEnt = !ent || l.entity_type === ent;
    return matchQ && matchEnt;
  });
  const tbody = document.getElementById('logsTbody');
  if (tbody) tbody.innerHTML = renderLogRows(filtered);
}


async function pgRecycle() {
  const pg = document.getElementById('recycle');
  if (!pg) return;
  showLoad('Loading recycle bin…');

  try {
    const items = await GET('/recycle');
    G.recycle = items || [];

    const types = [...new Set((G.recycle || []).map(i => i.entity_type).filter(Boolean))];

    pg.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="bi bi-trash3 me-2" style="color:var(--err)"></i>Recycle Bin (Restorable Records)</h1>
          <span class="page-sub">Soft-deleted quotations, hotels, inquiries and records are safely restorable</span>
        </div>
      </div>

      <div class="sec-box mb-3">
        <div class="row g-2">
          <div class="col-md-7">
            <input class="form-inp" id="recSearchInp" placeholder="Search deleted records by name, ID, or user…" oninput="filterRecycleTable()">
          </div>
          <div class="col-md-5">
            <select class="form-inp" id="recTypeFilter" onchange="filterRecycleTable()">
              <option value="">All Deleted Record Types</option>
              ${types.map(t => `<option value="${esc(t)}">${esc(t.toUpperCase())}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="glass-card">
        <div class="table-wrap">
          <table class="tbl" id="recycleTable">
            <thead>
              <tr>
                <th>Record Type</th>
                <th>Name / Identifier</th>
                <th>Deleted By</th>
                <th>Expires / Deleted At</th>
                <th style="width:140px">Actions</th>
              </tr>
            </thead>
            <tbody id="recycleTbody">
              ${renderRecycleRows(G.recycle)}
            </tbody>
          </table>
        </div>
      </div>`;
  } catch (err) {
    toast('Error loading recycle bin: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

function renderRecycleRows(list) {
  if (!list || !list.length) {
    return '<tr><td colspan="5" class="t3 text-center py-4">Recycle bin is clean. No deleted records ✨</td></tr>';
  }
  return list.map(it => `
    <tr>
      <td><span class="pill pill-peach pill-bare">${esc((it.entity_type || 'record').toUpperCase())}</span></td>
      <td style="font-weight:700;color:var(--text)">${esc(it.entity_name || it.entity_id || '—')}</td>
      <td class="t2">${esc(it.deleted_by || '—')}</td>
      <td class="t3" style="font-size:11px">${fmtDate(it.expires_at || it.created_at)}</td>
      <td>
        <div class="d-flex align-items-center gap-1">
          <button type="button" class="btn-ghost btn-sm" onclick="restoreRecycleItem('${it.id}')" title="Restore back to active database">
            <i class="bi bi-arrow-counterclockwise me-1"></i>Restore
          </button>
          <button type="button" class="btn-icon text-danger" onclick="deleteRecyclePermanent('${it.id}')" title="Purge permanently">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

function filterRecycleTable() {
  const q = document.getElementById('recSearchInp')?.value.trim().toLowerCase() || '';
  const typ = document.getElementById('recTypeFilter')?.value || '';
  const filtered = (G.recycle || []).filter(it => {
    const matchQ = !q ||
      (it.entity_name || '').toLowerCase().includes(q) ||
      (it.entity_id || '').toLowerCase().includes(q) ||
      (it.deleted_by || '').toLowerCase().includes(q);
    const matchTyp = !typ || it.entity_type === typ;
    return matchQ && matchTyp;
  });
  const tbody = document.getElementById('recycleTbody');
  if (tbody) tbody.innerHTML = renderRecycleRows(filtered);
}

async function restoreRecycleItem(id) {
  showLoad('Restoring record…');
  try {
    await POST('/recycle/' + id + '/restore');
    toast('Record restored successfully!', 'success');
    pgRecycle();
    // Refresh hotels inventory cache
    const htls = await GET('/hotels');
    if (htls) G.hotels = htls;
  } catch (err) {
    toast('Restore error: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

async function deleteRecyclePermanent(id) {
  if (!confirm('Permanently purge this record from database? This cannot be undone.')) return;
  showLoad('Purging record…');
  try {
    await DELETE('/recycle/' + id);
    toast('Record permanently deleted', 'success');
    pgRecycle();
  } catch (err) {
    toast('Purge error: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}



/* ===== 10. 19-COLUMN SHEETJS EXCEL IMPORTER PAGE ===== */
function pgImport() {
  const pg = document.getElementById('import');
  if (!pg) return;
  pg.innerHTML = `
    <div class="page-header d-flex align-items-center justify-content-between flex-wrap gap-2">
      <h1 class="page-title"><i class="bi bi-file-earmark-spreadsheet me-2" style="color:var(--ok)"></i>19-Column Hotel Importer & Exporter</h1>
      <div class="d-flex align-items-center gap-2">
        <button type="button" class="btn-ghost" onclick="downloadExcelSample()">
          <i class="bi bi-download me-1"></i>Sample Excel (.xlsx)
        </button>
        <button type="button" class="btn-pri" onclick="exportHotelsToExcel()">
          <i class="bi bi-file-earmark-arrow-up me-1"></i>Export All Active Hotels
        </button>
      </div>
    </div>

    <div class="row g-3">
      <div class="col-lg-8">
        <div class="glass-card p-4">
          <h5 style="color:var(--pri);font-weight:800;margin-bottom:6px">
            <i class="bi bi-cloud-arrow-up me-2"></i>Upload 19-Column Hotel Contract Sheet
          </h5>
          <p class="t2" style="font-size:12px;margin-bottom:14px">
            Matches existing hotels by Name + City + Area, updates rate contracts, registers new vendors automatically, and safely skips duplicate rows.
          </p>

          <div id="pgImportDropZone" style="border:2px dashed var(--priBrd);border-radius:12px;padding:32px;text-align:center;background:rgba(126,200,227,0.06);cursor:pointer;transition:var(--tr)" onclick="document.getElementById('pgImportFileInput').click()">
            <i class="bi bi-file-earmark-excel" style="font-size:42px;color:var(--pri);display:block;margin-bottom:8px"></i>
            <div style="font-weight:800;font-size:14px;color:var(--t1)">Click to choose or drag & drop Excel file (.xlsx / .xls)</div>
            <div class="t3" style="font-size:11px;margin-top:4px">19 Columns: Name, City, Area, Dist, Shuttle, Stars, Vendor, Room, Meal, Rates, Dates, Extra Bed</div>
            <input type="file" id="pgImportFileInput" accept=".xlsx,.xls,.json" style="display:none" onchange="handleExcelFileUpload(this.files[0])">
          </div>

          <div id="excelReportContainer" class="mt-3" style="display:none"></div>
        </div>
      </div>

      <div class="col-lg-4">
        <div class="glass-card p-4">
          <h5 style="color:var(--t1);font-weight:800;margin-bottom:8px">
            <i class="bi bi-info-circle me-2" style="color:var(--pri)"></i>19-Column Format Guide
          </h5>
          <ul style="font-size:11.5px;color:var(--t2);padding-left:18px;line-height:1.7">
            <li><b>Col 1-3:</b> Hotel Name, City (Makkah/Madinah), Area</li>
            <li><b>Col 4-6:</b> Distance, Shuttle (Yes/No), Star Rating</li>
            <li><b>Col 7-9:</b> Vendor Name, Room Type, Meal Plan</li>
            <li><b>Col 10-12:</b> All Days Rate, Weekday, Weekend Rate</li>
            <li><b>Col 13-14:</b> Check-in Date, Check-out Date</li>
            <li><b>Col 15-19:</b> Extra Bed, Remarks, Days, Best Rate, Country</li>
          </ul>
        </div>
      </div>
    </div>`;
}

/* ===== 11. MEDIA & IMAGE LIBRARY PAGE ===== */
function pgImages() {
  const pg = document.getElementById('images');
  if (!pg) return;
  pg.innerHTML = `
    <div class="page-header d-flex align-items-center justify-content-between flex-wrap gap-2">
      <div>
        <h1 class="page-title"><i class="bi bi-images me-2" style="color:var(--pri)"></i>Media & Image Library</h1>
        <div class="t3" style="font-size:11.5px">Self-Hosted local storage in <code>/uploads/</code> with auto-generated public URLs.</div>
      </div>
      <div>
        <button type="button" class="btn-pri" onclick="document.getElementById('pgImagesInp').click()">
          <i class="bi bi-cloud-arrow-up me-1"></i>Upload Image
        </button>
        <input type="file" id="pgImagesInp" accept="image/*" style="display:none" onchange="uploadDirectImage(this.files[0])">
      </div>
    </div>

    <div class="glass-card p-3">
      <div id="mediaGalleryGrid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:14px;max-height:70vh;overflow-y:auto;padding:4px">
        <div class="text-center p-4 col-12"><div class="spinner-border text-primary" role="status"></div></div>
      </div>
    </div>`;

  loadMediaGallery();
}

/* ===== 12. 8-CHARACTER HOTEL DEDUPLICATION PAGE ===== */
function pgDedup() {
  const pg = document.getElementById('dedup');
  if (!pg) return;
  pg.innerHTML = `
    <div class="page-header d-flex align-items-center justify-content-between flex-wrap gap-2">
      <div>
        <h1 class="page-title"><i class="bi bi-layers-half me-2" style="color:var(--pri)"></i>Hotel Deduplication & Rate Merging</h1>
        <div class="t3" style="font-size:11.5px">Fingerprint: <code>CITY + First 8 Alphanumeric Characters</code></div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <button type="button" class="btn-ghost" onclick="runHotelDeduplicationScan()">
          <i class="bi bi-arrow-repeat me-1"></i>Re-Scan Now
        </button>
        <button type="button" class="btn-pri" onclick="autoMergeAllDuplicates()">
          <i class="bi bi-shield-check me-1"></i>Auto-Merge All Safe
        </button>
      </div>
    </div>

    <div class="glass-card p-4">
      <div id="dedupResultsList"></div>
    </div>`;

  runHotelDeduplicationScan();
}

/* Recycle Bin unified in Section 11 */


// ═══════════════════════════════════════════════════════════
//  VENDORS & SUPPLIERS MODULE (FULL OLVARA CRUD)
// ═══════════════════════════════════════════════════════════
async function pgVendors(forceRefresh = false) {
  const pg = document.getElementById('vendors');
  if (!pg) return;
  if (forceRefresh || !G._vendorsLoaded || Date.now() - G._vendorsLoadedAt >= PAGE_CACHE_TTL) {
    showLoad('Loading vendors…');
    try {
      G.vendors = (await GET('/vendors')) || [];
      G._vendorsLoaded = true;
      G._vendorsLoadedAt = Date.now();
    } catch (err) {
      toast('Error loading vendors: ' + err.message, 'error');
      return;
    } finally {
      hideLoad();
    }
  }

  try {
    pg.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="bi bi-people me-2" style="color:var(--pri)"></i>Vendors & Suppliers</h1>
          <span class="page-sub">Contracted Umrah rate suppliers, contact directories & WhatsApp shortcuts</span>
        </div>
        <button class="btn-pri" onclick="openVendorModal()"><i class="bi bi-plus-lg me-1"></i>Add New Vendor</button>
      </div>

      <div class="sec-box mb-3">
        <div class="row g-2">
          <div class="col-md-8">
            <input class="form-inp" id="vSearchInp" placeholder="Search vendor name, phone, email, WhatsApp, or address…" oninput="filterVendorsTable()">
          </div>
          <div class="col-md-4">
            <select class="form-inp" id="vStatusFilter" onchange="filterVendorsTable()">
              <option value="">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      <div class="glass-card">
        <div class="table-wrap">
          <table class="tbl" id="vendorsTable">
            <thead>
              <tr>
                <th>Vendor / Company</th>
                <th>Contact Person</th>
                <th>Phone</th>
                <th>WhatsApp</th>
                <th>Email</th>
                <th>Location / Address</th>
                <th>Status</th>
                <th style="width:110px">Actions</th>
              </tr>
            </thead>
            <tbody id="vendorsTbody">
              ${renderVendorRows(G.vendors)}
            </tbody>
          </table>
        </div>
      </div>`;
    pg.dataset.initialized = 'true';
  } catch (err) {
    toast('Error loading vendors: ' + err.message, 'error');
  }
}

function renderVendorRows(list) {
  if (!list || !list.length) {
    return '<tr><td colspan="8" class="t3 text-center py-4">No vendors registered yet ✨</td></tr>';
  }
  return list.map(v => `
    <tr>
      <td>
        <div style="font-weight:700;color:var(--text)">${esc(v.name)}</div>
      </td>
      <td>${esc(v.contact_person || '—')}</td>
      <td>${esc(v.phone || '—')}</td>
      <td>
        ${v.whatsapp ? `
          <a href="https://wa.me/${esc(v.whatsapp.replace(/[^0-9]/g,''))}" target="_blank" class="link" style="color:#25D366;font-weight:700">
            <i class="bi bi-whatsapp me-1"></i>${esc(v.whatsapp)}
          </a>` : '<span class="t3">—</span>'}
      </td>
      <td>${v.email ? `<a href="mailto:${esc(v.email)}" class="link">${esc(v.email)}</a>` : '<span class="t3">—</span>'}</td>
      <td class="t3">${esc(v.address || '—')}</td>
      <td><span class="badge-status ${v.status === 'active' ? 'bs-active' : 'bs-inactive'}">${esc(v.status || 'active')}</span></td>
      <td>
        <div class="action-btns d-flex align-items-center gap-1">
          <button class="btn-icon" title="Edit Vendor" onclick="openVendorModal('${v.id}')"><i class="bi bi-pencil"></i></button>
          <button class="btn-icon text-danger" title="Delete Vendor" onclick="deleteVendor('${v.id}', '${esc(v.name)}')"><i class="bi bi-trash3"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function filterVendorsTable() {
  const q = document.getElementById('vSearchInp')?.value.trim().toLowerCase() || '';
  const stat = document.getElementById('vStatusFilter')?.value || '';
  const filtered = (G.vendors || []).filter(v => {
    const matchQ = !q ||
      (v.name || '').toLowerCase().includes(q) ||
      (v.phone || '').toLowerCase().includes(q) ||
      (v.whatsapp || '').toLowerCase().includes(q) ||
      (v.email || '').toLowerCase().includes(q) ||
      (v.address || '').toLowerCase().includes(q);
    const matchStat = !stat || v.status === stat;
    return matchQ && matchStat;
  });
  const tbody = document.getElementById('vendorsTbody');
  if (tbody) tbody.innerHTML = renderVendorRows(filtered);
}

function openVendorModal(id = null) {
  document.getElementById('vId').value = id || '';
  if (id) {
    const v = (G.vendors || []).find(x => x.id === id);
    if (v) {
      document.getElementById('vName').value = v.name || '';
      document.getElementById('vContactPerson').value = v.contact_person || '';
      document.getElementById('vPhone').value = v.phone || '';
      document.getElementById('vWhatsApp').value = v.whatsapp || '';
      document.getElementById('vEmail').value = v.email || '';
      document.getElementById('vStatus').value = v.status || 'active';
      document.getElementById('vAddress').value = v.address || '';
      document.getElementById('vModalTitle').textContent = 'Edit Vendor: ' + v.name;
    }
  } else {
    document.getElementById('vName').value = '';
    document.getElementById('vContactPerson').value = '';
    document.getElementById('vPhone').value = '';
    document.getElementById('vWhatsApp').value = '';
    document.getElementById('vEmail').value = '';
    document.getElementById('vStatus').value = 'active';
    document.getElementById('vAddress').value = '';
    document.getElementById('vModalTitle').textContent = 'Add New Vendor';
  }
  openModal('vendorModal');
}

async function saveVendorModal() {
  const id = document.getElementById('vId')?.value;
  const name = document.getElementById('vName')?.value.trim();
  const contact_person = document.getElementById('vContactPerson')?.value.trim();
  const phone = document.getElementById('vPhone')?.value.trim();
  const whatsapp = document.getElementById('vWhatsApp')?.value.trim();
  const email = document.getElementById('vEmail')?.value.trim();
  const status = document.getElementById('vStatus')?.value || 'active';
  const address = document.getElementById('vAddress')?.value.trim();

  if (!name) { toast('Vendor name is required', 'warn'); return; }

  showLoad('Saving vendor…');
  try {
    if (id) {
      await PUT('/vendors/' + id, { name, contact_person, phone, whatsapp, email, status, address });
      toast('Vendor updated successfully!', 'success');
    } else {
      await POST('/vendors', { name, contact_person, phone, whatsapp, email, status, address });
      toast('Vendor added successfully!', 'success');
    }
    closeModal('vendorModal');
    pgVendors(true);
  } catch (err) {
    toast('Vendor save error: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

async function deleteVendor(id, name) {
  if (!confirm('Are you sure you want to delete vendor "' + name + '"?')) return;
  showLoad('Deleting vendor…');
  try {
    await DELETE('/vendors/' + id);
    toast('Vendor deleted!', 'success');
    pgVendors(true);
  } catch (err) {
    toast('Delete error: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

// ═══════════════════════════════════════════════════════════
//  TRANSPORT & VEHICLE RATES MODULE (FULL OLVARA CRUD)
// ═══════════════════════════════════════════════════════════
async function pgTransport(forceRefresh = false) {
  const pg = document.getElementById('transport');
  if (!pg) return;
  if (forceRefresh || !G._transportLoaded || Date.now() - G._transportLoadedAt >= PAGE_CACHE_TTL) {
    showLoad('Loading transport rates…');
    try {
      G.transport = (await GET('/transport')) || [];
      G._transportLoaded = true;
      G._transportLoadedAt = Date.now();
    } catch (err) {
      toast('Error loading transport: ' + err.message, 'error');
      return;
    } finally {
      hideLoad();
    }
  }

  try {
    const sectors = [...new Set((G.transport || []).map(t => t.sector).filter(Boolean))];
    const vehicles = [...new Set((G.transport || []).map(t => t.vehicle).filter(Boolean))];

    pg.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title"><i class="bi bi-truck me-2" style="color:var(--pri)"></i>Transport & Vehicle Fleet Rates</h1>
          <span class="page-sub">Sector-wise vehicle pricing (SAR / PKR) automatically synced with costing engine</span>
        </div>
        <button class="btn-pri" onclick="openTransportModal()"><i class="bi bi-plus-lg me-1"></i>Add Route Rate</button>
      </div>

      <div class="sec-box mb-3">
        <div class="row g-2">
          <div class="col-md-4">
            <input class="form-inp" id="trSearchInp" placeholder="Search route, sector or vehicle…" oninput="filterTransportTable()">
          </div>
          <div class="col-md-4">
            <select class="form-inp" id="trSectorFilter" onchange="filterTransportTable()">
              <option value="">All Sectors / Routes</option>
              ${sectors.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
            </select>
          </div>
          <div class="col-md-4">
            <select class="form-inp" id="trVehicleFilter" onchange="filterTransportTable()">
              <option value="">All Vehicle Types</option>
              ${vehicles.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="glass-card">
        <div class="table-wrap">
          <table class="tbl" id="transportTable">
            <thead>
              <tr>
                <th>Sector / Route</th>
                <th>Vehicle Type</th>
                <th>Rate (SAR)</th>
                <th>Rate (PKR)</th>
                <th>Status</th>
                <th style="width:110px">Actions</th>
              </tr>
            </thead>
            <tbody id="transportTbody">
              ${renderTransportRows(G.transport)}
            </tbody>
          </table>
        </div>
      </div>`;
    pg.dataset.initialized = 'true';
  } catch (err) {
    toast('Error loading transport: ' + err.message, 'error');
  }
}

function renderTransportRows(list) {
  if (!list || !list.length) {
    return '<tr><td colspan="6" class="t3 text-center py-4">No transport rates registered yet ✨</td></tr>';
  }
  return list.map(t => `
    <tr>
      <td>
        <span class="badge-code" style="color:var(--pri);font-weight:700">${esc(t.sector)}</span>
      </td>
      <td style="font-weight:600">${esc(t.vehicle)}</td>
      <td>
        <span style="color:var(--ok);font-weight:700">${fmtSAR(t.rate_sar || 0)}</span>
      </td>
      <td style="font-weight:700;color:var(--text)">
        ${fmtPKR(t.rate_pkr || (numR(t.rate_sar) * (G.settings?.default_roe || 78)))}
      </td>
      <td><span class="badge-status ${t.status === 'active' ? 'bs-active' : 'bs-inactive'}">${esc(t.status || 'active')}</span></td>
      <td>
        <div class="action-btns d-flex align-items-center gap-1">
          <button class="btn-icon" title="Edit Route Rate" onclick="openTransportModal('${t.id}')"><i class="bi bi-pencil"></i></button>
          <button class="btn-icon text-danger" title="Delete Rate" onclick="deleteTransport('${t.id}', '${esc(t.sector)}', '${esc(t.vehicle)}')"><i class="bi bi-trash3"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function filterTransportTable() {
  const q = document.getElementById('trSearchInp')?.value.trim().toLowerCase() || '';
  const sec = document.getElementById('trSectorFilter')?.value || '';
  const veh = document.getElementById('trVehicleFilter')?.value || '';
  const filtered = (G.transport || []).filter(t => {
    const matchQ = !q ||
      (t.sector || '').toLowerCase().includes(q) ||
      (t.vehicle || '').toLowerCase().includes(q);
    const matchSec = !sec || t.sector === sec;
    const matchVeh = !veh || t.vehicle === veh;
    return matchQ && matchSec && matchVeh;
  });
  const tbody = document.getElementById('transportTbody');
  if (tbody) tbody.innerHTML = renderTransportRows(filtered);
}

function syncTrRatePKR() {
  const sar = parseFloat(document.getElementById('trRateSAR')?.value) || 0;
  const roe = G.settings?.default_roe || 78;
  const pkrInp = document.getElementById('trRatePKR');
  if (pkrInp) pkrInp.value = Math.round(sar * roe);
}

function openTransportModal(id = null) {
  document.getElementById('trId').value = id || '';
  if (id) {
    const t = (G.transport || []).find(x => x.id === id);
    if (t) {
      document.getElementById('trSector').value = t.sector || 'JED-MAK';
      document.getElementById('trVehicle').value = t.vehicle || 'Sedan / Car (1-3 Pax)';
      document.getElementById('trRateSAR').value = t.rate_sar || '';
      document.getElementById('trRatePKR').value = t.rate_pkr || '';
      document.getElementById('trStatus').value = t.status || 'active';
      document.getElementById('trModalTitle').textContent = 'Edit Transport: ' + t.sector + ' (' + t.vehicle + ')';
    }
  } else {
    document.getElementById('trSector').value = 'JED-MAK';
    document.getElementById('trVehicle').value = 'Sedan / Car (1-3 Pax)';
    document.getElementById('trRateSAR').value = '';
    document.getElementById('trRatePKR').value = '';
    document.getElementById('trStatus').value = 'active';
    document.getElementById('trModalTitle').textContent = 'Add Transport Rate';
  }
  openModal('transportModal');
}

async function saveTransportModal() {
  const id = document.getElementById('trId')?.value;
  const sector = document.getElementById('trSector')?.value;
  const vehicle = document.getElementById('trVehicle')?.value;
  const rate_sar = parseFloat(document.getElementById('trRateSAR')?.value) || 0;
  const rate_pkr = parseFloat(document.getElementById('trRatePKR')?.value) || 0;
  const status = document.getElementById('trStatus')?.value || 'active';

  if (!sector || !vehicle) { toast('Sector and vehicle are required', 'warn'); return; }

  showLoad('Saving transport rate…');
  try {
    if (id) {
      await PUT('/transport/' + id, { sector, vehicle, rate_sar, rate_pkr, status });
      toast('Transport rate updated successfully!', 'success');
    } else {
      await POST('/transport', { sector, vehicle, rate_sar, rate_pkr, status });
      toast('Transport rate added successfully!', 'success');
    }
    closeModal('transportModal');
    pgTransport(true);
  } catch (err) {
    toast('Transport save error: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}

async function deleteTransport(id, sector, vehicle) {
  if (!confirm('Are you sure you want to delete rate for ' + sector + ' (' + vehicle + ')?')) return;
  showLoad('Deleting rate…');
  try {
    await DELETE('/transport/' + id);
    toast('Transport rate deleted!', 'success');
    pgTransport(true);
  } catch (err) {
    toast('Delete error: ' + err.message, 'error');
  } finally {
    hideLoad();
  }
}


// ═══════════════════════════════════════════════════════════
//  BOOT
// ═══════════════════════════════════════════════════════════
async function _boot() {
  // Apply saved theme (Default is light as requested)
  const savedTheme = localStorage.getItem('pgt_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.inert = window.innerWidth <= 1100;
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.innerHTML = `<i class="bi bi-${savedTheme === 'dark' ? 'sun-fill' : 'moon-stars-fill'}"></i>`;

  // Wire up login form
  document.getElementById('loginForm')?.addEventListener('submit', event => {
    event.preventDefault();
    doLogin();
  });

  // Password show/hide
  document.getElementById('pwToggle')?.addEventListener('click', () => {
    const inp = document.getElementById('loginPass');
    const ic  = document.getElementById('pwToggleIcon');
    inp.type  = inp.type === 'password' ? 'text' : 'password';
    ic.className = `bi bi-${inp.type === 'password' ? 'eye' : 'eye-slash'}`;
    const showPassword = inp.type === 'text';
    const toggle = document.getElementById('pwToggle');
    toggle.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
    toggle.setAttribute('aria-pressed', String(showPassword));
  });

  // Global search
  document.getElementById('gSearch')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = e.target.value.trim();
      if (q) { nav('search'); setTimeout(() => { document.getElementById('srchQ').value = q; doSearch(); }, 100); }
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.getElementById('sidebar')?.classList.contains('open')) {
      closeSidebar();
      document.getElementById('sbToggleBtn')?.focus();
      return;
    }
    if (G.user && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      document.getElementById('gSearch')?.focus();
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 1100) {
      closeSidebar();
      const side = document.getElementById('sidebar');
      if (side) side.inert = false;
    } else {
      const side = document.getElementById('sidebar');
      if (side && !side.classList.contains('open')) side.inert = true;
    }
  });

  // Check existing session
  if (loadSession()) {
    try {
      const me = await GET('/auth/me');
      if (me?.user) {
        G.user = { ...G.user, ...me.user };
        localStorage.setItem('pgt_user', JSON.stringify(G.user));
        showApp();
        await bootData();
        const hash = location.hash.slice(1) || 'dash';
        nav(PAGE_HANDLERS[hash] ? hash : 'dash');
        return;
      }
    } catch (_) { /* session expired */ }
  }

  showLogin();
  hideLoad();
}

// Expose key handlers to window for inline onclicks
window.doLogin = doLogin;
window.logout = logout;
window.nav = nav;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.toggleTheme = toggleTheme;

window.pTab = pTab;
window.addNextOpt = addNextOpt;
window.removeOpt = removeOpt;
window.openCopyOptionModal = openCopyOptionModal;
window.executeCopyOption = executeCopyOption;
window.addFlightRow = addFlightRow;
window.addHotelRow = addHotelRow;
window.openHotelCostingChooser = openHotelCostingChooser;
window.useHotelInNewQuotation = useHotelInNewQuotation;
window.useHotelInExistingQuotation = useHotelInExistingQuotation;
window.addTransportRow = addTransportRow;
window.removeTableRow = removeTableRow;
window.updateHotelDates = updateHotelDates;
window.syncPaxToQuantities = syncPaxToQuantities;
window.syncTravelDatesFromFlights = syncTravelDatesFromFlights;
window.triggerCostingCalc = triggerCostingCalc;
window.pCalc = pCalc;
window.pSave = pSave;
window.pSaveDraft = pSaveDraft;
window.newPrivateCosting = newPrivateCosting;
window.pPreview = pPreview;
window.shareWhatsAppPvt = shareWhatsAppPvt;
window.shareCurrentProposalWhatsApp = shareCurrentProposalWhatsApp;
window.printCostingPvt = printCostingPvt;
window.triggerProposalPrint = triggerProposalPrint;
window.triggerCostingPrint = triggerCostingPrint;
window.addGHRow = addGHRow;
window.gCalc = gCalc;
window.gSave = gSave;
window.gSaveDraft = gSaveDraft;
window.gPreview = gPreview;
window.shareWhatsAppGrp = shareWhatsAppGrp;
window.printCostingGrp = printCostingGrp;
window.previewQuotationById = previewQuotationById;
window.editQuotationById = editQuotationById;
window.deleteQuotationById = deleteQuotationById;
window.filterQuotationsTable = filterQuotationsTable;
window.openNewQueryModal = openNewQueryModal;
window.openQueryModal = openQueryModal;
window.addQueryMessage = addQueryMessage;
window.saveQueryModal = saveQueryModal;
window.filterQueriesTable = filterQueriesTable;
window.openUserModal = openUserModal;
window.saveUserModal = saveUserModal;
window.openBranchModal = openBranchModal;
window.saveBranchModal = saveBranchModal;
window.saveSettingsForm = saveSettingsForm;
window.restoreItem = typeof restoreRecycleItem === 'function' ? restoreRecycleItem : function() {};
window.restoreRecycleItem = window.restoreItem;
window.downloadBackup = downloadBackup;
window.openModal = openModal;
window.closeModal = closeModal;


// Keyboard Shortcuts for Costing (Ctrl+S, Ctrl+Enter, Ctrl+P)
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 's' || e.key === 'S') {
      const active = G._currentPage;
      if (active === 'pvt') { e.preventDefault(); pSaveDraft(); }
      else if (active === 'grp') { e.preventDefault(); gSaveDraft(); }
    } else if (e.key === 'Enter') {
      const active = G._currentPage;
      if (active === 'pvt') { e.preventDefault(); pSave(); }
      else if (active === 'grp') { e.preventDefault(); gSave(); }
    } else if (e.key === 'p' || e.key === 'P') {
      const active = G._currentPage;
      if (active === 'pvt') { e.preventDefault(); pPreview(); }
      else if (active === 'grp') { e.preventDefault(); gPreview(); }
    }
  }
});

// Start
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _boot, { once: true });
} else {
  _boot();
}


/* ===== INTERNAL CONFIDENTIAL COSTING SHEET (A4 PDF) ===== */
function renderCostingA4Html(data, branch) {
  const inv = data.invoice_no || 'PGT-0116';
  const cName = data.client_name || 'HASEEB';
  const phone = data.contact_no || '—';
  const dates = data.travel_dates || '16 NOVEMBER 2026 TO 05 DECEMBER 2026';
  const includes = data.includes || 'FLIGHT, HOTEL, VISA, TRANSPORT';
  const compName = branch.name || 'Shahzaman Umrah Costing Portal';
  const bPhone = branch.phone || '03140352536';
  const roe = G.settings?.default_roe || 78;
  const prepBy = G.user?.full_name || G.user?.username || 'Shahzaman';

  const calcAll = typeof pCalc === 'function' ? pCalc(true) : {};

  const activeOptions = ['A', 'B', 'C'].filter(L => {
    if (L === 'A') return true;
    if (data.options && data.options[L]) {
      const o = data.options[L];
      if ((o.hotels && o.hotels.length) || (o.flights && o.flights.length) || (o.transports && o.transports.length)) return true;
    }
    const tabBtn = typeof document !== 'undefined' && document.getElementById ? document.getElementById('pTabBtn' + L) : null;
    return tabBtn?.style?.display !== 'none' && Boolean(data.options?.[L]);
  });

  return `
    <div class="cost-pg" style="font-family:'Segoe UI',Arial,sans-serif;background:#ffffff;padding:12px;color:#1e293b">
      
      <!-- Top Title Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
        <div>
          <div style="font-size:9.5px;letter-spacing:4px;font-weight:700;color:#64748b">S H A H Z A M A N &nbsp; U M R A H &nbsp; C O S T I N G &nbsp; P O R T A L</div>
          <div style="font-size:20px;font-weight:900;color:#0F2C59;letter-spacing:0.5px;margin:2px 0">PRIVATE COSTING SHEET</div>
          <div style="font-size:9px;font-weight:700;color:#b45309">⚠ CONFIDENTIAL — Internal Use Only — Team Review</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;font-weight:800;color:#0F2C59">${esc(compName)}</div>
          <div style="font-size:10.5px;color:#64748b">${esc(bPhone)}</div>
        </div>
      </div>

      <!-- 8-Card Metadata Grid -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">
        <div style="border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px;background:#f8fafc">
          <div style="font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase">CLIENT</div>
          <div style="font-size:10.5px;font-weight:800;color:#0F2C59">${esc(cName)}</div>
        </div>
        <div style="border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px;background:#f8fafc">
          <div style="font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase">CONTACT</div>
          <div style="font-size:10.5px;font-weight:700;color:#334155">${esc(phone)}</div>
        </div>
        <div style="border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px;background:#f8fafc">
          <div style="font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase">TRAVEL DATES</div>
          <div style="font-size:10px;font-weight:700;color:#334155">${esc(dates)}</div>
        </div>
        <div style="border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px;background:#f8fafc">
          <div style="font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase">INCLUDES</div>
          <div style="font-size:9.5px;font-weight:700;color:#334155">${esc(includes)}</div>
        </div>

        <div style="border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px;background:#f8fafc">
          <div style="font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase">INVOICE #</div>
          <div style="font-size:10.5px;font-weight:800;color:#0F2C59">${esc(inv)}</div>
        </div>
        <div style="border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px;background:#f8fafc">
          <div style="font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase">DATE</div>
          <div style="font-size:10.5px;font-weight:700;color:#334155">${fmtDate(new Date())}</div>
        </div>
        <div style="border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px;background:#f8fafc">
          <div style="font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase">PREPARED BY</div>
          <div style="font-size:10.5px;font-weight:700;color:#334155">${esc(prepBy)}</div>
        </div>
        <div style="border:1px solid #cbd5e1;border-radius:4px;padding:6px 8px;background:#f8fafc">
          <div style="font-size:8px;font-weight:800;color:#64748b;text-transform:uppercase">BRANCH</div>
          <div style="font-size:9.5px;font-weight:700;color:#334155">${esc(compName)}</div>
        </div>
      </div>

      <!-- Render Each Active Option (A, B, C) -->
      ${activeOptions.map(L => {
        const o = (data.options || {})[L] || {};
        const calcRes = calcAll[L] || { adultPerPax: 0, childPerPax: 0, infantPerPax: 0, grandTotal: 0 };

        let hTotalPKR = 0;
        const hotelRows = (o.hotels || []).filter(h => h && h.name).map(h => {
          const rateSAR = numR(h.rate || h.rateSAR || 0);
          const qty = parseInt(h.qty) || 1;
          const nights = parseInt(h.nights) || 1;
          const hRoe = numR(h.roe || roe);
          const pkr = rateSAR * qty * nights * hRoe;
          hTotalPKR += pkr;

          return `
            <tr style="text-align:center;border-bottom:1px solid #e2e8f0;font-size:9px">
              <td style="padding:3px;border:1px solid #cbd5e1">${esc((h.city||'makkah').toUpperCase())}</td>
              <td style="padding:3px;border:1px solid #cbd5e1;text-align:left;font-weight:700">${esc(h.name)}</td>
              <td style="padding:3px;border:1px solid #cbd5e1">${esc(h.roomType||'DOUBLE')}</td>
              <td style="padding:3px;border:1px solid #cbd5e1">${esc(h.meal||'RO')}</td>
              <td style="padding:3px;border:1px solid #cbd5e1">${rateSAR}</td>
              <td style="padding:3px;border:1px solid #cbd5e1">${qty}</td>
              <td style="padding:3px;border:1px solid #cbd5e1">${nights}</td>
              <td style="padding:3px;border:1px solid #cbd5e1">${hRoe}</td>
              <td style="padding:3px;border:1px solid #cbd5e1;font-weight:700">${fmtNum(pkr)}</td>
            </tr>`;
        }).join('');

        const visaRate = numR(o.visa?.rate || 560);
        const visaQty = parseInt(o.visa?.qty) || data.adult_pax || 2;
        const visaRoe = numR(o.visa?.roe || roe);
        const visaTotalPKR = visaRate * visaQty * visaRoe;

        let tTotalPKR = 0;
        const transportRows = (o.transports || []).filter(t => t && t.sector).map(t => {
          const rateSAR = numR(t.rate || t.rateSAR || 0);
          const qty = parseInt(t.qty) || 1;
          const tRoe = numR(t.roe || roe);
          const pkr = rateSAR * qty * tRoe;
          tTotalPKR += pkr;

          return `
            <tr style="text-align:center;border-bottom:1px solid #e2e8f0;font-size:9px">
              <td style="padding:3px;border:1px solid #cbd5e1;text-align:left;font-weight:700">${esc(t.sector)}</td>
              <td style="padding:3px;border:1px solid #cbd5e1">${esc(t.vehicle)}</td>
              <td style="padding:3px;border:1px solid #cbd5e1">${rateSAR}</td>
              <td style="padding:3px;border:1px solid #cbd5e1">${qty}</td>
              <td style="padding:3px;border:1px solid #cbd5e1">${tRoe}</td>
              <td style="padding:3px;border:1px solid #cbd5e1;font-weight:700">${fmtNum(pkr)}</td>
            </tr>`;
        }).join('');

        const totalAdultCost = hTotalPKR + visaTotalPKR + tTotalPKR + (numR(o.ticketPKR) * (data.adult_pax || 2));
        const adultPaxCount = data.adult_pax || 2;
        const adultPerPax = Math.round(totalAdultCost / adultPaxCount);

        return `
          <div style="margin-bottom:14px">
            <div style="text-align:center;font-size:10px;font-weight:800;letter-spacing:2px;color:#0F2C59;margin:8px 0 6px">
              O P T I O N &nbsp; ${L} — P R I V A T E &nbsp; C O S T I N G
            </div>

            <!-- HOTELS (ADULT) -->
            ${hotelRows ? `
              <div style="font-size:9.5px;font-weight:800;color:#0F2C59;margin-bottom:3px">🏨 HOTELS (ADULT) — OPTION ${L}</div>
              <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:6px">
                <thead>
                  <tr style="background:#f1f5f9;font-weight:800;color:#334155">
                    <th style="border:1px solid #cbd5e1;padding:3px;width:10%">CITY</th>
                    <th style="border:1px solid #cbd5e1;padding:3px;width:26%">HOTEL</th>
                    <th style="border:1px solid #cbd5e1;padding:3px;width:9%">ROOM</th>
                    <th style="border:1px solid #cbd5e1;padding:3px;width:7%">MEAL</th>
                    <th style="border:1px solid #cbd5e1;padding:3px;width:9%">RATE SAR</th>
                    <th style="border:1px solid #cbd5e1;padding:3px;width:6%">QTY</th>
                    <th style="border:1px solid #cbd5e1;padding:3px;width:7%">NIGHTS</th>
                    <th style="border:1px solid #cbd5e1;padding:3px;width:7%">ROE</th>
                    <th style="border:1px solid #cbd5e1;padding:3px;width:19%">TOTAL PKR</th>
                  </tr>
                </thead>
                <tbody>
                  ${hotelRows}
                  <tr style="background:#f8fafc;font-weight:800">
                    <td colspan="8" style="padding:4px;border:1px solid #cbd5e1;text-align:left;color:#0F2C59">Hotel Total</td>
                    <td style="padding:4px;border:1px solid #cbd5e1;text-align:center;font-weight:900;color:#0F2C59">${fmtNum(hTotalPKR)}</td>
                  </tr>
                </tbody>
              </table>
            ` : ''}

            <!-- VISA (ADULT) -->
            <div style="font-size:9.5px;font-weight:800;color:#0F2C59;margin-bottom:3px">🛂 VISA (ADULT) — OPTION ${L}</div>
            <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:6px">
              <thead>
                <tr style="background:#f1f5f9;font-weight:800;color:#334155;text-align:center">
                  <th style="border:1px solid #cbd5e1;padding:3px;width:30%">VISA SAR</th>
                  <th style="border:1px solid #cbd5e1;padding:3px;width:20%">QTY</th>
                  <th style="border:1px solid #cbd5e1;padding:3px;width:20%">ROE</th>
                  <th style="border:1px solid #cbd5e1;padding:3px;width:30%">TOTAL PKR</th>
                </tr>
              </thead>
              <tbody>
                <tr style="text-align:center;font-size:9px">
                  <td style="padding:3px;border:1px solid #cbd5e1">${visaRate}</td>
                  <td style="padding:3px;border:1px solid #cbd5e1">${visaQty}</td>
                  <td style="padding:3px;border:1px solid #cbd5e1">${visaRoe}</td>
                  <td style="padding:3px;border:1px solid #cbd5e1;font-weight:700">${fmtNum(visaTotalPKR)}</td>
                </tr>
              </tbody>
            </table>

            <!-- TRANSPORT (ADULT) -->
            ${transportRows ? `
              <div style="font-size:9.5px;font-weight:800;color:#0F2C59;margin-bottom:3px">🚌 TRANSPORT (ADULT) — OPTION ${L}</div>
              <table style="width:100%;border-collapse:collapse;font-size:9px;margin-bottom:6px">
                <thead>
                  <tr style="background:#f1f5f9;font-weight:800;color:#334155;text-align:center">
                    <th style="border:1px solid #cbd5e1;padding:3px;text-align:left;width:35%">SECTOR</th>
                    <th style="border:1px solid #cbd5e1;padding:3px;width:25%">VEHICLE</th>
                    <th style="border:1px solid #cbd5e1;padding:3px;width:10%">RATE SAR</th>
                    <th style="border:1px solid #cbd5e1;padding:3px;width:8%">QTY</th>
                    <th style="border:1px solid #cbd5e1;padding:3px;width:8%">ROE</th>
                    <th style="border:1px solid #cbd5e1;padding:3px;width:14%">TOTAL PKR</th>
                  </tr>
                </thead>
                <tbody>
                  ${transportRows}
                  <tr style="background:#f8fafc;font-weight:800">
                    <td colspan="5" style="padding:4px;border:1px solid #cbd5e1;text-align:left;color:#0F2C59">Transport Total</td>
                    <td style="padding:4px;border:1px solid #cbd5e1;text-align:center;font-weight:900;color:#0F2C59">${fmtNum(tTotalPKR)}</td>
                  </tr>
                </tbody>
              </table>
            ` : ''}

            <!-- Summary Total Adult Cost Box -->
            <div style="border:1.5px solid #0F2C59;border-radius:4px;padding:6px 14px;background:#f8fafc;margin-top:6px;font-size:11px">
              <div style="display:flex;justify-content:space-between;margin-bottom:2px">
                <span style="font-weight:800;color:#334155">Total Adult Cost:</span>
                <b style="color:#0F2C59;font-size:12px">PKR ${fmtNum(totalAdultCost)}</b>
              </div>
              <div style="display:flex;justify-content:space-between">
                <span style="font-weight:800;color:#334155">Adult Per Pax:</span>
                <b style="color:#0F2C59;font-size:12px">PKR ${fmtNum(adultPerPax)}</b>
              </div>
            </div>

          </div>`;
      }).join('')}

      <!-- Bottom Disclaimer -->
      <div style="text-align:center;font-size:8px;color:#64748b;margin-top:16px;border-top:1px solid #e2e8f0;padding-top:4px">
        CONFIDENTIAL — Do not share with clients. For internal team review only. | ${esc(compName)} | ${fmtDate(new Date())}
      </div>

    </div>`;
}

function openCostingSheetModal() {
  const data = collectPrivateQuotationData();
  const branch = G.branches.find(b => b.id === G.activeBranchId) || { name: 'PAK GLOBE TRAVELS' };
  const html = renderCostingA4Html(data, branch);
  const container = document.getElementById('costingSheetBody');
  if (container) container.innerHTML = html;
  openModal('costingModal');
}


/* ==========================================================================
   10. 19-COLUMN SHEETJS EXCEL IMPORTER & EXPORTER
   ========================================================================== */
function openExcelModal() {
  const rep = document.getElementById('excelReportContainer');
  if (rep) { rep.innerHTML = ''; rep.style.display = 'none'; }
  openModal('excelModal');
}

async function downloadExcelSample() {
  try {
    await loadUtilityScript('xlsx');
  } catch (error) {
    toast(`Excel sample unavailable: ${error.message}`, 'err');
    return;
  }
  const rows = [
    ['Hotel Name','City','Area','Distance','Shuttle','Stars','Vendor','Room Type','Meal Plan','All Days Rate','Weekday Rate','Weekend Rate','Check-In','Check-Out','Extra Bed','Remarks','Days','Best Rate','Country'],
    ['AL NUSK HOTEL','MAKKAH','AZIZIYAH','400m from Haram','Yes','4','AL HARAM TRAVELS','DOUBLE','BB','250','230','280','2026-09-01','2026-09-15','100','Near bus stop','ALL','240','Saudi Arabia'],
    ['AL NUSK HOTEL','MAKKAH','AZIZIYAH','400m from Haram','Yes','4','AL HARAM TRAVELS','TRIPLE','RO','210','','','2026-09-01','2026-09-15','','','SPLIT','','Saudi Arabia'],
    ['DAR AL TAQWA','MADINAH','CENTRAL','100m from Masjid','No','5','MADINA BOOKING','QUAD','BB','320','','','2026-10-01','2026-10-20','120','Ramadan Suhoor rate','ALL','','Saudi Arabia'],
    ['SWISSOTEL MAKKAH','MAKKAH','CLOCK TOWER','Clock Tower Abraj','No','5','SAUDI VENDORS','DOUBLE','BB','750','700','850','2026-11-01','2026-11-30','200','Haram View','ALL','720','Saudi Arabia']
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:22},{wch:12},{wch:14},{wch:18},{wch:9},{wch:6},{wch:20},{wch:12},{wch:10},{wch:13},{wch:12},{wch:12},{wch:11},{wch:11},{wch:10},{wch:20},{wch:9},{wch:9},{wch:14}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hotels');
  XLSX.writeFile(wb, 'hotel_import_sample_19col.xlsx');
  toast('Sample Excel downloaded', 'ok');
}

function downloadJsonSample() {
  const sample = {
    hotels: [
      {
        name: 'AL NUSK HOTEL',
        city: 'MAKKAH',
        area: 'AZIZIYAH',
        distance: '400m from Haram',
        shuttle: 'yes',
        stars: '4',
        country: 'Saudi Arabia',
        vendors: [
          {
            vendor: 'AL HARAM TRAVELS',
            roomType: 'DOUBLE',
            mealPlan: 'BB',
            price: 250,
            weekdayRate: 230,
            weekendRate: 280,
            checkIn: '2026-09-01',
            checkOut: '2026-09-15',
            extraBed: 100,
            bestRate: 240
          }
        ]
      }
    ]
  };
  const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hotel_import_sample.json';
  a.click();
  toast('Sample JSON downloaded', 'ok');
}

async function handleExcelFileUpload(file) {
  if (!file) return;
  try {
    await loadUtilityScript('xlsx');
  } catch (error) {
    toast(`Excel import unavailable: ${error.message}`, 'err');
    return;
  }

  showLoading('Parsing 19-column Excel file…');
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

    if (rows.length < 2) {
      hideLoading();
      toast('Excel file is empty or missing data rows', 'warn');
      return;
    }

    const items = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r[0]) continue; // Skip blank rows
      items.push({
        name: String(r[0] || '').trim(),
        city: String(r[1] || 'makkah').trim(),
        area: String(r[2] || '').trim(),
        distance: String(r[3] || '').trim(),
        distanceValue: parseInt(String(r[3] || '').replace(/[^0-9]/g, '')) || 0,
        shuttle: String(r[4] || '').toLowerCase() === 'yes' ? 'yes' : '',
        stars: String(r[5] || '3').trim(),
        vendor: String(r[6] || '').trim(),
        roomType: String(r[7] || 'DOUBLE').trim(),
        mealPlan: String(r[8] || 'RO').trim(),
        price: parseFloat(r[9]) || 0,
        weekdayRate: parseFloat(r[10]) || 0,
        weekendRate: parseFloat(r[11]) || 0,
        checkIn: r[12] ? String(r[12]).trim() : null,
        checkOut: r[13] ? String(r[13]).trim() : null,
        extraBed: parseFloat(r[14]) || 0,
        remarks: String(r[15] || '').trim(),
        days: String(r[16] || 'ALL').trim(),
        bestRate: parseFloat(r[17]) || 0,
        country: String(r[18] || 'Saudi Arabia').trim()
      });
    }

    // Call backend bulk-import endpoint
    showLoading('Saving to self-hosted MySQL database…');
    const res = await apiFetch('/api/hotels/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ items })
    });

    hideLoading();
    toast(`Excel imported: ${res.hAdd} new hotels, ${res.rowAdd} rate rows, ${res.dupSkip} skipped duplicates`, 'ok');

    // Display summary inside modal
    const rep = document.getElementById('excelReportContainer');
    if (rep) {
      rep.style.display = 'block';
      rep.innerHTML = `
        <div style="background:rgba(255,255,255,0.9);border:1px solid var(--glass-border);border-radius:10px;padding:14px">
          <div style="font-weight:800;font-size:13px;color:var(--t1);margin-bottom:10px">
            <i class="bi bi-check-circle-fill me-1" style="color:var(--ok)"></i>Import Processed: ${esc(file.name)}
          </div>
          <div class="row g-2 text-center">
            <div class="col-4">
              <div style="font-size:18px;font-weight:900;color:var(--ok)">${res.hAdd}</div>
              <div class="t3" style="font-size:10px">NEW HOTELS</div>
            </div>
            <div class="col-4">
              <div style="font-size:18px;font-weight:900;color:var(--pri)">${res.rowAdd}</div>
              <div class="t3" style="font-size:10px">RATE ROWS ADDED</div>
            </div>
            <div class="col-4">
              <div style="font-size:18px;font-weight:900;color:var(--t2)">${res.dupSkip}</div>
              <div class="t3" style="font-size:10px">SKIPPED (DUPLICATE)</div>
            </div>
          </div>
        </div>`;
    }

    // Refresh hotel inventory
    await fetchHotels();
    if (G._currentPage === 'hotels') pgHotels();

  } catch (err) {
    hideLoading();
    toast('Excel import error: ' + err.message, 'err');
  }
}

async function exportHotelsToExcel() {
  try {
    await loadUtilityScript('xlsx');
  } catch (error) {
    toast(`Excel export unavailable: ${error.message}`, 'err');
    return;
  }
  if (!G.hotels || !G.hotels.length) { toast('No hotels found to export', 'warn'); return; }

  const rows = [
    ['Hotel Name','City','Area','Distance','Shuttle','Stars','Vendor','Room Type','Meal Plan','All Days Rate','Weekday Rate','Weekend Rate','Check-In','Check-Out','Extra Bed','Remarks','Days','Best Rate','Country']
  ];

  G.hotels.forEach(h => {
    const vens = h.vendors || [];
    if (!vens.length) {
      rows.push([
        h.name, h.city, h.area || '', h.distance_str || '', h.shuttle ? 'Yes' : 'No',
        h.stars || '3', '', '', '', '', '', '', '', '', '', '', 'ALL', '', h.country || 'Saudi Arabia'
      ]);
    } else {
      vens.forEach(v => {
        rows.push([
          h.name, h.city, h.area || '', h.distance_str || '', h.shuttle ? 'Yes' : 'No',
          h.stars || '3', v.vendor_name || '', v.room_type || 'DOUBLE', v.meal_plan || 'RO',
          v.price_all || 0, v.price_weekday || '', v.price_weekend || '',
          v.checkin_date || '', v.checkout_date || '', v.extra_bed || '',
          v.remarks || '', v.days_type || 'ALL', v.price_best || '', h.country || 'Saudi Arabia'
        ]);
      });
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hotels');
  XLSX.writeFile(wb, `pakglobe_hotels_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('Hotels catalogue exported to Excel', 'ok');
}

/* ==========================================================================
   11. 8-CHARACTER HOTEL DEDUPLICATION & MERGE ENGINE
   ========================================================================== */
let _dedupClusters = [];

function openDedupModal() {
  openModal('dedupModal');
  runHotelDeduplicationScan();
}

function runHotelDeduplicationScan() {
  const container = document.getElementById('dedupResultsList');
  if (!container) return;
  container.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-primary" role="status"></div><div class="mt-2 t3">Scanning hotels database with 8-character fingerprint…</div></div>';

  const groups = {};
  (G.hotels || []).forEach(h => {
    const normCity = (h.city || 'MAKKAH').trim().toUpperCase();
    const normName = (h.name || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const key = normCity + '::' + normName;
    if (!groups[key]) groups[key] = [];
    groups[key].push(h);
  });

  _dedupClusters = Object.entries(groups)
    .filter(([, hs]) => hs.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  if (!_dedupClusters.length) {
    container.innerHTML = `
      <div class="text-center p-4">
        <i class="bi bi-check-circle-fill text-success" style="font-size:36px;display:block;margin-bottom:8px"></i>
        <div style="font-weight:800;font-size:14px;color:var(--t1)">No Duplicate Hotels Found!</div>
        <div class="t3" style="font-size:11.5px">Hotel database is clean and deduplicated.</div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="mb-2 t3" style="font-size:11.5px">
      Found <b>${_dedupClusters.length}</b> duplicate cluster(s) across hotel inventory.
    </div>` + _dedupClusters.map(([key, hs], cIdx) => {
      // Find richest hotel by vendor rows
      const keeper = hs.slice().sort((a, b) => (b.vendors?.length || 0) - (a.vendors?.length || 0))[0];
      return `
        <div class="p-3 mb-2" style="background:#fff;border:1px solid var(--brd);border-radius:10px">
          <div class="d-flex align-items-center justify-content-between mb-2">
            <div class="d-flex align-items-center gap-2">
              <span class="badge" style="background:var(--pri);color:#fff">${esc(hs[0].city?.toUpperCase())}</span>
              <span style="font-weight:800;font-size:12px;color:var(--t1)">${esc(key)}</span>
              <span class="t3" style="font-size:11px">(${hs.length} hotels)</span>
            </div>
            <button type="button" class="btn-pri btn-sm" onclick="mergeCluster(${cIdx})">
              <i class="bi bi-box-arrow-in-right me-1"></i>Merge into Master
            </button>
          </div>
          ${hs.map(h => {
            const isK = h.id === keeper.id;
            return `
              <div class="d-flex align-items-center justify-content-between p-2 mb-1" style="background:${isK ? 'rgba(126,200,227,0.15)' : 'rgba(241,245,249,0.5)'};border-radius:6px;border:1px solid ${isK ? 'var(--priBrd)' : '#e2e8f0'}">
                <div class="d-flex align-items-center gap-2">
                  <input type="radio" name="keeper_${cIdx}" value="${h.id}" ${isK ? 'checked' : ''} style="accent-color:var(--pri)">
                  <span style="font-weight:700;font-size:12px">${esc(h.name)}</span>
                  ${isK ? '<span class="badge bg-success" style="font-size:9px">MASTER</span>' : ''}
                </div>
                <div class="d-flex align-items-center gap-3" style="font-size:11px;color:var(--t2)">
                  <span>${(h.vendors||[]).length} rate rows</span>
                  <span>${esc(h.distance_str||'')}</span>
                </div>
              </div>`;
          }).join('')}
        </div>`;
    }).join('');
}

async function mergeCluster(cIdx) {
  const cluster = _dedupClusters[cIdx];
  if (!cluster) return;
  const [key, hs] = cluster;
  const selRadio = document.querySelector(`input[name="keeper_${cIdx}"]:checked`);
  const keeperId = selRadio ? selRadio.value : hs[0].id;
  const duplicateIds = hs.map(h => h.id).filter(id => id !== keeperId);

  if (!duplicateIds.length) { toast('No duplicates to merge', 'warn'); return; }

  showLoading('Merging duplicate hotel records and rate rows…');
  try {
    const res = await apiFetch('/api/hotels/merge', {
      method: 'POST',
      body: JSON.stringify({ keeperId, duplicateIds })
    });
    hideLoading();
    toast(`Merged ${res.mergedCount} hotel(s) into ${res.keeperName} (+${res.movedRates} rates)`, 'ok');
    await fetchHotels();
    runHotelDeduplicationScan();
  } catch (err) {
    hideLoading();
    toast('Merge error: ' + err.message, 'err');
  }
}

async function autoMergeAllDuplicates() {
  if (!_dedupClusters.length) { toast('No duplicates found to merge', 'warn'); return; }
  if (!confirm(`Auto-merge all ${_dedupClusters.length} duplicate groups? All rate rows will be safely preserved under master hotels.`)) return;

  showLoading('Auto-merging all duplicate clusters…');
  let totalMoved = 0, totalMerged = 0;
  try {
    for (const [key, hs] of _dedupClusters) {
      const keeper = hs.slice().sort((a, b) => (b.vendors?.length || 0) - (a.vendors?.length || 0))[0];
      const duplicateIds = hs.map(h => h.id).filter(id => id !== keeper.id);
      if (!duplicateIds.length) continue;
      const res = await apiFetch('/api/hotels/merge', {
        method: 'POST',
        body: JSON.stringify({ keeperId: keeper.id, duplicateIds })
      });
      totalMoved += res.movedRates || 0;
      totalMerged += res.mergedCount || 0;
    }
    hideLoading();
    toast(`Auto-merge completed: ${totalMerged} duplicates merged (+${totalMoved} rates)`, 'ok');
    await fetchHotels();
    runHotelDeduplicationScan();
  } catch (err) {
    hideLoading();
    toast('Auto-merge error: ' + err.message, 'err');
  }
}

/* ==========================================================================
   12. SELF-HOSTED MEDIA & UPLOADS GALLERY MANAGER
   ========================================================================== */
function openImageModal() {
  openModal('imageModal');
  loadMediaGallery();
}

async function loadMediaGallery() {
  const container = document.getElementById('mediaGalleryGrid');
  if (!container) return;
  container.innerHTML = '<div class="text-center p-4 col-12"><div class="spinner-border text-primary" role="status"></div></div>';

  try {
    const images = await apiFetch('/api/images');
    if (!images || !images.length) {
      container.innerHTML = '<div class="col-12 text-center p-4 t3">No uploaded media images yet. Upload hotel photos, branch logos, or voucher banners above!</div>';
      return;
    }

    container.innerHTML = images.map(img => `
      <div style="background:#fff;border:1px solid var(--brd);border-radius:10px;padding:8px;display:flex;flex-direction:column;justify-content:space-between">
        <div style="width:100%;height:110px;border-radius:6px;overflow:hidden;background:#f1f5f9;display:flex;align-items:center;justify-content:center;margin-bottom:6px">
          <img src="${img.public_url}" alt="${esc(img.original_name)}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='/favicon.png'">
        </div>
        <div style="font-weight:700;font-size:11px;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(img.original_name)}">
          ${esc(img.original_name || img.filename)}
        </div>
        <div class="t3" style="font-size:9.5px;margin-bottom:6px">${(img.file_size / 1024).toFixed(1)} KB</div>
        <div class="d-flex align-items-center gap-1">
          <button type="button" class="btn-ghost btn-sm flex-1" style="font-size:10px;padding:2px 6px" onclick="copyMediaLink('${img.public_url}')" title="Copy public link to clipboard">
            <i class="bi bi-clipboard me-1"></i>Copy
          </button>
          <button type="button" class="btn-icon" style="color:var(--err)" onclick="deleteMediaImage('${img.id}')" title="Delete image">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>`).join('');

  } catch (err) {
    container.innerHTML = '<div class="col-12 text-center text-danger p-3">Failed to load media: ' + esc(err.message) + '</div>';
  }
}

async function uploadDirectImage(file) {
  if (!file) return;
  showLoading('Uploading image to self-hosted storage…');
  try {
    const fd = new FormData();
    fd.append('file', file);
    const token = localStorage.getItem('token');
    const res = await fetch('/api/images/upload', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: fd
    });
    const data = await res.json();
    hideLoading();
    if (data.public_url) {
      toast('Image uploaded! URL generated: ' + data.public_url, 'ok');
      loadMediaGallery();
    } else {
      toast('Upload failed', 'err');
    }
  } catch (err) {
    hideLoading();
    toast('Upload error: ' + err.message, 'err');
  }
}

function copyMediaLink(url) {
  navigator.clipboard.writeText(url).then(() => {
    toast('Public URL copied to clipboard!', 'ok');
  }).catch(() => {
    prompt('Copy public URL:', url);
  });
}

async function deleteMediaImage(id) {
  if (!confirm('Are you sure you want to delete this image?')) return;
  try {
    await apiFetch('/api/images/' + id, { method: 'DELETE' });
    toast('Image deleted', 'ok');
    loadMediaGallery();
  } catch (err) {
    toast('Delete error: ' + err.message, 'err');
  }
}

window.collectPrivateQuotationData = collectQuotationData;
window.collectQuotationData = collectQuotationData;
window.openExcelModal = openExcelModal;
window.downloadExcelSample = downloadExcelSample;
window.downloadJsonSample = downloadJsonSample;
window.handleExcelFileUpload = handleExcelFileUpload;
window.exportHotelsToExcel = exportHotelsToExcel;
window.openDedupModal = openDedupModal;
window.runHotelDeduplicationScan = runHotelDeduplicationScan;
window.mergeCluster = mergeCluster;
window.autoMergeAllDuplicates = autoMergeAllDuplicates;
window.openImageModal = openImageModal;
window.loadMediaGallery = loadMediaGallery;
window.uploadDirectImage = uploadDirectImage;
window.copyMediaLink = copyMediaLink;
window.deleteMediaImage = deleteMediaImage;
window.openCostingSheetModal = openCostingSheetModal;
window.renderCostingA4Html = renderCostingA4Html;


window.pgVendors = pgVendors;
window.openVendorModal = openVendorModal;
window.saveVendorModal = saveVendorModal;
window.deleteVendor = deleteVendor;
window.filterVendorsTable = filterVendorsTable;

window.pgTransport = pgTransport;
window.openTransportModal = openTransportModal;
window.saveTransportModal = saveTransportModal;
window.deleteTransport = deleteTransport;
window.filterTransportTable = filterTransportTable;
window.syncTrRatePKR = syncTrRatePKR;


window.pgLogs = pgLogs;
window.filterLogsTable = filterLogsTable;
window.pgRecycle = pgRecycle;
window.filterRecycleTable = filterRecycleTable;
window.restoreRecycleItem = restoreRecycleItem;
window.deleteRecyclePermanent = deleteRecyclePermanent;
