const express = require("express");
const Stripe = require("stripe");

const Book = require("../models/Book");
const Delivery = require("../models/Delivery");
const Transaction = require("../models/Transaction");

const { verifyToken } = require("../middlewares/authMiddleware");
const { verifyRole } = require("../middlewares/roleMiddleware");

const router = express.Router();

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️ STRIPE_SECRET_KEY is missing from .env");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// =====================================================
// CREATE PAYMENT INTENT
// POST /api/deliveries/create-payment-intent
// =====================================================

router.post(
  "/create-payment-intent",
  verifyToken,
  async (req, res) => {
    try {
      const { bookId } = req.body;

      if (!bookId) {
        return res.status(400).json({
          success: false,
          message: "Book ID is required.",
        });
      }

      const book = await Book.findById(bookId);

      if (!book) {
        return res.status(404).json({
          success: false,
          message: "Book not found.",
        });
      }

      // Only published books can be requested
      if (book.status !== "Published") {
        return res.status(400).json({
          success: false,
          message: "This book is currently unavailable.",
        });
      }

      // Owner cannot request own book
      if (
        book.owner &&
        book.owner.toString() === req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You cannot request delivery of your own book.",
        });
      }

      const amount = Number(book.deliveryFee);

      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid delivery fee.",
        });
      }

      // Prevent multiple active requests for same book/user
      const existingDelivery =
        await Delivery.findOne({
          book: book._id,
          user: req.user.id,
          status: {
            $in: ["Pending", "Dispatched"],
          },
        });

      if (existingDelivery) {
        return res.status(400).json({
          success: false,
          message:
            "You already have an active delivery request for this book.",
        });
      }

      const paymentIntent =
        await stripe.paymentIntents.create({
          amount: Math.round(amount * 100),
          currency: "usd",

          automatic_payment_methods: {
            enabled: true,
          },

          metadata: {
            bookId: book._id.toString(),
            userId: req.user.id,
            librarianId: book.owner.toString(),
          },
        });

      return res.status(200).json({
        success: true,
        clientSecret:
          paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
      });
    } catch (error) {
      console.error(
        "CREATE PAYMENT INTENT ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to create payment intent.",
      });
    }
  }
);

// =====================================================
// CONFIRM PAYMENT
// POST /api/deliveries/confirm-payment
//
// Stripe payment successful হলে:
// 1. Transaction create
// 2. Delivery create
// 3. Book -> Checked Out
//
// IMPORTANT:
// Frontend অবশ্যই Stripe payment success হওয়ার পরে
// এই endpoint call করবে.
// =====================================================

