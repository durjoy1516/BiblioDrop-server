const express = require("express");
const mongoose = require("mongoose");

const User = require("../models/User");
const Book = require("../models/Book");
const Delivery = require("../models/Delivery");
const Transaction = require("../models/Transaction");

const { verifyToken } = require("../middlewares/authMiddleware");
const { verifyRole } = require("../middlewares/roleMiddleware");

const router = express.Router();

router.use(
  verifyToken,
  verifyRole("admin")
);

// =====================================================
// ADMIN STATS
// =====================================================

router.get("/stats", async (req, res) => {
  try {
    const totalUsers =
      await User.countDocuments();

    const totalLibrarians =
      await User.countDocuments({
        role: "librarian",
      });

    const totalBooks =
      await Book.countDocuments();

    const totalDeliveries =
      await Delivery.countDocuments({
        status: "Delivered",
      });

    const revenueData =
      await Transaction.aggregate([
        {
          $match: {
            status: "completed",
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amount",
            },
          },
        },
      ]);

    const totalRevenue =
      revenueData[0]?.total || 0;

    const categoryStats =
      await Book.aggregate([
        {
          $group: {
            _id: "$category",
            value: {
              $sum: 1,
            },
          },
        },
        {
          $project: {
            _id: 0,
            name: "$_id",
            value: 1,
          },
        },
        {
          $sort: {
            value: -1,
          },
        },
      ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalLibrarians,
        totalBooks,
        totalDeliveries,
        totalRevenue,
      },
      categoryStats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =====================================================
// ALL USERS
// =====================================================

router.get("/users", async (req, res) => {
  try {
    const users =
      await User.find()
        .select("-password")
        .sort({ createdAt: -1 });

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =====================================================
// CHANGE USER ROLE
// =====================================================

router.patch(
  "/users/:id/role",
  async (req, res) => {
    try {
      const { role } = req.body;

      if (
        !["user", "librarian", "admin"].includes(
          role
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid role.",
        });
      }

      if (req.params.id === req.user.id) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot change your own admin role.",
        });
      }

      const user =
        await User.findByIdAndUpdate(
          req.params.id,
          { role },
          {
            new: true,
            runValidators: true,
          }
        ).select("-password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      res.json({
        success: true,
        message: "User role updated.",
        user,
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
// DELETE USER
// =====================================================

router.delete(
  "/users/:id",
  async (req, res) => {
    try {
      if (req.params.id === req.user.id) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot delete your own admin account.",
        });
      }

      const user =
        await User.findByIdAndDelete(
          req.params.id
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      res.json({
        success: true,
        message: "User deleted successfully.",
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
// ALL BOOKS
// =====================================================

router.get("/books", async (req, res) => {
  try {
    const books =
      await Book.find()
        .populate(
          "owner",
          "name email photoURL"
        )
        .sort({ createdAt: -1 });

    res.json({
      success: true,
      books,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =====================================================
// PENDING APPROVAL QUEUE
// =====================================================

router.get(
  "/books/pending",
  async (req, res) => {
    try {
      const books =
        await Book.find({
          status: "Pending Approval",
        })
          .populate(
            "owner",
            "name email photoURL"
          )
          .sort({ createdAt: -1 });

      res.json({
        success: true,
        books,
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
// APPROVE BOOK
// =====================================================

router.patch(
  "/books/:id/approve",
  async (req, res) => {
    try {
      const book =
        await Book.findByIdAndUpdate(
          req.params.id,
          {
            status: "Published",
          },
          {
            new: true,
          }
        ).populate(
          "owner",
          "name email photoURL"
        );

      if (!book) {
        return res.status(404).json({
          success: false,
          message: "Book not found.",
        });
      }

      res.json({
        success: true,
        message:
          "Book approved and published successfully.",
        book,
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
// UNPUBLISH BOOK
// =====================================================

router.patch(
  "/books/:id/unpublish",
  async (req, res) => {
    try {
      const book =
        await Book.findById(
          req.params.id
        );

      if (!book) {
        return res.status(404).json({
          success: false,
          message: "Book not found.",
        });
      }

      if (book.status === "Checked Out") {
        return res.status(400).json({
          success: false,
          message:
            "Checked-out book cannot be unpublished.",
        });
      }

      book.status = "Unpublished";

      await book.save();

      res.json({
        success: true,
        message: "Book unpublished successfully.",
        book,
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
// DELETE BOOK
// =====================================================

router.delete(
  "/books/:id",
  async (req, res) => {
    try {
      const book =
        await Book.findByIdAndDelete(
          req.params.id
        );

      if (!book) {
        return res.status(404).json({
          success: false,
          message: "Book not found.",
        });
      }

      res.json({
        success: true,
        message: "Book deleted successfully.",
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
// ALL DELIVERIES
// =====================================================

router.get(
  "/deliveries",
  async (req, res) => {
    try {
      const deliveries =
        await Delivery.find()
          .populate(
            "book",
            "title author"
          )
          .populate(
            "user",
            "name email"
          )
          .populate(
            "librarian",
            "name email"
          )
          .sort({ createdAt: -1 });

      res.json({
        success: true,
        deliveries,
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
// ALL TRANSACTIONS
// =====================================================

router.get(
  "/transactions",
  async (req, res) => {
    try {
      const transactions =
        await Transaction.find()
          .populate(
            "user",
            "name email"
          )
          .populate(
            "librarian",
            "name email"
          )
          .populate(
            "book",
            "title"
          )
          .sort({ createdAt: -1 });

      res.json({
        success: true,
        transactions,
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
// CATEGORY CHART
// =====================================================

router.get(
  "/category-stats",
  async (req, res) => {
    try {
      const categoryStats =
        await Book.aggregate([
          {
            $group: {
              _id: "$category",
              value: {
                $sum: 1,
              },
            },
          },
          {
            $project: {
              _id: 0,
              name: "$_id",
              value: 1,
            },
          },
          {
            $sort: {
              value: -1,
            },
          },
        ]);

      res.json({
        success: true,
        categoryStats,
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