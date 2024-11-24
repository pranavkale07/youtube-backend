import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import jwt from "jsonwebtoken"

export const verifyJWT = asyncHandler(async (req, _, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
    
        if(!token){
            throw new ApiError(401, "unauthorized request");
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
    
        if(!user){
            // TODO: discuss about frontend
            throw new ApiError(401, "Invalid Access Token");
        }
    
        req.user = user;  // add this user as a field in the req body so that logoutUser can access the user from req body
    
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Access Token");
    }
})