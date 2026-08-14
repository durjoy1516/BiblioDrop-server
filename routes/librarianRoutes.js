const express = require("express");
const mongoose = require("mongoose");

const Book = require("../models/Book");
const Delivery = require("../models/Delivery");
const Transaction = require("../models/Transaction");

const { verifyToken } = require("../middlewares/authMiddleware");
const { verifyRole } = require("../middlewares/roleMiddleware");

const router = express.Router();

router.use(
  verifyToken,
  verifyRole("librarian")
);

// =====================================================
// LIBRARIAN DASHBOARD STATS
// =====================================================

router.get("/stats", async (req, res) => {
  try {
    const librarianId = new mongoose.Types.ObjectId(
      req.user.id
    );

    const totalBooks = await Book.countDocuments({
      owner: librarianId,
    });

    const activePendingRequests =
      await Delivery.countDocuments({
        librarian: librarianId,
        status: "Pending",
      });

    const completedDeliveries =
      await Delivery.countDocuments({
        librarian: librarianId,
        status: "Delivered",
      });

    const earningsData =
      await Transaction.aggregate([
        {
          $match: {
            librarian: librarianId,
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

    const totalEarnings =
      earningsData[0]?.total || 0;

    const popularBooks =
      await Delivery.aggregate([
        {
          $match: {
            librarian: librarianId,
          },
        },
        {
          $group: {
            _id: "$book",
            requestCount: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            requestCount: -1,
          },
        },
        {
          $limit: 5,
        },
        {
          $lookup: {
            from: "books",
            localField: "_id",
            foreignField: "_id",
            as: "book",
          },
        },
        {
          $unwind: "$book",
        },
        {
          $project: {
            _id: 0,
            book: {
              _id: "$book._id",
              title: "$book.title",
              coverImage: "$book.coverImage",
            },
            requestCount: 1,
          },
        },
      ]);

    res.json({
      success: true,
      stats: {
        totalBooks,
        activePendingRequests,
        completedDeliveries,
        totalEarnings,
      },
      popularBooks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =====================================================
// MY BOOKS
// =====================================================

router.get("/books", async (req, res) => {
  try {
    const books = await Book.find({
      owner: req.user.id,
    })
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
// MY DELIVERIES
// =====================================================

router.get("/deliveries", async (req, res) => {
  try {
    const deliveries =
      await Delivery.find({
        librarian: req.user.id,
      })
        .populate(
          "book",
          "title author coverImage"
        )
        .populate(
          "user",
          "name email photoURL"
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
});

// =====================================================
// MY TRANSACTIONS
// =====================================================

router.get("/transactions", async (req, res) => {
  try {
    const transactions =
      await Transaction.find({
        librarian: req.user.id,
      })
        .populate(
          "user",
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
});

// =====================================================
// TOP LIBRARIANS
// HOME PAGE
// =====================================================

router.get("/top", async (req, res) => {
  try {
    const topLibrarians =
      await Delivery.aggregate([
        {
          $match: {
            status: "Delivered",
          },
        },
        {
          $group: {
            _id: "$librarian",
            completedDeliveries: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            completedDeliveries: -1,
          },
        },
        {
          $limit: 3,
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "librarian",
          },
        },
        {
          $unwind: "$librarian",
        },
        {
          $project: {
            _id: "$librarian._id",
            name: "$librarian.name",
            email: "$librarian.email",
            photoURL: "$librarian.photoURL",
            completedDeliveries: 1,
          },
        },
      ]);

    res.json({
      success: true,
      librarians: topLibrarians,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;