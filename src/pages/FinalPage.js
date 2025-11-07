import React, { useContext, useState, useEffect } from "react";
import { AppContext } from "../context/AppContext";
import { useNavigate } from "react-router-dom";

function FinalPage() {
  const { layoutId, processedImage, user } = useContext(AppContext);
  const navigate = useNavigate();

  const [finalImage, setFinalImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // const BASE_URL = "http://localhost:5000";
  const BASE_URL = "https://magazine-photobooth-backend.onrender.com";

  // 🧠 Compose automatically when the page loads
  useEffect(() => {
    const composeFinalImage = async () => {
      if (!processedImage || !layoutId) {
        setError("Missing processed image or layout ID!");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/compose-final`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userImage: processedImage,
            layoutId,
            name: user?.name || "",
          }),
        });

        const data = await res.json();
        if (data.success && data.finalImageData) {
          setFinalImage(data.finalImageData);
        } else {
          setError("Failed to compose image.");
        }
      } catch (err) {
        console.error("Compose error:", err);
        setError("Something went wrong while composing the final image!");
      } finally {
        setLoading(false);
      }
    };

    composeFinalImage();
  }, [processedImage, layoutId, user]);

  // ⚠️ Handle missing data
  if (!processedImage || !layoutId) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100 bg-dark text-white">
        <h4>Missing data. Please retake your photo.</h4>
      </div>
    );
  }

  return (
    <div
      className="container-fluid text-center py-5 bg-dark text-white d-flex flex-column align-items-center justify-content-center"
      style={{ minHeight: "100vh" }}
    >
      <h3 className="mb-4 fw-semibold">Your Final Portrait</h3>

      {/* 🧩 Step 1: Loading Spinner */}
      {loading && (
        <div className="d-flex flex-column align-items-center mt-5">
          <div
            className="spinner-border text-light mb-3"
            role="status"
            style={{ width: "3rem", height: "3rem" }}
          ></div>
          <p className="text-light">Composing your portrait...</p>
        </div>
      )}

      {/* ⚠️ Step 2: Error Message */}
      {error && !loading && (
        <p className="text-danger mt-4 fw-semibold">{error}</p>
      )}

      {/* 🖼️ Step 3: Display Composed Image */}
      {!loading && finalImage && (
        <div
          style={{
            position: "relative",
            width: "280px",
            height: "480px",
            borderRadius: "12px",
            overflow: "hidden",
            backgroundColor: "#000",
            boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "24px", // spacing before buttons
          }}
        >
          <img
            src={finalImage}
            alt="Final Portrait"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover", // fills entire frame
              display: "block",
            }}
          />
        </div>
      )}

      {/* 🔙 Step 4: Navigation */}
      <div className="d-flex gap-3">
        <button
          className="btn btn-success px-4"
          onClick={() => navigate("/")}
        >
          Home
        </button>
      </div>
    </div>
  );
}

export default FinalPage;
