import React, { useState, useContext, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../context/AppContext";
import "../css/UserDetails.css";
import "../css/LayoutSelection.css";
import myntraLogo2 from "../assets/logos/experience-express.png";

function UserAndLayoutPage() {
  const { setUser, setLayout } = useContext(AppContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showConsent, setShowConsent] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);

  const layouts = [
    { id: "layout1", src: "/layouts/layout1.jpg" },
    { id: "layout2", src: "/layouts/layout2.jpg" },
    { id: "layout3", src: "/layouts/layout3.jpg" },
  ];

  const BASE_URL = "https://magazine-photobooth-backend.onrender.com";
  // const BASE_URL = "http://localhost:5000";

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  /** === Form Input Change === */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /** === Save User === */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) {
      alert("Please fill in both fields");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/save-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        setFormSubmitted(true);
      } else {
        alert("Failed to save user");
      }
    } catch (error) {
      console.error("Error saving user:", error);
      alert("Something went wrong while saving your details!");
    } finally {
      setLoading(false);
    }
  };

  /** === Preload Layout Images === */
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

  /** === Layout Selection + Consent === */
  const handleLayoutSelect = (layout) => {
    setLayout(layout.id);
    setShowConsent(true);
  };

  const handleAgree = () => {
    if (isAgreed) {
      setShowConsent(false);
      navigate("/camera", {
        state: { userId: formData._id, layoutId: layouts[activeIndex].id },
      });
    }
  };

  /** === Swipe Navigation === */
  const nextLayout = () => {
    setActiveIndex((prev) => (prev + 1) % layouts.length);
  };

  const prevLayout = () => {
    setActiveIndex((prev) =>
      prev === 0 ? layouts.length - 1 : prev - 1
    );
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 60) nextLayout(); // Swipe Left
    if (distance < -60) prevLayout(); // Swipe Right
  };

  return (
    <div className="container py-5">
      {/* ======= STEP 1: USER DETAILS ======= */}
      {!formSubmitted && (
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
                    className="form-control"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter your name"
                  />
                </div>
                <div className="mb-3 text-start">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email"
                  />
                </div>
                <button
                  type="submit"
                  className="btn w-100"
                  disabled={loading}
                  style={{
                    background: "linear-gradient(135deg, #0047FF 0%, #7A00FF 50%, #FF0099 100%)",

                    border: "none",
                  }}
                >
                  {loading ? "Saving..." : "Continue"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ======= STEP 2: LAYOUT SELECTION ======= */}
      {formSubmitted && (
        <div className="layout-selection-container text-center mt-5">
          <h3 className="mb-4">Select Your Layout</h3>

          <div
            className="layout-display-container"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="layout-wrapper">
              <img
                src={`${process.env.PUBLIC_URL}${layouts[activeIndex].src}`}
                alt={layouts[activeIndex].id}
                className="layout-image active"
                onClick={() => handleLayoutSelect(layouts[activeIndex])}
              />
            </div>
          </div>

          {/* Dots indicator below layout */}
          <div className="dots-indicator">
            {layouts.map((_, i) => (
              <span
                key={i}
                className={`dot ${i === activeIndex ? "active" : ""}`}
                onClick={() => setActiveIndex(i)}
              ></span>
            ))}
          </div>
        </div>
      )}

      {/* ======= CONSENT MODAL ======= */}
      {showConsent && (
        <div className="consent-overlay">
          <div className="consent-box">
            <h4>Consent & Agreement</h4>
            <p className="consent-text">
              By taking a photo, you agree to receive a digital copy of your image.
              You also consent that the image may be used by Myntra for non-commercial
              internal communications and for external Employer Branding purposes.
            </p>

            <div className="checkbox-area">
              <input
                type="checkbox"
                id="agree"
                checked={isAgreed}
                onChange={(e) => setIsAgreed(e.target.checked)}
              />
              <label htmlFor="agree">I agree to the terms above.</label>
            </div>

            <button
              className="btn mt-3"
              disabled={!isAgreed}
              onClick={handleAgree}
              style={{
                background: "linear-gradient(135deg, #0047FF 0%, #7A00FF 50%, #FF0099 100%)",

                border: "none",
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserAndLayoutPage;
