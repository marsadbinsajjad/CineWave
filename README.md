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
