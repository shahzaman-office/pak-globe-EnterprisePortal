// Find exact KPI block content
const fs = require('fs');
const content = fs.readFileSync('public/js/app.js', 'utf8');
const idx = content.indexOf('OLVARA 4-TILE KPI GRID');
if (idx < 0) { console.log('Not found'); process.exit(1); }
// Print 200 chars around it
console.log(JSON.stringify(content.slice(idx, idx+300)));
