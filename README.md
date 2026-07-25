# 🎬 CineWave — Movie & TV Series Tracker

**CineWave** is a dynamic web application built to help users keep track of their favorite movies and TV shows, manage watchlists, record ratings, and organize media seamlessly.

---

## ✨ Features

* 📺 **Track Movies & Series:** Easily add, edit, and delete entries from your watch history.
* 📊 **Ratings & Categories:** Categorize content, assign star ratings, and take detailed notes.
* ⚡ **PostgreSQL Integration:** Powered by PostgreSQL database for fast data persistence.
* 🚀 **Cloud Deployed:** Production-ready deployment configuration for Railway.
* 🎨 **Responsive UI:** Clean, modern interface designed for mobile and desktop viewing.

---

## 🛠️ Tech Stack

* **Frontend:** EJS (Embedded JavaScript Templates), HTML5, CSS3, JavaScript
* **Backend:** Node.js, Express.js
* **Database:** PostgreSQL (`pg` library)
* **Hosting / Deployment:** Railway & GitHub

---

## 📂 Project Structure

```text
movies-and-series/
├── public/
│   ├── favicon.png          # Website tab icon
│   └── styles/              # Custom CSS stylesheets
├── views/
│   ├── partials/            # Header and footer EJS components
│   ├── index.ejs            # Main dashboard view
│   └── add.ejs              # Add/edit entry form
├── index.js                 # Express server & database logic
├── package.json             # Project dependencies & scripts
└── README.md                # Project documentation

## How to use

🚀 Quick Start (Local Setup)
1. Prerequisites
Ensure you have the following installed on your system:

Node.js (v18 or higher)

PostgreSQL

2. Clone the Repository
Bash
git clone [https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME.git](https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME.git)
cd YOUR_REPOSITORY_NAME
3. Install Dependencies
Bash
npm install
4. Configure Database
Create a PostgreSQL database on your local machine and run the following table initialization script:

SQL
CREATE TABLE media (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('Movie', 'Series')),
    category VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('Watched', 'Not Watched')),
    rating INT CHECK (rating >= 1 AND rating <= 5) DEFAULT 5,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
5. Set Environment Variables
Create a .env file in the root directory (or configure local environment variables):

Code snippet
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/YOUR_DB_NAME
6. Run the Application
Bash
# Start server with Nodemon / Node
npm start
Visit http://localhost:3000 in your browser.

☁️ Deployment on Railway
Push your latest code to your GitHub repository.

Connect your GitHub repository to Railway.app.

Provision a PostgreSQL Database plugin in your Railway project canvas.

Reference the DATABASE_URL variable under your Web Service's Variables tab:

Plaintext
DATABASE_URL = ${{Postgres.DATABASE_URL}}
Run the database migration script in Railway's PostgreSQL Data/Query tab.

📝 License
This project is open-source and available under the MIT License.
