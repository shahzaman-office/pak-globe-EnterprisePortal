const fs = require('fs');
const path = require('path');
const app = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');

console.log('Searching for pwToggle in app.js:');
app.split('\n').forEach((l, i) => {
  if (l.includes('pwToggle') || l.includes('loginUser') || l.includes('doLogin')) {
    console.log((i+1) + ': ' + l.trim());
  }
});
