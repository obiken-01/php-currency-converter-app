/**
 * The app moved from its Netlify address to tools.ralphalcaide.com.
 *
 * Browsers treat those as two different apps, so nothing stored on the old
 * one -- IndexedDB, localStorage, the login -- is visible on the new one.
 * The redirect therefore has to happen in the app rather than as a Netlify
 * rule: a server-side 301 would also redirect sw.js, the installed app would
 * never receive this build, and any time logs still waiting in the outbox
 * would be stranded on the old address.
 *
 * The login is deliberately not carried across. Tokens in a URL end up in
 * browser history; signing in once on the new address is cheaper than that.
 */

export const NEW_ORIGIN = "https://tools.ralphalcaide.com";

// Exact match, so deploy previews (`deploy-preview-N--…`) stay usable.
const RETIRED_HOSTS = ["zippy-mousse-7dfbd1.netlify.app"];

export const SHOPPING_STORAGE_KEY = "ralphy-shopping-list";

// Fragment, not query string: a fragment is never sent to the server.
export const CARRY_PREFIX = "#carry-shopping=";

export const isRetiredHost = (hostname) => RETIRED_HOSTS.includes(hostname);

const isItemList = (value) =>
  Array.isArray(value) &&
  value.every((item) => item !== null && typeof item === "object" && !Array.isArray(item));

const hasItems = (json) => {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) && value.length > 0;
  } catch {
    return false;
  }
};

/** Where to send someone on the old address: same page, on the new origin. */
export function buildMoveUrl({ pathname, search }, shoppingJson) {
  const carry = shoppingJson && hasItems(shoppingJson)
    ? `${CARRY_PREFIX}${encodeURIComponent(shoppingJson)}`
    : "";
  return `${NEW_ORIGIN}${pathname}${search}${carry}`;
}

/**
 * The list to store on the new address, or null to leave things alone.
 * Only imports into an empty list: anything already there was made on the new
 * address and is newer than what the old one is handing over.
 */
export function takeCarriedShoppingList(hash, existingJson) {
  if (!hash.startsWith(CARRY_PREFIX)) return null;
  if (existingJson && hasItems(existingJson)) return null;

  try {
    const json = decodeURIComponent(hash.slice(CARRY_PREFIX.length));
    return isItemList(JSON.parse(json)) ? json : null;
  } catch {
    return null;
  }
}

/** On the new address: import a carried list and strip it from the URL. */
export function receiveCarriedShoppingList() {
  if (!window.location.hash.startsWith(CARRY_PREFIX)) return;

  try {
    const json = takeCarriedShoppingList(
      window.location.hash,
      localStorage.getItem(SHOPPING_STORAGE_KEY)
    );
    if (json) localStorage.setItem(SHOPPING_STORAGE_KEY, json);
  } catch {
    // Storage blocked: the list stays on the old address, nothing breaks here.
  }

  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", `${pathname}${search}`);
}

/** On the old address: go, taking the shopping list along. */
export function moveToNewDomain() {
  let shoppingJson = null;
  try {
    shoppingJson = localStorage.getItem(SHOPPING_STORAGE_KEY);
  } catch {
    // Storage blocked: move without the list rather than not at all.
  }
  window.location.replace(buildMoveUrl(window.location, shoppingJson));
}
