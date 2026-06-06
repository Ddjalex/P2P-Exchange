import { useState } from "react";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { useLocation } from "wouter";

export default function AdminLoginPage() {
  const { login, admin } = useAdminAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (admin) { navigate("/admin/dashboard"); return null; }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/admin/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" style={{ fontFamily: 'Poppins, sans-serif' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/src/assets/logo-icon.svg" alt="SwapBirr" width={56} height={56} style={{ margin: '0 auto 12px' }} />
          <div className="text-3xl font-bold mb-1">
            Swap<span style={{ color: '#00d4ff' }}>Birr</span>
          </div>
          <div className="text-muted-foreground text-sm">Admin Dashboard</div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          <h1 className="font-bold text-xl mb-6">Sign In</h1>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@swapbirr.com"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>

        <div className="text-center mt-4 text-xs text-muted-foreground">
          SwapBirr Admin — Authorized personnel only
        </div>
      </div>
    </div>
  );
}
