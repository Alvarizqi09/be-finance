const User = require("../models/User");
const jwt = require("jsonwebtoken");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
};

exports.registerUser = async (req, res) => {
  const { fullName, email, password, profileImageUrl } = req.body || {};

  if (!fullName || !email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields" });
  }
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const user = await User.create({
      fullName,
      email,
      password,
      profileImageUrl,
    });
    const createdAtIndo = new Date(user.createdAt).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    res
      .status(201)
      .json({
        id: user._id,
        user: { ...user.toObject(), createdAt: createdAtIndo },
        token: generateToken(user._id),
      });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Please provide all required fields" });
  }
  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const createdAtIndo = new Date(user.createdAt).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    res
      .status(200)
      .json({
        id: user._id,
        user: { ...user.toObject(), createdAt: createdAtIndo },
        token: generateToken(user._id),
      });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.getUserInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Format createdAt ke waktu Indonesia
    const createdAtIndo = new Date(user.createdAt).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    res
      .status(200)
      .json({ user: { ...user.toObject(), createdAt: createdAtIndo } });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
