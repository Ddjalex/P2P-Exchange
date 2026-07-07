import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, Lock, Loader2 } from "lucide-react";

interface Props {
  title?: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
  error?: string;
  onConfirm: (password: string) => void;
  onCancel: () => void;
}

export function PasswordConfirmModal({
  title = "Confirm with Password",
  description = "Enter your account password to continue.",
  confirmLabel = "Confirm",
  loading = false,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input when modal opens
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loading) return;
    onConfirm(password);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {/* Password input */}
          <div className="relative">
            <input
              ref={inputRef}
              type={show ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={loading}
              className="w-full bg-secondary border border-border rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:border-primary placeholder:text-muted-foreground disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShow(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive font-medium">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 py-3 rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!password || loading}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
              ) : (
                confirmLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
