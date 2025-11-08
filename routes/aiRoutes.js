const express = require("express");
const router = express.Router();
const { chatWithAI } = require("../controllers/aiController");
const auth = require("../middleware/auth"); // optional, jika ingin authenticated

const rateLimit = require("express-rate-limit");

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 20, // max 20 request per 15 menit
  message: "Too many AI requests, please try again later.",
});

router.post("/chat", aiLimiter, auth, chatWithAI);
router.post("/chat", auth, chatWithAI); // hapus auth jika ingin public

module.exports = router;
