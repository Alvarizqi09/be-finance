const express = require("express");
const passport = require("passport");
const { protect } = require("../middleware/authMiddleware");
const {
  registerUser,
  loginUser,
  getUserInfo,
  googleCallback,
} = require("../controllers/authController");
const upload = require("../middleware/uploadMiddleware");

const router = express.Router();
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/getUser", protect, getUserInfo);

// Google OAuth routes
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  googleCallback
);

// Cloudinary setup
const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.post("/upload-image", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  try {
    const result = await cloudinary.uploader.upload_stream(
      { resource_type: "image", folder: "be-finance-profile" },
      (error, result) => {
        if (error) {
          return res
            .status(500)
            .json({ message: "Cloudinary upload error", error });
        }
        res.status(200).json({
          imageUrl: result.secure_url,
          message: "Image uploaded successfully",
        });
      }
    );
    result.end(req.file.buffer);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
});

module.exports = router;
