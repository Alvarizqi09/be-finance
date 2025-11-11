// controllers/aiController.js - FIXED GEMINI API CONFIG
const Income = require("../models/Income");
const Expense = require("../models/Expense");

const chatWithAI = async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Fetch user's financial data
    const incomes = await Income.find({ userId }).sort({ date: -1 }).limit(10);
    const expenses = await Expense.find({ userId })
      .sort({ date: -1 })
      .limit(10);

    // Calculate totals
    const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
    const balance = totalIncome - totalExpense;

    // Get this month's data
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthIncomes = await Income.find({
      userId,
      date: { $gte: startOfMonth },
    });
    const thisMonthExpenses = await Expense.find({
      userId,
      date: { $gte: startOfMonth },
    });

    const monthlyIncomeTotal = thisMonthIncomes.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    const monthlyExpenseTotal = thisMonthExpenses.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    // Simple and reliable formatCurrency function
    const formatCurrency = (amount) => {
      const num = Number(amount) || 0;
      const formatted = num.toLocaleString("id-ID");
      return `Rp ${formatted}`;
    };

    const financialContext = `
User's Financial Data:
- Total Balance: ${formatCurrency(balance)}
- Total Income: ${formatCurrency(totalIncome)}
- Total Expense: ${formatCurrency(totalExpense)}
- This Month's Income: ${formatCurrency(monthlyIncomeTotal)}
- This Month's Expense: ${formatCurrency(monthlyExpenseTotal)}

Recent Income (latest 10):
${incomes
  .map(
    (inc) =>
      `- ${inc.source}: ${formatCurrency(inc.amount)} (${new Date(
        inc.date
      ).toLocaleDateString("id-ID")})`
  )
  .join("\n")}

Recent Expenses (latest 10):
${expenses
  .map(
    (exp) =>
      `- ${exp.source}: ${formatCurrency(exp.amount)} (${new Date(
        exp.date
      ).toLocaleDateString("id-ID")})`
  )
  .join("\n")}

This Month's Expenses:
${thisMonthExpenses
  .map(
    (exp) =>
      `- ${exp.source}: ${formatCurrency(exp.amount)} (${new Date(
        exp.date
      ).toLocaleDateString("id-ID")})`
  )
  .join("\n")}
`;

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const MODEL_NAME = "gemini-2.0-flash";
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    const systemPrompt = `Kamu adalah asisten keuangan yang sangat kreatif, inspiratif, dan ramah. Tugasmu:
- Berikan tips keuangan yang tidak hanya praktis, tapi juga memotivasi dan membangkitkan semangat pengguna untuk mengelola keuangan lebih baik.
- Sertakan insight unik, analogi, atau contoh sederhana yang relevan dengan data keuangan user.
- Jawaban harus tetap actionable, mudah dipahami, dan bisa langsung diterapkan.
- Gunakan format berikut:
  1. **Bold** untuk kategori/judul penting
  2. Bullet point (•) untuk setiap tips
  3. Format: • **Kategori:** penjelasan lengkap
  4. Gunakan format Rupiah PERSIS dari data (contoh: Rp 20.000, Rp 233)
  5. Berikan 5-8 tips, dan tambahkan 1 kalimat motivasi di akhir jawaban.
  6. Hindari jawaban monoton, gunakan variasi gaya bahasa yang tetap profesional dan positif.

PERHATIAN: Gunakan angka Rupiah PERSIS dari data yang diberikan. Jangan ubah format atau hilangkan digit! Jangan gunakan italic atau underscore.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);

    const response = await fetch(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${systemPrompt}\n\nDATA KEUANGAN:\n${financialContext}\n\nPERTANYAAN: ${message}\n\nREMINDER: Salin angka Rupiah PERSIS dari data keuangan yang diberikan! Gunakan format dengan **bold** untuk kategori dan pisahkan setiap bullet point dengan line break!`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 2.0,
          maxOutputTokens: 1000,
          topP: 0.95,
          topK: 64,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json();
      return res.status(response.status).json({
        error: "Gemini API Error",
        details: errorData,
      });
    }

    const data = await response.json();
    let botResponse =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Maaf, saya tidak bisa memproses permintaan tersebut. Silakan coba lagi.";

    // Clean response with SAFE cleaning that preserves currency
    botResponse = cleanAIResponse(botResponse);

    res.json({ response: botResponse });
  } catch (error) {
    console.error("AI Chat Error:", error);

    if (error.name === "AbortError") {
      return res.status(504).json({
        error: "Request timeout",
        message: "AI service took too long to respond. Please try again.",
      });
    }

    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process your request. Please try again later.",
    });
  }
};

// FIXED: Safe cleaning function that PRESERVES currency formatting
const cleanAIResponse = (text) => {
  if (!text) return text;

  let cleaned = text;

  // Step 1: Remove italic markers (single asterisks) but keep bold (**)
  // This regex carefully avoids touching ** while removing single *
  cleaned = cleaned.replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, "$1");

  // Step 2: Clean up duplicate phrases with colons (but avoid touching numbers)
  // Only match word characters, not numbers
  cleaned = cleaned.replace(/([A-Za-z\u00C0-\u024F\s]+):\s*\1:/gi, "$1:");

  // Step 3: Remove duplicate consecutive WORDS (not numbers!)
  // Use word boundary to avoid touching currency amounts
  cleaned = cleaned.replace(/\b([A-Za-z\u00C0-\u024F]+)\s+\1\b/gi, "$1");

  // Step 4: Fix line breaks for bullet points
  cleaned = cleaned.replace(/([•\-])\s*/g, "\n$1 ");

  // Step 5: Remove excessive line breaks (max 2)
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Step 6: Clean up extra spaces (but not in currency)
  cleaned = cleaned.replace(/ {2,}/g, " ");

  // Step 7: Final formatting cleanup
  cleaned = cleaned
    .replace(/\*\*\*/g, "**") // Fix triple asterisks
    .replace(/\(\s+/g, "(") // Fix spacing in parentheses
    .replace(/\s+\)/g, ")")
    .trim();

  return cleaned;
};

module.exports = { chatWithAI };
