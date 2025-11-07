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

// ----------------- Background Removal ----------------- //
app.post("/remove-bg", upload.single("image"), async (req, res) => {
  try {
    let fileBuffer, fileName;

    if (req.file) {
      fileBuffer = req.file.buffer;
      fileName = req.file.originalname;
    } else if (req.body.filepath) {
      const response = await axios.get(req.body.filepath, {
        responseType: "arraybuffer",
      });
      fileBuffer = response.data;
      fileName = path.basename(req.body.filepath);
    } else {
      return res.status(400).json({ error: "No image provided" });
    }

    const formData = new FormData();
    formData.append("image_file", fileBuffer, fileName);
    formData.append("size", "auto");

    const response = await axios.post(
      "https://api.remove.bg/v1.0/removebg",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          "X-Api-Key": process.env.REMOVEBG_KEY,
        },
        responseType: "arraybuffer",
      }
    );

    const base64Image = Buffer.from(response.data, "binary").toString("base64");
    res.json({ success: true, data: { result_b64: base64Image } });
  } catch (error) {
    console.error("Remove.bg Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Background removal failed" });
  }
});



app.post("/compose-final", async (req, res) => {
  try {
    const { userImage, layoutId } = req.body;

    if (!userImage || !layoutId) {
      return res.status(400).json({
        success: false,
        message: "Missing userImage or layoutId",
      });
    }

    // Base directories
    const baseDir = path.join(__dirname, "assets");
    const outputDir = path.join(__dirname, "final-images");
    await fs.promises.mkdir(outputDir, { recursive: true });

    // Layout and layer paths
    const layoutFolder = path.join(baseDir, layoutId);
    const layoutPath = path.join(layoutFolder, "layout-img.png");
    const layerPath = path.join(layoutFolder, "layer-img.png");

    if (!fs.existsSync(layoutPath) || !fs.existsSync(layerPath)) {
      return res.status(404).json({
        success: false,
        message: `Layout or layer not found for ${layoutId}`,
      });
    }

    console.log(`🧩 Composing final image using layout: ${layoutId}`);

    // Load layout and layer images
    const [layoutBuffer, layerBuffer] = await Promise.all([
      fs.promises.readFile(layoutPath),
      fs.promises.readFile(layerPath),
    ]);

    // Decode user image
    const userBuffer = Buffer.from(
      userImage.replace(/^data:image\/\w+;base64,/, ""),
      "base64"
    );

    // Get layout metadata
    const layoutMeta = await sharp(layoutBuffer).metadata();
    const layoutWidth = Math.round(layoutMeta.width);
    const layoutHeight = Math.round(layoutMeta.height);

    // Resize user image to fill 90% of layout height (maintain aspect)
    const targetUserHeight = Math.round(layoutHeight * 0.9);
    const resizedUserBuffer = await sharp(userBuffer)
      .resize({
        height: targetUserHeight,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    const userMeta = await sharp(resizedUserBuffer).metadata();

    // Center horizontally, align bottom vertically
    const left = Math.floor((layoutWidth - userMeta.width) / 2);
    const top = Math.max(layoutHeight - userMeta.height, 0);

    // 🧠 Composite: layout + user + overlay layer
    const composedImage = await sharp(layoutBuffer)
      .composite([
        { input: resizedUserBuffer, left, top },
        { input: layerBuffer, blend: "over" },
      ])
      .jpeg({ quality: 100, chromaSubsampling: "4:4:4" })
      .toBuffer();

    // Save locally (for Render file system)
    const timestamp = Date.now();
    const outputFilename = `final_${layoutId}_${timestamp}.jpg`;
    const outputPath = path.join(outputDir, outputFilename);
    await fs.promises.writeFile(outputPath, composedImage);

    console.log(`✅ Saved locally: ${outputFilename}`);

    // ☁️ Upload to Cloudinary
    let uploadResult = null;
    try {
      uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "photo-booth-finals",
            public_id: `final_${layoutId}_${timestamp}`,
            resource_type: "image",
            overwrite: true,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(composedImage);
      });

      console.log(`☁️ Uploaded to Cloudinary: ${uploadResult.secure_url}`);
    } catch (cloudErr) {
      console.warn("⚠️ Cloudinary upload failed:", cloudErr.message);
    }

    // Encode for immediate frontend preview
    const finalBase64 = `data:image/jpeg;base64,${composedImage.toString("base64")}`;

    res.json({
      success: true,
      message: "Image composed successfully",
      finalImageData: finalBase64,
      localPath: outputPath,
      cloudinaryUrl: uploadResult?.secure_url || null,
    });
  } catch (err) {
    console.error("❌ Compose error:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to compose and upload image",
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
