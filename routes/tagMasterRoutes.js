const express = require("express");
const { verifyAuth } = require("../middleware/auth");
const tagMasterController = require("../controllers/tagMasterController");

const router = express.Router();

router.get("/", tagMasterController.list);
router.get("/:id", tagMasterController.getById);
router.post("/", verifyAuth, tagMasterController.create);
router.put("/:id", verifyAuth, tagMasterController.update);
router.delete("/:id", verifyAuth, tagMasterController.remove);

module.exports = router;
