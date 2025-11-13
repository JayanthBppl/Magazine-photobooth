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
  // const BASE_URL = "http://localhost:5000";

  const FRAME_WIDTH = 1080;
  const FRAME_HEIGHT = 1920;

  /* ----------------------------------------------------------
      RESIZE CAPTURE TO 288x432 (IMPORTANT!!)
  ---------------------------------------------------------- */
 const resizeToLayoutSize = (dataUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const out = document.createElement("canvas");
      out.width = 288;
      out.height = 432;

      const ctx = out.getContext("2d");

      ctx.fillStyle = "transparent";
      ctx.fillRect(0, 0, out.width, out.height);

      const imgAspect = img.width / img.height;
      const layoutAspect = 288 / 432;

      let drawWidth, drawHeight, x, y;

      if (imgAspect > layoutAspect) {
        drawHeight = 432;
        drawWidth = drawHeight * imgAspect;
        x = (288 - drawWidth) / 2;
        y = 0;
      } else {
        drawWidth = 288;
        drawHeight = drawWidth / imgAspect;
        x = 0;
        y = (432 - drawHeight) / 2;
      }

      /* ----------------------------------------
         🔥 SHIFT USER IMAGE DOWN
         Increase value to move further down
      -----------------------------------------*/
      const DOWN_OFFSET = 40; // try 30–60 until perfect
      y += DOWN_OFFSET;

      ctx.drawImage(img, x, y, drawWidth, drawHeight);

      resolve(out.toDataURL("image/png"));
    };

    img.src = dataUrl;
  });
};

  /* ----------------------------------------------------------
      Detect Cameras
  ---------------------------------------------------------- */
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

  /* ----------------------------------------------------------
      Start Camera
  ---------------------------------------------------------- */
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
      videoRef.current.srcObject = stream;
      setIsCameraReady(true);
      setHasStartedCamera(true);
    } catch (err) {
      console.error("Camera access error:", err);
      alert("Please allow camera access to continue.");
    }
  };

  useEffect(() => {
    const autoStart = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        startCamera();
      } catch {}
    };

    autoStart();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, [selectedDeviceId]);

  /* ----------------------------------------------------------
      Capture 1080x1920 → Auto-resize → 288x432
  ---------------------------------------------------------- */
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

    const videoAspect = video.videoWidth / video.videoHeight;
    const canvasAspect = FRAME_WIDTH / FRAME_HEIGHT;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (videoAspect > canvasAspect) {
      drawHeight = FRAME_HEIGHT;
      drawWidth = drawHeight * videoAspect;
      offsetX = (drawWidth - FRAME_WIDTH) / 2;
      offsetY = 0;
    } else {
      drawWidth = FRAME_WIDTH;
      drawHeight = FRAME_WIDTH / videoAspect;
      offsetX = 0;
      offsetY = (drawHeight - FRAME_HEIGHT) / 2;
    }

    ctx.drawImage(video, -FRAME_WIDTH - offsetX, -offsetY, drawWidth, drawHeight);
    ctx.restore();

    const rawData = canvas.toDataURL("image/png");

    /* 🔥 Resize BEFORE sending to backend */
    resizeToLayoutSize(rawData).then((resized) => {
      setCapturedDataUrl(resized);
      setShowConsent(true);
    });
  };

  /* ----------------------------------------------------------
      Countdown
  ---------------------------------------------------------- */
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

  /* ----------------------------------------------------------
      Submit to Backend
  ---------------------------------------------------------- */
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
      if (!data.success) throw new Error(data.message);

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
          <img src={LoadingGif} alt="Processing..." className="loading-icon" />
          <p className="loading-text">Processing your photo...</p>
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
              By taking a photo, you agree to receive a digital copy. <br />
              You also consent that the image may be used for internal communications &
              employer branding.
            </p>
            <div className="consent-buttons">
              <button
                className="agree-btn"
                onClick={() => {
                  setShowConsent(false);
                  setProcessing(true);
                  submitImageWithConsent(true);
                }}
              >
                I Agree
              </button>
              <button
                className="decline-btn"
                onClick={() => {
                  setShowConsent(false);
                  setProcessing(true);
                  submitImageWithConsent(false);
                }}
              >
                Do Not Agree
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraPage;
