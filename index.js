const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const connectDB = require("./config/db");

const app = express();

const PORT = process.env.PORT || 5000;

// ==============================
// DATABASE
// ==============================

connectDB();

// ==============================
// CORS
// ==============================

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Postman / server-to-server requests
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    credentials: true,
  })
);

// ==============================
// BODY PARSER
// ==============================

app.use(express.json());

// ==============================
// COOKIE
// ==============================

app.use(cookieParser());

// ==============================
// ROUTES
// ==============================

app.use(
  "/api/auth",
  require("./routes/authRoutes")
);

app.use(
  "/api/books",
  require("./routes/bookRoutes")
);

app.use(
  "/api/deliveries",
  require("./routes/deliveryRoutes")
);

app.use(
  "/api/reviews",
  require("./routes/reviewRoutes")
);

app.use(
  "/api/librarian",
  require("./routes/librarianRoutes")
);

app.use(
  "/api/admin",
  require("./routes/adminRoutes")
);

// ==============================
// HEALTH CHECK
// ==============================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "BiblioDrop Server is running smoothly 🚀",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API is healthy.",
    timestamp: new Date().toISOString(),
  });
});

// ==============================
// 404
// ==============================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ==============================
// GLOBAL ERROR HANDLER
// ==============================

app.use((err, req, res, next) => {
  console.error("Global Error:", err);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "CORS policy blocked this request.",
    });
  }

  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error."
        : err.message,
  });
});

// ==============================
// START SERVER
// ==============================

app.listen(PORT, () => {
  console.log(
    `BiblioDrop server running on port ${PORT}`
  );
});