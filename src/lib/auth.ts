import crypto from 'crypto';

/**
 * Hashes a password using crypto.scryptSync with a salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a password against a stored scrypt hash
 */
export function verifyPassword(password: string, hash: string): boolean {
  if (!hash || typeof hash !== 'string' || !hash.includes(':')) return false;
  const parts = hash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, storedHash] = parts;
  const derivedKey = crypto.scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(storedHash, 'hex');
  if (storedBuffer.length !== derivedKey.length) return false;
  return crypto.timingSafeEqual(storedBuffer, derivedKey);
}

/**
 * Generates a cryptographically secure random password meeting strict security requirements:
 * - 12 to 16 characters.
 * - At least 1 uppercase, 1 lowercase, 1 digit, 1 special symbol.
 * - Excludes user context terms (first name, last name, email local part, document, etc.)
 */
export function generateSecurePassword(userContext: {
  first_name?: string;
  last_name?: string;
  email?: string;
  document_number?: string;
  username?: string;
} = {}): string {
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%^&*()_+-=';
  const allChars = uppers + lowers + numbers + symbols;

  const blacklist = [
    userContext.first_name,
    userContext.last_name,
    userContext.email ? userContext.email.split('@')[0] : '',
    userContext.document_number,
    userContext.username
  ]
    .filter(Boolean)
    .map(s => String(s).trim().toLowerCase())
    .filter(s => s.length >= 3);

  for (let attempt = 0; attempt < 50; attempt++) {
    const length = 14;
    const chars = [
      uppers[crypto.randomInt(0, uppers.length)],
      lowers[crypto.randomInt(0, lowers.length)],
      numbers[crypto.randomInt(0, numbers.length)],
      symbols[crypto.randomInt(0, symbols.length)],
    ];

    for (let i = chars.length; i < length; i++) {
      chars.push(allChars[crypto.randomInt(0, allChars.length)]);
    }

    // Fisher-Yates Shuffle using crypto.randomInt
    for (let i = chars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    const candidate = chars.join('');
    const candLower = candidate.toLowerCase();

    const hasForbiddenTerm = blacklist.some(term => candLower.includes(term));
    if (!hasForbiddenTerm) {
      return candidate;
    }
  }

  // Fallback guaranteed secure
  return `Bk#${crypto.randomBytes(6).toString('hex')}!8`;
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
