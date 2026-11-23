const fs = require('fs');
const content = fs.readFileSync('public/index.html', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  const m = l.match(/id=["']([a-zA-Z0-9_\-]+)["']/);
  if (m && ['backup','recycle','import','images','dedup'].includes(m[1])) {
    console.log((i+1) + ': ' + l.trim());
  }
});
