const express = require("express");

const Review = require("../models/Review");
const Delivery = require("../models/Delivery");

const { verifyToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// =====================================================
// CREATE VERIFIED REVIEW
// =====================================================

router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      bookId,
      rating,
      comment,
    } = req.body;

    if (!bookId || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message:
          "Book, rating and comment are required.",
      });
    }

    const numericRating = Number(rating);

    if (
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Rating must be between 1 and 5.",
      });
    }

    // Verified delivery check
    const delivered =
      await Delivery.findOne({
        book: bookId,
        user: req.user.id,
        status: "Delivered",
      });

    if (!delivered) {
      return res.status(403).json({
        success: false,
        message:
          "Only users who received this book can leave a review.",
      });
    }

    // One review per user per book
    const existingReview =
      await Review.findOne({
        book: bookId,
        user: req.user.id,
      });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message:
          "You have already reviewed this book.",
      });
    }

    const review = await Review.create({
      book: bookId,
      user: req.user.id,
      rating: numericRating,
      comment: comment.trim(),
    });

    const populatedReview =
      await Review.findById(review._id).populate(
        "user",
        "name photoURL"
      );

    res.status(201).json({
      success: true,
      message: "Review submitted successfully.",
      review: populatedReview,
    });
  } catch (error) {
    // Mongo duplicate key
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "You have already reviewed this book.",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =====================================================
// MY REVIEWS
// =====================================================

router.get(
  "/my-reviews",
  verifyToken,
  async (req, res) => {
    try {
      const reviews = await Review.find({
        user: req.user.id,
      })
        .populate(
          "book",
          "title author coverImage category"
        )
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        reviews,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// =====================================================
// UPDATE MY REVIEW
// =====================================================

router.patch(
  "/:id",
  verifyToken,
  async (req, res) => {
    try {
      const {
        rating,
        comment,
      } = req.body;

      const review =
        await Review.findOne({
          _id: req.params.id,
          user: req.user.id,
        });

      if (!review) {
        return res.status(404).json({
          success: false,
          message:
            "Review not found or unauthorized.",
        });
      }

      if (rating !== undefined) {
        const numericRating = Number(rating);

        if (
          numericRating < 1 ||
          numericRating > 5
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Rating must be between 1 and 5.",
          });
        }

        review.rating = numericRating;
      }

      if (comment !== undefined) {
        review.comment = comment.trim();
      }

      await review.save();

      res.json({
        success: true,
        message: "Review updated successfully.",
        review,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// =====================================================
// DELETE MY REVIEW
// =====================================================

router.delete(
  "/:id",
  verifyToken,
  async (req, res) => {
    try {
      const review =
        await Review.findOneAndDelete({
          _id: req.params.id,
          user: req.user.id,
        });

      if (!review) {
        return res.status(404).json({
          success: false,
          message:
            "Review not found or unauthorized.",
        });
      }

      res.json({
        success: true,
        message: "Review deleted successfully.",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

module.exports = router;