import { useEffect } from "react";
import { useParams, useLocation } from "wouter";

export default function SharedAdPage() {
  const { adId } = useParams<{ adId: string }>();
  const [, navigate] = useLocation();
  const token = localStorage.getItem("p2p_token");

  useEffect(() => {
    if (!adId) return;

    // Save the intended destination so auth page can redirect after login/register
    localStorage.setItem("redirect_after_auth", `/p2p/confirm/${adId}`);

    if (token) {
      // Verify the token is still valid
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => {
        if (res.ok) {
          // Still logged in → go directly to order confirmation
          localStorage.removeItem("redirect_after_auth");
          navigate(`/p2p/confirm/${adId}`);
        } else {
          // Token expired → clear and go to login with redirect param
          localStorage.removeItem("p2p_token");
          navigate("/auth?redirect=" + encodeURIComponent(`/p2p/confirm/${adId}`));
        }
      }).catch(() => {
        navigate("/auth?redirect=" + encodeURIComponent(`/p2p/confirm/${adId}`));
      });
    } else {
      // Not logged in → go to auth with redirect param
      navigate("/auth?redirect=" + encodeURIComponent(`/p2p/confirm/${adId}`));
    }
  }, [adId]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#1a1a2e",
        gap: "16px",
      }}
    >
      <div
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          background: "rgba(0,212,255,0.15)",
          border: "2px solid #00d4ff44",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
        }}
      >
        ₿
      </div>
      <div style={{ color: "#00d4ff", fontSize: "14px", fontWeight: 600 }}>
        Loading trade offer...
      </div>
      <div
        style={{
          width: "36px",
          height: "36px",
          border: "3px solid #334455",
          borderTop: "3px solid #00d4ff",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
