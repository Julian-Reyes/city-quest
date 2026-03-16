import { useEffect, useRef, useState } from "react";

export function CameraOverlay({ onCapture, onClose, showToast }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(document.createElement("canvas"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Camera requires HTTPS or localhost");
      onClose();
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.onloadedmetadata = () => {
            video.play();
            setReady(true);
          };
        }
      })
      .catch(() => {
        if (!cancelled) {
          showToast("Camera access denied");
          onClose();
        }
      });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const base64 = canvas.toDataURL("image/jpeg", 0.8);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(base64);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "#000",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        style={{
          flex: 1,
          objectFit: "cover",
          width: "100%",
          background: "#000",
        }}
      />
      {!ready && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.5)",
            fontSize: 13,
            letterSpacing: 2,
          }}
        >
          Starting camera...
        </div>
      )}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "20px 24px 40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
        }}
      >
        <button
          onClick={() => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            onClose();
          }}
          style={{
            position: "absolute",
            left: 24,
            background: "rgba(255,255,255,0.15)",
            border: "none",
            color: "#fff",
            width: 44,
            height: 44,
            borderRadius: "50%",
            fontSize: 20,
            cursor: "pointer",
          }}
        >
          ✕
        </button>
        <button
          onClick={handleCapture}
          disabled={!ready}
          style={{
            width: 68,
            height: 68,
            borderRadius: "50%",
            background: ready ? "#fff" : "rgba(255,255,255,0.3)",
            border: "4px solid rgba(255,255,255,0.4)",
            cursor: ready ? "pointer" : "default",
          }}
        />
      </div>
    </div>
  );
}
