'use strict';
/**
 * RBAC MIDDLEWARE
 * Usage:  router.get('/hotels', requireAuth, can('hotels','view'), handler)
 *
 * Policy:
 *   • superadmin  → unrestricted (_all: true)
 *   • admin       → full role-level defaults for ALL branches;
 *                    any saved custom-permissions JSON is IGNORED so a
 *                    malformed matrix can never blank their sidebar.
 *   • branch users (branch_admin, editor, viewer, user)
 *                 → custom matrix is authoritative when present & valid;
 *                    role defaults apply only when no custom matrix exists.
 */

// Default permissions per role
const ROLE_DEFAULTS = {
  superadmin: { _all: true },
  admin: {
    dash:true, hotels:{view:true,add:true,edit:true,del:true,exp:true},
    vendors:{view:true,add:true,edit:true,del:true},
    search:true, ratelist:{view:true,exp:true},
    queries:{view:true,add:true,edit:true,del:true},
    quotations_pvt:{view:true,add:true,edit:true,del:true},
    quotations_grp:{view:true,add:true,edit:true,del:true},
    allquot:{view:true,add:true,edit:true,del:true},
    transport:{view:true,add:true,edit:true,del:true},
    import:{view:true,imp:true,exp:true},
    users:{view:true,add:true,edit:true,del:true},
    branches:{view:true,add:true,edit:true},
    logs:{view:true}, recycle:{view:true,del:true},
    backup:{view:true}, settings:{view:true,edit:true},
    dedup:{view:true,del:true},
    packages:{view:true,add:true,edit:true,del:true},
    images:{view:true,add:true,del:true}
  },
  branch_admin: {
    dash:true, hotels:{view:true}, search:true,
    ratelist:{view:true,exp:true},
    queries:{view:true,add:true,edit:true},
    quotations_pvt:{view:true,add:true,edit:true,del:true},
    quotations_grp:{view:true,add:true,edit:true,del:true},
    allquot:{view:true}, transport:{view:true},
    import:{view:true,exp:true},
    users:{view:true,add:true,edit:true},
    branches:{view:true,edit:true},
    logs:{view:true}, recycle:{view:true}, settings:{view:true,edit:true},
    packages:{view:true,add:true,edit:true},
    images:{view:true,add:true}
  },
  editor: {
    dash:true, hotels:{view:true,add:true,edit:true,exp:true},
    vendors:{view:true,add:true,edit:true}, search:true,
    ratelist:{view:true,exp:true},
    queries:{view:true,add:true,edit:true},
    quotations_pvt:{view:true,add:true,edit:true},
    quotations_grp:{view:true,add:true,edit:true},
    transport:{view:true,add:true,edit:true},
    import:{view:true,imp:true,exp:true},
    packages:{view:true,add:true,edit:true},
    images:{view:true,add:true}
  },
  viewer: {
    dash:true, hotels:{view:true}, search:true,
    ratelist:{view:true}, queries:{view:true},
    quotations_pvt:{view:true}, quotations_grp:{view:true},
    transport:{view:true}, packages:{view:true}
  },
  user: {
    dash:true, search:true, ratelist:{view:true},
    quotations_pvt:{view:true,add:true,edit:true},
    quotations_grp:{view:true,add:true,edit:true},
    transport:{view:true}, packages:{view:true,add:true}
  }
};

// Roles that always use role-level defaults and NEVER consult custom matrix
const GLOBAL_ADMIN_ROLES = new Set(['superadmin', 'admin']);

function hasPerm(user, module, action = 'view') {
  if (!user) return false;
  const defaults = ROLE_DEFAULTS[user.role] || {};
  if (defaults._all) return true; // superadmin → everything

  // ── Admin/Superadmin: ALWAYS use role defaults, ignore custom matrix ──
  if (GLOBAL_ADMIN_ROLES.has(user.role)) {
    const rm = defaults[module];
    if (!rm) return false;
    if (typeof rm === 'boolean') return rm;
    return !!rm[action];
  }

  // ── Branch users: custom matrix is authoritative when valid ──
  let up = user.permissions || null;
  if (typeof up === 'string') {
    try { up = JSON.parse(up); } catch (_) { up = null; }
  }
  if (up && typeof up === 'object' && Object.keys(up).length > 0) {
    if (up[module] === undefined) return false;
    if (Array.isArray(up[module])) return up[module].includes(action);
    if (typeof up[module] === 'boolean') return up[module];
    if (up[module][action] !== undefined) return !!up[module][action];
    return false;
  }

  // Fall back to role defaults
  const rm = defaults[module];
  if (!rm) return false;
  if (typeof rm === 'boolean') return rm;
  return !!rm[action];
}

// Express middleware factory
function can(module, action = 'view') {
  return (req, res, next) => {
    if (!hasPerm(req.user, module, action)) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    next();
  };
}

module.exports = { hasPerm, can, ROLE_DEFAULTS, GLOBAL_ADMIN_ROLES };
