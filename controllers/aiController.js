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

    const systemPrompt = `You are a helpful financial assistant with access to the user's financial data. You help users with:
- Budgeting advice based on their actual income and expenses
- Expense tracking tips
- Income management strategies
- Financial planning guidance based on their current balance
- Saving and investment basics

**CRITICAL FORMATTING RULES:**
1. Use **bold** for important terms, categories, and amounts by wrapping text with **
2. Use *italic* for emphasis and secondary information by wrapping text with *
3. Use bullet points with • for lists
4. NEVER repeat words or phrases consecutively
5. NEVER duplicate amounts like "Rp 233Rp 233" - use only "Rp 233"
6. NEVER duplicate headings like "Evaluasi Pengeluaran:Evaluasi Pengeluaran:" - use only once
7. Keep your responses concise, friendly, and actionable
8. Use Indonesian Rupiah (Rp) format when mentioning amounts
9. Avoid redundant information and repetition

**IMPORTANT: If you notice any duplication in your response, fix it before sending.**

Example of CORRECT formatting:
• **Evaluasi Pengeluaran:** Pengeluaran terbesarmu bulan ini adalah *Kesehatan* (**Rp 233**). Coba telaah, apakah pengeluaran ini bisa dikurangi?

Example of INCORRECT formatting (DO NOT DO THIS):
• **Evaluasi Pengeluaran:Evaluasi Pengeluaran:** Pengeluaran terbesarmu bulan ini adalah *Kesehatan* (**Rp 233Rp 233**). Coba telaah, apakah pengeluaran ini bisa dikurangi?

When asked about their financial data (income, expenses, balance, etc.), provide specific information from their actual data.`;

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
                text: `${systemPrompt}\n\n${financialContext}\n\nUser question: ${message}\n\nRemember: No duplication, be concise and clear.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.5, // Lower temperature untuk mengurangi kreativitas berlebihan
          maxOutputTokens: 800,
          topP: 0.8,
          topK: 40,
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
      "I apologize, but I couldn't process that request. Please try again.";

    // Enhanced cleaning function
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

// Enhanced cleaning function for AI responses
const cleanAIResponse = (text) => {
  if (!text) return text;

  let cleaned = text;

  // Fix duplicate phrases with colon (Evaluasi Pengeluaran:Evaluasi Pengeluaran:)
  cleaned = cleaned.replace(/([A-Za-z\s]+):\1:/g, "$1:");
  cleaned = cleaned.replace(/([A-Za-z\s]+):\s*\1:/g, "$1:");

  // Fix duplicate words (Evaluasi Evaluasi -> Evaluasi)
  cleaned = cleaned.replace(/\b(\w+)\s+\1\b/gi, "$1");

  // Fix duplicate currency amounts (Rp 233Rp 233 -> Rp 233)
  cleaned = cleaned.replace(/(Rp\s*\d+(?:\.\d{3})*(?:,\d{2})?)\s*\1/gi, "$1");

  // Fix duplicate amounts without Rp (233233 -> 233)
  cleaned = cleaned.replace(/(\b\d+\b)\s*\1/gi, "$1");

  // Fix formatting issues
  cleaned = cleaned
    .replace(/\*\*\*/g, "**") // Fix triple asterisks
    .replace(/\*\*/g, "**") // Ensure proper bold formatting
    .replace(/\*(?!\*)/g, "*") // Ensure proper italic formatting
    .replace(/\s+/g, " ") // Remove extra spaces
    .trim();

  // Additional cleanup for specific patterns
  cleaned = cleaned
    .replace(/(\w+):\s*\1\s*:/g, "$1:") // Fix pattern: "word: word :"
    .replace(/(\b\w+\b)\s*:\s*\1/g, "$1") // Fix pattern: "word : word"
    .replace(/(Rp\s*)\s+/g, "$1") // Remove extra spaces after Rp
    .replace(/(\d)\s+(\d)/g, "$1$2"); // Fix space in numbers

  return cleaned;
};

module.exports = { chatWithAI };
