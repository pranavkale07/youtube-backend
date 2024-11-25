import mongoose from "mongoose"

const likeSchema = new mongoose.Schema(
    {
        likedBy: {
            required: true,
            type: mongoose.Schema.ObjectId,
            ref: "User"
        },
        video: {
            required: true,
            type: mongoose.Schema.ObjectId,
            ref: "Video"
        }
    },
    {
        timestamps: true
    }
)

export const Like = mongoose.model("Like", likeSchema);