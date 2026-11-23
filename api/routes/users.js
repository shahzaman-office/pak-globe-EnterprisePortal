'use strict';
const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { can }         = require('../middleware/rbac');
const { v4: uuid }    = require('uuid');
const bcrypt          = require('bcryptjs');

function isBranchAdmin(req) {
  return req.user.role === 'branch_admin';
}

function localRole(role) {
  return ['user', 'editor', 'viewer'].includes(role) ? role : 'user';
}

const GLOBAL_ROLES = new Set(['superadmin', 'admin']);
const LOCAL_ROLES = new Set(['branch_admin', 'editor', 'viewer', 'user']);

async function validateAssignment(req, role, branchId) {
  if (!GLOBAL_ROLES.has(role) && !LOCAL_ROLES.has(role)) {
    return { status: 400, error: 'Invalid user role' };
  }
  if (req.user.role === 'branch_admin') {
    if (!req.user.branchId) return { status: 403, error: 'Your account is not linked to a branch' };
    if (branchId !== req.user.branchId) return { status: 403, error: 'Branch admins can manage users in their assigned branch only' };
    if (!LOCAL_ROLES.has(role)) return { status: 403, error: 'Branch admins can create local branch roles only' };
  }
  if (req.user.role === 'admin' && role === 'superadmin') {
    return { status: 403, error: 'Only a superadmin can create or assign a superadmin account' };
  }
  if (GLOBAL_ROLES.has(role) && branchId) {
    return { status: 400, error: 'Head-office roles cannot be assigned to a branch' };
  }
  if (LOCAL_ROLES.has(role) && !branchId) {
    return { status: 400, error: 'A branch is required for branch users and branch admins' };
  }
  if (branchId) {
    const [branches] = await pool.execute(
      'SELECT id FROM branches WHERE id=? AND status="active" LIMIT 1',
      [branchId]
    );
    if (!branches.length) return { status: 400, error: 'Assigned branch is not active or does not exist' };
  }
  return null;
}

async function getUserBranch(userId) {
  const [rows] = await pool.execute('SELECT id,branch_id,role FROM users WHERE id=? LIMIT 1', [userId]);
  return rows[0] || null;
}

// GET /api/users
router.get('/', requireAuth, can('users'), async (req, res) => {
  try {
    let sql = 'SELECT u.id,u.username,u.full_name,u.email,u.phone,u.department,u.role,u.branch_id,b.name AS branch_name,b.code AS branch_code,u.status,u.permissions,u.last_login,u.created_at FROM users u LEFT JOIN branches b ON b.id=u.branch_id WHERE 1=1';
    const params = [];

    // Branch admin sees only their branch users
    if (req.user.role === 'branch_admin' && req.user.branchId) {
      sql += ' AND u.branch_id = ?';
      params.push(req.user.branchId);
    }

    const [rows] = await pool.execute(sql + ' ORDER BY u.created_at DESC', params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users
router.post('/', requireAuth, can('users','add'), async (req, res) => {
  try {
    const { username, password, full_name, email, phone, department, permissions } = req.body;
    const requestedRole = String(req.body.role || 'user').toLowerCase();
    const requestedBranch = req.body.branch_id || null;
    if (!username || !password || !full_name)
      return res.status(400).json({ error: 'username, password, full_name are required' });

    // Branch admins can create only local users inside their assigned branch.
    const role = isBranchAdmin(req) ? localRole(requestedRole) : requestedRole;
    const branch_id = isBranchAdmin(req) ? req.user.branchId : requestedBranch;
    const assignmentError = await validateAssignment(req, role, branch_id);
    if (assignmentError) return res.status(assignmentError.status).json({ error: assignmentError.error });

    const hash = await bcrypt.hash(password, 10);
    const id   = uuid();
    const isGlobal = GLOBAL_ROLES.has(role);
    await pool.execute(
      `INSERT INTO users (id,username,password,full_name,email,phone,department,role,branch_id,permissions)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, username.toLowerCase().trim(), hash, full_name, email||null, phone||null,
       department||null, role, branch_id, (!isGlobal && permissions) ? JSON.stringify(permissions) : null]
    );
    res.json({ id, username, full_name, role, branch_id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', requireAuth, can('users','edit'), async (req, res) => {
  try {
    const { full_name, email, phone, department, permissions, status, password } = req.body;
    const target = await getUserBranch(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (isBranchAdmin(req) && target.branch_id !== req.user.branchId)
      return res.status(403).json({ error: 'You can manage users in your branch only' });
    if (req.user.role === 'admin' && target.role === 'superadmin')
      return res.status(403).json({ error: 'Only a superadmin can edit a superadmin account' });

    const role = isBranchAdmin(req) ? localRole(req.body.role) : String(req.body.role || target.role).toLowerCase();
    const branch_id = isBranchAdmin(req) ? req.user.branchId : (req.body.branch_id || null);
    const assignmentError = await validateAssignment(req, role, branch_id);
    if (assignmentError) return res.status(assignmentError.status).json({ error: assignmentError.error });
    const isGlobal = GLOBAL_ROLES.has(role);
    const fields = ['full_name=?','email=?','phone=?','department=?','role=?','branch_id=?','permissions=?','status=?'];
    const values = [full_name, email||null, phone||null, department||null, role, branch_id||null,
                    (!isGlobal && permissions) ? JSON.stringify(permissions) : null, status||'active'];

    if (password && password.length >= 6) {
      fields.push('password=?');
      values.push(await bcrypt.hash(password, 10));
    }
    values.push(req.params.id);

    await pool.execute(`UPDATE users SET ${fields.join(',')} WHERE id=?`, values);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id  (soft: set inactive)
router.delete('/:id', requireAuth, can('users','del'), async (req, res) => {
  try {
    if (req.params.id === req.user.userId)
      return res.status(400).json({ error: 'Cannot delete your own account' });
    const target = await getUserBranch(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (isBranchAdmin(req) && target.branch_id !== req.user.branchId)
      return res.status(403).json({ error: 'You can manage users in your branch only' });
    await pool.execute('UPDATE users SET status="inactive" WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
