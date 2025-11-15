const mongoose = require("mongoose");

const savingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    goalName: {
      type: String,
      required: true,
      trim: true,
    },
    targetAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    icon: {
      type: String,
      default: "💰",
    },
    description: {
      type: String,
      trim: true,
    },
    targetDate: {
      type: Date,
    },
    category: {
      type: String,
      enum: ["vacation", "education", "emergency", "investment", "other"],
      default: "other",
    },
    status: {
      type: String,
      enum: ["active", "completed", "paused"],
      default: "active",
    },
    // Kontribusi otomatis
    autoContribute: {
      enabled: {
        type: Boolean,
        default: false,
      },
      amount: {
        type: Number,
        default: 0,
        min: 0,
      },
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
        default: "monthly",
      },
      lastContributionDate: {
        type: Date,
      },
      nextContributionDate: {
        type: Date,
      },
    },
    // Riwayat kontribusi
    contributions: [
      {
        amount: Number,
        type: {
          type: String,
          enum: ["manual", "auto"],
        },
        date: {
          type: Date,
          default: Date.now,
        },
        note: String,
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index untuk query yang efisien
savingsSchema.index({ userId: 1, status: 1 });
savingsSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Savings", savingsSchema);
