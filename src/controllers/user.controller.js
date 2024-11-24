import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/fileUpload.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

const registerUser = asyncHandler( async (req, res) => {
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

const loginUser = asyncHandler( async (req, res) => {
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

const logoutUser = asyncHandler( async (req, res) => {
    // challenge: to get user id

    await User.findByIdAndUpdate(
        req.user._id,
        {
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

export {
    registerUser,
    loginUser,
    logoutUser
}