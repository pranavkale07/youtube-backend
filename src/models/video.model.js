import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new mongoose.Schema(
    {
        videoFile: {
            required: true,
            type: String, // cloudinary url
        },
        thumbnail: {
            required: true, // cloudinary url
            type: String
        },
        title: {
            required: true,
            type: String
        },
        description: {
            required: true,
            type: String
        },
        duration: {
            required: true,
            type: Number
        },
        views: {
            type: Number,
            default: 0
        },
        isPublished: {
            type: Boolean,
            default: true
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        }
    }, {timestamps: true}
)

videoSchema.plugin(mongooseAggregatePaginate)

export const Video = mongoose.model("Video", videoSchema);