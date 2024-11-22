import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/fileUpload.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler( async (req, res) =>{
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
    const {fullName, email, username, password} = req.body
    console.log("email: ", email);

    // 2) validation: - input fields should not be empty
    // if(fullName === ""){
    //     throw new ApiError(400, "fullname cannot be empty")
    // }

    if([fullName, email, username, password].some((field) => field?.trim() === "")){
        throw new ApiError(400, "all fields are required")
    }


    // 3) check if user already exists: username, email
    const existingUser = User.findOne({
        $or: [{username}, {email}]
    })

    if(existingUser){
        throw new ApiError(409, "user with this username or email already exists")
    }

    // 4) check for avatar(required) and images

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required")
    }

    // 5) upload imgaes on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);  // doubt: should check if coverImageLocalPath exists

    if(!avatar){
        throw new ApiError(400, "Avatar is required")
    }

    // 6) create user object - create entry in db
    const user = await User.create({
        fullName,
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

export {registerUser}