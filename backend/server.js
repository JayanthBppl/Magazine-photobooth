require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const axios = require("axios");
const FormData = require("form-data");
const User = require("./models/User");
const Consent = require("./models/Consent");
const sharp = require("sharp");
const fs = require("fs");
const archiver = require("archiver");
const Session = require("./models/Session");


const app = express();

// ----------------- Middleware ----------------- //
app.use(
  cors({
    origin: ["https://magazine-photobooth.netlify.app", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use("/final-images", express.static(path.join(__dirname, "final-images")));

// ----------------- Cloudinary Setup ----------------- //
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ----------------- Multer (Memory Storage) ----------------- //
const upload = multer({ storage: multer.memoryStorage() });

// ----------------- MongoDB ----------------- //
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: process.env.DB_NAME,
  })
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ----------------- Nodemailer ----------------- //
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ----------------- User Routes ----------------- //
// app.post("/save-user", async (req, res) => {
//   const { name, email } = req.body;
//   if (!name || !email)
//     return res.status(400).json({ error: "Name and email are required" });

//   try {
//     const newUser = new User({ name, email });
//     await newUser.save();
//     res.json({ success: true, user: newUser });
//   } catch (err) {
//     if (err.code === 11000)
//       return res.status(400).json({ error: "Email already exists" });
//     res.status(500).json({ error: "Failed to save user" });
//   }
// });

// ----------------- Get All Users ----------------- //
app.get("/users", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ----------------- DSLR Utility ----------------- //
app.get("/cloudinary/latest-dslr", async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression("folder:dslr-images")
      .sort_by("created_at", "desc")
      .max_results(1)
      .execute();

    if (!result.resources || result.resources.length === 0) {
      return res.json({ url: null });
    }

    const latest = result.resources[0];
    res.json({ url: latest.secure_url });
  } catch (err) {
    console.error("❌ Error fetching latest DSLR photo:", err);
    res.status(500).json({ error: "Failed to fetch latest photo" });
  }
});

// ----------------- Retake Utility ----------------- //
app.post("/retake", async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression("folder:dslr-images")
      .sort_by("created_at", "desc")
      .max_results(1)
      .execute();

    if (!result.resources || result.resources.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "No image to delete" });
    }

    const publicId = result.resources[0].public_id;
    await cloudinary.uploader.destroy(publicId);

    res.json({
      success: true,
      message: "Last photo deleted, please capture a new one",
      waitTime: 3000,
    });
  } catch (err) {
    console.error("❌ Retake error:", err);
    res.status(500).json({ success: false, error: "Failed to delete photo" });
  }
});

