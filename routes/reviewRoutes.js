const express = require("express");
const Review = require("../models/Review");
const Delivery = require("../models/Delivery");
const { verifyToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// Post Verified Review
router.post("/", verifyToken, async (req, res) => {
  try {
    const { bookId, rating, comment } = req.body;

    // Challenge Check: Check if status is Delivered
    const verifiedDelivery = await Delivery.findOne({
      book: bookId,
      user: req.user.id,
      status: "Delivered",
    });

    if (!verifiedDelivery) {
      return res.status(403).json({
        message: "Only users who have received delivery of this book can leave a review.",
      });
    }

    const review = await Review.create({
      book: bookId,
      user: req.user.id,
      rating,
      comment,
    });

    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;