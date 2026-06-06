export function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div style={{
      position: "absolute",
      top: "-4px", right: "-4px",
      minWidth: "18px", height: "18px",
      background: "#ff3b30",
      borderRadius: "9px",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0 4px",
      border: "2px solid #1a1a2e",
      zIndex: 10,
    }}>
      <span style={{ color: "#fff", fontSize: "10px", fontWeight: 700, lineHeight: 1 }}>
        {count > 99 ? "99+" : count}
      </span>
    </div>
  );
}
