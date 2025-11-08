// controllers/aiController.js
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

    // Prepare financial context for AI
    const financialContext = `
User's Financial Data:
- Total Balance: Rp ${balance.toLocaleString("id-ID")}
- Total Income: Rp ${totalIncome.toLocaleString("id-ID")}
- Total Expense: Rp ${totalExpense.toLocaleString("id-ID")}
- This Month's Income: Rp ${monthlyIncomeTotal.toLocaleString("id-ID")}
- This Month's Expense: Rp ${monthlyExpenseTotal.toLocaleString("id-ID")}

Recent Income (latest 10):
${incomes
  .map(
    (inc) =>
      `- ${inc.source}: Rp ${inc.amount.toLocaleString("id-ID")} (${new Date(
        inc.date
      ).toLocaleDateString("id-ID")})`
  )
  .join("\n")}

Recent Expenses (latest 10):
${expenses
  .map(
    (exp) =>
      `- ${exp.source}: Rp ${exp.amount.toLocaleString("id-ID")} (${new Date(
        exp.date
      ).toLocaleDateString("id-ID")})`
  )
  .join("\n")}

This Month's Expenses:
${thisMonthExpenses
  .map(
    (exp) =>
      `- ${exp.source}: Rp ${exp.amount.toLocaleString("id-ID")} (${new Date(
        exp.date
      ).toLocaleDateString("id-ID")})`
  )
  .join("\n")}
`;

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const MODEL_NAME = "gemini-2.0-flash";
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    const systemPrompt = `Kamu adalah asisten keuangan yang membantu. Berikan tips yang jelas dan praktis.

ATURAN PENTING:
1. Gunakan format markdown yang bersih - HANYA gunakan **bold** untuk penekanan penting (kategori/judul)
2. JANGAN gunakan italic (*text*) - hanya bold saja
3. Gunakan bullet points (•) untuk list
4. Format Rupiah: Rp [angka]
5. Berikan saran yang spesifik berdasarkan data user
6. Hindari pengulangan kata atau frasa
7. Setiap bullet point adalah 1 paragraf lengkap dengan penjelasan detail

CONTOH FORMAT YANG BENAR:
• **Evaluasi Pengeluaran:** Pengeluaran kesehatan sebesar Rp 233.000 cukup tinggi. Pertimbangkan alternatif yang lebih terjangkau seperti fasilitas kesehatan yang ditanggung asuransi atau obat generik.
• **Tingkatkan Pendapatan:** Pendapatan Rp 89.000 lebih kecil dari pengeluaran. Cari peluang freelance tambahan atau kembangkan skill baru untuk meningkatkan penghasilan.

Berikan tips yang actionable, mudah dipahami, dan dalam format bullet points dengan penjelasan lengkap.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 second timeout

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
                text: `${systemPrompt}\n\nDATA KEUANGAN:\n${financialContext}\n\nPERTANYAAN: ${message}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1000,
          topP: 0.8,
          topK: 40,
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

    // Clean response
    botResponse = cleanAIResponse(botResponse);

    res.json({ response: botResponse });
  } catch (error) {
    console.error("AI Chat Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

// Improved cleaning function
const cleanAIResponse = (text) => {
  if (!text) return text;

  let cleaned = text;

  // Apply cleaning passes
  for (let i = 0; i < 3; i++) {
    // Remove duplicate phrases with colon (e.g., "Evaluasi:Evaluasi:")
    cleaned = cleaned.replace(/([A-Za-z\u00C0-\u024F\s]+):\s*\1:/gi, "$1:");

    // Remove duplicate Rupiah amounts (e.g., "Rp 233Rp 233" -> "Rp 233")
    cleaned = cleaned.replace(/(Rp\s*[\d.,]+)\s*Rp\s*[\d.,]+/gi, "$1");

    // Remove duplicate consecutive words
    cleaned = cleaned.replace(/\b(\w+)\s+\1\b/gi, "$1");

    // Remove duplicate numbers
    cleaned = cleaned.replace(/(\d+)\s*\1\b/g, "$1");

    // Clean up extra spaces
    cleaned = cleaned.replace(/\s+/g, " ");
  }

  // Remove italic markers since we're not using them
  cleaned = cleaned.replace(/\*([^*]+)\*/g, "$1");

  // Final formatting cleanup
  cleaned = cleaned
    .replace(/\*\*\*/g, "**") // Fix triple asterisks
    .replace(/\(\s+/g, "(") // Fix spacing in parentheses
    .replace(/\s+\)/g, ")")
    .trim();

  return cleaned;
};

module.exports = { chatWithAI };
