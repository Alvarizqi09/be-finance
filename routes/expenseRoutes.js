const express = require("express");

const { protect } = require("../middleware/authMiddleware");
const {
  addExpense,
  getAllExpenses,
  downloadExpense,
  deleteExpense,
} = require("../controllers/expenseController");

const router = express.Router();

router.post("/add", protect, addExpense);
router.get("/get", protect, getAllExpenses);
router.get("/download", protect, downloadExpense);
router.delete("/delete/:id", protect, deleteExpense);

module.exports = router;
