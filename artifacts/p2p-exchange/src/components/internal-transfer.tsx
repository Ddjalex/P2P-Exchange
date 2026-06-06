import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getGetWalletQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const TOKEN_KEY = "p2p_token";
function getToken() { return localStorage.getItem(TOKEN_KEY); }

interface Props {
  availableBalance: string;
}

export function InternalTransferPanel({ availableBalance }: Props) {
  const [tabType, setTabType] = useState<"uid" | "email" | "phone">("uid");
  const [identifier, setIdentifier] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [foundUser, setFoundUser] = useState<{ uid: string; username: string; displayName: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const available = parseFloat(availableBalance || "0");

  const searchUser = async (val?: string) => {
    const id = (val ?? identifier).trim();
    if (!id) return;
    setSearching(true);
    setFoundUser(null);
    setSearchError("");
    try {
      const res = await fetch(
        `/api/wallet/find-user?identifier=${encodeURIComponent(id)}&type=${tabType}`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      const data = await res.json();
      if (res.ok && data.found) {
        setFoundUser(data.user);
      } else {
        setSearchError(data.message || "User not found on Xendrx");
      }
    } catch {
      setSearchError("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleTransfer = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/wallet/internal-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          identifierType: tabType,
          amount: parseFloat(amount),
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      return data;
    },
    onSuccess: () => {
      setSuccess(true);
      setFoundUser(null);
      setIdentifier("");
      setAmount("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  if (success) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: "64px", marginBottom: "16px" }}>✅</div>
        <div style={{ color: "#fff", fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
          Transfer Successful!
        </div>
        <div style={{ color: "#8899aa", fontSize: "13px", marginBottom: "24px" }}>
          USDT sent instantly with zero fees
        </div>
        <button
          onClick={() => setSuccess(false)}
          style={{
            background: "#00d4ff", border: "none", borderRadius: "24px",
            padding: "12px 32px", color: "#080d18", fontWeight: 700,
            fontSize: "14px", cursor: "pointer",
          }}
        >
          Send Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Poppins, sans-serif" }}>
      {/* Zero fee badge */}
      <div style={{
        background: "rgba(0,212,255,0.08)",
        border: "1px solid rgba(0,212,255,0.25)",
        borderRadius: "10px", padding: "10px 14px",
        display: "flex", alignItems: "center", gap: "8px",
        marginBottom: "20px",
      }}>
        <span style={{ fontSize: "18px" }}>⚡</span>
        <div>
          <div style={{ color: "#00d4ff", fontSize: "13px", fontWeight: 600 }}>
            Internal Transfer — Zero Fees
          </div>
          <div style={{ color: "#8899aa", fontSize: "11px" }}>
            Transfer instantly to any Xendrx user
          </div>
        </div>
        <span style={{
          marginLeft: "auto", background: "#00d4ff",
          color: "#080d18", fontSize: "10px", fontWeight: 700,
          padding: "3px 8px", borderRadius: "10px",
        }}>0 Fee</span>
      </div>

      {/* Recipient type tabs */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ color: "#8899aa", fontSize: "11px", marginBottom: "8px", letterSpacing: "1px" }}>
          RECIPIENT
        </div>
        <div style={{
          display: "flex", background: "rgba(255,255,255,0.05)",
          borderRadius: "8px", padding: "2px",
        }}>
          {(["uid", "email", "phone"] as const).map(t => (
            <button key={t}
              onClick={() => { setTabType(t); setFoundUser(null); setIdentifier(""); setSearchError(""); }}
              style={{
                flex: 1, padding: "8px",
                background: tabType === t ? "rgba(0,212,255,0.15)" : "transparent",
                border: tabType === t ? "1px solid rgba(0,212,255,0.3)" : "1px solid transparent",
                borderRadius: "6px",
                color: tabType === t ? "#00d4ff" : "#8899aa",
                fontSize: "12px", fontWeight: 600, cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              {t === "uid" ? "UID" : t === "email" ? "Email" : "Phone"}
            </button>
          ))}
        </div>
      </div>

      {/* Identifier input */}
      <div style={{ position: "relative", marginBottom: "8px" }}>
        <input
          value={identifier}
          onChange={e => { setIdentifier(e.target.value); setFoundUser(null); setSearchError(""); }}
          onBlur={() => searchUser()}
          placeholder={
            tabType === "uid" ? "Enter UID (e.g. 120100976)" :
            tabType === "email" ? "Enter email address" :
            "Enter phone number"
          }
          style={{
            width: "100%", background: "rgba(255,255,255,0.06)",
            border: `1.5px solid ${foundUser ? "#00d4ff" : searchError ? "#ff4444" : "#334455"}`,
            borderRadius: "10px", padding: "12px 50px 12px 14px",
            color: "#fff", fontSize: "14px", outline: "none",
            boxSizing: "border-box",
          }}
        />
        <button
          onClick={async () => {
            const text = await navigator.clipboard.readText();
            setIdentifier(text);
            setTimeout(() => searchUser(text), 100);
          }}
          style={{
            position: "absolute", right: "10px", top: "50%",
            transform: "translateY(-50%)",
            background: "none", border: "none",
            color: "#00d4ff", cursor: "pointer", fontSize: "18px",
          }}
        >📋</button>
      </div>

      {searching && <div style={{ color: "#8899aa", fontSize: "12px", marginBottom: "12px" }}>Searching...</div>}
      {searchError && <div style={{ color: "#ff4444", fontSize: "12px", marginBottom: "12px" }}>❌ {searchError}</div>}
      {foundUser && (
        <div style={{
          background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)",
          borderRadius: "10px", padding: "10px 14px", marginBottom: "16px",
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "50%",
            background: "rgba(0,212,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#00d4ff", fontWeight: 700, fontSize: "14px",
          }}>
            {foundUser.displayName?.[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>{foundUser.displayName}</div>
            <div style={{ color: "#8899aa", fontSize: "11px" }}>UID: {foundUser.uid}</div>
          </div>
          <span style={{ marginLeft: "auto", color: "#00d4ff", fontSize: "16px" }}>✓</span>
        </div>
      )}

      {/* Amount */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ color: "#8899aa", fontSize: "11px", marginBottom: "8px", letterSpacing: "1px" }}>
          AMOUNT (USDT)
        </div>
        <div style={{ position: "relative" }}>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="Min. 1 USDT"
            min="1"
            step="0.0001"
            style={{
              width: "100%", background: "rgba(255,255,255,0.06)",
              border: "1.5px solid #334455", borderRadius: "10px",
              padding: "12px 60px 12px 14px",
              color: "#fff", fontSize: "14px", outline: "none",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={() => setAmount(available.toFixed(4))}
            style={{
              position: "absolute", right: "10px", top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(0,212,255,0.15)", border: "1px solid rgba(0,212,255,0.3)",
              borderRadius: "6px", padding: "4px 8px",
              color: "#00d4ff", fontSize: "11px", fontWeight: 700, cursor: "pointer",
            }}
          >MAX</button>
        </div>
        <div style={{ color: "#8899aa", fontSize: "11px", marginTop: "6px" }}>
          Available: {available.toFixed(4)} USDT
        </div>
      </div>

      {/* Note */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ color: "#8899aa", fontSize: "11px", marginBottom: "8px", letterSpacing: "1px" }}>
          NOTE (OPTIONAL)
        </div>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Add a note..."
          maxLength={100}
          style={{
            width: "100%", background: "rgba(255,255,255,0.06)",
            border: "1.5px solid #334455", borderRadius: "10px",
            padding: "12px 14px", color: "#fff", fontSize: "13px",
            outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {/* Fee summary */}
      <div style={{ background: "#0c1420", borderRadius: "10px", padding: "12px 14px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ color: "#8899aa", fontSize: "12px" }}>Amount</span>
          <span style={{ color: "#fff", fontSize: "12px" }}>{amount || "0"} USDT</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ color: "#8899aa", fontSize: "12px" }}>Transfer Fee</span>
          <span style={{ color: "#00d4ff", fontSize: "12px", fontWeight: 700 }}>Zero</span>
        </div>
        <div style={{
          display: "flex", justifyContent: "space-between",
          borderTop: "1px solid #1e2d3d", paddingTop: "8px",
        }}>
          <span style={{ color: "#fff", fontSize: "13px", fontWeight: 600 }}>Recipient Gets</span>
          <span style={{ color: "#00d4ff", fontSize: "13px", fontWeight: 700 }}>{amount || "0"} USDT</span>
        </div>
      </div>

      <button
        onClick={() => handleTransfer.mutate()}
        disabled={
          !foundUser || !amount ||
          parseFloat(amount) < 1 ||
          parseFloat(amount) > available ||
          handleTransfer.isPending
        }
        style={{
          width: "100%", height: "50px",
          background: foundUser && amount && parseFloat(amount) >= 1 && parseFloat(amount) <= available
            ? "#00d4ff" : "#334455",
          border: "none", borderRadius: "25px",
          color: foundUser && amount ? "#080d18" : "#556677",
          fontSize: "15px", fontWeight: 700,
          cursor: foundUser && amount ? "pointer" : "not-allowed",
        }}
      >
        {handleTransfer.isPending ? "Sending..." : "⚡ Send USDT"}
      </button>

      {handleTransfer.isError && (
        <div style={{ color: "#ff4444", fontSize: "12px", textAlign: "center", marginTop: "10px" }}>
          ❌ {(handleTransfer.error as Error).message}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: "16px" }}>
        <a href="/wallet/transfer-history"
          style={{ color: "#00d4ff", fontSize: "12px", textDecoration: "none" }}>
          View Transfer History →
        </a>
      </div>
    </div>
  );
}
