import { getSupabaseClient } from './supabaseClient';

// Local UI cache of the verified admin profile. The source of truth is always
// the Supabase Auth session + admin_whitelist check (see verifyAdminSession).
export const ADMIN_SESSION_KEY = 'csu_rotc_auth_session';

export const PENDING_APPROVAL_MESSAGE = 'Account pending administrator approval.';

export class AdminAuthError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AdminAuthError';
    this.code = code;
  }
}

/**
 * Calls the get_admin_profile() RPC, which resolves the caller's identity
 * server-side via auth.uid(). Returns the whitelist row (active or pending),
 * or null if the signed-in user has no whitelist entry at all.
 */
async function fetchAdminProfile(client) {
  const { data, error } = await client.rpc('get_admin_profile');
  if (error) {
    throw new AdminAuthError(
      'WHITELIST_CHECK_FAILED',
      'Unable to verify admin authorization. Please try again.'
    );
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row && row.email ? row : null;
}

function buildAdminUser(authUser, profile) {
  return {
    id: authUser.id,
    email: authUser.email,
    name: profile.full_name || authUser.user_metadata?.full_name || 'ROTC Command Officer',
    title: profile.title || null,
    role: profile.role,
    authProvider: 'SUPABASE'
  };
}

async function forceSignOut(client) {
  try {
    await client.auth.signOut({ scope: 'local' });
  } catch (_) { }
}

/**
 * Strict admin sign-in:
 *   1. supabase.auth.signInWithPassword()
 *   2. Whitelist / role check via get_admin_profile()
 *   3. On any failure after step 1, the Supabase session is destroyed.
 */
export async function signInAdmin(email, password) {
  const client = getSupabaseClient();
  if (!client) {
    throw new AdminAuthError(
      'NOT_CONFIGURED',
      'Authentication service is not configured. Contact the system administrator.'
    );
  }

  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password
  });

  if (error || !data?.user) {
    if (/email not confirmed/i.test(error?.message || '')) {
      throw new AdminAuthError(
        'EMAIL_NOT_CONFIRMED',
        'Please confirm your email address using the link we sent you, then sign in.'
      );
    }
    throw new AdminAuthError('INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  let profile;
  try {
    profile = await fetchAdminProfile(client);
  } catch (err) {
    await forceSignOut(client);
    throw err;
  }

  if (!profile) {
    await forceSignOut(client);
    throw new AdminAuthError(
      'NOT_AUTHORIZED',
      'Access denied. This account is not authorized for the Command Center.'
    );
  }

  // Strict check: only an explicit TRUE grants entry.
  if (profile.is_active !== true) {
    await forceSignOut(client);
    throw new AdminAuthError('PENDING_APPROVAL', PENDING_APPROVAL_MESSAGE);
  }

  return buildAdminUser(data.user, profile);
}

/**
 * Registers a new Supabase Auth user and files an admin access request.
 * The pending admin_whitelist row (is_active = false) is created server-side
 * by the on_auth_user_admin_access_request trigger, keyed on the
 * `admin_access_request` metadata flag.
 *
 * Returns { needsEmailConfirmation: boolean }.
 */
export async function requestAdminAccess({ email, password, fullName, title }) {
  const client = getSupabaseClient();
  if (!client) {
    throw new AdminAuthError(
      'NOT_CONFIGURED',
      'Authentication service is not configured. Contact the system administrator.'
    );
  }

  const { data, error } = await client.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: `${window.location.origin}${window.location.pathname}#login`,
      data: {
        admin_access_request: true,
        full_name: fullName.trim(),
        title: (title || '').trim()
      }
    }
  });

  if (error) {
    if (/already registered|already exists/i.test(error.message || '')) {
      throw new AdminAuthError('ALREADY_REGISTERED', 'An account with this email already exists. Please sign in instead.');
    }
    if (/password/i.test(error.message || '')) {
      throw new AdminAuthError('WEAK_PASSWORD', error.message);
    }
    throw new AdminAuthError('SIGNUP_FAILED', error.message || 'Unable to submit your request. Please try again.');
  }

  // With email confirmation on, Supabase returns an obfuscated user with no
  // identities when the email is already taken (to prevent enumeration).
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new AdminAuthError('ALREADY_REGISTERED', 'An account with this email already exists. Please sign in instead.');
  }

  // If auto-confirm is on, signUp returns a live session — drop it so a
  // pending requester is never left signed in.
  const needsEmailConfirmation = !data?.session;
  if (data?.session) await forceSignOut(client);

  return { needsEmailConfirmation };
}

/**
 * Re-validates the persisted Supabase session against the auth server and
 * the admin whitelist.
 *
 * Returns:
 *   { status: 'valid', user }  – session is live and user is an active admin
 *   { status: 'invalid' }      – no session, token rejected, or not whitelisted
 *   { status: 'error' }        – transient network failure; could not verify
 */
export async function verifyAdminSession() {
  const client = getSupabaseClient();
  if (!client) return { status: 'invalid' };

  try {
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData?.session) return { status: 'invalid' };

    // getUser() hits the auth server, so revoked/deleted users are caught.
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) {
      const isNetwork = userError && /fetch|network/i.test(userError.message || '');
      if (isNetwork) return { status: 'error' };
      await forceSignOut(client);
      return { status: 'invalid' };
    }

    const profile = await fetchAdminProfile(client);
    if (!profile || profile.is_active !== true) {
      await forceSignOut(client);
      return { status: 'invalid' };
    }

    return { status: 'valid', user: buildAdminUser(userData.user, profile) };
  } catch (err) {
    if (err instanceof AdminAuthError && err.code === 'WHITELIST_CHECK_FAILED') {
      return { status: 'error' };
    }
    console.warn('Admin session verification failed:', err);
    return { status: 'error' };
  }
}

export async function signOutAdmin() {
  const client = getSupabaseClient();
  if (client) await forceSignOut(client);
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

/** Reads the cached admin profile; rejects expired or non-Supabase sessions. */
export function readCachedAdminSession() {
  try {
    const saved = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    const user = parsed?.user;
    const expired = parsed?.expiresAt && new Date(parsed.expiresAt) <= new Date();
    // Legacy hardcoded-credential sessions (authProvider: 'LOCAL_SECURE') are purged.
    if (!user || expired || user.authProvider !== 'SUPABASE') {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      return null;
    }
    return user;
  } catch (_) {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    return null;
  }
}

export function writeCachedAdminSession(user, rememberMe) {
  const ttl = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
    user,
    loggedInAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttl).toISOString()
  }));
}
