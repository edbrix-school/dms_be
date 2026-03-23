const jwt = require("jsonwebtoken");
require("dotenv").config();

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
}

module.exports = {
  verifyAuth,
  getTokenFromHeader,
};
