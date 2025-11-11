import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import "../css/FinalPage.css";

const FinalPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { finalImage, cloudinaryUrl, publicId, layoutId } = location.state || {};

  const [showQR, setShowQR] = useState(false);

  const BASE_URL = "https://magazine-photobooth-backend.onrender.com";
  // const BASE_URL = "http://localhost:5000";

  /** 🔄 Retake workflow */
 const handleRetake = async () => {
  try {
    // delete previous image (if publicId exists)
    if (publicId) {
      await fetch(`${BASE_URL}/delete-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId }),
      });
    }

    // 🔹 delete DB record too
    await fetch(`${BASE_URL}/delete-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicId }),
    });

  } catch (err) {
    console.warn("⚠️ Retake cleanup failed:", err);
  } finally {
    // ✅ Pass all necessary data again
    navigate("/camera", {
      state: {
        layoutId: location.state?.layoutId,
        name: location.state?.name,
        email: location.state?.email,
      },
    });
  }
};


  return (
    <div className="final-container">
      <h2 className="final-title">✨ Your Final Portrait ✨</h2>

      <div className="final-content">
        {/* Final composite image */}
        <div className="final-card">
          <img src={finalImage} alt="Final Portrait" className="final-image" />
        </div>

        {/* Buttons */}
        <div className="btn-box dual-buttons">
          <button
            className="home-btn"
            onClick={() => setShowQR(true)}
            disabled={!cloudinaryUrl}
          >
            Generate QR
          </button>

          <button className="home-btn secondary-btn" onClick={handleRetake}>
            Retake
          </button>
        </div>
      </div>

      {/* 📱 QR Overlay */}
      {showQR && (
        <div className="qr-overlay">
          <div className="qr-box">
            <h4 className="qr-title">📱 Scan to Download</h4>

            {cloudinaryUrl ? (
              <>
                <QRCodeCanvas
                  value={cloudinaryUrl}
                  size={220}
                  fgColor="#ffffff"
                  bgColor="transparent"
                  level="H"
                  includeMargin={true}
                  className="qr-canvas"
                />
                <p
                  style={{
                    marginTop: 14,
                    fontSize: "0.95rem",
                    lineHeight: "1.4",
                    maxWidth: 420,
                    textAlign: "center",
                    color: "#f3f3f3",
                  }}
                >
                  Celebrate your Myntra story! Post your photo on LinkedIn and
                  show how you fashion the future.{" "}
                  <b style={{ color: "#FF0099" }}>#BeTheTrend</b>
                </p>
              </>
            ) : (
              <p style={{ color: "#ccc" }}>Cloudinary URL not available.</p>
            )}

            <div
              className="dual-buttons"
              style={{
                marginTop: 20,
                display: "flex",
                justifyContent: "center",
                gap: 16,
              }}
            >
              <button className="close-btn" onClick={() => setShowQR(false)}>
                Back
              </button>
              <button
                className="secondary-btn"
                onClick={() => navigate("/")}
              >
                Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinalPage;