app.post("/submit-image-consent", async (req, res) => {
  try {
    const { imageData, layoutId, name, email, consent } = req.body;
    if (!imageData || !layoutId || !name || !email) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    console.log(`🧩 Processing layout: ${layoutId}`);

    let base64Data = imageData.startsWith("data:image")
      ? imageData.split(",")[1]
      : imageData;
    const inputBuffer = Buffer.from(base64Data, "base64");

    // Background removal
    const formData = new FormData();
    formData.append("image_file", inputBuffer, "camera.png");
    formData.append("size", "auto");

    const bgResponse = await axios.post("https://api.remove.bg/v1.0/removebg", formData, {
      headers: { ...formData.getHeaders(), "X-Api-Key": process.env.REMOVEBG_KEY },
      responseType: "arraybuffer",
      timeout: 60000,
    });

    const bgRemovedBuffer = Buffer.from(bgResponse.data, "binary");
    const bgMeta = await sharp(bgRemovedBuffer).metadata();

    // Layout setup
    const baseDir = path.join(__dirname, "assets");
    const layoutFolder = path.join(baseDir, layoutId);
    const layoutPath = path.join(layoutFolder, "layout-img.png");
    const layerPath = path.join(layoutFolder, "layer-img.png");

    const LAYOUT_WIDTH = 1080;
    const LAYOUT_HEIGHT = 1920;

    const [layoutBuffer, layerBuffer] = await Promise.all([
      sharp(layoutPath).toBuffer(),
      sharp(layerPath).toBuffer(),
    ]);

    // Scale user image proportionally
    // --- Safe adaptive scaling ---
const userAspect = bgMeta.width / bgMeta.height;

// Start with the layout as a base canvas
let targetWidth = LAYOUT_WIDTH;
let targetHeight = targetWidth / userAspect;

// If image taller than layout → scale to height instead
if (targetHeight > LAYOUT_HEIGHT) {
  targetHeight = LAYOUT_HEIGHT;
  targetWidth = targetHeight * userAspect;
}

// Safety margin (fit nicely inside the layout)
targetWidth *= 0.92;
targetHeight *= 0.92;

// ✅ Center horizontally and slightly lower vertically
const left = Math.round((LAYOUT_WIDTH - targetWidth) / 2);
const top = Math.round((LAYOUT_HEIGHT - targetHeight) / 3.5);

// Resize user image safely
const scaledUser = await sharp(bgRemovedBuffer)
  .resize(Math.round(targetWidth), Math.round(targetHeight), { fit: "contain" })
  .toBuffer();

console.log(`
📏 SAFE COMPOSITION DIAGNOSTICS
----------------------------------
Device image: ${bgMeta.width}x${bgMeta.height} (aspect: ${userAspect.toFixed(2)})
Target: ${Math.round(targetWidth)}x${Math.round(targetHeight)}
Layout: ${LAYOUT_WIDTH}x${LAYOUT_HEIGHT}
Position: left=${left}, top=${top}
----------------------------------
`);



    const composedImageBuffer = await sharp(layoutBuffer)
      .composite([
        { input: scaledUser, left, top, blend: "over" },
        { input: layerBuffer, left: 0, top: 0, blend: "over" },
      ])
      .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
      .toBuffer();

    const finalBase64 = `data:image/jpeg;base64,${composedImageBuffer.toString("base64")}`;

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "photo-booth-finals",
          public_id: `${layoutId}_${Date.now()}`,
          resource_type: "image",
          format: "jpg",
          overwrite: true,
        },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      require("streamifier").createReadStream(composedImageBuffer).pipe(uploadStream);
    });

    // Save session
    const newSession = new Session({
      name,
      email,
      layoutId,
      consent: !!consent,
      cloudinaryUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    });

    await newSession.save();

    res.json({
      success: true,
      message: "Session stored successfully",
      finalImage: finalBase64,
      cloudinaryUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
    });
  } catch (error) {
    console.error("❌ submit-image-consent error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to process or upload image",
    });
  }
});






// ----------------- Delete Image (for Retake) ----------------- //
app.post("/delete-image", async (req, res) => {
  try {
    const { publicId } = req.body;
    if (!publicId)
      return res
        .status(400)
        .json({ success: false, message: "publicId required" });

    await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: "image",
    });

    res.json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (err) {
    console.error("❌ delete-image error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete Cloudinary image" });
  }
});
// ----------------- Delete Image & Session ----------------- //
app.post("/delete-session", async (req, res) => {
  try {
    const { publicId } = req.body;
    if (!publicId)
      return res
        .status(400)
        .json({ success: false, message: "publicId required" });

    // 🔹 Delete Cloudinary image
    await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: "image",
    });

    // 🔹 Delete MongoDB record
    const result = await Session.findOneAndDelete({ publicId });

    if (result) {
      console.log(`🗑️ Deleted session & image for ${publicId}`);
    } else {
      console.warn(`⚠️ No session found for ${publicId}`);
    }

    res.json({
      success: true,
      message: "Session and image deleted successfully",
    });
  } catch (err) {
    console.error("❌ delete-session error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete Cloudinary image or session",
    });
  }
});

// ----------------- Start Server ----------------- //
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
