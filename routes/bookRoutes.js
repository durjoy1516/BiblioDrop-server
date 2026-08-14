const express = require("express");
const mongoose = require("mongoose");

const Book = require("../models/Book");
const Review = require("../models/Review");

const { verifyToken } = require("../middlewares/authMiddleware");
const { verifyRole } = require("../middlewares/roleMiddleware");

const router = express.Router();

// =====================================================
// FEATURED BOOKS
// GET /api/books/featured
// =====================================================

router.get("/featured", async (req, res) => {
  try {
    const books = await Book.find({
      status: "Published",
    })
      .populate("owner", "name email photoURL")
      .sort({ createdAt: -1 })
      .limit(6);

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
// POPULAR CATEGORIES
// GET /api/books/categories
// =====================================================

router.get("/categories", async (req, res) => {
  try {
    const categories = await Book.aggregate([
      {
        $match: {
          status: "Published",
        },
      },
      {
        $group: {
          _id: "$category",
          count: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          count: 1,
        },
      },
    ]);

    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =====================================================
// BROWSE BOOKS
// GET /api/books
// =====================================================

router.get("/", async (req, res) => {
  try {
    const {
      search = "",
      category = "All",
      minFee,
      maxFee,
      availability = "all",
      sort = "latest",
      page = 1,
      limit = 8,
    } = req.query;

    const currentPage = Math.max(Number(page) || 1, 1);

    let perPage = Number(limit) || 8;

    // Assignment requires 6–12 items per page.
    perPage = Math.min(Math.max(perPage, 6), 12);

    const query = {
      status: {
        $in:
          availability === "all"
            ? ["Published", "Checked Out"]
            : availability === "available"
            ? ["Published"]
            : ["Checked Out"],
      },
    };

    // Search title / author
    if (search.trim()) {
      query.$or = [
        {
          title: {
            $regex: search.trim(),
            $options: "i",
          },
        },
        {
          author: {
            $regex: search.trim(),
            $options: "i",
          },
        },
      ];
    }

    // Category
    if (category && category !== "All") {
      query.category = category;
    }

    // Delivery fee range
    if (minFee !== undefined || maxFee !== undefined) {
      query.deliveryFee = {};

      if (minFee !== undefined && minFee !== "") {
        query.deliveryFee.$gte = Number(minFee);
      }

      if (maxFee !== undefined && maxFee !== "") {
        query.deliveryFee.$lte = Number(maxFee);
      }
    }

    // Sorting
    let sortOption = {
      createdAt: -1,
    };

    if (sort === "oldest") {
      sortOption = {
        createdAt: 1,
      };
    }

    if (sort === "fee-low") {
      sortOption = {
        deliveryFee: 1,
      };
    }

    if (sort === "fee-high") {
      sortOption = {
        deliveryFee: -1,
      };
    }

    const total = await Book.countDocuments(query);

    const totalPages = Math.max(
      Math.ceil(total / perPage),
      1
    );

    const books = await Book.find(query)
      .populate("owner", "name email photoURL")
      .sort(sortOption)
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.json({
      success: true,
      books,
      pagination: {
        currentPage,
        totalPages,
        totalItems: total,
        limit: perPage,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =====================================================
// SINGLE BOOK DETAILS
// GET /api/books/:id
// =====================================================

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID.",
      });
    }

    const book = await Book.findById(id).populate(
      "owner",
      "name email photoURL"
    );

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found.",
      });
    }

    const reviews = await Review.find({
      book: id,
    })
      .populate("user", "name photoURL")
      .sort({ createdAt: -1 });

    const reviewStats = await Review.aggregate([
      {
        $match: {
          book: new mongoose.Types.ObjectId(id),
        },
      },
      {
        $group: {
          _id: null,
          averageRating: {
            $avg: "$rating",
          },
          totalReviews: {
            $sum: 1,
          },
        },
      },
    ]);

    res.json({
      success: true,
      book,
      reviews,
      reviewStats: reviewStats[0] || {
        averageRating: 0,
        totalReviews: 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// =====================================================
// ADD BOOK
// LIBRARIAN / ADMIN
// =====================================================

router.post(
  "/",
  verifyToken,
  verifyRole("librarian", "admin"),
  async (req, res) => {
    try {
      const {
        title,
        author,
        description,
        category,
        deliveryFee,
        coverImage,
      } = req.body;

      if (
        !title ||
        !author ||
        !description ||
        !category ||
        deliveryFee === undefined ||
        !coverImage
      ) {
        return res.status(400).json({
          success: false,
          message: "All book fields are required.",
        });
      }

      const book = await Book.create({
        title: title.trim(),
        author: author.trim(),
        description: description.trim(),
        category: category.trim(),
        deliveryFee: Number(deliveryFee),
        coverImage,
        owner: req.user.id,

        // Always starts here.
        status: "Pending Approval",
      });

      const populatedBook = await Book.findById(book._id).populate(
        "owner",
        "name email photoURL"
      );

      res.status(201).json({
        success: true,
        message: "Book submitted for admin approval.",
        book: populatedBook,
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
// UPDATE OWN BOOK
// LIBRARIAN / ADMIN
// =====================================================

router.put(
  "/:id",
  verifyToken,
  verifyRole("librarian", "admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid book ID.",
        });
      }

      const book = await Book.findById(id);

      if (!book) {
        return res.status(404).json({
          success: false,
          message: "Book not found.",
        });
      }

      // Librarian can only edit own book.
      if (
        req.user.role === "librarian" &&
        book.owner.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only edit your own books.",
        });
      }

      const allowedFields = [
        "title",
        "author",
        "description",
        "category",
        "deliveryFee",
        "coverImage",
      ];

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          book[field] =
            field === "deliveryFee"
              ? Number(req.body[field])
              : req.body[field];
        }
      });

      await book.save();

      const updatedBook = await Book.findById(id).populate(
        "owner",
        "name email photoURL"
      );

      res.json({
        success: true,
        message: "Book updated successfully.",
        book: updatedBook,
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
// LIBRARIAN OWN BOOKS
// =====================================================

router.get(
  "/owner/my-books",
  verifyToken,
  verifyRole("librarian"),
  async (req, res) => {
    try {
      const books = await Book.find({
        owner: req.user.id,
      }).sort({ createdAt: -1 });

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
// TOGGLE PUBLISH / UNPUBLISH
// LIBRARIAN / ADMIN
// =====================================================

router.patch(
  "/:id/toggle-publish",
  verifyToken,
  verifyRole("librarian", "admin"),
  async (req, res) => {
    try {
      const book = await Book.findById(req.params.id);

      if (!book) {
        return res.status(404).json({
          success: false,
          message: "Book not found.",
        });
      }

      if (
        req.user.role === "librarian" &&
        book.owner.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only manage your own books.",
        });
      }

      if (book.status === "Pending Approval") {
        return res.status(400).json({
          success: false,
          message:
            "Pending Approval books cannot be published by librarians.",
        });
      }

      if (book.status === "Checked Out") {
        return res.status(400).json({
          success: false,
          message:
            "A checked-out book cannot be unpublished until it is available.",
        });
      }

      book.status =
        book.status === "Published"
          ? "Unpublished"
          : "Published";

      await book.save();

      res.json({
        success: true,
        message: `Book ${book.status.toLowerCase()} successfully.`,
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
  "/:id",
  verifyToken,
  verifyRole("librarian", "admin"),
  async (req, res) => {
    try {
      const book = await Book.findById(req.params.id);

      if (!book) {
        return res.status(404).json({
          success: false,
          message: "Book not found.",
        });
      }

      if (
        req.user.role === "librarian" &&
        book.owner.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only delete your own books.",
        });
      }

      if (book.status === "Checked Out") {
        return res.status(400).json({
          success: false,
          message: "Checked-out books cannot be deleted.",
        });
      }

      await Book.findByIdAndDelete(req.params.id);

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

module.exports = router;