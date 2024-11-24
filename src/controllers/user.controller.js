import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/fileUpload.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken = async (userId) =>{
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false})    // set to false otherwise password will be required

        return {accessToken, refreshToken};

    } catch (error) {
        throw new ApiError(500, "something went wrong while generating access and refresh token");
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // Steps:
    // 1) get user details from frontend
    // 2) validation: - input fields should not be empty
    // 3) check if user already exists: username, email
    // 4) check for avatar(required) and cover image
    // 5) upload them to cloudinary
    // 6) create user object - create entry in db
    // 7) check if user is created successfully
    // 8) remove password and refresh token field from response
    // 9) return response


    // 1) get user details from frontend
    const {fullname, email, username, password} = req.body
    // console.log("email: ", email);
    console.log("req.files:", req.files);
    console.log("req.body:", req.body);


    // 2) validation: - input fields should not be empty
    // if(fullname === ""){
    //     throw new ApiError(400, "fullname cannot be empty")
    // }

    if([fullname, email, username, password].some((field) => field?.trim() === "")){
        throw new ApiError(400, "all fields are required")
    }


    // 3) check if user already exists: username, email
    const existingUser = await User.findOne({
        $or: [{username}, {email}]
    })

    if(existingUser){
        throw new ApiError(409, "user with this username or email already exists")
    }

    // 4) check for avatar(required) and images

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required")
    }

    // 5) upload imgaes on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    let coverImage = null;
    if(coverImageLocalPath){
        coverImage = await uploadOnCloudinary(coverImageLocalPath);  // doubt: should check if coverImageLocalPath exists
    }

    if(!avatar){
        throw new ApiError(400, "Avatar is required")
    }

    // 6) create user object - create entry in db
    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    // 7,8) check if user is created successfully and if created then remove password and refresh token field from response
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if(!createdUser){
        throw new ApiError(500, "something went wrong while registering the user")
    }

    // 9) return response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "user registered successfully")
    )
})

const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    // username or email
    // find the user
    // password check
    // access and refresh token
    // send cookie

    const {email, username, password} = req.body;

    if(!(username || email)){
        throw new ApiError(400, "username or email is required");
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "user does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401, "incorrect password");
    }

    const {accessToken, refreshToken} =  await generateAccessAndRefreshToken(user._id);

    // this approach is costly (as we are querying the db) but simple and easy
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    // user.refreshToken = refreshToken;
    // await user.save({validateBeforeSave: false});

    // cookies
    const options = {
        httpOnly: true,
        secure: true,
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,
                accessToken,
                refreshToken
            },
            "user logged in successfully"
        )
    )
})

const logoutUser = asyncHandler(async (req, res) => {
    // challenge: to get user id

    await User.findByIdAndUpdate(
        req.user._id,
        {
            // may give error while testing , so set to null or use $unset method
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "user logged out successfully")
    )
})

const refreshAccessToken = asyncHandler(async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
        if(!incomingRefreshToken){
            throw new ApiError(401, "unauthorized request");
        }
    
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id);
    
        if(!user){
            throw new ApiError(401, "Invalid Refresh Token");
        }
    
        if(incomingRefreshToken !== user.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const {newRefreshToken, newAccessToken} = await generateAccessAndRefreshToken(user._id);
        
        const options = {
            httpOnly: true,
            secure: true
        }
        
        return res
        .status(200)
        .cookie("accessToken", newAccessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken: newAccessToken, refreshToken: newRefreshToken},
                "Access Token refreshed successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token")
    }

})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const {oldPassword, newPassword} = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordValid = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordValid){
        throw new ApiError(401, "Incorrect old password");
    }

    user.password = newPassword;

    await user.save({validateBeforeSave: false});  // password will be encrypted before saving as we have implemented that functionality as a hook in user model

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed successfully"))
})

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            req.user,
            "current user fetched successfully"
        )
    )
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullname, email} = req.body;

    if(!fullname && !email){
        throw new ApiError(400, "fullname or email is required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname: fullname,
                email: email
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))

})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    const newAvatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(400, "error while uploading avatar on cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $ser: {
                avatar: newAvatar.url
            }
        },
        {new: true}
    ).select("-password -refreshToken")

    // TODO: delete old image from cloudinary (same for cover image also)

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "avatar updated successfully")
    )
})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "Cover Image file is missing")
    }

    const newCoverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!newCoverImage.url){
        throw new ApiError(400, "error while uploading cover image on cloudinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $ser: {
                coverImage: newCoverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "cover image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const {username} = req.params
    
    if(!username?.trim()){
        throw new ApiError(400, "username is missing")
    }

    // Perform aggregation on the User collection
    const channel = await User.aggregate([
        // Stage 1: Filter the user by the provided username (to get _id of the target user)
        {
            $match: {
                username: username?.toLowerCase()   // Match username (case-insensitive, converted to lowercase)
            }
        },
        // Stage 2: Find all subscribers of the target user
        {
            $lookup: {
                // note: current(local) collection is 'User' and foreign collection is 'subscriptions'
                from: "subscriptions",   // in mongodb "Subscription" becomes "subscriptions" i.e. lowercase and plural
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"   // Save the result as `subscribers` array
            }
        },
         // Stage 3: Find all channels that the target user has subscribed to
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        // Stage 4: Add calculated fields
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"   // Count the size of the `subscribers` array
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"  // Count the size of the `subscribedTo` array
                },
                isSubscribed: {
                    $condition: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},  // Check if current user's _id exists in target user's `subscribers.subscriber`
                        then: true,
                        else: false
                    }
                }
            }
        },
        // Stage 5: Select only the fields needed for the response
        {
            $project: {
                fullname: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "channel does not exist")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "channel info fetched successfully")
    )
})

const getUserWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
                // cannot directly write req.user._id bcz monogdb _id is like _id: Object('6742cb90263e8b226bf57e20) which is a string
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getUserWatchHistory
}

