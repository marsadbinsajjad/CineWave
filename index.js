import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

// ==========================================================================
// 1. PostgreSQL Database Configuration
// ==========================================================================
const db = new pg.Pool({
  user: "postgres",
  host: "localhost",
  database: "movies/series",
  password: "0321", // ⚠️ Replace with your actual database password
  port: 5432,
});

db.connect()
  .then(() => console.log("⚡ Connected to PostgreSQL database successfully!"))
  .catch((err) => console.error("❌ Database connection error:", err.stack));

// ==========================================================================
// 2. Middleware
// ==========================================================================
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

// ==========================================================================
// 3. Application Routes
// ==========================================================================

// 📖 GET Homepage - Fetch and display all titles
app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM media ORDER BY id DESC;");
    res.render("index.ejs", { mediaList: result.rows });
  } catch (err) {
    console.error("Error fetching media list:", err);
    res.status(500).send("Server Error: Unable to fetch database records.");
  }
});

// ➕ GET Form to add a new movie or series
app.get("/new", (req, res) => {
  res.render("new.ejs");
});

// 💾 POST Insert a new movie or series into the database
app.post("/add", async (req, res) => {
  const { title, type, category, status, rating, notes } = req.body;

  try {
    await db.query(
      `INSERT INTO media (title, type, category, status, rating, notes) 
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [title, type, category, status, parseInt(rating, 10) || 5, notes]
    );
    res.redirect("/");
  } catch (err) {
    console.error("Error adding new item:", err);
    res.status(500).send("Server Error: Failed to save entry.");
  }
});

// 🔍 GET Form to edit an existing item
app.get("/edit/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    const result = await db.query("SELECT * FROM media WHERE id = $1;", [id]);

    if (result.rows.length > 0) {
      res.render("edit.ejs", { item: result.rows[0] });
    } else {
      res.redirect("/");
    }
  } catch (err) {
    console.error("Error finding item for edit:", err);
    res.redirect("/");
  }
});

// ✏️ POST Update an existing movie or series
app.post("/edit/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { title, type, category, status, rating, notes } = req.body;

  try {
    await db.query(
      `UPDATE media 
       SET title = $1, type = $2, category = $3, status = $4, rating = $5, notes = $6 
       WHERE id = $7;`,
      [title, type, category, status, parseInt(rating, 10) || 5, notes, id]
    );
    res.redirect("/");
  } catch (err) {
    console.error("Error updating item:", err);
    res.status(500).send("Server Error: Failed to update entry.");
  }
});

// 🗑️ POST Delete a title from the database
app.post("/delete/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);

  try {
    await db.query("DELETE FROM media WHERE id = $1;", [id]);
    res.redirect("/");
  } catch (err) {
    console.error("Error deleting item:", err);
    res.status(500).send("Server Error: Failed to delete entry.");
  }
});

// ==========================================================================
// 4. Server Initialization
// ==========================================================================
app.listen(port, () => {
  console.log(`🎬 CineWave server running smoothly at http://localhost:${port}`);
});