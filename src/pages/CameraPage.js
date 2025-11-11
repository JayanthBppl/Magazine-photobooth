import React, { useState, useRef, useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AppContext } from "../context/AppContext";
import "../css/CameraPage.css";
import LoadingGif from "../assets/loading.gif";

const CameraPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { layoutId, name, email } = location.state || {}; // from previous screen
  const { setProcessedImage } = useContext(AppContext);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [hasStartedCamera, setHasStartedCamera] = useState(false);

  const [capturedDataUrl, setCapturedDataUrl] = useState(null);
  const [showConsent, setShowConsent] = useState(false);

  const BASE_URL = "https://magazine-photobooth-backend.onrender.com";
  // const BASE_URL = "http://localhost:5000";

  const FRAME_WIDTH = 1880;
  const FRAME_HEIGHT = 2500;

  /** 🎥 Detect available cameras */
  useEffect(() => {
    const detect = async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = list.filter((d) => d.kind === "videoinput");
        setDevices(videoInputs);
        const front = videoInputs.find((d) =>
          d.label.toLowerCase().includes("front")
        );
        setSelectedDeviceId(
          front ? front.deviceId : videoInputs[0]?.deviceId || null
        );
      } catch (err) {
        console.error("Camera detection error:", err);
      }
    };
    detect();
  }, []);

  /** 🎞 Start camera */
  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          width: FRAME_WIDTH,
          height: FRAME_HEIGHT,
          facingMode: "user",
        },
        audio: false,
      };
      if (selectedDeviceId)
        constraints.video.deviceId = { exact: selectedDeviceId };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraReady(true);
        setHasStartedCamera(true);

        // Reload overlay
        setTimeout(() => {
          const overlayImg = document.querySelector(".overlay-frame");
          if (overlayImg) {
            overlayImg.src = `/layouts/${layoutId}/layer-img.png?cacheBust=${Date.now()}`;
          }
        }, 300);
      }
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Please allow camera access to continue.");
    }
  };

  /** 🚀 Auto-start camera */
  useEffect(() => {
    const autoStart = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        startCamera();
      } catch {
        // wait for user interaction
      }
    };
    autoStart();

    // Cleanup stream
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, [selectedDeviceId, layoutId]);

  /** 📸 Capture image locally */
 /** 📸 Capture image locally with strong zoom */
