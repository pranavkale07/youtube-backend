import { Router } from "express";
import {
    deleteVideo,
    getAllVideos,
    publishVideo,
    togglePublishStatus,
    updateVideoDetails,
    watchVideo
} from "../controllers/video.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.route("/").get(getAllVideos)

router.route("/publish").post(
        verifyJWT,
        upload.fields([
            {
                name: "videoFile",
                maxCount: 1
            },
            {
                name: "thumbnail",
                maxCount: 1
            }
        ]),
        publishVideo
    );

router.route("/watch/:videoId").get(verifyJWT, watchVideo)

router.route("/watch/:videoId").get(verifyJWT, watchVideo)

router.route("/update/:videoId").put(verifyJWT, upload.single('thumbnail'), updateVideoDetails)

router.route("/delete/:videoId").delete(verifyJWT, deleteVideo)

router.route("/toggle-publish/:videoId").patch(verifyJWT, togglePublishStatus)

export default router;