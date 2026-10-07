const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../config/db');
const { isEnvAdminEmail } = require('../config/adminEnv');
const { ROLES } = require('../config/roles');

async function listUsers() {
  const result = await query(
    `SELECT id, first_name, last_name, email, role, is_active, must_change_password, temp_token, temp_token_expires_at, created_at, updated_at
     FROM users
     ORDER BY created_at DESC`
  );

  return result.rows.map((u) => ({
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    fullName: `${u.first_name} ${u.last_name}`,
    email: u.email,
    role: u.role,
    isActive: u.is_active,
    mustChangePassword: Boolean(u.must_change_password),
    tempToken: u.temp_token,
    tempTokenExpiresAt: u.temp_token_expires_at,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  }));
}

async function getUserStats() {
  const result = await query(`
    SELECT 
      COUNT(*)::int AS total_users,
      COUNT(*) FILTER (WHERE is_active = true)::int AS active_users,
      COUNT(*) FILTER (WHERE is_active = false)::int AS inactive_users,
      COUNT(*) FILTER (WHERE must_change_password = true)::int AS pending_setup_users,
      COUNT(*) FILTER (WHERE role = 'doctor')::int AS doctor_count,
      COUNT(*) FILTER (WHERE role = 'nurse')::int AS nurse_count,
      COUNT(*) FILTER (WHERE role = 'receptionist')::int AS receptionist_count,
      COUNT(*) FILTER (WHERE role = 'chief')::int AS chief_count,
      COUNT(*) FILTER (WHERE role = 'admin')::int AS admin_count
    FROM users
  `);

  const row = result.rows[0];
  return {
    totalUsers: row.total_users || 0,
    activeUsers: row.active_users || 0,
    inactiveUsers: row.inactive_users || 0,
    pendingSetupUsers: row.pending_setup_users || 0,
    roles: {
      doctor: row.doctor_count || 0,
      nurse: row.nurse_count || 0,
      receptionist: row.receptionist_count || 0,
      chief: row.chief_count || 0,
      admin: row.admin_count || 0,
    },
  };
}

async function createUser(data) {
  const { firstName, lastName, email, role } = data;

  if (!firstName || !lastName || !email || !role) {
    throw {
      status: 400,
      message: 'firstName, lastName, email, and role are required.',
    };
  }

  if (!ROLES.includes(role)) {
    throw {
      status: 400,
      message: `Invalid role '${role}'. Must be one of: ${ROLES.join(', ')}.`,
    };
  }

  if (role === 'admin') {
    throw {
      status: 403,
      message: 'Admin accounts are provisioned via server environment only.',
    };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes('@')) {
    throw { status: 400, message: 'Invalid email address.' };
  }

  // Check if email already exists
  const existing = await query('SELECT id FROM users WHERE lower(email) = $1', [normalizedEmail]);
  if (existing.rowCount > 0) {
    throw { status: 409, message: 'A user with this email address already exists.' };
  }

  // Generate secure temporary activation token (valid for 7 days)
  const tempToken = crypto.randomBytes(24).toString('hex');
  const tempTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Generate unguessable random placeholder password hash so user must set their own password
  const randomSecret = crypto.randomBytes(32).toString('hex');
  const passwordHash = await bcrypt.hash(randomSecret, 10);

  const result = await query(
    `INSERT INTO users (first_name, last_name, email, password_hash, role, is_active, must_change_password, temp_token, temp_token_expires_at)
     VALUES ($1, $2, $3, $4, $5, true, true, $6, $7)
     RETURNING id, first_name, last_name, email, role, is_active, must_change_password, temp_token, temp_token_expires_at, created_at`,
    [firstName.trim(), lastName.trim(), normalizedEmail, passwordHash, role, tempToken, tempTokenExpiresAt]
  );

  const u = result.rows[0];
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    fullName: `${u.first_name} ${u.last_name}`,
    email: u.email,
    role: u.role,
    isActive: u.is_active,
    mustChangePassword: true,
    tempToken: u.temp_token,
    tempTokenExpiresAt: u.temp_token_expires_at,
    createdAt: u.created_at,
  };
}

