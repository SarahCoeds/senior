import express from "express";
import mysql from "mysql";
import cors from "cors";


const db =mysql.createConnection({
    host:"localhost", 
    user: "root",
    password:"",
    database:"liu",
});

//create api to get all student records

app.get("/students",(req, res)=>{
    const q=
    "SELECT StdId, Fname, Lname, Email, Description, Address FROM students"
    db.query(q, (err, data)=>{
        if(err){
            console.log("You have an Error")

        }
    })
}

//const express = require('express');
//const app = express();

//const port = 3000;

//app.listen(port, ()=> {
  //  console.log(`Server is running at http://localhost:${port}`);
//});