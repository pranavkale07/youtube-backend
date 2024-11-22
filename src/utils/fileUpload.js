import {v2 as cloudinary} from "cloudinary";
import fs from "fs";

// console.log("Cloudinary Configuration:", {
//     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//     api_key: process.env.CLOUDINARY_API_KEY,
//     api_secret: process.env.CLOUDINARY_API_SECRET,
//     PORT: process.env.PORT
// });

// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath){
            throw new Error("Local file path is required to upload to Cloudinary");
        }

        // upload file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        console.log("file successfully uploaded on cloudinary. ", response.url);
        fs.unlinkSync(localFilePath);
        return response;

        // now unlink/delete
    } catch (error) {
        fs.unlinkSync(localFilePath); // remove the locally saved temp file as the upload operation got failed
        console.error("failed to upload on cloudinary ", error);
        return null;
    }
}

export {uploadOnCloudinary};
