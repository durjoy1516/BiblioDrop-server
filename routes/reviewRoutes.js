const express = require("express");

const Review = require("../models/Review");
const Delivery = require("../models/Delivery");

const { verifyToken } = require("../middlewares/authMiddleware");

const router = express.Router();

// =====================================================
// GET REVIEWS FOR A BOOK
// GET /api/reviews?bookId=BOOK_ID
//
// Public access
// Login required নয়
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { bookId } = req.query;

    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: "Book ID is required.",
      });
    }

    const reviews = await Review.find({
      book: bookId,
    })
      .populate("user", "name photoURL")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      reviews,
    });
  } catch (error) {
    console.error("GET BOOK REVIEWS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =====================================================
// CREATE VERIFIED REVIEW
// POST /api/reviews
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

    // -----------------------------------------------
    // Verified delivery check
    // -----------------------------------------------

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

    // -----------------------------------------------
    // One review per user per book
    // -----------------------------------------------

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

    // -----------------------------------------------
    // Create review
    // -----------------------------------------------

    const review = await Review.create({
      book: bookId,
      user: req.user.id,
      rating: numericRating,
      comment: comment.trim(),
    });

    // -----------------------------------------------
    // Populate user information
    // -----------------------------------------------

    const populatedReview =
      await Review.findById(
        review._id
      ).populate(
        "user",
        "name photoURL"
      );

    return res.status(201).json({
      success: true,
      message:
        "Review submitted successfully.",
      review: populatedReview,
    });
  } catch (error) {
    console.error(
      "CREATE REVIEW ERROR:",
      error
    );

    // Mongo duplicate key
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "You have already reviewed this book.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =====================================================
// MY REVIEWS
// GET /api/reviews/my-reviews
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
        .sort({
          createdAt: -1,
        });

      return res.status(200).json({
        success: true,
        reviews,
      });
    } catch (error) {
      console.error(
        "MY REVIEWS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// =====================================================
// UPDATE MY REVIEW
// PATCH /api/reviews/:id
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

      // -----------------------------------------------
      // Find only the logged-in user's review
      // -----------------------------------------------

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

      // -----------------------------------------------
      // Update rating
      // -----------------------------------------------

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

      // -----------------------------------------------
      // Update comment
      // -----------------------------------------------

      if (comment !== undefined) {
        const trimmedComment =
          comment.trim();

        if (!trimmedComment) {
          return res.status(400).json({
            success: false,
            message:
              "Comment cannot be empty.",
          });
        }

        review.comment =
          trimmedComment;
      }

      await review.save();

      // Populate updated review
      const updatedReview =
        await Review.findById(
          review._id
        ).populate(
          "user",
          "name photoURL"
        );

      return res.status(200).json({
        success: true,
        message:
          "Review updated successfully.",
        review: updatedReview,
      });
    } catch (error) {
      console.error(
        "UPDATE REVIEW ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// =====================================================
// DELETE MY REVIEW
// DELETE /api/reviews/:id
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

      return res.status(200).json({
        success: true,
        message:
          "Review deleted successfully.",
      });
    } catch (error) {
      console.error(
        "DELETE REVIEW ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

module.exports = router;