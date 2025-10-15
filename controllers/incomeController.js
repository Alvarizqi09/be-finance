const Income = require("../models/Income");
const xlsx = require("xlsx");

exports.addIncome = async (req, res) => {
  const userId = req.user.id;

  try {
    const { icon, source, amount, date } = req.body;
    if (!source || !amount || !date) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields" });
    }

    const newIncome = new Income({
      userId,
      icon,
      source,
      amount,
      date,
    });
    await newIncome.save();
    res.status(201).json({ message: "Income added successfully", newIncome });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
exports.getAllIncomes = async (req, res) => {
  const userId = req.user.id;
  try {
    const incomes = await Income.find({ userId }).sort({ date: -1 });
    res.status(200).json({ incomes });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
exports.downloadIncome = async (req, res) => {
  const userId = req.user.id;
  try {
    const incomes = await Income.find({ userId }).sort({ date: -1 });

    const data = incomes.map((item) => ({
      Source: item.source,
      Amount: item.amount,
      Date: item.date,
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, "incomes");
    xlsx.writeFile(wb, "incomes.xlsx");
    res.download("incomes.xlsx");
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
exports.deleteIncome = async (req, res) => {
  try {
    await Income.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Income deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
