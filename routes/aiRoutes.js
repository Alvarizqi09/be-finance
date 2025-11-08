const express = require("express");
const router = express.Router();
const { chatWithAI } = require("../controllers/aiController");
const { protect } = require("../middleware/authMiddleware");
const rateLimit = require("express-rate-limit");

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 20, // max 20 request per 15 menit
  message: "Too many AI requests, please try again later.",
});

router.post("/chat", protect, aiLimiter, chatWithAI);

module.exports = router;
