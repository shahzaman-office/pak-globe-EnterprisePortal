'use strict';
const router = require('express').Router();
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { hasPerm } = require('../middleware/rbac');
const { v4: uuid } = require('uuid');

function allowed(req) { return hasPerm(req.user, 'packages', 'view') || hasPerm(req.user, 'quotations_pvt', 'view'); }
function scope(sql, params, req) {
  if (!['superadmin', 'admin'].includes(req.user.role)) {
    // Branch-scoped user: restrict to their own branch
    sql += ' AND p.branch_id=?';
    params.push(req.user.branchId || null);
  }
  return [sql, params];
}

router.get('/', requireAuth, async (req, res) => {
  if (!allowed(req)) return res.status(403).json({ error: 'Permission denied' });
  try {
    let [sql, params] = scope('SELECT p.*, COALESCE(SUM(pp.amount),0) paid_total FROM quotation_packages p LEFT JOIN package_payments pp ON pp.package_id=p.id WHERE 1=1', [], req);
    sql += ' GROUP BY p.id ORDER BY p.created_at DESC';
    const [rows] = await pool.execute(sql, params);
    res.json(rows.map(row => ({ ...row, received_amount: Number(row.paid_total || row.received_amount || 0), remaining_amount: Math.max(0, Number(row.total_amount || 0) - Number(row.paid_total || row.received_amount || 0)) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', requireAuth, async (req, res) => {
  if (!allowed(req)) return res.status(403).json({ error: 'Permission denied' });
  try {
    let sql = 'SELECT * FROM quotation_packages WHERE id=?';
    const params = [req.params.id];
    if (!['superadmin', 'admin'].includes(req.user.role)) {
      sql += ' AND branch_id=?';
      params.push(req.user.branchId || null);
    }
    sql += ' LIMIT 1';
    const [rows] = await pool.execute(sql, params);
    if (!rows.length) return res.status(404).json({ error: 'Package not found' });
    const [payments] = await pool.execute('SELECT amount,received_on,method,note FROM package_payments WHERE package_id=? ORDER BY received_on ASC,created_at ASC', [req.params.id]);
    res.json({ ...rows[0], payments });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  if (!hasPerm(req.user, 'packages', 'add') && !hasPerm(req.user, 'quotations_pvt', 'add')) return res.status(403).json({ error: 'Permission denied' });
  try {
    const b = req.body || {}; const id = uuid();
    const isGlobal = ['superadmin', 'admin'].includes(req.user.role);
    const assignedBranch = isGlobal ? (b.branch_id || null) : (req.user.branchId || null);
    const visa = Number(b.visa_rate||0)*Number(b.visa_qty||0), ticket = Number(b.ticket_rate||0)*Number(b.ticket_qty||0), transport = Number(b.transport_rate||0)*Number(b.transport_qty||0);
    const total = visa + ticket + transport + Number(b.hotel_amount||0) + Number(b.other_amount||0);
    await pool.execute(`INSERT INTO quotation_packages (id,quotation_id,client_name,branch_id,visa_rate,visa_qty,ticket_rate,ticket_qty,transport_rate,transport_qty,hotel_amount,other_amount,total_amount,remaining_amount,notes,details,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [id,b.quotation_id||null,b.client_name,assignedBranch,b.visa_rate||0,b.visa_qty||0,b.ticket_rate||0,b.ticket_qty||0,b.transport_rate||0,b.transport_qty||0,b.hotel_amount||0,b.other_amount||0,total,total,b.notes||null,b.details ? JSON.stringify(b.details) : null,req.user.userId]);
    if (Array.isArray(b.payments)) for (const p of b.payments) if (Number(p.amount)>0) await pool.execute('INSERT INTO package_payments (id,package_id,amount,received_on,method,note,created_by) VALUES (?,?,?,?,?,?,?)',[uuid(),id,p.amount,p.received_on||new Date(),p.method||null,p.note||null,req.user.userId]);
    res.json({ id, total_amount: total, ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, async (req, res) => {
  if (!hasPerm(req.user, 'packages', 'edit') && !hasPerm(req.user, 'quotations_pvt', 'edit')) return res.status(403).json({ error: 'Permission denied' });
  try {
    // Branch isolation check on update
    if (!['superadmin', 'admin'].includes(req.user.role)) {
      const [check] = await pool.execute('SELECT branch_id FROM quotation_packages WHERE id=?', [req.params.id]);
      if (!check.length || check[0].branch_id !== req.user.branchId) {
        return res.status(403).json({ error: 'Permission denied' });
      }
    }
    const b = req.body || {};
    const visa = Number(b.visa_rate||0)*Number(b.visa_qty||0), ticket = Number(b.ticket_rate||0)*Number(b.ticket_qty||0), transport = Number(b.transport_rate||0)*Number(b.transport_qty||0);
    const total = visa + ticket + transport + Number(b.hotel_amount||0) + Number(b.other_amount||0);
    const [payments] = await pool.execute('SELECT COALESCE(SUM(amount),0) AS paid FROM package_payments WHERE package_id=?', [req.params.id]);
    const paid = Number(payments[0]?.paid || 0);
    const remaining = Math.max(0, total - paid);
    await pool.execute(
      `UPDATE quotation_packages SET client_name=?,visa_rate=?,visa_qty=?,ticket_rate=?,ticket_qty=?,transport_rate=?,transport_qty=?,hotel_amount=?,other_amount=?,total_amount=?,remaining_amount=?,notes=?,details=? WHERE id=?`,
      [b.client_name, b.visa_rate||0, b.visa_qty||0, b.ticket_rate||0, b.ticket_qty||0, b.transport_rate||0, b.transport_qty||0, b.hotel_amount||0, b.other_amount||0, total, remaining, b.notes||null, b.details ? JSON.stringify(b.details) : null, req.params.id]
    );
    res.json({ ok: true, total_amount: total, remaining_amount: remaining });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  if (!hasPerm(req.user, 'packages', 'del') && !hasPerm(req.user, 'quotations_pvt', 'del')) return res.status(403).json({ error: 'Permission denied' });
  try {
    // Branch isolation check on delete
    if (!['superadmin', 'admin'].includes(req.user.role)) {
      const [check] = await pool.execute('SELECT branch_id FROM quotation_packages WHERE id=?', [req.params.id]);
      if (!check.length || check[0].branch_id !== req.user.branchId) {
        return res.status(403).json({ error: 'Permission denied' });
      }
    }
    await pool.execute('DELETE FROM package_payments WHERE package_id=?', [req.params.id]);
    await pool.execute('DELETE FROM quotation_packages WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/payments', requireAuth, async (req, res) => {
  try {
    const p = req.body || {};
    const amount = Number(p.amount);
    if (!(amount > 0)) return res.status(400).json({ error: 'Valid payment amount required' });
    await pool.execute(
      'INSERT INTO package_payments (id,package_id,amount,received_on,method,note,created_by) VALUES (?,?,?,?,?,?,?)',
      [uuid(), req.params.id, amount, p.received_on || new Date(), p.method || null, p.note || null, req.user.userId]
    );
    // Recalculate remaining amount on package
    const [sumRows] = await pool.execute('SELECT COALESCE(SUM(amount),0) AS total_paid FROM package_payments WHERE package_id=?', [req.params.id]);
    const totalPaid = Number(sumRows[0]?.total_paid || 0);
    await pool.execute(
      'UPDATE quotation_packages SET remaining_amount = GREATEST(0, total_amount - ?) WHERE id=?',
      [totalPaid, req.params.id]
    );
    res.json({ ok: true, total_paid: totalPaid });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});
module.exports = router;
