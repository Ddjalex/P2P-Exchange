import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

const TOKEN_KEY = "p2p_token";

export default function AddressStatusPage() {
  const [, navigate] = useLocation();
  const token = localStorage.getItem(TOKEN_KEY);

  const { data, isLoading } = useQuery({
    queryKey: ["address-status"],
    queryFn: () =>
      fetch("/api/kyc/address-status", {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json()),
  });

  return (
    <div style={{ background: "#080d18", minHeight: "100vh", padding: "20px", fontFamily: "Poppins, sans-serif", maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <button onClick={() => navigate("/profile")} style={{ background: "none", border: "none", color: "#fff", fontSize: "22px", cursor: "pointer", lineHeight: 1 }}>←</button>
        <h2 style={{ color: "#fff", fontSize: "18px", fontWeight: 700, margin: 0 }}>Address Verification</h2>
      </div>

      {isLoading && (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#8899aa" }}>Loading...</div>
      )}

      {!isLoading && data?.status === "verified" && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>✅</div>
          <div style={{ color: "#00e5ff", fontSize: "20px", fontWeight: 700 }}>Address Verified!</div>
          <div style={{ color: "#8899aa", fontSize: "13px", marginTop: "8px" }}>
            {data?.submission?.addressLine1}, {data?.submission?.city}, {data?.submission?.country}
          </div>
          <div style={{ marginTop: "24px", background: "rgba(0,229,255,0.06)", border: "1px solid rgba(0,229,255,0.2)", borderRadius: "12px", padding: "16px", textAlign: "left" }}>
            <div style={{ color: "#8899aa", fontSize: "11px", letterSpacing: "1px", marginBottom: "8px" }}>VERIFIED ADDRESS</div>
            <div style={{ color: "#fff", fontSize: "13px", lineHeight: "1.8" }}>
              {data?.submission?.fullName}<br />
              {data?.submission?.addressLine1}
              {data?.submission?.addressLine2 && <><br />{data.submission.addressLine2}</>}<br />
              {data?.submission?.city}{data?.submission?.state ? `, ${data.submission.state}` : ""}<br />
              {data?.submission?.country}
            </div>
          </div>
        </div>
      )}

      {!isLoading && data?.status === "pending" && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>⏳</div>
          <div style={{ color: "#ffaa00", fontSize: "20px", fontWeight: 700 }}>Under Review</div>
          <div style={{ color: "#8899aa", fontSize: "13px", marginTop: "8px" }}>
            We'll notify you within 24 hours.
          </div>
          <div style={{ marginTop: "16px", background: "rgba(255,170,0,0.06)", border: "1px solid rgba(255,170,0,0.2)", borderRadius: "10px", padding: "12px", fontSize: "12px", color: "#8899aa" }}>
            Submitted: {data?.submission?.submittedAt ? new Date(data.submission.submittedAt).toLocaleDateString() : "—"}
          </div>
        </div>
      )}

      {!isLoading && data?.status === "rejected" && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>❌</div>
          <div style={{ color: "#ff4444", fontSize: "20px", fontWeight: 700 }}>Verification Rejected</div>
          {data?.submission?.rejectionReason && (
            <div style={{ color: "#8899aa", fontSize: "13px", marginTop: "8px" }}>
              Reason: {data.submission.rejectionReason}
            </div>
          )}
          <button
            onClick={() => navigate("/settings/address-verify")}
            style={{ marginTop: "20px", background: "#00e5ff", border: "none", borderRadius: "24px", padding: "12px 32px", color: "#080d18", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
          >
            Resubmit
          </button>
        </div>
      )}

      {!isLoading && !data?.status && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: "64px", marginBottom: "16px" }}>📍</div>
          <div style={{ color: "#fff", fontSize: "18px", fontWeight: 700 }}>Not Verified Yet</div>
          <div style={{ color: "#8899aa", fontSize: "13px", marginTop: "8px" }}>
            Verify your address to unlock higher trading limits and earn a trust badge.
          </div>
          <button
            onClick={() => navigate("/settings/address-verify")}
            style={{ marginTop: "20px", background: "#00e5ff", border: "none", borderRadius: "24px", padding: "12px 32px", color: "#080d18", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
          >
            Verify Now
          </button>
        </div>
      )}
    </div>
  );
}
