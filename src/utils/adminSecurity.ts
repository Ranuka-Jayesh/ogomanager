/**
 * Admin security prefs: PIN + biometric preference.
 * Prefer Supabase `admin` columns; mirror/fallback to localStorage.
 *
 * Run once on Supabase (SQL editor):
 *
 *   alter table admin
 *     add column if not exists pin_hash text,
 *     add column if not exists pin_enabled boolean default false,
 *     add column if not exists biometric_enabled boolean default false;
 */

import { supabase } from '../supabaseClient';
import { hashPin, isValidPinFormat, verifyPin } from './pinHash';

export type AdminSecurityPrefs = {
  email: string;
  adminId?: string;
  pinEnabled: boolean;
  pinHash: string | null;
  biometricEnabled: boolean;
  /** True when DB columns appear unavailable (local-only mode) */
  localOnly: boolean;
};

const LOCAL_KEY = 'ogo_admin_security';
const LAST_EMAIL_KEY = 'ogo_last_login_email';

type LocalStore = Record<
  string,
  {
    pinHash?: string | null;
    pinEnabled?: boolean;
    biometricEnabled?: boolean;
    pinLength?: number;
  }
>;

function readLocalAll(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalEmail(
  email: string,
  patch: Partial<LocalStore[string]>
): void {
  const key = email.trim().toLowerCase();
  const all = readLocalAll();
  all[key] = { ...all[key], ...patch };
  localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
}

function readLocalEmail(email: string): LocalStore[string] {
  const key = email.trim().toLowerCase();
  return readLocalAll()[key] || {};
}

export function getLastLoginEmail(): string | null {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function setLastLoginEmail(email: string): void {
  try {
    localStorage.setItem(LAST_EMAIL_KEY, email.trim().toLowerCase());
  } catch {
    /* ignore */
  }
}

/**
 * Resolve which account to use for PIN-only login (no email field).
 * Prefers last login email if that account has a PIN; else first local PIN account.
 */
export function getPinLoginAccount(): {
  email: string;
  pinLength: number | null;
} | null {
  const all = readLocalAll();
  const last = getLastLoginEmail();

  if (last) {
    const local = all[last.trim().toLowerCase()];
    if (local?.pinEnabled && local.pinHash) {
      return {
        email: last.trim().toLowerCase(),
        pinLength:
          local.pinLength && local.pinLength >= 4 && local.pinLength <= 6
            ? local.pinLength
            : null,
      };
    }
  }

  for (const [email, local] of Object.entries(all)) {
    if (local?.pinEnabled && local.pinHash) {
      return {
        email,
        pinLength:
          local.pinLength && local.pinLength >= 4 && local.pinLength <= 6
            ? local.pinLength
            : null,
      };
    }
  }

  return null;
}

export function getStoredPinLength(email: string): number {
  const local = readLocalEmail(email);
  if (local.pinLength && local.pinLength >= 4 && local.pinLength <= 6) {
    return local.pinLength;
  }
  return 4;
}

function emptyPrefs(email: string): AdminSecurityPrefs {
  return {
    email: email.trim().toLowerCase(),
    pinEnabled: false,
    pinHash: null,
    biometricEnabled: false,
    localOnly: true,
  };
}

/** Load security for an admin email. Merges local + DB. */
export async function loadAdminSecurity(email: string): Promise<AdminSecurityPrefs> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return emptyPrefs('');

  const local = readLocalEmail(normalized);
  let prefs: AdminSecurityPrefs = {
    email: normalized,
    pinEnabled: !!local.pinEnabled && !!local.pinHash,
    pinHash: local.pinHash ?? null,
    biometricEnabled: !!local.biometricEnabled,
    localOnly: true,
  };

  try {
    const { data, error } = await supabase
      .from('admin')
      .select('id, email, pin_hash, pin_enabled, biometric_enabled')
      .ilike('email', normalized)
      .maybeSingle();

    if (error) {
      // Column missing or other API error — stay local
      console.warn('[adminSecurity] DB load fallback:', error.message);
      return prefs;
    }

    if (!data) return prefs;

    prefs = {
      email: (data.email || normalized).toLowerCase(),
      adminId: data.id,
      pinHash: data.pin_hash ?? local.pinHash ?? null,
      pinEnabled: !!(data.pin_enabled && (data.pin_hash || local.pinHash)),
      biometricEnabled: !!data.biometric_enabled || !!local.biometricEnabled,
      localOnly: false,
    };

    // Keep local mirror in sync
    writeLocalEmail(normalized, {
      pinHash: prefs.pinHash,
      pinEnabled: prefs.pinEnabled,
      biometricEnabled: prefs.biometricEnabled,
    });
  } catch (e) {
    console.warn('[adminSecurity] load error', e);
  }

  return prefs;
}

async function updateAdminRow(
  adminId: string,
  fields: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('admin').update(fields).eq('id', adminId);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function verifyAdminPassword(
  email: string,
  password: string
): Promise<{ ok: boolean; adminId?: string; error?: string }> {
  const { data: admin, error } = await supabase
    .from('admin')
    .select('id, email, password')
    .ilike('email', email.trim())
    .maybeSingle();

  if (error || !admin) {
    return { ok: false, error: 'Account not found.' };
  }
  if (admin.password !== password) {
    return { ok: false, error: 'Incorrect password.' };
  }
  return { ok: true, adminId: admin.id };
}

export async function setAdminPin(opts: {
  email: string;
  pin: string;
  currentPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isValidPinFormat(opts.pin)) {
    return { ok: false, error: 'PIN must be 4–6 digits.' };
  }
  const auth = await verifyAdminPassword(opts.email, opts.currentPassword);
  if (!auth.ok) return { ok: false, error: auth.error || 'Password check failed.' };

  const pinHash = await hashPin(opts.pin);
  const email = opts.email.trim().toLowerCase();
  const pinLength = opts.pin.length;

  writeLocalEmail(email, { pinHash, pinEnabled: true, pinLength });

  if (auth.adminId) {
    const res = await updateAdminRow(auth.adminId, {
      pin_hash: pinHash,
      pin_enabled: true,
    });
    if (!res.ok) {
      // Columns may not exist; local still works
      console.warn('[adminSecurity] PIN DB save failed:', res.error);
    }
    try {
      await supabase.from('log').insert({
        admin_id: auth.adminId,
        admin_email: email,
        action: 'security_pin_set',
      });
    } catch {
      /* ignore */
    }
  }

  return { ok: true };
}

export async function removeAdminPin(opts: {
  email: string;
  currentPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  const auth = await verifyAdminPassword(opts.email, opts.currentPassword);
  if (!auth.ok) return { ok: false, error: auth.error || 'Password check failed.' };

  const email = opts.email.trim().toLowerCase();
  writeLocalEmail(email, { pinHash: null, pinEnabled: false });

  if (auth.adminId) {
    const res = await updateAdminRow(auth.adminId, {
      pin_hash: null,
      pin_enabled: false,
    });
    if (!res.ok) console.warn('[adminSecurity] PIN remove DB:', res.error);
    try {
      await supabase.from('log').insert({
        admin_id: auth.adminId,
        admin_email: email,
        action: 'security_pin_removed',
      });
    } catch {
      /* ignore */
    }
  }
  return { ok: true };
}

export async function setBiometricPreference(opts: {
  email: string;
  enabled: boolean;
  adminId?: string;
}): Promise<void> {
  const email = opts.email.trim().toLowerCase();
  writeLocalEmail(email, { biometricEnabled: opts.enabled });

  let adminId = opts.adminId;
  if (!adminId) {
    const { data } = await supabase
      .from('admin')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    adminId = data?.id;
  }
  if (adminId) {
    const res = await updateAdminRow(adminId, { biometric_enabled: opts.enabled });
    if (!res.ok) console.warn('[adminSecurity] bio pref DB:', res.error);
    try {
      await supabase.from('log').insert({
        admin_id: adminId,
        admin_email: email,
        action: opts.enabled ? 'security_bio_enabled' : 'security_bio_disabled',
      });
    } catch {
      /* ignore */
    }
  }
}

/** Verify PIN against DB/local hash. On success returns email. */
export async function authenticateWithPin(
  email: string,
  pin: string
): Promise<{ ok: boolean; email?: string; error?: string }> {
  if (!isValidPinFormat(pin)) {
    return { ok: false, error: 'Enter a 4–6 digit PIN.' };
  }
  const prefs = await loadAdminSecurity(email);
  if (!prefs.pinEnabled || !prefs.pinHash) {
    return { ok: false, error: 'PIN login is not set up for this account.' };
  }
  const match = await verifyPin(pin, prefs.pinHash);
  if (!match) {
    try {
      await supabase.from('log').insert({
        admin_id: prefs.adminId || null,
        admin_email: email.trim().toLowerCase(),
        action: 'login_fail_pin',
      });
    } catch {
      /* ignore */
    }
    return { ok: false, error: 'Incorrect PIN.' };
  }

  // Confirm admin still exists
  const { data: admin, error } = await supabase
    .from('admin')
    .select('id, email')
    .ilike('email', email.trim())
    .maybeSingle();

  if (error || !admin) {
    return { ok: false, error: 'Account not found.' };
  }

  try {
    await supabase.from('log').insert({
      admin_id: admin.id,
      admin_email: admin.email,
      action: 'login_success_pin',
    });
  } catch {
    /* ignore */
  }

  return { ok: true, email: admin.email };
}

export { isValidPinFormat };
