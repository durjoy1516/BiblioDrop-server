const express = require("express");

const User = require("../models/User");
const Book = require("../models/Book");
const Delivery = require("../models/Delivery");
const Transaction = require("../models/Transaction");

const {
  verifyToken,
} = require("../middlewares/authMiddleware");

const {
  verifyRole,
} = require("../middlewares/roleMiddleware");

const router = express.Router();

// =====================================================
// ADMIN AUTH
// Every admin route requires:
// 1. Valid JWT
// 2. Admin role
// =====================================================

router.use(
  verifyToken,
  verifyRole("admin")
);

// =====================================================
// ADMIN STATS
// GET /api/admin/stats
// =====================================================

router.get(
  "/stats",
  async (req, res) => {
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

      res.json({
        success: true,

        stats: {
          totalUsers,
          totalLibrarians,
          totalBooks,
          totalDeliveries,
          totalRevenue,
        },
      });
    } catch (error) {
      console.error(
        "Admin stats error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load admin statistics.",
      });
    }
  }
);

// =====================================================
// CATEGORY STATS
// GET /api/admin/category-stats
// =====================================================

router.get(
  "/category-stats",
  async (req, res) => {
    try {
      const categoryStats =
        await Book.aggregate([
          {
            $match: {
              category: {
                $exists: true,
                $ne: "",
              },
            },
          },

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
      console.error(
        "Category stats error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load category statistics.",
      });
    }
  }
);

// =====================================================
// ALL USERS
// GET /api/admin/users
// =====================================================

router.get(
  "/users",
  async (req, res) => {
    try {
      const users =
        await User.find()
          .select("-password")
          .sort({
            createdAt: -1,
          });

      res.json({
        success: true,
        users,
      });
    } catch (error) {
      console.error(
        "Get users error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load users.",
      });
    }
  }
);

// =====================================================
// CHANGE USER ROLE
// PATCH /api/admin/users/:id/role
// =====================================================

router.patch(
  "/users/:id/role",
  async (req, res) => {
    try {
      const {
        role,
      } = req.body;

      // Validate role

      const allowedRoles = [
        "user",
        "librarian",
        "admin",
      ];

      if (
        !allowedRoles.includes(role)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid role.",
        });
      }

      // Prevent admin from changing own role

      if (
        req.params.id ===
        req.user.id
      ) {
        return res.status(400).json({
          success: false,
          message:
            "You cannot change your own admin role.",
        });
      }

      const user =
        await User.findByIdAndUpdate(
          req.params.id,
          {
            role,
          },
          {
            new: true,
            runValidators: true,
          }
        ).select("-password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message:
            "User not found.",
        });
      }

      res.json({
        success: true,
        message:
          "User role updated successfully.",
        user,
      });
    } catch (error) {
      console.error(
        "Role update error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to update user role.",
      });
    }
  }
);

// =====================================================
// DELETE USER
// DELETE /api/admin/users/:id
// =====================================================

router.delete(
  "/users/:id",
  async (req, res) => {
    try {
      // Prevent deleting own admin account

      if (
        req.params.id ===
        req.user.id
      ) {
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
          message:
            "User not found.",
        });
      }

      res.json({
        success: true,
        message:
          "User deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Delete user error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to delete user.",
      });
    }
  }
);

// =====================================================
// ALL BOOKS
// GET /api/admin/books
// =====================================================

router.get(
  "/books",
  async (req, res) => {
    try {
      const books =
        await Book.find()
          .populate(
            "owner",
            "name email photoURL"
          )
          .sort({
            createdAt: -1,
          });

      res.json({
        success: true,
        books,
      });
    } catch (error) {
      console.error(
        "Get admin books error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load books.",
      });
    }
  }
);

// =====================================================
// PENDING APPROVAL BOOKS
// GET /api/admin/books/pending
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
          .sort({
            createdAt: -1,
          });

      res.json({
        success: true,
        books,
      });
    } catch (error) {
      console.error(
        "Get pending books error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load pending books.",
      });
    }
  }
);

// =====================================================
// APPROVE BOOK
// PATCH /api/admin/books/:id/approve
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
            runValidators: true,
          }
        ).populate(
          "owner",
          "name email photoURL"
        );

      if (!book) {
        return res.status(404).json({
          success: false,
          message:
            "Book not found.",
        });
      }

      res.json({
        success: true,
        message:
          "Book approved and published successfully.",
        book,
      });
    } catch (error) {
      console.error(
        "Approve book error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to approve book.",
      });
    }
  }
);

// =====================================================
// UNPUBLISH BOOK
// PATCH /api/admin/books/:id/unpublish
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
          message:
            "Book not found.",
        });
      }

      // A checked-out book cannot be unpublished.

      if (
        book.status ===
        "Checked Out"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Checked-out book cannot be unpublished.",
        });
      }

      book.status =
        "Unpublished";

      await book.save();

      const updatedBook =
        await Book.findById(
          book._id
        ).populate(
          "owner",
          "name email photoURL"
        );

      res.json({
        success: true,
        message:
          "Book unpublished successfully.",
        book: updatedBook,
      });
    } catch (error) {
      console.error(
        "Unpublish book error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to unpublish book.",
      });
    }
  }
);

// =====================================================
// DELETE BOOK
// DELETE /api/admin/books/:id
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
          message:
            "Book not found.",
        });
      }

      res.json({
        success: true,
        message:
          "Book deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Delete book error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to delete book.",
      });
    }
  }
);

// =====================================================
// ALL DELIVERIES
// GET /api/admin/deliveries
// =====================================================

router.get(
  "/deliveries",
  async (req, res) => {
    try {
      const deliveries =
        await Delivery.find()
          .populate(
            "book",
            "title author coverImage category deliveryFee"
          )
          .populate(
            "user",
            "name email photoURL"
          )
          .populate(
            "librarian",
            "name email photoURL"
          )
          .sort({
            createdAt: -1,
          });

      res.json({
        success: true,
        deliveries,
      });
    } catch (error) {
      console.error(
        "Get deliveries error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load deliveries.",
      });
    }
  }
);

// =====================================================
// ALL TRANSACTIONS
// GET /api/admin/transactions
// =====================================================

router.get(
  "/transactions",
  async (req, res) => {
    try {
      const transactions =
        await Transaction.find()
          .populate(
            "user",
            "name email photoURL"
          )
          .populate(
            "librarian",
            "name email photoURL"
          )
          .populate(
            "book",
            "title author coverImage"
          )
          .sort({
            createdAt: -1,
          });

      res.json({
        success: true,
        transactions,
      });
    } catch (error) {
      console.error(
        "Get transactions error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load transactions.",
      });
    }
  }
);

module.exports = router;