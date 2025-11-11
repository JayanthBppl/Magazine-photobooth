import React, { useState, useContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../context/AppContext";
import "../css/UserDetails.css";
import "../css/LayoutSelection.css";
import myntraLogo2 from "../assets/logos/experience-express.png";

function UserAndLayoutPage() {
  const { setLayout } = useContext(AppContext);
  const navigate = useNavigate();

  const [showIntro, setShowIntro] = useState(true);
  const [formData, setFormData] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const layouts = [
    { id: "layout1", src: "/layouts/layout1.jpg" },
    { id: "layout2", src: "/layouts/layout2.jpg" },
    { id: "layout3", src: "/layouts/layout3.jpg" },
  ];

  // const BASE_URL = "https://magazine-photobooth-backend.onrender.com";
  const BASE_URL = "http://localhost:5000";

  useEffect(() => {
    if (formSubmitted) {
      const preload = layouts.map(
        (layout) =>
          new Promise((resolve) => {
            const img = new Image();
            img.src = `${process.env.PUBLIC_URL}${layout.src}`;
            img.onload = resolve;
            img.onerror = resolve;
          })
      );
      Promise.all(preload).then(() => setImagesLoaded(true));
    }
  }, [formSubmitted]);

  const handleIntroContinue = () => setShowIntro(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      alert("Please enter both name and email");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setFormSubmitted(true);
    }, 700);
  };

  // swipe helpers
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const nextLayout = () => setActiveIndex((p) => (p + 1) % layouts.length);
  const prevLayout = () =>
    setActiveIndex((p) => (p === 0 ? layouts.length - 1 : p - 1));

  const handleTouchStart = (e) => (touchStartX.current = e.touches[0].clientX);
  const handleTouchMove = (e) => (touchEndX.current = e.touches[0].clientX);
  const handleTouchEnd = () => {
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 60) nextLayout();
    if (distance < -60) prevLayout();
  };

  // After selecting layout → go to camera page with name/email/layoutId
const handleLayoutSelect = (layout) => {
  console.log("🎯 Sending layoutId:", layout.id);

  setLayout(layout.id);
  navigate("/camera", {
    state: {
      layoutId: layout.id, // ✅ exact ID of clicked image
      name: formData.name,
      email: formData.email,
    },
  });
};




  return (
    <div className="container py-5">
      {/* ======= Opening Message ======= */}
      {showIntro && (
        <div className="consent-overlay">
          <div className="consent-box">
            <h4>Welcome to the Myntra Experience Express!</h4>
            <p className="consent-text">
              Capture your moment with Myntra’s AI Photobooth! You’ll receive a
              digital copy of your photo. These may be used for internal
              communications or Employer Branding.
            </p>
            <button
              className="btn mt-3"
              style={{
                background:
                  "linear-gradient(135deg, #0047FF 0%, #7A00FF 50%, #FF0099 100%)",
                border: "none",
              }}
              onClick={handleIntroContinue}
            >
              Get Started
            </button>
          </div>
        </div>
      )}

      {/* ======= Step 1: User Details ======= */}
      {!formSubmitted && !showIntro && (
        <div className="text-center user-details-section">
          <img src={myntraLogo2} alt="Myntra Logo" className="myntra-main-logo" />
          <h1 className="page-title mt-3">AI PHOTOBOOTH</h1>

          <div
            className="card shadow user-form-card mx-auto mt-4"
            style={{ maxWidth: "480px" }}
          >
            <div className="card-body text-center">
              <h2 className="mb-4 fs-5">Enter Your Details</h2>
              <form onSubmit={handleSubmit}>
                <div className="mb-3 text-start">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="Enter your name"
                  />
                </div>
                <div className="mb-3 text-start">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="Enter your email"
                  />
                </div>
                <button
                  type="submit"
                  className="btn w-100"
                  disabled={loading}
                  style={{
                    background:
                      "linear-gradient(135deg, #0047FF 0%, #7A00FF 50%, #FF0099 100%)",
                    border: "none",
                  }}
                >
                  {loading ? "Please wait..." : "Continue"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

    
{/* ======= Step 2: Layout Selection ======= */}
{formSubmitted && (
  <div
    className="layout-selection-container text-center mt-5"
    onTouchStart={handleTouchStart}
    onTouchMove={handleTouchMove}
    onTouchEnd={handleTouchEnd}
  >
    <h3 className="mb-4">Select Your Layout</h3>

    <div className="layout-display-container">
      <button className="nav-arrow left" onClick={prevLayout}>
        &#8249;
      </button>

      <div className="layout-wrapper">
        {layouts.map((layout, i) => (
          <img
            key={layout.id}
            src={`${process.env.PUBLIC_URL}${layout.src}`}
            alt={layout.id}
            className={`layout-image ${i === activeIndex ? "active" : "inactive"}`}
            onClick={() => handleLayoutSelect(layout)}
            style={{
              display: i === activeIndex ? "block" : "none",
              transition: "all 0.4s ease-in-out",
            }}
          />
        ))}
      </div>

      <button className="nav-arrow right" onClick={nextLayout}>
        &#8250;
      </button>
    </div>

    <div className="dots-indicator" style={{ marginTop: 20 }}>
      {layouts.map((_, i) => (
        <span
          key={i}
          className={`dot ${i === activeIndex ? "active" : ""}`}
          onClick={() => setActiveIndex(i)}
        />
      ))}
    </div>
  </div>
)}



    </div>
  );
}

export default UserAndLayoutPage;
