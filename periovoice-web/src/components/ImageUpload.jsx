/**
 * ImageUpload.jsx — PerioVoice AI
 * Lets user upload a photo of their gums/teeth.
 * Validates size (max 5MB) and type (jpg/png).
 */

import React, { useState, useRef } from "react";
import "./ImageUpload.css";

const ImageUpload = ({ onImageSelected, disabled }) => {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate type
    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      setError("Only JPG or PNG images allowed.");
      return;
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }

    setError("");
    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);

    // Pass file to Chat page
    onImageSelected(file);
  };

  const removeImage = () => {
    setPreview(null);
    fileInputRef.current.value = "";
    onImageSelected(null);
  };

  return (
    <div className="image-upload-wrapper">
      {preview ? (
        <div className="image-preview">
          <img src={preview} alt="Uploaded gum/teeth" />
          <button className="remove-img-btn" onClick={removeImage} title="Remove image">✕</button>
        </div>
      ) : (
        <button
          className="image-upload-btn"
          onClick={() => fileInputRef.current.click()}
          disabled={disabled}
          title="Upload image of gums/teeth"
        >
          📷
        </button>
      )}
      {error && <div className="img-error">{error}</div>}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </div>
  );
};

export default ImageUpload;
