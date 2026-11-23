'use strict';
const router = require('express').Router();
const pool   = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { can }         = require('../middleware/rbac');
const { v4: uuid }    = require('uuid');

// GET /api/queries
router.get('/', requireAuth, can('queries'), async (req, res) => {
  try {
    let sql = 'SELECT * FROM queries WHERE 1=1';
    const params = [];
    if (!['superadmin', 'admin'].includes(req.user.role) && req.user.branchId) {
      sql += ' AND branch_id = ?'; params.push(req.user.branchId);
    }
    const { status } = req.query;
    if (status) { sql += ' AND status = ?'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/queries
router.post('/', requireAuth, can('queries','add'), async (req, res) => {
  try {
    const { client_name, client_phone, hotel_id, hotel_name, rooms_requested,
            checkin_date, checkout_date, guest_names, notes } = req.body;

    const id       = uuid();
    const ref_code = 'PGT-' + Math.random().toString(36).toUpperCase().slice(2,7);

    await pool.execute(
      `INSERT INTO queries
       (id,ref_code,client_name,client_phone,hotel_id,hotel_name,rooms_requested,
        checkin_date,checkout_date,guest_names,notes,submitted_by,branch_id,workflow_history)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, ref_code, client_name, client_phone||null, hotel_id||null, hotel_name||null,
       rooms_requested ? JSON.stringify(rooms_requested) : null,
       checkin_date||null, checkout_date||null, guest_names||null, notes||null,
       req.user.userId, req.user.branchId||null,
       JSON.stringify([{ ts: Date.now(), user: req.user.username, action: 'Query submitted' }])]
    );
    res.json({ id, ref_code });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/queries/:id  — update query & status
router.put('/:id', requireAuth, can('queries','edit'), async (req, res) => {
  try {
    const { client_name, client_phone, branch_id, status, supplier_confirmed, booking_ref, notes } = req.body;

    const [rows] = await pool.execute('SELECT * FROM queries WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Query not found' });
    const current = rows[0];

    let history = [];
    try {
      history = typeof current.workflow_history === 'string' ? JSON.parse(current.workflow_history) : (current.workflow_history || []);
    } catch (_) { history = []; }

    if (status && status !== current.status) {
      history.push({ ts: Date.now(), user: req.user.username, action: `Status → ${status}`, notes: notes || null });
    } else if (notes) {
      history.push({ ts: Date.now(), user: req.user.username, action: 'Note updated', notes });
    }

    const nextClientName = client_name !== undefined ? client_name : current.client_name;
    const nextClientPhone = client_phone !== undefined ? client_phone : current.client_phone;
    const nextBranchId = branch_id !== undefined ? (branch_id || null) : current.branch_id;
    const nextStatus = status !== undefined ? status : current.status;
    const nextSupplierConfirmed = supplier_confirmed !== undefined ? (supplier_confirmed ? 1 : 0) : current.supplier_confirmed;
    const nextBookingRef = booking_ref !== undefined ? booking_ref : current.booking_ref;
    const nextNotes = notes !== undefined ? notes : current.notes;

    await pool.execute(
      `UPDATE queries SET client_name=?,client_phone=?,branch_id=?,status=?,supplier_confirmed=?,booking_ref=?,notes=?,workflow_history=? WHERE id=?`,
      [nextClientName, nextClientPhone, nextBranchId, nextStatus, nextSupplierConfirmed, nextBookingRef, nextNotes, JSON.stringify(history), req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/queries/:id/chat  — add chat message / note
router.post('/:id/chat', requireAuth, can('queries'), async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    const [rows] = await pool.execute('SELECT workflow_history FROM queries WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Query not found' });
    const history = typeof rows[0]?.workflow_history === 'string'
      ? JSON.parse(rows[0].workflow_history || '[]')
      : (rows[0].workflow_history || []);
    const newEntry = { ts: Date.now(), user: req.user.username, role: req.user.role, message, type: 'chat' };
    history.push(newEntry);
    await pool.execute('UPDATE queries SET workflow_history=? WHERE id=?',
      [JSON.stringify(history), req.params.id]);
    res.json({ ok: true, message: newEntry, history });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/queries/:id  — delete query
router.delete('/:id', requireAuth, can('queries','del'), async (req, res) => {
  try {
    await pool.execute('DELETE FROM queries WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
