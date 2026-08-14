const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    librarian: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    transactionId: {
      type: String,
      required: true,
      unique: true,
    },

    paymentIntentId: {
      type: String,
      required: true,
      unique: true,
    },

    status: {
      type: String,
      enum: ["completed", "failed", "refunded"],
      default: "completed",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Transaction", transactionSchema);