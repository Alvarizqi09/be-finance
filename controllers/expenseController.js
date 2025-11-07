const Expense = require("../models/Expense");
const xlsx = require("xlsx");

exports.addExpense = async (req, res) => {
  const userId = req.user.id;

  try {
    const { icon, source, amount, date } = req.body;
    if (!source || !amount || !date) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields" });
    }

    const newExpense = new Expense({
      userId,
      icon,
      source,
      amount,
      date,
    });
    await newExpense.save();
    res.status(201).json({ message: "Expense added successfully", newExpense });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
exports.getAllExpenses = async (req, res) => {
  const userId = req.user.id;
  try {
    const expense = await Expense.find({ userId }).sort({ date: -1 });
    res.status(200).json({ expense });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
exports.downloadExpense = async (req, res) => {
  const userId = req.user.id;
  try {
    const expenses = await Expense.find({ userId }).sort({ date: -1 });

    const data = expenses.map((item) => ({
      Source: item.source,
      Amount: item.amount,
      Date: new Date(item.date).toLocaleDateString(),
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, "Expenses");

    // Write to buffer instead of file
    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    // Set headers for file download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=expense_report.xlsx"
    );

    res.send(buffer);
  } catch (error) {
    console.error("Error downloading expense:", error);
    res.status(500).json({ message: "Server error" });
  }
};
exports.deleteExpense = async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Expense deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
