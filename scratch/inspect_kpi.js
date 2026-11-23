const fs = require('fs');
const content = fs.readFileSync('public/js/app.js', 'utf8');
const startIdx = content.indexOf('<!-- OLVARA 4-TILE KPI GRID -->');
const endIdx = content.indexOf('<!-- MAIN DASHBOARD SPLIT', startIdx);
console.log('Start:', startIdx, 'End:', endIdx);
console.log('Snippet length:', endIdx - startIdx);
console.log(content.slice(startIdx, endIdx));
