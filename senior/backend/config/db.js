const mysql = require("mysql2");

// Use createPool instead of createConnection
const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "senior",
  connectionLimit: 10, // Allows multiple simultaneous users
  queueLimit: 0
});

// For pools, we don't need db.connect(), it handles it automatically.
module.exports = db;