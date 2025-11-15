const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
  createSavingsGoal,
  getAllSavingsGoals,
  getSavingsGoal,
  addManualContribution,
  toggleAutoContribute,
  updateSavingsGoal,
  deleteSavingsGoal,
  getContributionHistory,
  downloadSavingsReport,
} = require("../controllers/savingsController");

const router = express.Router();

// Create
router.post("/create", protect, createSavingsGoal);

// Get all goals
router.get("/get-all", protect, getAllSavingsGoals);

// Get single goal
router.get("/get/:id", protect, getSavingsGoal);

// Manual contribution
router.post("/contribute-manual", protect, addManualContribution);

// Toggle auto contribute
router.put("/toggle-auto", protect, toggleAutoContribute);

// Update goal
router.put("/update/:savingsId", protect, updateSavingsGoal);

// Delete goal
router.delete("/delete/:savingsId", protect, deleteSavingsGoal);

// Get contribution history
router.get("/history/:savingsId", protect, getContributionHistory);

// Download report
router.get("/download-report", protect, downloadSavingsReport);

module.exports = router;
