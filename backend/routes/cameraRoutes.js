const express = require("express");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const router = express.Router();

// absolute path where Canon DSLR photos should be stored
const baseDir = "D:/art-photobooth/public/user-images";

// API to capture photo
router.post("/capture", (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "User ID required" });

  const userFolder = path.join(baseDir, userId);
  if (!fs.existsSync(userFolder)) fs.mkdirSync(userFolder, { recursive: true });

  const filename = `photo_${Date.now()}.jpg`;
  const filepath = path.join(userFolder, filename);

  // ✅ Replace this with Canon Remote Shooting CLI/SDK
  // Example: exec(`eosutility-cli --capture --save-to "${filepath}"`, ...
  // For testing: copy a sample image
  exec(`copy sample.jpg "${filepath}"`, (err) => {
    if (err) {
      console.error("Capture error:", err);
      return res.status(500).json({ error: "Failed to capture image" });
    }

    // return relative URL so React can load it
    const publicUrl = `/user-images/${userId}/${filename}`;
    res.json({ success: true, filepath: publicUrl });
  });
});

// API to delete last photo (Retake)
router.post("/retake", (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "User ID required" });

  const userFolder = path.join(baseDir, userId);
  if (!fs.existsSync(userFolder)) {
    return res.status(404).json({ error: "No photos for this user" });
  }

  const files = fs.readdirSync(userFolder).filter(f => f.endsWith(".jpg"));
  if (files.length === 0) {
    return res.status(404).json({ error: "No photos to delete" });
  }

  const lastFile = path.join(userFolder, files.sort().pop());
  fs.unlinkSync(lastFile);

  res.json({ success: true, message: "Last photo deleted" });
});

module.exports = router;
