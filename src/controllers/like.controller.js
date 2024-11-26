import { asyncHandler } from "../utils/asyncHandler.js"
import { Like } from "../models/like.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params

    const userId = req.user?._id; // Assuming user info is available via middleware (e.g., JWT)
    if (!userId) {
        throw new ApiError(401, "Unauthorized");
    }

    // Check if video exists
    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Check if the user has already liked the video
    const existingLike = await Like.findOne({ video: videoId, likedBy: userId });

    if (existingLike) {
        // If the like exists, remove it (unlike the video)
        await Like.deleteOne({ _id: existingLike._id });
        // return res.status(200).json(
        //     new ApiResponse(200, { isLiked: false }, "Like removed successfully")
        // );
    }
    else {
        // If no like exists, create a new like (like the video)
        const newLike = await Like.create({
            video: videoId,
            likedBy: userId,
        });
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {
                videoId,
                userId,
                likeStatus: !existingLike
            },
            "Like toggeled successfully"
        )
    )

})

export { toggleVideoLike }