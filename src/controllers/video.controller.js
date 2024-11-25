import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { uploadOnCloudinary } from "../utils/uploadOnCloudinary.js";
import { deleteFromCloudinary } from "../utils/deleteFromCloudinary.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose from "mongoose";
import jwt from "jsonwebtoken"

const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query = "", sortBy = "createdAt", sortType = -1, userId } = req.query;

    // Parse `page` and `limit` as integers
    const currentPage = parseInt(page, 10);
    const pageSize = parseInt(limit, 10);

    const match = { isPublished: true }; // Only include published videos
    if (query && query.trim()) {
        match.$or = [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } },
        ];
    }

    const videos = await Video.aggregate([
        { 
            $match: match 
        },
        { 
            $sort: { 
                [sortBy]: sortType === "asc" ? 1 : -1 
            } 
        },
        { 
            $skip: (currentPage  - 1) * pageSize 
        },
        { 
            $limit: pageSize 
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    { 
                        $project: { 
                            avatar: 1, 
                            username: 1, 
                            fullName: 1 
                        } 
                    },
                ],
            },
        },
        {
            $project: {
                videoFile: 1,
                thumbnail: 1,
                owner: { 
                    $arrayElemAt: ["$owner", 0] 
                }, // Flatten the owner array
                title: 1,
                description: 1,
                views: 1,
                duration: 1,
            },
        },
    ]);

    res.status(200).json({
        success: true,
        data: videos,
        pagination: {
            currentPage: currentPage,
            pageSize,
        },
    });
})

const publishVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    
    if (!title || !description) {
        throw new ApiError(400, "Title and description are required.");
    }
    
    const {videoFile, thumbnail} = req.files;
    
    if (!videoFile || !thumbnail) {
        throw new ApiError(400, "Both video and thumbnail files are required.");
    }
    
    try {
        const videoUploadResult = await uploadOnCloudinary(videoFile[0].path)
        const thumbnailUploadResult = await uploadOnCloudinary(thumbnail[0].path)

        console.log(videoUploadResult);
        console.log(thumbnailUploadResult);
    
        if (!videoUploadResult || !videoUploadResult.duration) {
            throw new ApiError(400, "Failed to upload video or retrieve video metadata.");
        }
    
        const video = new Video({
            title: title,
            description: description,
            duration: videoUploadResult.duration, // Set duration from Cloudinary response
            videoFile: videoUploadResult.secure_url, // Store the Cloudinary URL for video
            thumbnail: thumbnailUploadResult.secure_url, // Store the Cloudinary URL for thumbnail
            owner: req.user._id, // Assuming the user is authenticated and `req.user` exists
        });
    
        // Save the video in the database
        await video.save();
    
        // Return the response with the created video details
        return res.status(201).json(
            new ApiResponse(201, video, "Video published successfully.")
        );
    } catch (error) {
        throw new ApiError(500, "something went wrong")
    }
})

// when user clicks on a video to view it (this controller is 'getVideoById' in original codebase)
const watchVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    
    if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "Invalid video ID provided");
    }

    const video = await Video.aggregate(
        [
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(videoId) // Convert string to ObjectId
                }
            },

            {
                $lookup: {
                    from: "likes",
                    localField: "_id",
                    foreignField: "video",
                    as: "likes"
                },
            },

            {
                $addFields: {
                    likesCount: {
                        $size: "$likes"
                    },

                    isLiked: {
                        $cond: {
                            if: {$in: [req.user?._id, "$likes.likedBy"]},
                            then: true,
                            else: false,
                        }
                    }
                }
            },

            {
                $lookup: {
                    from: "users",
                    foreignField: "_id",
                    localField: "owner",
                    as: "owner",
                    pipeline: [
                        {
                            $lookup: {
                                from: "subscriptions",
                                foreignField: "channel",
                                localField: "_id",
                                as: "subscribers"
                            }
                        },

                        {
                            $addFields: {
                                subscriberCount: {
                                    $size: "$subscribers"
                                },

                                isSubscribed: {
                                    $cond: {
                                        if: {$in : [req.user?._id, "$subscribers.subscriber"]},
                                        then: true,
                                        else: false
                                    }
                                }
                            }
                        },

                        {
                            $project: {
                                fullName: 1,
                                username: 1,
                                avatar: 1,
                                subscriberCount: 1,
                                isSubscribed: 1,
                            },
                        }
                    ]
                },


            },

            {
                $lookup: {
                    from: "comments",
                    foreignField: "video",
                    localField: "_id",
                    as: "comments"
                }
            },

            {
                $project: {
                    videoFile: 1,
                    thumbnail: 1,
                    title: 1,
                    description: 1,
                    duration: 1,
                    views: 1,
                    owner: 1,
                    createdAt: 1,
                    comments: 1,
                    likesCount: 1,
                    isLiked: 1,
                }
            }
        ]
    );

    if (req.user) {
        const user = await User.findById(req.user._id);
        if (user) {
            // Add the video to the watch history if it's not already present
            if (!user.watchHistory.includes(videoId)) {
                user.watchHistory.push(videoId);
                await user.save();
            }
        }
    }

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video fetched successfully"));

    // SHORTER AND SIMPLER ALTERNATIVE
    // Find the video by ID and update the views
    // const video = await Video.findOneAndUpdate(
    //     { _id: new mongoose.Types.ObjectId(videoId) },
    //     { $inc: { views: 1 } }, // Increment the views count by 1
    //     { new: true } // Ensure that the updated document is returned
    // )
    // .populate('owner', 'fullName userName avatar') // Populate the user info
    // .exec();
    // // .populate('subscribers', 'subscriber') // Populate subscribers

    // // If no video found, return an error
    // if (!video) {
    //     return res.status(404).json({
    //         success: false,
    //         message: "Video not found",
    //     });
    // }

    // // Get the total number of subscribers and subscription status
    // // const totalSubscribers = video.subscribers.length;
    // // const isSubscribed = video.subscribers.some(subscriber => subscriber.subscriber.toString() === req.user._id.toString());

    // // Send the response with the updated video data
    // return res.status(200).json({
    //     success: true,
    //     statusCode: 200,
    //     message: "Video fetched successfully",
    //     data: {
    //         _id: video._id,
    //         videoFile: video.videoFile,
    //         thumbnail: video.thumbnail,
    //         title: video.title,
    //         views: video.views,
    //         uploadedBy: {
    //             fullName: video.owner.fullName,
    //             userName: video.owner.userName,
    //             avatar: video.owner.avatar
    //         },
    //         // totalSubscribers,
    //         // isSubscribed
    //     }
    // });

})

