import { useState } from "react";
import { useLocation } from "wouter";

const TOKEN_KEY = "p2p_token";

export default function AddressVerifyPage() {
  const [, navigate] = useLocation();
  const token = localStorage.getItem(TOKEN_KEY);

  const [formData, setFormData] = useState({
    fullName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    documentType: "",
  });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("File must be under 5MB");
      return;
    }
    setDocumentFile(file);
    setPreview(URL.createObjectURL(file));
    setError("");
  };

  const handleSubmit = async () => {
    if (!formData.fullName || !formData.addressLine1 || !formData.city || !formData.country || !formData.documentType) {
      setError("Please fill all required fields");
      return;
    }
    if (!documentFile) {
      setError("Please upload a proof of address document");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const uploadForm = new FormData();
      uploadForm.append("file", documentFile);
      const uploadRes = await fetch("/api/kyc/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: uploadForm,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error("Upload failed");

      const res = await fetch("/api/kyc/address-verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...formData, documentImageUrl: uploadData.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Submission failed");
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div style={{ background: "#080d18", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "Poppins, sans-serif" }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>⏳</div>
        <h2 style={{ color: "#fff", fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>Submitted for Review</h2>
        <p style={{ color: "#8899aa", fontSize: "13px", textAlign: "center", marginBottom: "24px" }}>
          Your address verification is under review. We'll notify you within 24 hours.
        </p>
        <button
          onClick={() => navigate("/profile")}
          style={{ background: "#00e5ff", border: "none", borderRadius: "24px", padding: "12px 32px", color: "#080d18", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}
        >
          Back to Profile
        </button>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,0.06)", border: "1.5px solid #334455",
    borderRadius: "10px", padding: "12px 14px", color: "#fff", fontSize: "13px",
    outline: "none", boxSizing: "border-box", fontFamily: "Poppins, sans-serif",
  };
  const labelStyle: React.CSSProperties = {
    color: "#8899aa", fontSize: "11px", letterSpacing: "1px", display: "block", marginBottom: "6px",
  };

  return (
    <div style={{ background: "#080d18", minHeight: "100vh", padding: "20px", fontFamily: "Poppins, sans-serif", maxWidth: "480px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <button onClick={() => navigate("/profile")} style={{ background: "none", border: "none", color: "#fff", fontSize: "22px", cursor: "pointer", lineHeight: 1 }}>←</button>
        <div>
          <h2 style={{ color: "#fff", fontSize: "18px", fontWeight: 700, margin: 0 }}>Address Verification</h2>
          <p style={{ color: "#8899aa", fontSize: "11px", margin: 0 }}>Verify your residential address</p>
        </div>
      </div>

      <div style={{ background: "rgba(0,229,255,0.06)", border: "1px solid rgba(0,229,255,0.2)", borderRadius: "12px", padding: "14px", marginBottom: "24px" }}>
        <div style={{ color: "#00e5ff", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>📍 Why verify your address?</div>
        <div style={{ color: "#8899aa", fontSize: "12px", lineHeight: "1.6" }}>
          Address verification increases your trust score, unlocks higher trading limits, and shows a verified badge on your profile.
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)", borderRadius: "8px", padding: "10px 14px", marginBottom: "16px", color: "#ff4444", fontSize: "12px" }}>
          ❌ {error}
        </div>
      )}

      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>FULL NAME *</label>
        <input value={formData.fullName} onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))} placeholder="As shown on your document" style={inputStyle} />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>ADDRESS LINE 1 *</label>
        <input value={formData.addressLine1} onChange={e => setFormData(p => ({ ...p, addressLine1: e.target.value }))} placeholder="Street address, house number" style={inputStyle} />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>ADDRESS LINE 2 (OPTIONAL)</label>
        <input value={formData.addressLine2} onChange={e => setFormData(p => ({ ...p, addressLine2: e.target.value }))} placeholder="Apartment, suite, unit, building" style={inputStyle} />
      </div>

      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>CITY *</label>
          <input value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} placeholder="City" style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>POSTAL CODE</label>
          <input value={formData.postalCode} onChange={e => setFormData(p => ({ ...p, postalCode: e.target.value }))} placeholder="Postal / ZIP" style={inputStyle} />
        </div>
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>STATE / REGION</label>
        <input value={formData.state} onChange={e => setFormData(p => ({ ...p, state: e.target.value }))} placeholder="State or region (optional)" style={inputStyle} />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>COUNTRY *</label>
        <input value={formData.country} onChange={e => setFormData(p => ({ ...p, country: e.target.value }))} placeholder="Country" style={inputStyle} />
      </div>

      <div style={{ marginBottom: "16px" }}>
        <label style={labelStyle}>DOCUMENT TYPE *</label>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            { value: "utility_bill", label: "💡 Utility Bill", desc: "Electricity, water, gas bill" },
            { value: "bank_statement", label: "🏦 Bank Statement", desc: "Within last 3 months" },
            { value: "government_letter", label: "📄 Government Letter", desc: "Tax, pension, benefits letter" },
            { value: "lease_agreement", label: "🏠 Lease Agreement", desc: "Rental contract with address" },
          ].map(doc => (
            <div
              key={doc.value}
              onClick={() => setFormData(p => ({ ...p, documentType: doc.value }))}
              style={{
                padding: "12px 14px", borderRadius: "10px", cursor: "pointer",
                border: formData.documentType === doc.value ? "1.5px solid #00e5ff" : "1px solid #334455",
                background: formData.documentType === doc.value ? "rgba(0,229,255,0.08)" : "transparent",
                display: "flex", alignItems: "center", gap: "10px",
              }}
            >
              <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: formData.documentType === doc.value ? "5px solid #00e5ff" : "2px solid #556677", flexShrink: 0 }} />
              <div>
                <div style={{ color: formData.documentType === doc.value ? "#00e5ff" : "#fff", fontSize: "13px", fontWeight: 600 }}>{doc.label}</div>
                <div style={{ color: "#8899aa", fontSize: "11px" }}>{doc.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label style={labelStyle}>UPLOAD DOCUMENT * (JPG/PNG/PDF, max 5MB)</label>
        {preview ? (
          <div style={{ position: "relative" }}>
            <img src={preview} alt="Document" style={{ width: "100%", maxHeight: "200px", objectFit: "cover", borderRadius: "10px", border: "1.5px solid #00e5ff" }} />
            <button
              onClick={() => { setDocumentFile(null); setPreview(null); }}
              style={{ position: "absolute", top: "8px", right: "8px", background: "#ff4444", border: "none", borderRadius: "50%", width: "28px", height: "28px", color: "#fff", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
            >×</button>
          </div>
        ) : (
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", border: "2px dashed #334455", borderRadius: "12px", padding: "32px 20px", cursor: "pointer", background: "rgba(255,255,255,0.02)" }}>
            <span style={{ fontSize: "32px" }}>📄</span>
            <span style={{ color: "#8899aa", fontSize: "13px" }}>Tap to upload document</span>
            <span style={{ color: "#556677", fontSize: "11px" }}>JPG, PNG or PDF</span>
            <input type="file" accept="image/*,.pdf" onChange={handleFileSelect} style={{ display: "none" }} />
          </label>
        )}
      </div>

      <div style={{ background: "rgba(255,170,0,0.06)", border: "1px solid rgba(255,170,0,0.2)", borderRadius: "10px", padding: "12px 14px", marginBottom: "20px" }}>
        <div style={{ color: "#ffaa00", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>⚠️ Document Requirements</div>
        <div style={{ color: "#8899aa", fontSize: "11px", lineHeight: "1.8" }}>
          • Must show your full name and address clearly<br />
          • Document must be dated within the last 3 months<br />
          • All four corners must be visible<br />
          • No blurry or edited documents accepted
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{ width: "100%", height: "50px", background: submitting ? "#334455" : "#00e5ff", border: "none", borderRadius: "25px", color: submitting ? "#8899aa" : "#080d18", fontSize: "15px", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "Poppins, sans-serif" }}
      >
        {submitting ? "Submitting..." : "📍 Submit for Verification"}
      </button>
    </div>
  );
}
