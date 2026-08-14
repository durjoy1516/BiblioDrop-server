const mongoose = require("mongoose");

const deliverySchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },

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

    transactionId: {
      type: String,
      required: true,
    },

    deliveryFee: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["Pending", "Dispatched", "Delivered"],
      default: "Pending",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Delivery", deliverySchema);