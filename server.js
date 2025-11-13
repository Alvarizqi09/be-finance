require("dotenv").config();
const express = require("express");
const cors = require("cors");
const passport = require("./config/passport");
const session = require("express-session");

const app = express();
const path = require("path");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const incomeRoutes = require("./routes/incomeRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const aiRoutes = require("./routes/aiRoutes");

app.use(
  cors({
    origin: [
      "https://letsstack-it.vercel.app",
      "http://localhost:5173",
      process.env.CLIENT_URL,
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.use(express.json());

// Session setup untuk Passport
app.use(
  session({
    secret: process.env.JWT_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

const PORT = process.env.PORT || 5000;

connectDB();

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/income", incomeRoutes);
app.use("/api/v1/expense", expenseRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/ai", aiRoutes); // TAMBAHKAN INI

app.get("/", (req, res) => {
  res.json({ message: "Server is running" });
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
