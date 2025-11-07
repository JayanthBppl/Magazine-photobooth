import React, { useState, useRef, useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AppContext } from "../context/AppContext";
import "../css/CameraPage.css";

const CameraPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { layoutId } = location.state || {};

  const { setProcessedImage, setLayout } = useContext(AppContext);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // const BASE_URL = "http://localhost:5000";
  const BASE_URL = "https://magazine-photobooth-backend.onrender.com";
  const layerSrc = `/layouts/${layoutId}/layer-img.png`;

  /** 🎥 Initialize Camera **/
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 720 },
            height: { ideal: 1280 },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraReady(true);
        }
      } catch (err) {
        console.error("Camera error:", err);
        alert("Unable to access your camera!");
      }
    };

    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  /** 📸 Capture & Remove Background **/
  const captureAndRemoveBG = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!video.videoWidth || !video.videoHeight) {
      alert("Camera not ready yet!");
      return;
    }

    setProcessing(true);

    // --- Canvas setup (portrait crop 9:16) ---
    const canvasWidth = 720;
    const canvasHeight = 1280;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const videoAspect = video.videoWidth / video.videoHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    let sx, sy, sw, sh;

    if (videoAspect > canvasAspect) {
      sh = video.videoHeight;
      sw = sh * canvasAspect;
      sx = (video.videoWidth - sw) / 2;
      sy = 0;
    } else {
      sw = video.videoWidth;
      sh = sw / canvasAspect;
      sx = 0;
      sy = (video.videoHeight - sh) / 2;
    }

    // Draw mirrored video frame
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(
      video,
      sx,
      sy,
      sw,
      sh,
      -canvasWidth,
      0,
      canvasWidth,
      canvasHeight
    );
    ctx.restore();

    const capturedData = canvas.toDataURL("image/png");

    try {
      // 🧠 Step 1: Remove background
      const response = await fetch(`${BASE_URL}/remove-bg`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filepath: capturedData }),
      });

      const data = await response.json();
      if (!data.success) throw new Error("Background removal failed!");

      const bgRemovedImage = "data:image/png;base64," + data.data.result_b64;

      // ✅ Step 2: Save in context
      setProcessedImage(bgRemovedImage);
      setLayout(layoutId);

      // ✅ Step 3: Navigate to FinalPage
      navigate("/final", {
        state: { layoutId, processedImage: bgRemovedImage },
      });
    } catch (err) {
      console.error("Error while processing image:", err);
      alert("Failed to process image.");
    } finally {
      setProcessing(false);
    }
  };

  /** ⏱ Start 5-second countdown before capture **/
  const startCountdown = () => {
    if (!isCameraReady || processing) return;
    setCountdown(5);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCountdown(0);
          captureAndRemoveBG(); // auto-trigger capture after countdown
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="container-fluid text-center bg-dark text-white py-5 vh-100">
      <h3 className="mb-4">Align Yourself and Get Ready!</h3>

      <div
        style={{
          position: "relative",
          width: "280px",
          height: "480px",
          margin: "0 auto",
          borderRadius: "12px",
          overflow: "hidden",
          backgroundColor: "#000",
          boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
        }}
      >
        {/* Live Camera Feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) scaleX(-1)",
            width: "auto",
            height: "100%",
            objectFit: "cover",
            zIndex: 1,
          }}
        />

        {/* Layer Overlay */}
        <img
          src={layerSrc}
          alt="Layer Overlay"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            zIndex: 2,
            pointerEvents: "none",
          }}
        />

        {/* Countdown Overlay */}
        {countdown > 0 && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: "5rem",
              fontWeight: "bold",
              color: "#fff",
              textShadow: "0 0 15px rgba(0,0,0,0.7)",
              zIndex: 5,
            }}
          >
            {countdown}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Buttons */}
      <div className="mt-4">
        <button
          className="btn btn-primary px-4"
          onClick={startCountdown}
          disabled={!isCameraReady || processing || countdown > 0}
        >
          {processing
            ? "Processing..."
            : countdown > 0
            ? "Get Ready..."
            : "Capture Photo"}
        </button>
      </div>
    </div>
  );
};

export default CameraPage;
