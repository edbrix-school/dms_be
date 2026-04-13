const express = require("express");
const { verifyAuth } = require("../middleware/auth");
const moduleNameMasterController = require("../controllers/moduleNameMasterController");

const router = express.Router();

router.get("/", moduleNameMasterController.list);
router.get("/:id", moduleNameMasterController.getById);
router.post("/", verifyAuth, moduleNameMasterController.create);
router.put("/:id", verifyAuth, moduleNameMasterController.update);
router.delete("/:id", verifyAuth, moduleNameMasterController.remove);

module.exports = router;