const updateVideoDetails = asyncHandler(async (req, res) => {
    //TODO: update video details like title, description, thumbnail
    const { videoId } = req.params
    const { title, description, thumbnail, videoFile } = req.body;

    if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
        throw new ApiError(400, "Invalid video ID provided");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "video not found")
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiErrors(403, "You are not authorized to update this video");
    }

    // Create an object with the fields to update dynamically
    const updatedVideoData = {};
    if (title) updatedVideoData.title = title;
    if (description) updatedVideoData.description = description;
    // If thumbnail is provided, upload it to Cloudinary
    if (req.file) { // Multer stores the uploaded file in `req.file`
        try {
            const uploadedThumbnail = await uploadOnCloudinary(req.file.path);
            updatedVideoData.thumbnail = uploadedThumbnail.secure_url; // Get the secure URL of the uploaded image
        } catch (err) {
            throw new ApiError(500, "Failed to upload thumbnail");
        }
    }

    // Update the video document with the new data
    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        updatedVideoData,
        { new: true }  // This returns the updated video
    );

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            updatedVideo,
            "video data updated successfully"
        )
    )

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    // Check if video ID is provided and valid
    if (!videoId || !mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // Find video by ID
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Extract the Cloudinary URLs for the video file and thumbnail
    const videoFileUrl = video.videoFile;  // URL of the video file on Cloudinary
    const thumbnailUrl = video.thumbnail;  // URL of the thumbnail on Cloudinary

    // Debugging logs
    console.log("Video File URL:", videoFileUrl);
    console.log("Thumbnail URL:", thumbnailUrl);

    let videoDeletionSuccess = false
    let thumbnailDeletionSuccess = false
    if (videoFileUrl) {
        console.log("Deleting video file from Cloudinary...");
        videoDeletionSuccess = await deleteFromCloudinary(videoFileUrl);  // Delete the video file
        // console.log(videoDeletionSuccess)
    }

    if (thumbnailUrl) {
        console.log("Deleting thumbnail from Cloudinary...");
        thumbnailDeletionSuccess = await deleteFromCloudinary(thumbnailUrl);  // Delete the thumbnail
        // console.log(thumbnailDeletionSuccess)
    }

    // If either deletion failed, don't proceed with deleting the database record
    if (!videoDeletionSuccess || !thumbnailDeletionSuccess) {
        throw new ApiError(500, "Failed to delete files from Cloudinary");
    }

    // Now delete the video document from the database
    const deletedVideo = await Video.findByIdAndDelete(videoId);

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {
                videoId,
                videoDeleted: true,
                thumbnailDeleted: thumbnailDeletionSuccess,
                videoFileDeleted: videoDeletionSuccess,
                deletedVideoDetails: deletedVideo // Include deleted video details if needed
            },
            "deleted the video successfully"
        )
    )
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    // Check if video ID is provided and valid
    if (!videoId || !mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // Find the video by ID
    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiErrors(403, "You are not authorized to update this video");
    }

    // Toggle the publish status
    video.isPublished = !video.isPublished;

    // Save the updated video document
    await video.save();

    return res.status(200).json({
        success: true,
        message: `Video publish status toggled to ${video.isPublished ? 'published' : 'unpublished'}`,
        data: {
            videoId: video._id,
            isPublished: video.isPublished
        }
    });
})

export {
    getAllVideos,
    publishVideo,
    watchVideo,
    updateVideoDetails,
    deleteVideo,
    togglePublishStatus
}