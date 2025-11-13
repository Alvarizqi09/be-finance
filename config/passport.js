const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

// Local Strategy (untuk email/password login)
passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email });
        if (!user) {
          return done(null, false, { message: "User not found" });
        }
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
          return done(null, false, { message: "Invalid password" });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL || "/api/v1/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Cari user berdasarkan googleId
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          return done(null, user);
        }

        // Jika user tidak ditemukan, cek berdasarkan email
        user = await User.findOne({ email: profile.emails?.[0]?.value });

        if (user) {
          // Update user dengan googleId
          user.googleId = profile.id;
          await user.save();
          return done(null, user);
        }

        // Buat user baru
        const newUser = await User.create({
          googleId: profile.id,
          fullName: profile.displayName,
          email: profile.emails?.[0]?.value,
          profileImageUrl: profile.photos?.[0]?.value,
          // Password tidak diperlukan untuk OAuth
        });

        return done(null, newUser);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Serialize & Deserialize
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;
