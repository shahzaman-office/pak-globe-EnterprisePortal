const fs = require('fs');
const path = require('path');
const baseDir = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(baseDir, 'public/index.html'), 'utf8');
const app = fs.readFileSync(path.join(baseDir, 'public/js/app.js'), 'utf8');

const dollarBrace = String.fromCharCode(36) + String.fromCharCode(123);
console.log('index contains raw templates:', index.includes(dollarBrace));
if (index.includes(dollarBrace)) {
  const matches = index.split('\n').filter(l => l.includes(dollarBrace));
  console.log('Matches in index.html:', matches);
}

try {
  new Function(app);
  console.log('app.js parses cleanly as Function: YES');
} catch (e) {
  console.error('app.js syntax error:', e.message);
}
