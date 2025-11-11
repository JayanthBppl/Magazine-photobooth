import React, { useState, useRef, useContext, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AppContext } from "../context/AppContext";
import "../css/CameraPage.css";
import LoadingGif from "../assets/loading.gif";

const CameraPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { layoutId, name, email } = location.state || {};
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

  // ✅ Fixed size matching backend layout
  const FRAME_WIDTH = 1080;
  const FRAME_HEIGHT = 1920;

  /** 🎥 Detect cameras */
  useEffect(() => {
    const detectCameras = async () => {
      try {
        const devicesList = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devicesList.filter((d) => d.kind === "videoinput");
        setDevices(videoInputs);
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
      if (selectedDeviceId) constraints.video.deviceId = { exact: selectedDeviceId };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraReady(true);
        setHasStartedCamera(true);
      }
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Please allow camera access to continue.");
    }
  };

  /** Auto-start camera */
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

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, [selectedDeviceId, layoutId]);

  /** 📸 Capture Image (No Zoom) */
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
ctx.scale(-1, 1);

// Get video’s actual dimensions
const videoAspect = video.videoWidth / video.videoHeight;
const canvasAspect = FRAME_WIDTH / FRAME_HEIGHT;

let drawWidth, drawHeight, offsetX, offsetY;

// ✅ Maintain aspect ratio without stretching
if (videoAspect > canvasAspect) {
  // Video is wider than 9:16 → crop horizontally
  drawHeight = FRAME_HEIGHT;
  drawWidth = FRAME_HEIGHT * videoAspect;
  offsetX = (drawWidth - FRAME_WIDTH) / 2;
  offsetY = 0;
} else {
  // Video is taller → crop vertically
  drawWidth = FRAME_WIDTH;
  drawHeight = FRAME_WIDTH / videoAspect;
  offsetX = 0;
  offsetY = (drawHeight - FRAME_HEIGHT) / 2;
}

// Draw cropped portion of video feed
ctx.drawImage(
  video,
  -FRAME_WIDTH - offsetX,
  -offsetY,
  drawWidth,
  drawHeight
);

ctx.restore();

const data = canvas.toDataURL("image/png");
setCapturedDataUrl(data);
setShowConsent(true);

  };

  /** Countdown before capture */
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

  /** ✅ Submit Image with Consent */
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
      {processing && (
        <div className="processing-overlay">
          <img src={LoadingGif} alt="Processing..." />
          <p>Processing your photo...</p>
        </div>
      )}

      <div className="camera-center-box" style={{ opacity: processing ? 0.3 : 1 }}>
        <h3 className="camera-title">Align Yourself and Get Ready!</h3>

        {devices.length > 1 && (
          <div className="camera-select-box">
            <label className="camera-select-label">Switch Camera:</label>
            <select
              value={selectedDeviceId || ""}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="camera-dropdown"
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

        <div className="camera-frame">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="video-feed"
            style={{ transform: "scaleX(-1)" }}
          />
          <img
            src={`/layouts/${layoutId}/layer-img.png?cacheBust=${Date.now()}`}
            alt="overlay"
            className="overlay-frame"
          />
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

      {showConsent && !processing && (
        <div className="consent-overlay">
          <div className="consent-box">
            <h4>Consent & Agreement</h4>
            <p>
              By taking a photo, you agree to receive a digital copy of your image. 
              You also consent that the image may be used by Myntra for 
              internal communications and Employer Branding purposes.
            </p>
            <div className="consent-buttons">
              <button
                onClick={() => {
                  setShowConsent(false);
                  setProcessing(true);
                  submitImageWithConsent(true);
                }}
              >
                I Agree
              </button>
              <button
                onClick={() => {
                  setShowConsent(false);
                  setProcessing(true);
                  submitImageWithConsent(false);
                }}
              >
                Do Not Agree
              </button>
              <button
                onClick={() => {
                  setShowConsent(false);
                  setCapturedDataUrl(null);
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
