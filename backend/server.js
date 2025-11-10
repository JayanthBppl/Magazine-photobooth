require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const QRCode = require("qrcode");
const axios = require("axios");
const FormData = require("form-data");
const User = require("./models/User");
const sharp = require("sharp");
const fs = require("fs");
const archiver = require("archiver");




const app = express();

// ----------------- Middleware ----------------- //
app.use(
  cors({
    origin: ["https://magazine-photobooth.netlify.app","http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use('/final-images', express.static(path.join(__dirname, 'final-images')));


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
  secure: false, // use STARTTLS (587)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});


// ----------------- User Routes ----------------- //
app.post("/save-user", async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email)
    return res.status(400).json({ error: "Name and email are required" });

  try {
    const newUser = new User({ name, email });
    await newUser.save();
    res.json({ success: true, user: newUser });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ error: "Email already exists" });
    res.status(500).json({ error: "Failed to save user" });
  }
});

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

app.post("/retake", async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression("folder:dslr-images")
      .sort_by("created_at", "desc")
      .max_results(1)
      .execute();

    if (!result.resources || result.resources.length === 0) {
      return res.status(404).json({ success: false, error: "No image to delete" });
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

app.post("/process-image", async (req, res) => {
  try {
    const { imageData, layoutId } = req.body;

    if (!imageData || !layoutId) {
      return res.status(400).json({
        success: false,
        message: "Missing imageData or layoutId",
      });
    }

    console.log(`🧩 Processing layout: ${layoutId}`);

    // === Decode base64 ===
    let base64Data = imageData;
    if (base64Data.startsWith("data:image")) {
      base64Data = base64Data.split(",")[1];
    }
    const inputBuffer = Buffer.from(base64Data, "base64");

    // === Remove background ===
    const formData = new FormData();
    formData.append("image_file", inputBuffer, "camera.png");
    formData.append("size", "auto");

    console.log("🎨 Removing background...");
    const bgResponse = await axios.post("https://api.remove.bg/v1.0/removebg", formData, {
      headers: {
        ...formData.getHeaders(),
        "X-Api-Key": process.env.REMOVEBG_KEY,
      },
      responseType: "arraybuffer",
      timeout: 60000,
    });

    const bgRemovedBuffer = Buffer.from(bgResponse.data, "binary");
    const bgMeta = await sharp(bgRemovedBuffer).metadata();
    console.log(`✅ BG removed image size: ${bgMeta.width}x${bgMeta.height}`);

    // === Layout setup ===
    const baseDir = path.join(__dirname, "assets");
    const layoutFolder = path.join(baseDir, layoutId);
    const layoutPath = path.join(layoutFolder, "layout-img.png");
    const layerPath = path.join(layoutFolder, "layer-img.png");

    const LAYOUT_WIDTH = 900;
    const LAYOUT_HEIGHT = 1440;

    const [layoutBuffer, layerBuffer] = await Promise.all([
      sharp(layoutPath).resize(LAYOUT_WIDTH, LAYOUT_HEIGHT, { fit: "fill" }).toBuffer(),
      sharp(layerPath).resize(LAYOUT_WIDTH, LAYOUT_HEIGHT, { fit: "fill" }).toBuffer(),
    ]);

    // === Smart scaling logic ===
    const maxUserWidth = LAYOUT_WIDTH * 0.95;
    const maxUserHeight = LAYOUT_HEIGHT * 0.95;

    const aspectRatio = bgMeta.width / bgMeta.height;
    let targetWidth = Math.min(maxUserWidth, bgMeta.width * 1.7);
    let targetHeight = targetWidth / aspectRatio;

    if (targetHeight > maxUserHeight) {
      targetHeight = maxUserHeight;
      targetWidth = targetHeight * aspectRatio;
    }

    const scaledUser = await sharp(bgRemovedBuffer)
      .resize(Math.round(targetWidth), Math.round(targetHeight), { fit: "contain" })
      .toBuffer();

    // === Positioning logic ===
    const left = Math.round((LAYOUT_WIDTH - targetWidth) / 2);
    const top = Math.round(LAYOUT_HEIGHT / 2 - targetHeight * 0.35);

    console.log(
      `🧮 Placement → left=${left}, top=${top}, scaled=${Math.round(targetWidth)}x${Math.round(targetHeight)}`
    );

    // === Composite final image ===
    const composedImageBuffer = await sharp(layoutBuffer)
      .composite([
        { input: scaledUser, left, top, blend: "over" },
        { input: layerBuffer, left: 0, top: 0, blend: "over" },
      ])
      .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
      .toBuffer();

    console.log("✅ Final composition successful");

    // === Generate Base64 for Instant Preview ===
    const finalBase64 = `data:image/jpeg;base64,${composedImageBuffer.toString("base64")}`;

    // === Upload to Cloudinary (Async Stream) ===
    console.log("☁️ Uploading final image to Cloudinary...");

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "photo-booth-finals",
          public_id: `${layoutId}_${Date.now()}`,
          resource_type: "image",
          format: "jpg",
          overwrite: true,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      require("streamifier").createReadStream(composedImageBuffer).pipe(uploadStream);
    });

    console.log("✅ Uploaded to Cloudinary:", uploadResult.secure_url);

    // === Respond with Both Base64 & Cloudinary URL ===
    res.json({
      success: true,
      message: "Image processed successfully",
      finalImage: finalBase64, // for immediate display
      cloudinaryUrl: uploadResult.secure_url, // for permanent storage
      publicId: uploadResult.public_id,
    });

  } catch (error) {
    console.error("❌ Processing error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to compose or upload image",
    });
  }
});





// ----------------- QR Code Generator ----------------- //
// app.post("/generate-qr", async (req, res) => {
//   const { imageUrl } = req.body;
//   if (!imageUrl)
//     return res.status(400).json({ success: false, message: "Image URL is required" });

//   try {
//     const qrDataUrl = await QRCode.toDataURL(imageUrl, { width: 300 });
//     res.json({ success: true, qrCode: qrDataUrl });
//   } catch (err) {
//     console.error("❌ QR Code error:", err);
//     res.status(500).json({ success: false, message: "Failed to generate QR code" });
//   }
// });

// ----------------- Start Server ----------------- //
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
