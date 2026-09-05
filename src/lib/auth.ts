import crypto from 'crypto';

/**
 * Max password length to prevent DoS via CPU exhaustion
 */
const MAX_PASSWORD_LENGTH = 128;

/**
 * Hashes a password using crypto.scryptSync with a 16-byte random salt
 */
export function hashPassword(password: string): string {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password length exceeds maximum limit of ${MAX_PASSWORD_LENGTH} characters`);
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a password against a stored scrypt hash in a timing-safe manner
 */
export function verifyPassword(password: string, hash: string): boolean {
  if (!password || typeof password !== 'string' || password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }
  if (!hash || typeof hash !== 'string' || !hash.includes(':')) {
    return false;
  }

  const parts = hash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, salt, storedHashHex] = parts;
  if (!salt || !storedHashHex || salt.length !== 32) {
    return false;
  }

  try {
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const storedBuffer = Buffer.from(storedHashHex, 'hex');

    if (storedBuffer.length !== derivedKey.length) {
      return false;
    }

    return crypto.timingSafeEqual(storedBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Checks if a stored password hash needs re-hashing (e.g. non-scrypt format or legacy)
 */
export function needsPasswordRehash(storedHash: string): boolean {
  if (!storedHash || typeof storedHash !== 'string') return true;
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return true;
  return false;
}

/**
 * Masks an email address for public display / logs (e.g. j***z@gmail.com)
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.com';
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Hashes a raw session token using SHA-256 for secure database storage.
 * Prevents session hijacking even if database read access is compromised.
 */
export function hashSessionToken(token: string): string {
  if (!token || typeof token !== 'string') return '';
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}
