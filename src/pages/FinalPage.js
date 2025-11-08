import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

function FinalPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { finalImage, layoutId } = location.state || {};

  if (!finalImage || !layoutId) {
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
          marginBottom: "24px",
        }}
      >
        <img
          src={finalImage}
          alt="Final Portrait"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>

      <div className="d-flex gap-3">
        <button className="btn btn-success px-4" onClick={() => navigate("/")}>
          Home
        </button>
      </div>
    </div>
  );
}

export default FinalPage;
