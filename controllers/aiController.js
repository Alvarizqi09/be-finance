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

When asked about their financial data (income, expenses, balance, etc.), provide specific information from their actual data.
Keep your responses concise, friendly, and actionable. Use Indonesian Rupiah (Rp) format when mentioning amounts.`;

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
                text: `${systemPrompt}\n\n${financialContext}\n\nUser question: ${message}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
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
    const botResponse =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I apologize, but I couldn't process that request. Please try again.";

    res.json({ response: botResponse });
  } catch (error) {
    console.error("AI Chat Error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

module.exports = { chatWithAI };
