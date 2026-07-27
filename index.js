import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import session from "express-session";
import passport from "passport";
import bcrypt from "bcrypt";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const saltRounds = 10;

// ==========================================================================
// 1. PostgreSQL Database Configuration
// ==========================================================================
const db = new pg.Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // Required for Railway Cloud DB
      }
    : {
        user: "postgres",
        host: "localhost",
        database: "movies/series",
        password: "0321",
        port: 5432,
      }
);

db.connect()
  .then(() => console.log("⚡ Connected to PostgreSQL database successfully!"))
  .catch((err) => console.error("❌ Database connection error:", err.message));

// ==========================================================================
// 2. Middleware & Session Setup
// ==========================================================================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(
  session({
    secret: process.env.SESSION_SECRET || "cinewave_secret_key_123",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day session
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Protect Routes Middleware
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect("/login");
}

// ==========================================================================
// 3. Passport Authentication Strategies
// ==========================================================================

// --- Local Strategy (Email & Password) ---
passport.use(
  "local",
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
      if (result.rows.length === 0) {
        return done(null, false, { message: "User not found." });
      }

      const user = result.rows[0];
      if (!user.password) {
        return done(null, false, { message: "Please log in using Google." });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (validPassword) {
        return done(null, user);
      } else {
        return done(null, false, { message: "Incorrect password." });
      }
    } catch (err) {
      return done(err);
    }
  })
);

// --- Google OAuth Strategy (Gmail) ---
passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "YOUR_GOOGLE_CLIENT_SECRET",
      callbackURL: process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/auth/google/callback`
        : "http://localhost:3000/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const result = await db.query("SELECT * FROM users WHERE google_id = $1", [
          profile.id,
        ]);

        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (email, name, google_id) VALUES ($1, $2, $3) RETURNING *",
            [profile.emails[0].value, profile.displayName, profile.id]
          );
          return done(null, newUser.rows[0]);
        } else {
          return done(null, result.rows[0]);
        }
      } catch (err) {
        return done(err);
      }
    }
  )
);

// --- Session Serialization ---
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err, null);
  }
});

// ==========================================================================
// 4. Application Routes
// ==========================================================================

// 📖 GET Homepage - Fetch and display ONLY the logged-in user's media
app.get("/", ensureAuthenticated, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM media WHERE user_id = $1 ORDER BY id DESC;",
      [req.user.id]
    );
    res.render("index.ejs", { mediaList: result.rows, user: req.user });
  } catch (err) {
    console.error("Error fetching media list:", err);
    res.status(500).send("Server Error: Unable to fetch database records.");
  }
});

// ➕ GET Form to add a new movie or series
app.get("/new", ensureAuthenticated, (req, res) => {
  res.render("new.ejs", { user: req.user });
});

// 💾 POST Insert a new movie or series linked to the user
app.post("/add", ensureAuthenticated, async (req, res) => {
  const { title, type, category, status, rating, notes } = req.body;

  try {
    await db.query(
      `INSERT INTO media (title, type, category, status, rating, notes, user_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7);`,
      [title, type, category, status, parseInt(rating, 10) || 5, notes, req.user.id]
    );
    res.redirect("/");
  } catch (err) {
    console.error("Error adding new item:", err);
    res.status(500).send("Server Error: Failed to save entry.");
  }
});

// 🔍 GET Form to edit an existing item (Only owned items)
app.get("/edit/:id", ensureAuthenticated, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const result = await db.query(
      "SELECT * FROM media WHERE id = $1 AND user_id = $2;",
      [id, req.user.id]
    );

    if (result.rows.length > 0) {
      res.render("edit.ejs", { item: result.rows[0], user: req.user });
    } else {
      res.redirect("/");
    }
  } catch (err) {
    console.error("Error finding item for edit:", err);
    res.redirect("/");
  }
});

// ✏️ POST Update an existing movie or series (Only owned items)
app.post("/edit/:id", ensureAuthenticated, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, type, category, status, rating, notes } = req.body;

  try {
    await db.query(
      `UPDATE media 
       SET title = $1, type = $2, category = $3, status = $4, rating = $5, notes = $6 
       WHERE id = $7 AND user_id = $8;`,
      [title, type, category, status, parseInt(rating, 10) || 5, notes, id, req.user.id]
    );
    res.redirect("/");
  } catch (err) {
    console.error("Error updating item:", err);
    res.status(500).send("Server Error: Failed to update entry.");
  }
});

// 🗑️ POST Delete a title (Only owned items)
app.post("/delete/:id", ensureAuthenticated, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    await db.query("DELETE FROM media WHERE id = $1 AND user_id = $2;", [
      id,
      req.user.id,
    ]);
    res.redirect("/");
  } catch (err) {
    console.error("Error deleting item:", err);
    res.status(500).send("Server Error: Failed to delete entry.");
  }
});

// ==========================================================================
// 5. Auth Routes (Login, Register, Logout, Google)
// ==========================================================================

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.post("/register", async (req, res, next) => {
  const { email, password, name } = req.body;
  try {
    const checkUser = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (checkUser.rows.length > 0) {
      return res.send("Email already registered. Please log in.");
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const newUser = await db.query(
      "INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING *",
      [email, hashedPassword, name]
    );

    req.login(newUser.rows[0], (err) => {
      if (err) return next(err);
      res.redirect("/");
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).send("Error creating account");
  }
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login",
  })
);

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/");
  }
);

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/login");
  });
});

// ==========================================================================
// 6. Server Initialization
// ==========================================================================
app.listen(port, "0.0.0.0", () => {
  console.log(`🎬 CineWave server running smoothly on port ${port}`);
});