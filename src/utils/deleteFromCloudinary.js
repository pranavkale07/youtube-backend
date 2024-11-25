import { v2 as cloudinary } from "cloudinary";

const deleteFromCloudinary = async (fileUrl) => {
    try {
        if (!fileUrl) {
            throw new Error("File URL is required to delete from Cloudinary");
        }

        // Extract the public ID from the Cloudinary URL
        const regex = /\/v\d+\/(.+?)\./;
        const match = fileUrl.match(regex);
        if (!match) {
            console.error("Failed to extract public ID from URL:", fileUrl);
            return false;
        }

        let publicId = match[1];

        // If it's a video file, strip the file extension as Cloudinary may store the file without it
        publicId = publicId.replace(/\.[a-zA-Z0-9]+$/, '');

        console.log("Extracted public ID:", publicId);  // Debugging log

        // Determine resource type based on the file URL
        let resourceType = fileUrl.includes("video/") ? "video" : "image";

        // Delete the file from Cloudinary using the correct API call
        const response = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType
        });

        console.log("Cloudinary deletion response:", response);  // Debugging log

        if (response.result === "ok") {
            console.log(`File successfully deleted from Cloudinary: ${fileUrl}`);
            return true;
        } else {
            console.error("Failed to delete file from Cloudinary:", response);
            return false;
        }
    } catch (error) {
        console.error("Error deleting file from Cloudinary:", error);
        return false;
    }
};

export { deleteFromCloudinary };
