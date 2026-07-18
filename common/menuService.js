const axios = require("axios");
require("dotenv").config();

// Base URL of the auth service that exposes the Menu API the frontend uses.
const AUTH_API_URL = process.env.AUTH_API_URL || "http://10.100.200.123:8080";
const MENU_ENDPOINT = "/api/v1/auth/menu";
const MENU_TIMEOUT_MS = Number(process.env.AUTH_API_TIMEOUT_MS) || 15000;

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

  return collectMenuIds(menus);
}

module.exports = {
  getAccessibleMenuIds,
  collectMenuIds,
};
