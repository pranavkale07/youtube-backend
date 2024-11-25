import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new mongoose.Schema(
    {
        content: {
            required: true,
            type: string
        },
        video: {
            required: true,
            type: mongoose.Schema.Types.ObjectId,
            ref: "Video"
        },
        owner: {
            required: true,
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    }, {timestamps: true}
)

commentSchema.plugin(mongooseAggregatePaginate)

export const Comment = mongoose.model("Comment", commentSchema);