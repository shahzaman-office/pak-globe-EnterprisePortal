// Test: Chandni Branch branding simulation
// Simulates what GET /branding returns for a branch user

const mysql = require('mysql2/promise');
require('dotenv').config();

async function test() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'pakglobe',
    waitForConnections: true,
    connectionLimit: 3
  });

  const branchId = 'eff2a2ae-7268-4e74-b3c1-84db3f980745'; // Chandni Branch

  console.log('\n=== Simulating GET /branding for Chandni Branch user ===\n');

  // 1. Get global settings
  const [globalRows] = await pool.execute(
    'SELECT company_name,tagline,phone,email,address,license_no,logo_url,brand_color FROM settings WHERE scope="global" ORDER BY updated_at DESC,id DESC LIMIT 1'
  );
  const settings = { ...(globalRows[0] || {}) };
  console.log('Step 1 - Global settings company_name:', settings.company_name);

  // 2. Get branch record
  const [branchRows] = await pool.execute(
    'SELECT id,name,code,phone,email,address,license_no,logo_url,brand_color FROM branches WHERE id=? AND status="active" LIMIT 1',
    [branchId]
  );
  const branch = branchRows[0] || null;
  if (branch) {
    settings.branch_id = branch.id;
    settings.branch_name = branch.name;
    settings.branch_code = branch.code;
    settings.company_name = branch.name; // <-- key fix
    settings.logo_url = branch.logo_url || null;
    if (branch.brand_color) settings.brand_color = branch.brand_color;
    if (branch.phone) settings.phone = branch.phone;
    if (branch.email) settings.email = branch.email;
    if (branch.address) settings.address = branch.address;
    if (branch.license_no) settings.license_no = branch.license_no;
    console.log('Step 2 - After branch merge, company_name:', settings.company_name, '| brand_color:', settings.brand_color);
  } else {
    console.log('Step 2 - Branch NOT found!');
  }

  // 3. Apply branch settings (from settings table)
  const [branchSettings] = await pool.execute(
    'SELECT company_name,tagline,phone,email,address,license_no,logo_url,brand_color,terms_text,disclaimer_text FROM settings WHERE scope="branch" AND branch_id=? ORDER BY updated_at DESC,id DESC LIMIT 1',
    [branchId]
  );
  if (branchSettings[0]) {
    const b = branchSettings[0];
    if (b.company_name && b.company_name.trim()) settings.company_name = b.company_name.trim();
    if (b.brand_color && b.brand_color !== '#7EC8E3') settings.brand_color = b.brand_color;
    else if (branch && branch.brand_color) settings.brand_color = branch.brand_color;
    console.log('Step 3 - After branchSettings merge, company_name:', settings.company_name, '| brand_color:', settings.brand_color);
  } else {
    console.log('Step 3 - No branch settings row found (using branch table values)');
  }

  console.log('\n✅ FINAL BRANDING RESPONSE:');
  console.log('  company_name:', settings.company_name);
  console.log('  brand_color: ', settings.brand_color);
  console.log('  logo_url:    ', settings.logo_url);
  console.log('  phone:       ', settings.phone);
  console.log('  email:       ', settings.email);
  console.log('  address:     ', settings.address);
  console.log('  branch_name: ', settings.branch_name);
  console.log('  branch_code: ', settings.branch_code);

  if (settings.company_name === 'Chandni Branch') {
    console.log('\n🎉 PASS: company_name is "Chandni Branch" — branch branding working correctly!');
  } else {
    console.log('\n❌ FAIL: company_name is "' + settings.company_name + '" — still showing wrong brand!');
  }

  await pool.end();
}

test().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
