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

   const BASE_URL =  "https://magazine-photobooth-backend.onrender.com";
  // const BASE_URL = "http://localhost:5000";
  const layerSrc = `/layouts/${layoutId}/layer-img.png`;

  // Portrait ratio — must match backend composition dimensions
  const FRAME_WIDTH = 720;
  const FRAME_HEIGHT = 1280;

  /** 🎥 Detect available cameras **/
  useEffect(() => {
    const loadCameras = async () => {
      try {
        const devicesList = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devicesList.filter((d) => d.kind === "videoinput");
        setDevices(videoInputs);
        if (videoInputs.length > 0) {
          // Default to front camera (if labeled)
          const frontCam = videoInputs.find((d) =>
            d.label.toLowerCase().includes("front")
          );
          setSelectedDeviceId(frontCam ? frontCam.deviceId : videoInputs[0].deviceId);
        }
      } catch (err) {
        console.error("Camera detection error:", err);
      }
    };
    loadCameras();
  }, []);

  /** 🎥 Start camera stream **/
  useEffect(() => {
    const startCamera = async () => {
      if (!selectedDeviceId) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: selectedDeviceId },
            width: { ideal: FRAME_WIDTH },
            height: { ideal: FRAME_HEIGHT },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraReady(true);
          setPermissionDenied(false);
        }
      } catch (err) {
        console.error("Camera error:", err);
        if (err.name === "NotAllowedError") {
          setPermissionDenied(true);
        } else {
          alert("Unable to access your camera. Please enable permissions.");
        }
      }
    };

    startCamera();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, [selectedDeviceId]);

  /** 📸 Capture and remove background **/
  const captureAndRemoveBG = async () => {
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

    // Mirror image horizontally (selfie view)
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -FRAME_WIDTH, 0, FRAME_WIDTH, FRAME_HEIGHT);
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
        state: {
          layoutId,
          processedImage: bgRemovedImage,
          frameWidth: FRAME_WIDTH,
          frameHeight: FRAME_HEIGHT,
        },
      });
    } catch (err) {
      console.error("Error while processing image:", err);
      alert("Failed to process image.");
    } finally {
      setProcessing(false);
    }
  };

  /** ⏱ Countdown before capture **/
  const startCountdown = () => {
    if (!isCameraReady || processing) return;
    setCountdown(3);
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

  const handleCameraChange = (e) => {
    const newDeviceId = e.target.value;
    setSelectedDeviceId(newDeviceId);
  };

  return (
    <div className="camera-container">
      <div className="camera-center-box">
        <h3 className="camera-title">Align Yourself and Get Ready!</h3>

        {/* 🔄 Camera Selector */}
        {devices.length > 1 && (
          <div className="camera-select-box">
            <label htmlFor="cameraSelect" className="camera-select-label">
              Switch Camera:
            </label>
            <select
              id="cameraSelect"
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

        {/* 🎥 Camera Frame */}
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

        {/* 📸 Capture Button */}
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

        {permissionDenied && (
          <p className="text-warning mt-3">
            Please allow camera access in your browser settings.
          </p>
        )}
      </div>
    </div>
  );
};

export default CameraPage;
