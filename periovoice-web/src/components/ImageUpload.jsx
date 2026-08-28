import React, { useRef, useState } from "react";
import "./ImageUpload.css";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";

const ImageUpload = ({ onImageSelected, disabled }) => {
  const fileInputRef = useRef(null);
  const [error, setError] = useState("");

  const handleCapacitorCamera = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt // Prompts user to either take photo or choose from gallery
      });

      if (!image || !image.webPath) {
        console.warn("[Android Camera] Camera returned no webPath");
        return;
      }

      console.log("[Android Camera] Image picked from native platform:", {
        format: image.format,
        webPath: image.webPath,
        path: image.path
      });

      // Fetch file data as Blob from Capacitor local URI
      const response = await fetch(image.webPath);
      const blob = await response.blob();

      console.log("[Android Camera] Converted webPath to Blob:", {
        type: blob.type,
        size: blob.size
      });

      // Verify format
      const isAllowedFormat = ["jpeg", "jpg", "png", "webp"].includes(image.format.toLowerCase());
      if (!isAllowedFormat) {
        setError(`Please select a photo in JPG, PNG, or WEBP format. (Got: ${image.format})`);
        return;
      }

      // Check size limit (10MB)
      if (blob.size > 10 * 1024 * 1024) {
        setError("Image must be under 10MB.");
        return;
      }

      setError("");

      // Wrap in standard File object so downstream code receives name/type/size
      const filename = `camera_${Date.now()}.${image.format}`;
      const mimeType = blob.type || `image/${image.format}`;
      const fileObject = new File([blob], filename, { type: mimeType });

      console.log("[Android Camera] Created File object:", {
        name: fileObject.name,
        type: fileObject.type,
        size: fileObject.size
      });

      onImageSelected(fileObject);
    } catch (err) {
      console.error("[Android Camera] Error picking image:", err);
      // Avoid showing warning if user closed the picker
      if (err.message !== "User cancelled photos app" && err.message !== "Permission denied") {
        setError(`Failed to retrieve image: ${err.message || err}`);
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    // Support Android camera/gallery mime types (jpeg, png, webp, heic, image/*)
    const isImage = (file.type && file.type.startsWith("image/")) || /\.(jpg|jpeg|png|webp|heic|bmp)$/i.test(file.name || "");

    if (!isImage) {
      setError("Please select a clear photo (JPG, PNG, WEBP).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10MB.");
      return;
    }

    setError("");

    // Send image directly to Chat.jsx
    onImageSelected(file);

    // Clear input so the same image can be selected again later
    e.target.value = "";
  };

  const handleUploadClick = () => {
    if (Capacitor.isNativePlatform()) {
      handleCapacitorCamera();
    } else {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="image-upload-wrapper">
      <button
        type="button"
        className="image-upload-btn"
        onClick={handleUploadClick}
        disabled={disabled}
        title="Upload image of gums or teeth"
      >
        📷
      </button>

      {error && <div className="img-error">{error}</div>}

      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </div>
  );
};

export default ImageUpload;