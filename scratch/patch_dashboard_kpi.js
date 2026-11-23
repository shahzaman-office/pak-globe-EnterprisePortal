// Patch app.js: permission-aware KPI tiles + white-label company name in dashboard
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'js', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

const startIdx = content.indexOf('<!-- OLVARA 4-TILE KPI GRID -->');
const endIdx = content.indexOf('<!-- MAIN DASHBOARD SPLIT', startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error('KPI block markers not found!');
  process.exit(1);
}

const kpiNew = `<!-- PERMISSION-AWARE KPI GRID -->
    <div class="kpi-grid mb-4">
      \${P('hotels') ? \`<div class="kpi" data-tile="sage" onclick="nav('hotels')">
        <div class="d-flex justify-content-between align-items-center">
          <div class="kpi-lbl">HOTELS INVENTORY</div>
          <i class="bi bi-building fs-5" style="opacity:0.8"></i>
        </div>
        <div class="kpi-val" id="kpiHotels">\${fmtNum(hotelsCnt)}</div>
        <div class="d-flex justify-content-between align-items-center">
          <span style="font-size:11.5px;opacity:0.85">Makkah, Madinah &amp; Jeddah</span>
          <span class="delta delta--up"><i class="bi bi-arrow-up-right"></i> Live</span>
        </div>
      </div>\` : ''}

      \${(P('allquot') || P('quotations_pvt') || P('quotations_grp')) ? \`<div class="kpi" data-tile="apricot" onclick="nav('allquot')">
        <div class="d-flex justify-content-between align-items-center">
          <div class="kpi-lbl">QUOTATIONS &amp; PROPOSALS</div>
          <i class="bi bi-file-earmark-text fs-5" style="opacity:0.8"></i>
        </div>
        <div class="kpi-val" id="kpiQuots">\${fmtNum(quotsCnt)}</div>
        <div class="d-flex justify-content-between align-items-center">
          <span style="font-size:11.5px;opacity:0.85">Private &amp; Group Costing</span>
          <span class="delta delta--up"><i class="bi bi-arrow-up-right"></i> Active</span>
        </div>
      </div>\` : ''}

      \${P('queries') ? \`<div class="kpi" data-tile="mist" onclick="nav('queries')">
        <div class="d-flex justify-content-between align-items-center">
          <div class="kpi-lbl">BOOKING CRM INQUIRIES</div>
          <i class="bi bi-chat-dots fs-5" style="opacity:0.8"></i>
        </div>
        <div class="kpi-val" id="kpiQueries">\${fmtNum(queriesCnt)}</div>
        <div class="d-flex justify-content-between align-items-center">
          <span style="font-size:11.5px;opacity:0.85">Client Leads &amp; Inquiries</span>
          <span class="pill pill-amber pill-bare" style="height:18px;font-size:10px">Pending</span>
        </div>
      </div>\` : ''}

      \${P('vendors') ? \`<div class="kpi" data-tile="clay" onclick="nav('vendors')">
        <div class="d-flex justify-content-between align-items-center">
          <div class="kpi-lbl">VENDORS &amp; SUPPLIERS</div>
          <i class="bi bi-people-fill fs-5" style="opacity:0.8"></i>
        </div>
        <div class="kpi-val" id="kpiVendors">\${fmtNum(vendorsCnt)}</div>
        <div class="d-flex justify-content-between align-items-center">
          <span style="font-size:11.5px;opacity:0.85">Active Rate Contracts</span>
          <span style="font-size:11px;font-weight:700">\${isAdmin ? (G.branches.length || 1) + ' Branches' : esc(G.settings?.branch_name || 'Branch')}</span>
        </div>
      </div>\` : ''}
    </div>

    `;

content = content.slice(0, startIdx) + kpiNew + content.slice(endIdx);
console.log('Replaced KPI block successfully!');

// Safe animateCounter calls
const counterPattern = /animateCounter\(document\.getElementById\('kpiHotels'\),\s*hotelsCnt,\s*1000\);[\s\S]*?animateCounter\(document\.getElementById\('kpiVendors'\),\s*vendorsCnt,\s*1300\);/;

const safeCounters = `if (document.getElementById('kpiHotels')) animateCounter(document.getElementById('kpiHotels'), hotelsCnt, 1000);
      if (document.getElementById('kpiQuots')) animateCounter(document.getElementById('kpiQuots'), quotsCnt, 1100);
      if (document.getElementById('kpiQueries')) animateCounter(document.getElementById('kpiQueries'), queriesCnt, 1200);
      if (document.getElementById('kpiVendors')) animateCounter(document.getElementById('kpiVendors'), vendorsCnt, 1300);`;

if (counterPattern.test(content)) {
  content = content.replace(counterPattern, safeCounters);
  console.log('Patched animateCounter successfully!');
} else {
  console.warn('Counter pattern not matched');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Saved app.js successfully!');
