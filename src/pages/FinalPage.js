import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import "../css/FinalPage.css";

const FinalPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { finalImage, cloudinaryUrl } = location.state || {};

  const [showQR, setShowQR] = useState(false);

  return (
    <div className="final-container">
      <h2 className="final-title">✨ Your Final Portrait ✨</h2>

      <div className="final-content">
        <div className="final-card">
          <img
            src={finalImage}
            alt="Final Portrait"
            className="final-image"
          />
        </div>

        {/* === Buttons Section === */}
        <div className="btn-box dual-buttons">
          <button
            className="home-btn"
            onClick={() => setShowQR(true)}
            disabled={!cloudinaryUrl}
          >
            Generate QR
          </button>

          <button
            className="home-btn secondary-btn"
            onClick={() => navigate("/")}
          >
            Home
          </button>
        </div>
      </div>

      {/* ===== QR Modal Overlay ===== */}
      {showQR && (
        <div className="qr-overlay">
          <div className="qr-box">
            <h4 className="qr-title">📱 Scan to Download</h4>

            {cloudinaryUrl ? (
              <QRCodeCanvas
                value={cloudinaryUrl}
                size={220}
                fgColor="#ffffff"
                bgColor="transparent"
                level="H"
                includeMargin={true}
              />
            ) : (
              <p>Cloudinary URL not available</p>
            )}

            <button className="close-btn" onClick={() => setShowQR(false)}>
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinalPage;
