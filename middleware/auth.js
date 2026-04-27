const jwt = require("jsonwebtoken");
require("dotenv").config();

function decodeBase64UrlSecret(secret) {
  let normalized = String(secret || "").replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) {
    normalized += "=";
  }

  return Buffer.from(normalized, "base64");
}

function normalizeUser(decoded) {
  return {
    ...decoded,
    user_id: decoded.user_id || decoded.userPoid || decoded.sub || null,
    role_id: decoded.role_id || decoded.groupPoid || null,
  };
}

function getTokenFromHeader(req) {
  const auth = req.headers.authorization;
  if (auth && (auth.startsWith("Token ") || auth.startsWith("Bearer "))) {
    return auth.split(" ")[1];
  }
  return null;
}

function verifyAuth(req, res, next) {
  try {
    const token = getTokenFromHeader(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "Authorization token missing." });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ success: false, message: "JWT secret is not configured." });
    }

    const secret = decodeBase64UrlSecret(process.env.JWT_SECRET);
    const decoded = jwt.verify(token, secret);
    req.user = normalizeUser(decoded);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
}

module.exports = {
  verifyAuth,
  getTokenFromHeader,
};
