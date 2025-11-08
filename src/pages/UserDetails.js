import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../context/AppContext";
import "../css/UserDetails.css";
import "../css/LayoutSelection.css";
import myntraLogo from "../assets/logos/myntra-logo.png";
import myntraLogo2 from "../assets/logos/Logo-1-removebg-preview.png"

function UserAndLayoutPage() {
  const { setUser, setLayout } = useContext(AppContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const layouts = [
    { id: "layout1", src: "/layouts/layout1.jpg" },
    { id: "layout2", src: "/layouts/layout2.jpg" },
    { id: "layout3", src: "/layouts/layout3.jpg" },
  ];

  const BASE_URL = "http://localhost:5000"|| "https://magazine-photobooth-backend.onrender.com";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

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

  const handleLayoutSelect = (layout) => {
    setLayout(layout.id);
    navigate("/camera", {
      state: { userId: formData._id, layoutId: layout.id },
    });
  };

  const nextLayout = () => {
    if (transitioning) return;
    setTransitioning(true);
    setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % layouts.length);
      setTransitioning(false);
    }, 400);
  };

  const prevLayout = () => {
    if (transitioning) return;
    setTransitioning(true);
    setTimeout(() => {
      setActiveIndex((prev) =>
        prev === 0 ? layouts.length - 1 : prev - 1
      );
      setTransitioning(false);
    }, 400);
  };

  return (
    <div className="container py-5">
      {/* ======= Step 1: User Details ======= */}
      {!formSubmitted && (
        <div className="text-center user-details-section">
          <img
            src={myntraLogo2}
            alt="Myntra Logo"
            className="myntra-main-logo"
          />
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
                    background: "linear-gradient(90deg, #ec008c, #f7931e)",
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

      {/* ======= Step 2: Layout Selection ======= */}
      {formSubmitted && (
        <div className="layout-selection-container text-center mt-5">
          <h3 className="mb-4">Select Your Layout</h3>

          {!imagesLoaded ? (
            <div className="loading-section">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="mt-2">Loading layouts...</p>
            </div>
          ) : (
            <div className="layout-display-container">
              <button className="nav-arrow left" onClick={prevLayout}>
                &#8249;
              </button>

              <div
                className={`layout-wrapper ${
                  transitioning ? "fade-transition" : ""
                }`}
              >
                <img
                  src={`${process.env.PUBLIC_URL}${layouts[activeIndex].src}`}
                  alt={layouts[activeIndex].id}
                  className="layout-image active"
                  onClick={() => handleLayoutSelect(layouts[activeIndex])}
                />
              </div>

              <button className="nav-arrow right" onClick={nextLayout}>
                &#8250;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default UserAndLayoutPage;
