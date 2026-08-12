const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    amount: { type: Number, required: true },
    transactionId: { type: String, required: true },
    status: { type: String, default: "completed" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);