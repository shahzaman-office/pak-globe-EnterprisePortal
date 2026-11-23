const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

const regex = /<div class="glass-modal-overlay" id="([^"]+)"([^>]*)>/g;
let m;
while ((m = regex.exec(html)) !== null) {
  console.log('Modal ID:', m[1], '| Attributes:', m[2]);
}
