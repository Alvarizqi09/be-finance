const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const {
  addIncome,
  getAllIncomes,
  downloadIncome,
  deleteIncome,
} = require("../controllers/incomeController");

const router = express.Router();

router.post("/add", protect, addIncome);
router.get("/get", protect, getAllIncomes);
router.get("/download", protect, downloadIncome);
router.delete("/delete/:id", protect, deleteIncome);

module.exports = router;
