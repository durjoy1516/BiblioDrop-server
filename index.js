const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();
const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 5000;

// Connect Database
connectDB();

// Allowed Origins List
const allowedOrigins = [
  "http://localhost:3000",
  "http://192.168.0.100:3000",
  process.env.CLIENT_URL,
].filter(Boolean);

// Middlewares
app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(null, true); // Dev-mode override to prevent CORS blockage
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/books", require("./routes/bookRoutes"));
app.use("/api/deliveries", require("./routes/deliveryRoutes"));
app.use("/api/reviews", require("./routes/reviewRoutes"));

app.get("/", (req, res) => {
  res.send("BiblioDrop Server running smoothly 🚀");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));