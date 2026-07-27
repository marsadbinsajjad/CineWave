import express from 'express';
import bodyParser from 'body-parser';
import pg from 'pg';
import bcrypt from 'bcrypt';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const saltRounds = 10;

// PostgreSQL Connection Pool Setup
const db = new pg.Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

db.connect()
  .then(() => console.log("⚡ Connected to PostgreSQL database successfully!"))
  .catch(err => console.error("Database connection error:", err));

// Configure PG Session Store
const PgSession = connectPgSimple(session);

// Express Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Session Setup
app.use(
  session({
    store: new PgSession({
      pool: db,
      tableName: 'user_sessions',
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Authentication Middleware to Protect Routes
function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}

// Global User Variable for EJS Views
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  next();
});

// ==========================================
// 1. PASSPORT CONFIGURATION
// ==========================================

// Local Auth Strategy
passport.use(
  'local',
  new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
    try {
      const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return done(null, false, { message: 'User not found.' });
      }

      const user = result.rows[0];

      if (!user.password) {
        return done(null, false, { message: 'Please log in using Google.' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (validPassword) {
        return done(null, user);
      } else {
        return done(null, false, { message: 'Incorrect password.' });
      }
    } catch (err) {
      return done(err);
    }
  })
);

// Google OAuth Strategy
passport.use(
  'google',
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const googleId = profile.id;

        const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
          // Register new Google user
          const newUser = await db.query(
            'INSERT INTO users (name, email, google_id) VALUES ($1, $2, $3) RETURNING *',
            [name, email, googleId]
          );
          return done(null, newUser.rows[0]);
        } else {
          // Update google_id if existing account used password previously
          if (!result.rows[0].google_id) {
            await db.query('UPDATE users SET google_id = $1 WHERE email = $2', [googleId, email]);
          }
          return done(null, result.rows[0]);
        }
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query('SELECT id, name, email FROM users WHERE id = $1', [id]);
    done(null, result.rows[0]);
  } catch (err) {
    done(err, null);
  }
});

// ==========================================
// 2. AUTHENTICATION ROUTES
// ==========================================

// GET Login Page
app.get('/login', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/');
  res.render('login');
});

// GET Register Page
app.get('/register', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/');
  res.render('register');
});

// POST Register Action
app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const checkResult = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (checkResult.rows.length > 0) {
      return res.redirect('/login');
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await db.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING *',
      [name, email, hashedPassword]
    );

    const user = result.rows[0];
    req.login(user, (err) => {
      if (err) return res.redirect('/login');
      return res.redirect('/');
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.redirect('/register');
  }
});

// POST Login Action
app.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
  })
);

// Google Auth Trigger
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google Auth Callback
app.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    successRedirect: '/',
    failureRedirect: '/login',
  })
);

// Logout Action
app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/login');
  });
});

// ==========================================
// 3. MEDIA WATCHLIST CRUD ROUTES
// ==========================================

// GET Main Dashboard (Watchlist)
app.get('/', checkAuthenticated, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM media WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.render('index', { mediaList: result.rows });
  } catch (err) {
    console.error("Error fetching media list:", err);
    res.render('index', { mediaList: [] });
  }
});

// GET Add New Item Page
app.get('/new', checkAuthenticated, (req, res) => {
  res.render('new');
});

// POST Create New Item Action
// POST Create New Item Action
app.post('/add', checkAuthenticated, async (req, res) => {
  const { title, type, category, status, rating, notes } = req.body;

  // Ensure rating defaults to a valid integer (1-5)
  const parsedRating = rating ? parseInt(rating, 10) : 5;

  try {
    await db.query(
      'INSERT INTO media (user_id, title, type, category, status, rating, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.id, title, type, category, status, parsedRating, notes || '']
    );
    
    // Successfully inserted — redirect to main dashboard grid
    res.redirect('/');
  } catch (err) {
    console.error("❌ Database error while adding item:", err.message);
    res.redirect('/new');
  }
});

// GET Edit Item Page
app.get('/edit/:id', checkAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'SELECT * FROM media WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.redirect('/');
    }

    res.render('edit', { item: result.rows[0] });
  } catch (err) {
    console.error("Error fetching item for edit:", err);
    res.redirect('/');
  }
});

// POST Update Item Action
// POST Update Item Action
app.post('/edit/:id', checkAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { title, type, category, status, rating, notes } = req.body;

  // Ensure values are properly formatted
  const parsedId = parseInt(id, 10);
  const parsedRating = rating ? parseInt(rating, 10) : 1;

  try {
    const result = await db.query(
      'UPDATE media SET title = $1, type = $2, category = $3, status = $4, rating = $5, notes = $6 WHERE id = $7 AND user_id = $8',
      [title, type, category, status, parsedRating, notes || '', parsedId, req.user.id]
    );

    if (result.rowCount === 0) {
      console.warn(`⚠️ No item updated. Check if media ID ${parsedId} belongs to user ID ${req.user.id}`);
    }

    res.redirect('/');
  } catch (err) {
    console.error("❌ Error updating item:", err.message);
    res.redirect('/');
  }
});
// POST Delete Item Action
app.post('/delete/:id', checkAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM media WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.redirect('/');
  } catch (err) {
    console.error("Error deleting item:", err);
    res.redirect('/');
  }
});

// ==========================================
// 4. SERVER START
// ==========================================
app.listen(port, () => {
  console.log(`🎬 CineWave server running smoothly on port ${port}`);
});