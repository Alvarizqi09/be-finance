const Savings = require("../models/Savings");
const User = require("../models/User");
const xlsx = require("xlsx");

// ===== CREATE SAVINGS GOAL =====
exports.createSavingsGoal = async (req, res) => {
  const userId = req.user.id;

  try {
    const {
      goalName,
      targetAmount,
      icon,
      description,
      targetDate,
      category,
      autoContribute,
      autoAmount,
      frequency,
    } = req.body;

    // Validasi field required
    if (!goalName || !targetAmount) {
      return res.status(400).json({
        message: "goalName dan targetAmount harus diisi",
      });
    }

    // Setup auto-contribute jika diaktifkan
    let autoContributeConfig = {
      enabled: false,
    };

    if (autoContribute && autoAmount && frequency) {
      autoContributeConfig = {
        enabled: true,
        amount: autoAmount,
        frequency,
        nextContributionDate: calculateNextContributionDate(frequency),
      };
    }

    const newGoal = new Savings({
      userId,
      goalName,
      targetAmount,
      icon: icon || "💰",
      description,
      targetDate: targetDate || null,
      category: category || "other",
      autoContribute: autoContributeConfig,
      contributions: [],
    });

    await newGoal.save();

    res.status(201).json({
      message: "Savings goal berhasil dibuat",
      goal: newGoal,
    });
  } catch (error) {
    console.error("Error creating savings goal:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ===== GET ALL SAVINGS GOALS =====
exports.getAllSavingsGoals = async (req, res) => {
  const userId = req.user.id;

  try {
    const goals = await Savings.find({ userId }).sort({ createdAt: -1 });

    // Hitung summary
    const summary = {
      totalGoals: goals.length,
      totalTarget: goals.reduce((sum, goal) => sum + goal.targetAmount, 0),
      totalSaved: goals.reduce((sum, goal) => sum + goal.currentAmount, 0),
      completedGoals: goals.filter((g) => g.status === "completed").length,
    };

    res.status(200).json({
      goals,
      summary,
    });
  } catch (error) {
    console.error("Error fetching savings goals:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ===== GET SINGLE SAVINGS GOAL =====
exports.getSavingsGoal = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const goal = await Savings.findOne({ _id: id, userId });

    if (!goal) {
      return res.status(404).json({ message: "Savings goal tidak ditemukan" });
    }

    // Hitung progress percentage
    const progressPercentage =
      goal.targetAmount > 0
        ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
        : 0;

    res.status(200).json({
      goal,
      progressPercentage,
    });
  } catch (error) {
    console.error("Error fetching savings goal:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ===== MANUAL CONTRIBUTION =====
exports.addManualContribution = async (req, res) => {
  const userId = req.user.id;
  const { savingsId, amount, note } = req.body;

  try {
    if (!savingsId || !amount || amount <= 0) {
      return res.status(400).json({
        message: "savingsId dan amount (lebih dari 0) harus diisi",
      });
    }

    const goal = await Savings.findOne({ _id: savingsId, userId });

    if (!goal) {
      return res.status(404).json({ message: "Savings goal tidak ditemukan" });
    }

    if (goal.status === "completed") {
      return res.status(400).json({
        message: "Tidak bisa menambah kontribusi ke goal yang sudah completed",
      });
    }

    // Tambah amount ke currentAmount
    goal.currentAmount += amount;

    // Jika sudah mencapai target, update status
    if (goal.currentAmount >= goal.targetAmount) {
      goal.currentAmount = goal.targetAmount;
      goal.status = "completed";
    }

    // Catat kontribusi
    goal.contributions.push({
      amount,
      type: "manual",
      date: new Date(),
      note: note || "",
    });

    await goal.save();

    res.status(200).json({
      message: "Kontribusi manual berhasil ditambahkan",
      goal,
    });
  } catch (error) {
    console.error("Error adding manual contribution:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ===== AUTO CONTRIBUTION (Trigger dari schedule/cron) =====
exports.processAutoContributions = async () => {
  try {
    const now = new Date();

    // Cari semua goal dengan auto-contribute yang enabled
    const goals = await Savings.find({
      "autoContribute.enabled": true,
      status: { $ne: "completed" },
    });

    for (const goal of goals) {
      const { autoContribute } = goal;

      // Check apakah sudah waktunya kontribusi
      if (
        !autoContribute.nextContributionDate ||
        autoContribute.nextContributionDate <= now
      ) {
        // Tambah kontribusi otomatis
        goal.currentAmount += autoContribute.amount;

        // Jika sudah mencapai target
        if (goal.currentAmount >= goal.targetAmount) {
          goal.currentAmount = goal.targetAmount;
          goal.status = "completed";
        }

        // Update kontribusi history
        goal.contributions.push({
          amount: autoContribute.amount,
          type: "auto",
          date: new Date(),
          note: `Auto-contribution (${autoContribute.frequency})`,
        });

        // Update last dan next contribution date
        goal.autoContribute.lastContributionDate = new Date();
        goal.autoContribute.nextContributionDate =
          calculateNextContributionDate(autoContribute.frequency);

        await goal.save();

        console.log(
          `Auto-contribution processed for goal: ${goal.goalName} (${goal.userId})`
        );
      }
    }
  } catch (error) {
    console.error("Error processing auto contributions:", error);
  }
};

// ===== TOGGLE AUTO CONTRIBUTE =====
exports.toggleAutoContribute = async (req, res) => {
  const userId = req.user.id;
  const { savingsId, enabled, amount, frequency } = req.body;

  try {
    const goal = await Savings.findOne({ _id: savingsId, userId });

    if (!goal) {
      return res.status(404).json({ message: "Savings goal tidak ditemukan" });
    }

    if (enabled) {
      if (!amount || !frequency) {
        return res.status(400).json({
          message:
            "amount dan frequency harus diisi untuk enable auto-contribute",
        });
      }

      goal.autoContribute = {
        enabled: true,
        amount,
        frequency,
        nextContributionDate: calculateNextContributionDate(frequency),
      };
    } else {
      goal.autoContribute.enabled = false;
    }

    await goal.save();

    res.status(200).json({
      message: enabled
        ? "Auto-contribute diaktifkan"
        : "Auto-contribute dinonaktifkan",
      goal,
    });
  } catch (error) {
    console.error("Error toggling auto contribute:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ===== UPDATE SAVINGS GOAL =====
exports.updateSavingsGoal = async (req, res) => {
  const userId = req.user.id;
  const { savingsId } = req.params;
  const { goalName, targetAmount, icon, description, targetDate, category } =
    req.body;

  try {
    const goal = await Savings.findOne({ _id: savingsId, userId });

    if (!goal) {
      return res.status(404).json({ message: "Savings goal tidak ditemukan" });
    }

    // Update fields
    if (goalName) goal.goalName = goalName;
    if (targetAmount) goal.targetAmount = targetAmount;
    if (icon) goal.icon = icon;
    if (description) goal.description = description;
    if (targetDate) goal.targetDate = targetDate;
    if (category) goal.category = category;

    await goal.save();

    res.status(200).json({
      message: "Savings goal berhasil diupdate",
      goal,
    });
  } catch (error) {
    console.error("Error updating savings goal:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ===== DELETE SAVINGS GOAL =====
exports.deleteSavingsGoal = async (req, res) => {
  const userId = req.user.id;
  const { savingsId } = req.params;

  try {
    const goal = await Savings.findOneAndDelete({ _id: savingsId, userId });

    if (!goal) {
      return res.status(404).json({ message: "Savings goal tidak ditemukan" });
    }

    res.status(200).json({
      message: "Savings goal berhasil dihapus",
    });
  } catch (error) {
    console.error("Error deleting savings goal:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ===== GET CONTRIBUTION HISTORY =====
exports.getContributionHistory = async (req, res) => {
  const userId = req.user.id;
  const { savingsId } = req.params;

  try {
    const goal = await Savings.findOne({ _id: savingsId, userId });

    if (!goal) {
      return res.status(404).json({ message: "Savings goal tidak ditemukan" });
    }

    const history = goal.contributions.sort((a, b) => b.date - a.date);

    res.status(200).json({
      savingsId,
      goalName: goal.goalName,
      contributions: history,
      totalContributions: history.length,
    });
  } catch (error) {
    console.error("Error fetching contribution history:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ===== DOWNLOAD SAVINGS REPORT =====
exports.downloadSavingsReport = async (req, res) => {
  const userId = req.user.id;

  try {
    const goals = await Savings.find({ userId }).sort({ createdAt: -1 });

    if (goals.length === 0) {
      return res.status(400).json({
        message: "Tidak ada savings goal untuk didownload",
      });
    }

    // Format data untuk Excel
    const data = goals.map((goal) => ({
      "Goal Name": goal.goalName,
      Category: goal.category,
      "Target Amount": goal.targetAmount,
      "Current Amount": goal.currentAmount,
      Progress: `${Math.round(
        (goal.currentAmount / goal.targetAmount) * 100
      )}%`,
      Status: goal.status,
      "Auto Contribute": goal.autoContribute.enabled
        ? `Yes (Rp${goal.autoContribute.amount}/${goal.autoContribute.frequency})`
        : "No",
      "Target Date": goal.targetDate
        ? new Date(goal.targetDate).toLocaleDateString()
        : "-",
      "Created Date": new Date(goal.createdAt).toLocaleDateString(),
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);

    // Auto-size columns
    const colWidths = [
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 10 },
      { wch: 12 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
    ];
    ws["!cols"] = colWidths;

    xlsx.utils.book_append_sheet(wb, ws, "Savings Goals");

    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=savings_report.xlsx"
    );

    res.send(buffer);
  } catch (error) {
    console.error("Error downloading savings report:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ===== HELPER FUNCTION =====
function calculateNextContributionDate(frequency) {
  const now = new Date();

  switch (frequency) {
    case "daily":
      now.setDate(now.getDate() + 1);
      break;
    case "weekly":
      now.setDate(now.getDate() + 7);
      break;
    case "monthly":
      now.setMonth(now.getMonth() + 1);
      break;
    default:
      now.setMonth(now.getMonth() + 1);
  }

  return now;
}
