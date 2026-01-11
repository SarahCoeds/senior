import express from "express";
import mysql from "mysql";
import cors from "cors";


const db =mysql.createConnection({
    host:"localhost", 
    user: "root",
    password:"",
    database:"liu",
});


app.get("/students",(req, res)=>{
    const q=
    "SELECT StdId, Fname, Lname, Email, Description, Address FROM students"
    db.query(q, (err, data)=>{
        if(err){
            console.log("You have an Error")

        }
    })
}
)