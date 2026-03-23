const express = require("express");
const jwt = require("jsonwebtoken");
const authService = require("../services/authService");
const Util = require("../common/Util");

const router = express.Router();

router.post("/login", async (req, res) => {
  const errors = Util.validate_prams(
    req.body,
    { email: "EMAIL", password: "ANY" },
    { email: "Email", password: "Password" }
  );
  if (Object.keys(errors).length > 0) {
    return res.status(422).json(Util.getErrorResponse(errors));
  }
  try {
    const user = await authService.login(req.body.email, req.body.password);
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }
    if (user.blocked) {
      return res.status(403).json({ success: false, message: "User account is blocked." });
    }
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role_id: user.role_id },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    return res.status(200).json(Util.getSuccessResponse({ user, token }, "Login successful."));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
