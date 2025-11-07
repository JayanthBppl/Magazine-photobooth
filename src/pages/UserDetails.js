import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../context/AppContext";
import "../css/UserDetails.css";
import "../css/LayoutSelection.css";

function UserAndLayoutPage() {
  const { setUser, setLayout } = useContext(AppContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);

  // ✅ Layout options
  const layouts = [
    { id: "layout1", src: "/layouts/layout3.jpg" },
    { id: "layout2", src: "/layouts/layout2.jpg" },
    { id: "layout3", src: "/layouts/layout3.jpg" }
  ];

  const BASE_URL = "http://localhost:5000";

  /** Handle input changes **/
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /** Save user details **/
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

  /** Preload layout images after form submission **/
  useEffect(() => {
    if (formSubmitted) {
      const preload = layouts.map((layout) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.src = `${process.env.PUBLIC_URL}${layout.src}`;
          img.onload = resolve;
          img.onerror = resolve;
        });
      });

      Promise.all(preload).then(() => setImagesLoaded(true));
    }
  }, [formSubmitted]);

  /** Handle layout selection **/
  const handleLayoutSelect = (layout) => {
    setLayout(layout.id);
    navigate("/camera", {
      state: {
        userId: formData._id,
        layoutId: layout.id,
      },
    });
  };

  /** Render **/
  return (
    <div className="container py-5">
      {/* Logo Section */}
      {!formSubmitted && (
        <div className="text-center mb-4">
          <h1>Magazine Photobooth</h1>
        </div>
      )}

      {/* Step 1: User Details */}
      {!formSubmitted && (
        <div
          className="card shadow user-form-card mx-auto"
          style={{ maxWidth: "500px" }}
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
                className="btn btn-primary w-100"
                disabled={loading}
              >
                {loading ? "Saving..." : "Continue"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Step 2: Layout Selection */}
      {formSubmitted && (
        <div className="layout-selection-container text-center mt-5">
          <h3 className="mb-4">Select Your Layout</h3>

          {!imagesLoaded ? (
            <div className="d-flex justify-content-center align-items-center">
              <div
                className="spinner-border text-primary"
                role="status"
                style={{ width: "3rem", height: "3rem" }}
              >
                <span className="visually-hidden">Loading layouts...</span>
              </div>
              <p className="mt-2 ms-3">Loading layouts...</p>
            </div>
          ) : (
            <div className="d-flex flex-column flex-md-row gap-4 justify-content-center align-items-center">
              {layouts.map((layout) => (
                <div
                  key={layout.id}
                  onClick={() => handleLayoutSelect(layout)}
                  style={{
                    cursor: "pointer",
                    width: "100%",
                    maxWidth: "350px",
                    borderRadius: "10px",
                    overflow: "hidden",
                    transition: "transform 0.3s ease",
                  }}
                  className="layout-card shadow-sm"
                >
                  <img
                    src={`${process.env.PUBLIC_URL}${layout.src}`}
                    alt={layout.id}
                    className="img-fluid"
                    style={{
                      width: "100%",
                      height: "auto",
                      borderRadius: "10px",
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default UserAndLayoutPage;
