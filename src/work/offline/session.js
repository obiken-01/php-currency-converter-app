/**
 * The last identity the server confirmed.
 *
 * Not a credential and not a permission: the access token still decides what
 * any request is allowed to do, and the server still decides whether to honour
 * it. This only spares an offline start from rendering an app with no name in
 * the corner, or worse, flashing through a signed-out screen on the way in.
 */
const KEY = "work_last_user";

export function cachedUser() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function rememberUser(user) {
  try {
    if (user) localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    // Private mode, quota, a webview with storage disabled: the app works
    // without this, it just starts anonymous.
  }
}

export function forgetUser() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do -- the token is gone either way.
  }
}
