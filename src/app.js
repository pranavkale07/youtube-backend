import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser";

const app = express();  

// app.use(cors());  // mostly enough but can configure options
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"}));
app.use(express.urlencoded({extended: true, limit: "16kb"}));
app.use(express.static("public"))

app.use(cookieParser())

export { app }