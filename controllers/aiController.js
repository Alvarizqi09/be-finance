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

    const systemPrompt = `Kamu adalah asisten keuangan yang ramah, natural, dan adaptif bernama "StackBot". 

PRINSIP DASAR:
- Sesuaikan gaya jawaban dengan konteks pertanyaan user
- Untuk sapaan/pertanyaan umum: jawab santai dan natural seperti chatting biasa
- Untuk pertanyaan spesifik keuangan: berikan analisis dan tips yang relevan
- Jangan memaksakan format bullet points jika tidak diperlukan

PANDUAN RESPONS:
1. Pertanyaan sederhana (hai, halo, tolong bantu) → Jawab hangat, perkenalkan diri, tanyakan apa yang bisa dibantu
2. Pertanyaan spesifik (analisis, tips, saran) → Berikan jawaban detil dengan format yang rapi:
   - Gunakan **bold** untuk highlight poin penting
   - Gunakan bullet point (•) untuk list tips (jika ada beberapa poin)
   - Format: • **Kategori:** penjelasan
3. Data keuangan: Gunakan format Rupiah PERSIS dari data (contoh: Rp 20.000, Rp 233)
4. Tone: Profesional tapi tetap friendly, motivatif tanpa berlebihan

PENTING: Jangan gunakan italic atau underscore. Baca pertanyaan dengan seksama dan jawab sesuai kebutuhan! sesuaikan juga dengan Mood User`;

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
                text: `${systemPrompt}\n\nDATA KEUANGAN USER:\n${financialContext}\n\nPERTANYAAN USER: ${message}\n\nCATATAN: Jawab sesuai dengan konteks pertanyaan. Jika user hanya menyapa atau bertanya umum, jawab santai tanpa perlu detail analisis. Jika user minta analisis/tips spesifik, baru berikan detail lengkap.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 1,
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

      // Handle specific error codes with user-friendly messages
      if (response.status === 429) {
        return res.status(429).json({
          error: "Quota Limit Exceeded",
          message:
            "Maaf, batas penggunaan AI sudah tercapai. Silakan coba lagi dalam beberapa menit atau hubungi admin untuk upgrade quota.",
          retryAfter: response.headers.get("Retry-After") || 60,
        });
      }

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

    // Fallback response when API fails
    const fallbackResponse = `Maaf, sistem AI sedang sibuk saat ini. 

Namun, saya bisa memberitahu kamu kondisi keuangan saat ini:
- Total Balance: ${formatCurrency(balance)}
- Total Pemasukan: ${formatCurrency(totalIncome)}
- Total Pengeluaran: ${formatCurrency(totalExpense)}

Silakan coba lagi dalam beberapa saat, atau ketik pertanyaan spesifik tentang keuangan kamu!`;

    res.status(200).json({
      response: fallbackResponse,
      isLimited: true,
    });
  }
};

// IMPROVED: Cleaning function that preserves formatting and line breaks
const cleanAIResponse = (text) => {
  if (!text) return text;

  let cleaned = text;

  // Step 1: Remove italic markers (single asterisks) but keep bold (**)
  // This regex carefully avoids touching ** while removing single *
  cleaned = cleaned.replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, "$1");

  // Step 2: Fix triple or more asterisks to double
  cleaned = cleaned.replace(/\*{3,}/g, "**");

  // Step 3: Clean up duplicate phrases with colons (but avoid touching numbers)
  cleaned = cleaned.replace(/([A-Za-z\u00C0-\u024F\s]+):\s*\1:/gi, "$1:");

  // Step 4: Remove duplicate consecutive WORDS (not numbers!)
  cleaned = cleaned.replace(/\b([A-Za-z\u00C0-\u024F]+)\s+\1\b/gi, "$1");

  // Step 5: Preserve intentional line breaks but remove excessive ones
  // Keep double line breaks, reduce triple+ to double
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  // Step 6: Clean up extra spaces (but preserve single spaces and line structure)
  cleaned = cleaned.replace(/ {2,}/g, " ");

  // Step 7: Fix spacing in parentheses
  cleaned = cleaned.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");

  // Step 8: Ensure proper spacing after bullet points
  cleaned = cleaned.replace(/([•\*\-])\s*/g, "$1 ");

  // Step 9: Trim each line individually to remove trailing spaces
  cleaned = cleaned
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  return cleaned.trim();
};

module.exports = { chatWithAI };