async function generateTempTokenForUser(id) {
  const existing = await query('SELECT id, email, role, first_name, last_name FROM users WHERE id = $1', [id]);
  if (existing.rowCount === 0) {
    throw { status: 404, message: 'User not found.' };
  }

  const user = existing.rows[0];
  const tempToken = crypto.randomBytes(24).toString('hex');
  const tempTokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

  await query(
    `UPDATE users 
     SET must_change_password = true, 
         temp_token = $1, 
         temp_token_expires_at = $2, 
         updated_at = NOW() 
     WHERE id = $3`,
    [tempToken, tempTokenExpiresAt, id]
  );

  return {
    success: true,
    tempToken,
    tempTokenExpiresAt,
    user: {
      id: user.id,
      fullName: `${user.first_name} ${user.last_name}`,
      email: user.email,
    },
    message: `Nouveau jeton temporaire généré pour ${user.first_name} ${user.last_name}.`,
  };
}

async function updateUser(id, data) {
  const { firstName, lastName, email, role, isActive } = data;

  const existing = await query('SELECT id, first_name, last_name, email, role, is_active FROM users WHERE id = $1', [id]);
  if (existing.rowCount === 0) {
    throw { status: 404, message: 'User not found.' };
  }

  const existingUser = existing.rows[0];
  const isEnvAdmin = existingUser.role === 'admin' && isEnvAdminEmail(existingUser.email);

  if (role !== undefined) {
    if (!ROLES.includes(role)) {
      throw {
        status: 400,
        message: `Invalid role '${role}'. Must be one of: ${ROLES.join(', ')}.`,
      };
    }
    if (role === 'admin' && existingUser.role !== 'admin') {
      throw {
        status: 403,
        message: 'Admin role cannot be assigned through the API.',
      };
    }
    if (isEnvAdmin && role !== 'admin') {
      throw {
        status: 403,
        message: 'The environment admin account cannot be demoted.',
      };
    }
  }

  if (isEnvAdmin && isActive === false) {
    throw {
      status: 403,
      message: 'The environment admin account cannot be deactivated.',
    };
  }

  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (firstName !== undefined && firstName.trim()) {
    fields.push(`first_name = $${paramIndex++}`);
    values.push(firstName.trim());
  }

  if (lastName !== undefined && lastName.trim()) {
    fields.push(`last_name = $${paramIndex++}`);
    values.push(lastName.trim());
  }

  if (email !== undefined) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) {
      throw { status: 400, message: 'Invalid email address.' };
    }
    if (normalizedEmail !== existingUser.email.toLowerCase()) {
      const emailConflict = await query(
        'SELECT id FROM users WHERE lower(email) = $1 AND id != $2',
        [normalizedEmail, id]
      );
      if (emailConflict.rowCount > 0) {
        throw { status: 409, message: 'A user with this email address already exists.' };
      }
      fields.push(`email = $${paramIndex++}`);
      values.push(normalizedEmail);
    }
  }

  if (role !== undefined) {
    fields.push(`role = $${paramIndex++}`);
    values.push(role);
  }

  if (isActive !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    values.push(Boolean(isActive));
  }

  if (fields.length === 0) {
    throw { status: 400, message: 'No fields provided for update.' };
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}
     RETURNING id, first_name, last_name, email, role, is_active, must_change_password, temp_token, temp_token_expires_at, updated_at, created_at`,
    values
  );

  const u = result.rows[0];
  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    fullName: `${u.first_name} ${u.last_name}`,
    email: u.email,
    role: u.role,
    isActive: u.is_active,
    mustChangePassword: Boolean(u.must_change_password),
    tempToken: u.temp_token,
    tempTokenExpiresAt: u.temp_token_expires_at,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
  };
}

async function deleteUser(id, requestingUserId) {
  if (String(id) === String(requestingUserId)) {
    throw { status: 400, message: 'You cannot delete your own admin account.' };
  }

  const existing = await query('SELECT id, email, role, first_name, last_name FROM users WHERE id = $1', [id]);
  if (existing.rowCount === 0) {
    throw { status: 404, message: 'User not found.' };
  }

  const user = existing.rows[0];
  if (user.role === 'admin' && isEnvAdminEmail(user.email)) {
    throw { status: 403, message: 'The primary environment admin account cannot be deleted.' };
  }

  try {
    await query('DELETE FROM users WHERE id = $1', [id]);
    return {
      success: true,
      action: 'deleted',
      message: `Account for ${user.first_name} ${user.last_name} (${user.email}) permanently removed.`,
    };
  } catch (error) {
    // If foreign key constraint is violated (e.g. consultations.doctor_id RESTRICT)
    if (error.code === '23503') {
      await query('UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
      return {
        success: true,
        action: 'deactivated',
        message: `Account has historical clinical consultation records. It was automatically deactivated to preserve medical audit records.`,
      };
    }
    throw error;
  }
}

module.exports = {
  listUsers,
  getUserStats,
  createUser,
  updateUser,
  generateTempTokenForUser,
  deleteUser,
};
