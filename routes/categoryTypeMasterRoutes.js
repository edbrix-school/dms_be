const express = require("express");
const { verifyAuth } = require("../middleware/auth");
const categoryTypeMasterController = require("../controllers/categoryTypeMasterController");

const router = express.Router();

router.get("/", categoryTypeMasterController.list);
router.get("/:id", categoryTypeMasterController.getById);
router.post("/", verifyAuth, categoryTypeMasterController.create);
router.put("/:id", verifyAuth, categoryTypeMasterController.update);
router.delete("/:id", verifyAuth, categoryTypeMasterController.remove);

module.exports = router;
