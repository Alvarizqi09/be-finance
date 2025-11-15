const cron = require("node-cron");
const {
  processAutoContributions,
} = require("../controllers/savingsController");

// Jalankan auto-contributions setiap hari pada jam 00:00 (midnight)
const scheduleAutoContributions = () => {
  cron.schedule("0 0 * * *", async () => {
    console.log(
      "[CRON] Running auto-contributions at",
      new Date().toISOString()
    );
    await processAutoContributions();
  });

  console.log("[CRON] Auto-contribution scheduler initialized");
};

module.exports = { scheduleAutoContributions };
