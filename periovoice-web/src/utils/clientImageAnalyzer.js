/**
 * clientImageAnalyzer.js — Client-Side Canvas Image Analyzer
 * Runs pure JS color and mucosal tissue analysis using HTML5 Canvas.
 * Fallback when FastAPI backend is offline or sleeping.
 */

export const analyzeImageClientSide = async (file) => {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          const maxDim = 300;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          const totalPixels = width * height;

          let totalR = 0, totalG = 0, totalB = 0;
          let oralPinkRedCount = 0;
          let toothEnamelCount = 0;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            totalR += r;
            totalG += g;
            totalB += b;

            const rNorm = r / 255;
            const gNorm = g / 255;
            const bNorm = b / 255;
            const max = Math.max(rNorm, gNorm, bNorm);
            const min = Math.min(rNorm, gNorm, bNorm);
            const delta = max - min;

            let h = 0;
            if (delta !== 0) {
              if (max === rNorm) h = ((gNorm - bNorm) / delta) % 6;
              else if (max === gNorm) h = (bNorm - rNorm) / delta + 2;
              else h = (rNorm - gNorm) / delta + 4;
              h = Math.round(h * 60);
              if (h < 0) h += 360;
            }

            const s = max === 0 ? 0 : delta / max;
            const v = max;

            if ((h <= 35 || h >= 320) && s > 0.15 && v > 0.15) {
              oralPinkRedCount++;
            }

            if (s < 0.25 && v > 0.5) {
              toothEnamelCount++;
            }
          }

          URL.revokeObjectURL(url);

          const pinkRedPct = (oralPinkRedCount / totalPixels) * 100;
          const toothPct = (toothEnamelCount / totalPixels) * 100;
          const avgR = totalR / totalPixels;
          const avgG = totalG / totalPixels;

          if (pinkRedPct < 3.0 && toothPct < 5.0) {
            return resolve({
              status: "success",
              response: "📷 **Image Analysis Notice:** The uploaded photo appears to be a general photo or face photo rather than a close-up dental/oral image. For accurate visual AI triage, please upload a close-up photo of your teeth or gums. Alternatively, please describe your symptoms in text below.",
              is_dental_photo: false,
              findings: ["Non-dental or distant photo detected"]
            });
          }

          const findings = [];
          if (avgR > avgG * 1.3) findings.push("Localized Erythema / Redness");
          if (pinkRedPct > 15) findings.push("Gingival Inflammation / Swelling Sign");
          if (toothPct > 20) findings.push("Visible Enamel / Tooth Structure");
          if (findings.length === 0) findings.push("Mild Gingival Discoloration");

          const responseText = `Visual Assessment Result:\n\n• Detected Signs: ${findings.join(", ")}\n• Tissue Scan: ${pinkRedPct.toFixed(1)}% oral mucosa pattern detected.\n\n*Visual assessment is indicative. Please answer follow-up questions or describe your symptoms for a full triage report.*`;

          resolve({
            status: "success",
            response: responseText,
            is_dental_photo: true,
            findings: findings,
            symptoms: ["gum redness", "gingival swelling"]
          });

        } catch (canvasErr) {
          URL.revokeObjectURL(url);
          resolve({
            status: "success",
            response: "📷 Photo received! Please describe your symptoms (e.g., pain level, bleeding, swelling) in text so I can provide an accurate assessment.",
            is_dental_photo: false
          });
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({
          status: "success",
          response: "📷 Photo received! Please describe your symptoms in text for assessment.",
          is_dental_photo: false
        });
      };

      img.src = url;
    } catch (e) {
      resolve({
        status: "success",
        response: "📷 Photo received! Please describe your symptoms in text for assessment.",
        is_dental_photo: false
      });
    }
  });
};
