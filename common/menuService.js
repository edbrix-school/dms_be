const axios = require("axios");
require("dotenv").config();

// Base URL of the auth service that exposes the Menu API the frontend uses.
const AUTH_API_URL = process.env.AUTH_API_URL || "http://10.100.200.123:8080";
const MENU_ENDPOINT = "/api/v1/auth/menu";
const MENU_TIMEOUT_MS = Number(process.env.AUTH_API_TIMEOUT_MS) || 15000;

// A single page load hits several permission-aware endpoints (list, summary,
// distribution, recent files). Cache the resolved menuIds briefly so we make
// one Menu API call per user instead of one per endpoint. Set to 0 to disable.
const MENU_CACHE_TTL_MS =
  process.env.AUTH_MENU_CACHE_TTL_MS != null
    ? Number(process.env.AUTH_MENU_CACHE_TTL_MS)
    : 60000;

const menuCache = new Map();

function cacheKeyFor(userPoid, companyPoid) {
  return `${String(userPoid)}::${companyPoid == null ? "" : String(companyPoid)}`;
}

function readCache(key) {
  const hit = menuCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    menuCache.delete(key);
    return null;
  }
  return hit.ids;
}

function writeCache(key, ids) {
  if (MENU_CACHE_TTL_MS <= 0) return;
  // Drop expired entries so the map cannot grow without bound.
  const now = Date.now();
  for (const [k, v] of menuCache) {
    if (v.expiresAt <= now) menuCache.delete(k);
  }
  menuCache.set(key, { ids, expiresAt: now + MENU_CACHE_TTL_MS });
}

/**
 * Recursively collect every menuId from the menu tree returned by the Menu API.
 * Mirrors the frontend's getAllMenuIds() so backend/frontend authorization agree.
 * @param {Array} menus
 * @param {Set<string>} acc
 * @returns {Set<string>}
 */
function collectMenuIds(menus, acc = new Set()) {
  if (!Array.isArray(menus)) return acc;
  for (const item of menus) {
    if (!item) continue;
    if (item.menuId != null && String(item.menuId).trim() !== "") {
      acc.add(String(item.menuId).trim());
    }
    if (Array.isArray(item.children) && item.children.length > 0) {
      collectMenuIds(item.children, acc);
    }
  }
  return acc;
}

/**
 * Call the same Menu API the frontend uses and return the set of menuIds the
 * given user has access to. Throws on any failure so the caller can decide how
 * to react (the document list fails closed on error).
 *
 * @param {object} params
 * @param {string|number} params.userPoid - ERP user POID (menu is scoped per user)
 * @param {string} params.token - Bearer token forwarded from the incoming request
 * @param {string|number} [params.companyPoid] - Optional company scope (X-Company-Poid)
 * @returns {Promise<Set<string>>} accessible menuIds
 */
async function getAccessibleMenuIds({ userPoid, token, companyPoid } = {}) {
  if (userPoid == null || String(userPoid).trim() === "") {
    throw new Error("userPoid is required to resolve menu permissions.");
  }
  if (!token) {
    throw new Error("Authorization token is required to resolve menu permissions.");
  }

  const key = cacheKeyFor(userPoid, companyPoid);
  const cached = readCache(key);
  if (cached) return cached;

  const headers = { Authorization: `Bearer ${token}` };
  if (companyPoid != null && String(companyPoid).trim() !== "") {
    headers["X-Company-Poid"] = String(companyPoid);
  }

  const response = await axios.get(`${AUTH_API_URL}${MENU_ENDPOINT}`, {
    params: { userPoid },
    headers,
    timeout: MENU_TIMEOUT_MS,
  });

  const body = response.data || {};
  // The auth service wraps its payload as { result: { data: { menus, permissions } } }.
  const menus =
    body?.result?.data?.menus ||
    body?.data?.menus ||
    body?.menus ||
    [];

  const ids = collectMenuIds(menus);
  writeCache(key, ids);
  return ids;
}

module.exports = {
  getAccessibleMenuIds,
  collectMenuIds,
};