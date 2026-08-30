const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  try {
    // =====================================================
    // Get token from cookie OR Authorization header
    // =====================================================

    let token = req.cookies?.token;

    // If cookie token is not available,
    // try Authorization: Bearer <token>
    if (!token) {
      const authHeader = req.headers.authorization;

      if (
        authHeader &&
        authHeader.startsWith("Bearer ")
      ) {
        token = authHeader.split(" ")[1];
      }
    }

    // =====================================================
    // No token
    // =====================================================

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Please login first.",
      });
    }

    // =====================================================
    // Verify JWT
    // =====================================================

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // =====================================================
    // Attach authenticated user to request
    // =====================================================

    req.user = decoded;

    next();
  } catch (error) {
    console.error(
      "JWT verification error:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message:
        "Unauthorized: Invalid or expired session.",
    });
  }
};

module.exports = {
  verifyToken,
};