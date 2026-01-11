const mysql = require("mysql2");


const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "senior",
  connectionLimit: 100, 
  queueLimit: 0
});


module.exports = db;