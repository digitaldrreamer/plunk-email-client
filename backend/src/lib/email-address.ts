/**
 * Utilities for enforcing the team.reclear.io email domain and sanitising
 * local parts (the username before the @).
 *
 * Rules applied to the local part:
 *   - Lowercase
 *   - Strip any character not in [a-z0-9._-]
 *   - Collapse consecutive dots (.. → .)
 *   - Strip leading/trailing separators (. - _)
 *
 * The domain is always forced to TEAM_DOMAIN, regardless of what the caller
 * provided.  Use normaliseTeamEmail() on every inbound email field that is
 * supposed to be a @team.reclear.io address.
 */

export const TEAM_DOMAIN = "team.reclear.io";

/**
 * Sanitise a raw input into a valid @team.reclear.io address.
 *
 * @throws {Error} if the local part is empty after sanitisation (completely
 *   invalid input with no usable characters).
 */
export function normaliseTeamEmail(raw: string): string {
  const trimmed = raw.trim().toLowerCase();

  // Take only what's before the @ (if present)
  const atIdx = trimmed.indexOf("@");
  let local = atIdx === -1 ? trimmed : trimmed.slice(0, atIdx);

  // Keep only valid username characters
  local = local.replace(/[^a-z0-9._-]/g, "");

  // Collapse consecutive dots/separators
  local = local.replace(/\.{2,}/g, ".");

  // Strip leading and trailing separators
  local = local.replace(/^[._-]+|[._-]+$/g, "");

  if (!local) {
    throw new Error(`Cannot derive a valid username from: "${raw}"`);
  }

  return `${local}@${TEAM_DOMAIN}`;
}

/**
 * Return true if the string is already a properly-formed @team.reclear.io
 * address with a valid local part.
 */
export function isTeamEmail(email: string): boolean {
  try {
    return normaliseTeamEmail(email) === email.trim().toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Validate that an email string is structurally valid (any domain).
 * Used for recovery / external email addresses.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
