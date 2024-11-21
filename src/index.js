// require("dotenv").config({path: "./env"});     // this is on first line bcz env var should be loaded at first
// this syntax conflicts our ES6 style of code and thus reduces consistency

import dotenv from "dotenv";
dotenv.config({path: "./.env"});
import connectDB from "./db/index.js";
import { app } from "./app.js";

const serverPORT = process.env.PORT || 8000;

connectDB()
.then(() => {
    app.on("error", (err) => {
        console.error("App listening error!! ", err);
        exit(1);
    })
    app.listen(serverPORT, () => {
        console.log(`Server is listening at port ${serverPORT}`)
    })
})
.catch((err) => {
    console.error("MongoDB connection failed! ", err);
})










/*
    // This approach is good but not MODULAR
import express from "express";
const app = express();

;( async () => {
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)

        app.on("error", (error) => {
            console.error("ERROR: ", error);
            throw error;
        })

        app.listen(process.env.PORT, () => {
            console.log(`Application is listening on PORT ${process.env.PORT}`)
        })

    } catch (error) {
        console.error("ERROR: ", error);
        throw error;
    }
})()

 */