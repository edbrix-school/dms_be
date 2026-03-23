const express = require("express");
const authRepository = require("../dao/authRepository");
const { verifyAuth } = require("../middleware/auth");
const Util = require("../common/Util");

const router = express.Router();

router.get("/me", verifyAuth, async (req, res) => {
  try {
    const user = await authRepository.findUserById(req.user.user_id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    return res.status(200).json(Util.getSuccessResponse(user));
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
