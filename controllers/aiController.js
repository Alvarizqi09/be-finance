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

    const systemPrompt = `ANDA ADALAH ASISTEN KEUANGAN YANG SANGAT KETAT. IKUTI ATURAN INI DENGAN TEPAT:

**ATURAN MUTLAK (JANGAN PERNAH LANGGAR):**
1. JANGAN PERNAH mengulang kata, frasa, atau angka secara berurutan
2. JANGAN PERNAH menulis "Rp 233Rp 233" - tulis HANYA "Rp 233"
3. JANGAN PERNAH menulis "Evaluasi Pengeluaran:Evaluasi Pengeluaran:" - tulis HANYA "Evaluasi Pengeluaran:"
4. JANGAN PERNAH menduplikasi konten apa pun
5. Gunakan format yang konsisten dengan bullet points (•)

**FORMATTING:**
- Gunakan **tebal** untuk istilah penting dan kategori
- Gunakan *miring* untuk penekanan 
- Gunakan • untuk list
- Format Rupiah: Rp [angka]

**CONTOH FORMAT YANG BENAR:**
• **Evaluasi Pengeluaran:** Pengeluaran terbesarmu bulan ini adalah *Kesehatan* (**Rp 233**). Coba evaluasi apakah bisa dikurangi.

**CONTOH FORMAT YANG SALAH (JANGAN LAKUKAN INI):**
• Evaluasi Pengeluaran:Evaluasi Pengeluaran: Pengeluaran terbesarmu bulan ini adalah Kesehatan (Rp 233Rp 233).

Berdasarkan data keuangan user, berikan tips yang spesifik, jelas, dan bebas duplikasi.`;

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
                text: `ATURAN: ${systemPrompt}\n\nDATA KEUANGAN USER:\n${financialContext}\n\nPERTANYAAN USER: ${message}\n\nINGAT: TIDAK ADA DUPLIKASI, JELAS, DAN SPESIFIK.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3, // Sangat rendah untuk mengurangi kreativitas
          maxOutputTokens: 600,
          topP: 0.7,
          topK: 30,
        },
      }),
    });

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

    // Enhanced cleaning with multiple passes
    botResponse = aggressiveCleanAIResponse(botResponse);

    res.json({ response: botResponse });
  } catch (error) {
    console.error("AI Chat Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

// Ultra-aggressive cleaning function
const aggressiveCleanAIResponse = (text) => {
  if (!text) return text;

  let cleaned = text;

  // Multiple cleaning passes
  for (let i = 0; i < 3; i++) {
    // Fix duplicate phrases with colon (the main problem)
    cleaned = cleaned.replace(/([A-Za-z\u00C0-\u024F\s]+):\s*\1:/g, "$1:");
    cleaned = cleaned.replace(/([A-Za-z\u00C0-\u024F\s]+):\1/g, "$1:");

    // Fix duplicate words (any language)
    cleaned = cleaned.replace(/([\w\u00C0-\u024F]+)\s+\1/gi, "$1");

    // Fix duplicate currency amounts (Rp 233Rp 233 -> Rp 233)
    cleaned = cleaned.replace(/(Rp\s*[\d.,]+)\s*\1/gi, "$1");

    // Fix duplicate numbers (233233 -> 233)
    cleaned = cleaned.replace(/(\b[\d,]+\b)\s*\1/gi, "$1");

    // Fix specific patterns from your example
    cleaned = cleaned.replace(
      /Evaluasi Pengeluaran:\s*Evaluasi Pengeluaran:/g,
      "Evaluasi Pengeluaran:"
    );
    cleaned = cleaned.replace(
      /Tingkatkan Pendapatan:\s*Tingkatkan Pendapatan:/g,
      "Tingkatkan Pendapatan:"
    );
    cleaned = cleaned.replace(
      /Prioritaskan Pembayaran:\s*Prioritaskan Pembayaran:/g,
      "Prioritaskan Pembayaran:"
    );
    cleaned = cleaned.replace(
      /Buat Anggaran:\s*Buat Anggaran:/g,
      "Buat Anggaran:"
    );
    cleaned = cleaned.replace(
      /Lacak Pengeluaran:\s*Lacak Pengeluaran:/g,
      "Lacak Pengeluaran:"
    );
    cleaned = cleaned.replace(
      /Dana Darurat:\s*Dana Darurat:/g,
      "Dana Darurat:"
    );
    cleaned = cleaned.replace(/Investasi:\s*Investasi:/g, "Investasi:");

    // Fix Rp duplication
    cleaned = cleaned.replace(/Rp\s*89Rp\s*89/g, "Rp 89");
    cleaned = cleaned.replace(/Rp\s*233Rp\s*233/g, "Rp 233");
    cleaned = cleaned.replace(/Rp\s*144Rp\s*144/g, "Rp 144");

    // Remove extra spaces and trim
    cleaned = cleaned.replace(/\s+/g, " ").trim();
  }

  // Final formatting cleanup
  cleaned = cleaned
    .replace(/\*\*\*/g, "**")
    .replace(/\*\*/g, "**")
    .replace(/\*(?!\*)/g, "*")
    .replace(/(\d)\s+(\d)/g, "$1$2")
    .replace(/\(\s*/g, "(")
    .replace(/\s*\)/g, ")");

  return cleaned;
};

module.exports = { chatWithAI };