const captureImageLocal = () => {
  const video = videoRef.current;
  const canvas = canvasRef.current;
  if (!video || !video.videoWidth) {
    alert("Camera not ready");
    return;
  }

  canvas.width = FRAME_WIDTH;
  canvas.height = FRAME_HEIGHT;

  const ctx = canvas.getContext("2d");
  ctx.save();

  // Mirror effect for front camera
  ctx.scale(-1, 1);

  // ✅ Zoom factor — controls how big the user looks
  const zoomFactor = 1.35; // Try 1.5–1.8 for portrait crop

  // Scaled dimensions
  const zoomedWidth = FRAME_WIDTH * zoomFactor;
  const zoomedHeight = FRAME_HEIGHT * zoomFactor;

  // Center the zoom (crop equally from all sides)
  const offsetX = (zoomedWidth - FRAME_WIDTH) / 2;
  const offsetY = (zoomedHeight - FRAME_HEIGHT) / 2;

  // Draw enlarged area
  ctx.drawImage(
    video,
    -FRAME_WIDTH - offsetX,
    -offsetY,
    zoomedWidth,
    zoomedHeight
  );

  ctx.restore();

  const data = canvas.toDataURL("image/png");
  setCapturedDataUrl(data);
  setShowConsent(true);
};


  /** 🕒 Countdown before capture */
  const startCountdown = () => {
    if (!isCameraReady || processing) return;
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCountdown(0);
          captureImageLocal();
        }
        return prev - 1;
      });
    }, 1000);
  };

  /** ✅ Submit image, name, email, and consent */
  const submitImageWithConsent = async (consentValue) => {
    if (!capturedDataUrl) return;
    setProcessing(true);

    try {
      const payload = {
        imageData: capturedDataUrl,
        layoutId,
        name,
        email,
        consent: !!consentValue,
      };

      const res = await fetch(`${BASE_URL}/submit-image-consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Upload failed");

      setProcessedImage(data.finalImage);

      navigate("/final", {
        state: {
          layoutId,
          finalImage: data.finalImage,
          cloudinaryUrl: data.cloudinaryUrl,
          publicId: data.publicId,
          name,
          email,
        },
      });
    } catch (err) {
      console.error(err);
      alert("Something went wrong while processing your image.");
    } finally {
      setProcessing(false);
      setShowConsent(false);
      setCapturedDataUrl(null);
    }
  };

  return (
    <div key={layoutId} className="camera-container">
      {/* 🟣 Full-screen Loading Overlay */}
      {processing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
            zIndex: 9999,
          }}
        >
          <img
            src={LoadingGif}
            alt="Processing..."
            style={{ width: "120px", marginBottom: "1rem" }}
          />
          <p style={{ color: "#fff", fontSize: "1rem", fontWeight: "500" }}>
            Processing your photo...
          </p>
        </div>
      )}

      <div
        className="camera-center-box"
        style={{ opacity: processing ? 0.2 : 1 }}
      >
        <h3 className="camera-title">Align Yourself and Get Ready!</h3>

        {/* Camera selector */}
        {devices.length > 1 && (
          <div className="camera-select-box">
            <label className="camera-select-label">Switch Camera:</label>
            <select
              value={selectedDeviceId || ""}
              className="camera-dropdown"
              onChange={(e) => setSelectedDeviceId(e.target.value)}
            >
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {!hasStartedCamera && (
          <button className="start-camera-btn" onClick={startCamera}>
            Start Camera
          </button>
        )}

        {/* Video + Overlay */}
        <div className="camera-frame">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="video-feed"
            style={{ transform: "scaleX(-1)" }}
          />
          {/* <img
            src={`/layouts/${layoutId}/layer-img.png?cacheBust=${Date.now()}`}
            alt="overlay"
            className="overlay-frame"
          /> */}
          {countdown > 0 && <div className="countdown">{countdown}</div>}
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />

        <button
          className="capture-btn"
          onClick={startCountdown}
          disabled={!isCameraReady || processing || countdown > 0}
        >
          {countdown > 0 ? "Get Ready..." : "Capture Photo"}
        </button>
      </div>

      {/* 🟣 Consent Modal */}
      {showConsent && (
        <div className="consent-overlay">
          <div
            className="consent-box"
            style={{
              maxWidth: 520,
              padding: "1.5rem 1.5rem",
              textAlign: "center",
            }}
          >
            <h4 style={{ fontSize: "1.1rem", marginBottom: "0.8rem" }}>
              Consent & Agreement
            </h4>
            <p
              className="consent-text"
              style={{
                fontSize: "0.9rem",
                lineHeight: "1.4",
                marginBottom: "1rem",
                color: "#ddd",
              }}
            >
              By taking a photo, you agree to receive a digital copy of your
              image. You also consent that the image may be used by Myntra for
              non-commercial internal communications and for external Employer
              Branding purposes.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                alignItems: "center",
              }}
            >
              <button
                className="btn"
                onClick={() => {
                  setProcessing(true);
                  submitImageWithConsent(true);
                }}
                style={{
                  background:
                    "linear-gradient(135deg,#0047FF,#7A00FF,#FF0099)",
                  border: "none",
                  fontSize: "0.9rem",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  width: "180px",
                }}
              >
                I Agree
              </button>

              <button
                className="btn"
                onClick={() => {
                  setProcessing(true);
                  submitImageWithConsent(false);
                }}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff",
                  fontSize: "0.9rem",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  width: "180px",
                }}
              >
                Do Not Agree
              </button>

              <button
                className="btn"
                onClick={() => {
                  setShowConsent(false);
                  setCapturedDataUrl(null);
                }}
                style={{
                  fontSize: "0.8rem",
                  marginTop: "4px",
                  background: "transparent",
                  color: "#bbb",
                  border: "none",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraPage;