router.post(
  "/confirm-payment",
  verifyToken,
  async (req, res) => {
    try {
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          message:
            "Payment Intent ID is required.",
        });
      }

      // -----------------------------------------------
      // Get payment from Stripe
      // -----------------------------------------------

      const paymentIntent =
        await stripe.paymentIntents.retrieve(
          paymentIntentId
        );

      if (!paymentIntent) {
        return res.status(404).json({
          success: false,
          message:
            "Payment intent not found.",
        });
      }

      // -----------------------------------------------
      // Payment must be successful
      // -----------------------------------------------

      if (
        paymentIntent.status !==
        "succeeded"
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Payment is not completed. Current status: ${paymentIntent.status}`,
        });
      }

      // -----------------------------------------------
      // Verify payment belongs to logged user
      // -----------------------------------------------

      const metadata =
        paymentIntent.metadata || {};

      const {
        bookId,
        userId,
        librarianId,
      } = metadata;

      if (!bookId || !userId || !librarianId) {
        return res.status(400).json({
          success: false,
          message:
            "Payment metadata is incomplete.",
        });
      }

      if (userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message:
            "This payment does not belong to the logged-in user.",
        });
      }

      // -----------------------------------------------
      // Check existing transaction
      // -----------------------------------------------

      const existingTransaction =
        await Transaction.findOne({
          paymentIntentId,
        });

      if (existingTransaction) {
        const existingDelivery =
          await Delivery.findOne({
            transactionId:
              existingTransaction.transactionId,
          })
            .populate(
              "book",
              "title author coverImage category deliveryFee status"
            )
            .populate(
              "user",
              "name email photoURL"
            )
            .populate(
              "librarian",
              "name email photoURL"
            );

        return res.status(200).json({
          success: true,
          alreadyProcessed: true,
          message:
            "Payment was already processed.",
          transaction:
            existingTransaction,
          delivery:
            existingDelivery,
        });
      }

      // -----------------------------------------------
      // Find book
      // -----------------------------------------------

      const book =
        await Book.findById(bookId);

      if (!book) {
        return res.status(404).json({
          success: false,
          message: "Book not found.",
        });
      }

      // -----------------------------------------------
      // Verify book owner
      // -----------------------------------------------

      if (
        !book.owner ||
        book.owner.toString() !==
          librarianId
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Book owner information is invalid.",
        });
      }

      // -----------------------------------------------
      // Book must still be available
      // -----------------------------------------------

      if (book.status !== "Published") {
        return res.status(400).json({
          success: false,
          message:
            "This book is no longer available.",
        });
      }

      // -----------------------------------------------
      // Verify Stripe amount
      // -----------------------------------------------

      const paidAmount =
        Number(
          paymentIntent.amount_received
        ) / 100;

      const bookFee =
        Number(book.deliveryFee);

      if (
        !Number.isFinite(paidAmount) ||
        paidAmount <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid payment amount.",
        });
      }

      if (
        Math.round(paidAmount * 100) !==
        Math.round(bookFee * 100)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Payment amount does not match the delivery fee.",
        });
      }

      // -----------------------------------------------
      // Create transaction
      // -----------------------------------------------

      const transaction =
        await Transaction.create({
          user: req.user.id,
          librarian: librarianId,
          book: bookId,

          amount: paidAmount,

          // Payment Intent ID is used as transaction ID
          transactionId:
            paymentIntent.id,

          paymentIntentId:
            paymentIntent.id,

          status: "completed",
        });

      // -----------------------------------------------
      // Create delivery
      // -----------------------------------------------

      const delivery =
        await Delivery.create({
          book: bookId,
          user: req.user.id,
          librarian: librarianId,

          transactionId:
            paymentIntent.id,

          deliveryFee: paidAmount,

          status: "Pending",
        });

      // -----------------------------------------------
      // Lock book
      // -----------------------------------------------

      book.status = "Checked Out";

      await book.save();

      // -----------------------------------------------
      // Populate delivery
      // -----------------------------------------------

      const populatedDelivery =
        await Delivery.findById(
          delivery._id
        )
          .populate(
            "book",
            "title author coverImage category deliveryFee status"
          )
          .populate(
            "user",
            "name email photoURL"
          )
          .populate(
            "librarian",
            "name email photoURL"
          );

      return res.status(201).json({
        success: true,

        message:
          "Payment successful. Delivery request created.",

        transaction,

        delivery:
          populatedDelivery,
      });
    } catch (error) {
      console.error(
        "CONFIRM PAYMENT ERROR:",
        error
      );

      // Mongo duplicate key
      if (error?.code === 11000) {
        const transaction =
          await Transaction.findOne({
            paymentIntentId:
              req.body?.paymentIntentId,
          });

        if (transaction) {
          const delivery =
            await Delivery.findOne({
              transactionId:
                transaction.transactionId,
            })
              .populate(
                "book",
                "title author coverImage category deliveryFee status"
              )
              .populate(
                "user",
                "name email photoURL"
              )
              .populate(
                "librarian",
                "name email photoURL"
              );

          return res.status(200).json({
            success: true,
            alreadyProcessed: true,
            message:
              "Payment was already processed.",
            transaction,
            delivery,
          });
        }
      }

      return res.status(500).json({
        success: false,
        message:
          error?.message ||
          "Failed to confirm payment.",
      });
    }
  }
);

// =====================================================
// USER DELIVERY HISTORY
// GET /api/deliveries/my-orders
// =====================================================

router.get(
  "/my-orders",
  verifyToken,
  async (req, res) => {
    try {
      const deliveries =
        await Delivery.find({
          user: req.user.id,
        })
          .populate(
            "book",
            "title author coverImage category deliveryFee status"
          )
          .populate(
            "librarian",
            "name email photoURL"
          )
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
        success: true,
        deliveries,
      });
    } catch (error) {
      console.error(
        "MY ORDERS ERROR:",
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
// USER DELIVERY HISTORY
// GET /api/deliveries/my-loans
//
// Backward compatible endpoint
// =====================================================

router.get(
  "/my-loans",
  verifyToken,
  async (req, res) => {
    try {
      const deliveries =
        await Delivery.find({
          user: req.user.id,
        })
          .populate(
            "book",
            "title author coverImage category deliveryFee status"
          )
          .populate(
            "librarian",
            "name email photoURL"
          )
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
        success: true,
        loans: deliveries,
        deliveries,
      });
    } catch (error) {
      console.error(
        "MY LOANS ERROR:",
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
// CHECK WHETHER USER CAN REVIEW
// GET /api/deliveries/check-delivery/:bookId
// =====================================================

router.get(
  "/check-delivery/:bookId",
  verifyToken,
  async (req, res) => {
    try {
      const delivery =
        await Delivery.findOne({
          book: req.params.bookId,
          user: req.user.id,
          status: "Delivered",
        });

      return res.status(200).json({
        success: true,
        canReview: Boolean(delivery),
      });
    } catch (error) {
      console.error(
        "CHECK DELIVERY ERROR:",
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
// LIBRARIAN DELIVERY LIST
// GET /api/deliveries/librarian
// =====================================================

router.get(
  "/librarian",
  verifyToken,
  verifyRole("librarian"),
  async (req, res) => {
    try {
      const deliveries =
        await Delivery.find({
          librarian: req.user.id,
        })
          .populate(
            "book",
            "title author coverImage category"
          )
          .populate(
            "user",
            "name email photoURL"
          )
          .sort({
            createdAt: -1,
          });

      return res.status(200).json({
        success: true,
        deliveries,
      });
    } catch (error) {
      console.error(
        "LIBRARIAN DELIVERY ERROR:",
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
// UPDATE DELIVERY STATUS
// PATCH /api/deliveries/:id/status
// =====================================================

router.patch(
  "/:id/status",
  verifyToken,
  verifyRole("librarian", "admin"),
  async (req, res) => {
    try {
      const { status } = req.body;

      const allowedStatuses = [
        "Pending",
        "Dispatched",
        "Delivered",
      ];

      if (
        !allowedStatuses.includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid delivery status.",
        });
      }

      const delivery =
        await Delivery.findById(
          req.params.id
        );

      if (!delivery) {
        return res.status(404).json({
          success: false,
          message:
            "Delivery not found.",
        });
      }

      // Librarian can only manage own deliveries
      if (
        req.user.role === "librarian" &&
        delivery.librarian.toString() !==
          req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can only manage deliveries for your own books.",
        });
      }

      const statusOrder = {
        Pending: 1,
        Dispatched: 2,
        Delivered: 3,
      };

      // Prevent going backwards
      if (
        statusOrder[status] <
        statusOrder[delivery.status]
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Delivery status cannot move backwards.",
        });
      }

      delivery.status = status;

      await delivery.save();

      // -----------------------------------------------
      // Delivered -> book available again
      // -----------------------------------------------

      if (status === "Delivered") {
        await Book.findByIdAndUpdate(
          delivery.book,
          {
            status: "Published",
          }
        );
      }

      const updatedDelivery =
        await Delivery.findById(
          delivery._id
        )
          .populate(
            "book",
            "title author coverImage category deliveryFee status"
          )
          .populate(
            "user",
            "name email photoURL"
          )
          .populate(
            "librarian",
            "name email photoURL"
          );

      return res.status(200).json({
        success: true,
        message:
          "Delivery status updated successfully.",
        delivery:
          updatedDelivery,
      });
    } catch (error) {
      console.error(
        "UPDATE DELIVERY STATUS ERROR:",
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