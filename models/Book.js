const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    author: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    deliveryFee: {
      type: Number,
      required: true,
      min: 0,
    },

    coverImage: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: [
        "Pending Approval",
        "Published",
        "Unpublished",
        "Checked Out",
      ],
      default: "Pending Approval",
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Book", bookSchema);