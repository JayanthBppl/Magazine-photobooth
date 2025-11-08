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

 const BASE_URL = "http://localhost:5000"|| "https://magazine-photobooth-backend.onrender.com";
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
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
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

    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, sw, sh, -canvasWidth, 0, canvasWidth, canvasHeight);
    ctx.restore();

    const capturedData = canvas.toDataURL("image/png");

    try {
      const response = await fetch(`${BASE_URL}/remove-bg`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filepath: capturedData }),
      });

      const data = await response.json();
      if (!data.success) throw new Error("Background removal failed!");

      const bgRemovedImage = "data:image/png;base64," + data.data.result_b64;
      setProcessedImage(bgRemovedImage);
      setLayout(layoutId);

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

  /** ⏱ Countdown **/
  const startCountdown = () => {
    if (!isCameraReady || processing) return;
    setCountdown(5);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCountdown(0);
          captureAndRemoveBG();
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="camera-container">
      <div className="camera-center-box">
        <h3 className="camera-title">Align Yourself and Get Ready!</h3>

        <div className="camera-frame">
          {/* Camera Feed */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="video-feed"
            style={{
              transform: "scaleX(-1)",
            }}
          />

          {/* Overlay */}
          <img
            src={layerSrc}
            alt="Layout Overlay"
            className="overlay-frame"
          />

          {/* Countdown */}
          {countdown > 0 && (
            <div className="countdown">{countdown}</div>
          )}
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />

        <button
          className="capture-btn"
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
