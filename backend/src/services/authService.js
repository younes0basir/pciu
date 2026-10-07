const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { getCapabilities } = require('../config/roles');
const { getAdminEnvConfig, isEnvAdminEmail } = require('../config/adminEnv');

const PUBLIC_REGISTER_ROLES = ['receptionist', 'nurse', 'doctor', 'chief'];

function generateToken(user) {
  const secret = process.env.JWT_SECRET || 'super_secret_picu_jwt_key_2026_safe_change';
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn }
  );
}

function toAuthUser(user) {
  const firstName = user.firstName || user.first_name || '';
  const lastName = user.lastName || user.last_name || '';
  return {
    id: user.id,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    email: user.email,
    role: user.role,
    capabilities: getCapabilities(user.role),
  };
}

async function login(email, password) {
  if (!email || !password) {
    throw { status: 400, message: 'Email and password are required.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const result = await query(
    'SELECT id, first_name, last_name, email, password_hash, role, is_active, must_change_password, temp_token FROM users WHERE lower(email) = $1',
    [normalizedEmail]
  );

  if (result.rowCount === 0) {
    throw { status: 401, message: 'Invalid email or password.' };
  }

  const user = result.rows[0];

  if (user.role === 'admin') {
    if (!getAdminEnvConfig()) {
      throw { status: 403, message: 'Admin sign-in is not configured on this server.' };
    }
    if (!isEnvAdminEmail(normalizedEmail)) {
      throw { status: 401, message: 'Invalid email or password.' };
    }
  }

  if (!user.is_active) {
    throw { status: 403, message: 'This account has been deactivated.' };
  }

  if (user.must_change_password) {
    throw {
      status: 403,
      code: 'PASSWORD_SETUP_REQUIRED',
      tempToken: user.temp_token,
      message: 'Ce compte doit d’abord être activé en configurant son mot de passe personnel.',
    };
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw { status: 401, message: 'Invalid email or password.' };
  }

  const token = generateToken(user);

  return {
    token,
    user: toAuthUser(user),
  };
}

async function validateTempToken(token) {
  if (!token) {
    throw { status: 400, message: 'Jeton temporaire manquant.' };
  }

  const result = await query(
    `SELECT id, first_name, last_name, email, role, is_active, must_change_password, temp_token_expires_at 
     FROM users 
     WHERE temp_token = $1`,
    [token]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'Lien d’activation ou jeton temporaire invalide.' };
  }

  const user = result.rows[0];

  if (!user.is_active) {
    throw { status: 403, message: 'Ce compte collaborateur est désactivé.' };
  }

  if (user.temp_token_expires_at && new Date(user.temp_token_expires_at) < new Date()) {
    throw { status: 410, message: 'Ce jeton temporaire a expiré. Veuillez contacter votre administrateur.' };
  }

  return {
    valid: true,
    user: {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      fullName: `${user.first_name} ${user.last_name}`,
      email: user.email,
      role: user.role,
    },
  };
}

async function setupPasswordWithToken(token, newPassword) {
  if (!token) {
    throw { status: 400, message: 'Jeton temporaire manquant.' };
  }

  if (!newPassword || newPassword.length < 6) {
    throw { status: 400, message: 'Le mot de passe doit comporter au moins 6 caractères.' };
  }

  const result = await query(
    `SELECT id, first_name, last_name, email, role, is_active, temp_token_expires_at 
     FROM users 
     WHERE temp_token = $1`,
    [token]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'Lien d’activation ou jeton temporaire invalide ou déjà utilisé.' };
  }

  const user = result.rows[0];

  if (!user.is_active) {
    throw { status: 403, message: 'Ce compte collaborateur est désactivé.' };
  }

  if (user.temp_token_expires_at && new Date(user.temp_token_expires_at) < new Date()) {
    throw { status: 410, message: 'Ce jeton temporaire a expiré. Demandez un nouveau lien à votre administrateur.' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  const updated = await query(
    `UPDATE users 
     SET password_hash = $1, 
         must_change_password = false, 
         temp_token = NULL, 
         temp_token_expires_at = NULL, 
         updated_at = NOW() 
     WHERE id = $2
     RETURNING id, first_name, last_name, email, role, is_active`,
    [passwordHash, user.id]
  );

  const updatedUser = updated.rows[0];
  const authToken = generateToken(updatedUser);

  return {
    token: authToken,
    user: toAuthUser(updatedUser),
    message: 'Mot de passe configuré avec succès ! Votre compte est activé.',
  };
}

async function register({ firstName, lastName, email, password, role }) {
  if (!PUBLIC_REGISTER_ROLES.includes(role)) {
    throw {
      status: 400,
      message: `Role must be one of: ${PUBLIC_REGISTER_ROLES.join(', ')}.`,
    };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await query('SELECT id FROM users WHERE lower(email) = $1', [normalizedEmail]);
  if (existing.rowCount > 0) {
    throw { status: 409, message: 'A user with this email address already exists.' };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO users (first_name, last_name, email, password_hash, role, is_active, must_change_password)
     VALUES ($1, $2, $3, $4, $5, true, false)
     RETURNING id, first_name, last_name, email, role, is_active, created_at`,
    [firstName.trim(), lastName.trim(), normalizedEmail, passwordHash, role]
  );

  const user = result.rows[0];
  return {
    token: generateToken(user),
    user: toAuthUser(user),
  };
}

async function getProfile(userId) {
  const result = await query(
    'SELECT id, first_name, last_name, email, role, is_active, created_at FROM users WHERE id = $1',
    [userId]
  );

  if (result.rowCount === 0) {
    throw { status: 404, message: 'User not found.' };
  }

  const user = result.rows[0];
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    role: user.role,
    capabilities: getCapabilities(user.role),
    isActive: user.is_active,
    createdAt: user.created_at,
  };
}

module.exports = {
  login,
  register,
  getProfile,
  generateToken,
  validateTempToken,
  setupPasswordWithToken,
};
