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
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [hasStartedCamera, setHasStartedCamera] = useState(false);

  // const BASE_URL = "http://localhost:5000";
  const BASE_URL =  "https://magazine-photobooth-backend.onrender.com";
  const layerSrc = `/layouts/${layoutId}/layer-img.png`;

  // 💡 For iPad optimized preview
  const FRAME_WIDTH = 900;
  const FRAME_HEIGHT = 1200;

  /** ✅ Detect available cameras */
  useEffect(() => {
    const detectCameras = async () => {
      try {
        const devicesList = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devicesList.filter((d) => d.kind === "videoinput");
        setDevices(videoInputs);

        // Prefer front camera if available
        const frontCam = videoInputs.find((d) =>
          d.label.toLowerCase().includes("front")
        );
        setSelectedDeviceId(frontCam ? frontCam.deviceId : videoInputs[0]?.deviceId || null);
      } catch (err) {
        console.error("Camera detection error:", err);
      }
    };
    detectCameras();
  }, []);

  /** ✅ Start camera */
  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: FRAME_WIDTH },
          height: { ideal: FRAME_HEIGHT },
        },
        audio: false,
      };

      if (selectedDeviceId) {
        constraints.video.deviceId = { exact: selectedDeviceId };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraReady(true);
        setPermissionDenied(false);
        setHasStartedCamera(true);
      }
    } catch (err) {
      console.error("Camera start error:", err);
      if (err.name === "NotAllowedError") {
        setPermissionDenied(true);
        alert("Please allow camera access in your browser settings.");
      } else {
        alert("Unable to access camera. Please enable camera access.");
      }
    }
  };

  /** 📸 Capture + Remove BG + Compose in single API */
  const captureAndProcessImage = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!video.videoWidth || !video.videoHeight) {
      alert("Camera not ready yet!");
      return;
    }

    setProcessing(true);
    canvas.width = FRAME_WIDTH;
    canvas.height = FRAME_HEIGHT;

    // Mirror horizontally
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -FRAME_WIDTH, 0, FRAME_WIDTH, FRAME_HEIGHT);
    ctx.restore();

    const capturedData = canvas.toDataURL("image/png");

    try {
      const response = await fetch(`${BASE_URL}/process-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: capturedData, layoutId }),
      });

      const data = await response.json();
      if (!data.success) throw new Error("Image processing failed!");

      setProcessedImage(data.finalImage);
      setLayout(layoutId);

      navigate("/final", {
        state: { layoutId, finalImage: data.finalImage },
      });
    } catch (err) {
      console.error("Error processing image:", err);
      alert("Failed to process image. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  /** ⏱ Countdown before capture */
  const startCountdown = () => {
    if (!isCameraReady || processing) return;
    setCountdown(3);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCountdown(0);
          captureAndProcessImage();
        }
        return prev - 1;
      });
    }, 1000);
  };

  /** 🔁 Switch camera */
  const handleCameraChange = (e) => {
    setSelectedDeviceId(e.target.value);
    setIsCameraReady(false);
    setHasStartedCamera(false);
    startCamera();
  };

  /** 🚀 Auto-start camera */
  useEffect(() => {
    const autoStart = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        startCamera();
      } catch {
        console.log("Awaiting user gesture for camera...");
      }
    };
    autoStart();
  }, []);

  return (
    <div className="camera-container">
      <div className="camera-center-box">
        <h3 className="camera-title">Align Yourself and Get Ready!</h3>

        {devices.length > 1 && (
          <div className="camera-select-box">
            <label>Switch Camera:</label>
            <select
              value={selectedDeviceId || ""}
              onChange={handleCameraChange}
              className="camera-dropdown"
            >
              {devices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${index + 1}`}
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

        <div className="camera-frame">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="video-feed"
            style={{ transform: "scaleX(-1)" }}
          />
          <img src={layerSrc} alt="Layout Overlay" className="overlay-frame" />
          {countdown > 0 && <div className="countdown">{countdown}</div>}
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />

        <button
          className="capture-btn"
          onClick={startCountdown}
          disabled={!isCameraReady || processing || countdown > 0}
        >
          {processing ? "Processing..." : countdown > 0 ? "Get Ready..." : "Capture Photo"}
        </button>

        {permissionDenied && <p>Please allow camera access.</p>}
      </div>
    </div>
  );
};

export default CameraPage;
