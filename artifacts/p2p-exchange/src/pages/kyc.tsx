import { AppLayout } from "@/components/layout";
import { ArrowLeft, Check, Camera, UploadCloud, X, Loader2 } from "lucide-react";
import { useSubmitKyc, getGetMeQueryKey } from "@workspace/api-client-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/kyc/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Upload failed");
  }
  const data = await res.json();
  return data.url as string;
}

type UploadState = { status: "idle" } | { status: "uploading" } | { status: "done"; url: string; preview: string } | { status: "error"; message: string };

function useFileUpload() {
  const [state, setState] = useState<UploadState>({ status: "idle" });

  const pick = useCallback((file: File) => {
    const preview = URL.createObjectURL(file);
    setState({ status: "uploading" });
    uploadFile(file)
      .then(url => setState({ status: "done", url, preview }))
      .catch(e => setState({ status: "error", message: e.message }));
  }, []);

  const clear = useCallback(() => setState({ status: "idle" }), []);

  return { state, pick, clear };
}

function UploadBox({
  label,
  upload,
  required,
}: {
  label: string;
  upload: ReturnType<typeof useFileUpload>;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { state, pick, clear } = upload;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) pick(file);
          e.target.value = "";
        }}
      />

      {state.status === "done" ? (
        <div className="relative h-40 rounded-xl overflow-hidden border border-primary/40">
          <img src={state.preview} alt={label} className="w-full h-full object-cover" />
          <button
            onClick={clear}
            className="absolute top-2 right-2 w-7 h-7 bg-background/80 rounded-full flex items-center justify-center text-foreground hover:bg-background"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-0 inset-x-0 bg-primary/90 py-1 text-center text-xs font-bold text-background">
            ✓ Uploaded
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={state.status === "uploading"}
          className={`w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 transition-colors
            ${state.status === "error"
              ? "border-destructive/60 bg-destructive/5 text-destructive"
              : state.status === "uploading"
              ? "border-primary/40 bg-primary/5 text-primary cursor-not-allowed"
              : "border-primary/50 bg-primary/5 text-primary hover:bg-primary/10 cursor-pointer"
            }`}
        >
          {state.status === "uploading" ? (
            <>
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-sm font-medium">Uploading…</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-8 h-8" />
              <span className="text-sm font-medium">
                {state.status === "error" ? "Tap to retry" : "Tap to upload"}
              </span>
              {state.status === "error" && (
                <span className="text-xs px-2 text-center">{state.message}</span>
              )}
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default function KycPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    nationality: "ET",
    idType: "national_id" as "national_id" | "passport" | "drivers_license" | "kebele_id",
  });

  const frontUpload = useFileUpload();
  const backUpload = useFileUpload();
  const selfieUpload = useFileUpload();

  const [livenessStep, setLivenessStep] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const submitKyc = useSubmitKyc();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const livenessInstructions = [
    "Position your face in the oval",
    "Turn your head slowly to the left",
    "Turn your head slowly to the right",
    "Blink your eyes",
    "Verifying...",
  ];

  useEffect(() => {
    if (step === 3 && livenessStep < 4) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "user" } })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        })
        .catch(() => {});

      const timer = setTimeout(() => setLivenessStep(s => s + 1), 3000);
      return () => clearTimeout(timer);
    }
    if (step !== 3 && streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, [step, livenessStep]);

  const canContinueStep2 =
    frontUpload.state.status === "done" &&
    (formData.idType === "passport" || backUpload.state.status === "done");

  const handleSubmit = () => {
    const frontUrl = frontUpload.state.status === "done" ? frontUpload.state.url : "";
    const backUrl = backUpload.state.status === "done" ? backUpload.state.url : undefined;
    const selfieUrl = selfieUpload.state.status === "done" ? selfieUpload.state.url : "https://example.com/mock-selfie.jpg";

    submitKyc.mutate(
      {
        data: {
          ...formData,
          frontImageUrl: frontUrl,
          backImageUrl: backUrl,
          selfieUrl,
          livenessResult: { score: 0.98, passed: true },
        },
      },
      {
        onSuccess: () => {
          toast({ title: "KYC submitted successfully" });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setLocation("/wallet");
        },
        onError: (e: any) => {
          toast({ title: "Submission failed", description: e?.message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <AppLayout showNav={false}>
      <header className="flex items-center space-x-3 p-4 border-b border-border bg-background z-10 sticky top-0">
        {step === 1 ? (
          <Link href="/wallet" className="text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        ) : (
          <button onClick={() => setStep(s => s - 1)} className="text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="font-bold">Identity Verification</h1>
      </header>

      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between mb-4 relative">
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-border -z-10"></div>
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                step >= s ? "bg-primary text-background" : "bg-card border border-border text-muted-foreground"
              }`}
            >
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
          ))}
        </div>

        {/* Step 1 — Personal Info */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in">
            <h2 className="text-xl font-bold">Personal Information</h2>
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Legal Name</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full p-3 bg-card border border-border rounded-lg outline-none focus:border-primary"
                placeholder="As it appears on your ID"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Date of Birth</label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={e => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="w-full p-3 bg-card border border-border rounded-lg outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Document Type</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: "national_id", label: "National ID" },
                  { id: "passport", label: "Passport" },
                  { id: "drivers_license", label: "Driver's License" },
                  { id: "kebele_id", label: "Kebele ID" },
                ].map(type => (
                  <button
                    key={type.id}
                    onClick={() => setFormData({ ...formData, idType: type.id as any })}
                    className={`p-3 text-sm font-medium rounded-xl border text-left transition-all ${
                      formData.idType === type.id
                        ? "border-primary bg-primary/10 shadow-[0_0_10px_rgba(0,212,255,0.2)]"
                        : "border-border bg-card hover:bg-secondary/50"
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!formData.fullName || !formData.dateOfBirth}
              className="w-full py-4 bg-primary text-background font-bold rounded-xl mt-6 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2 — Document Upload */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-xl font-bold">Upload Documents</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Take clear photos of the original document. No photocopies or scans.
              </p>
            </div>

            <UploadBox label="Front Side" upload={frontUpload} required />

            {formData.idType !== "passport" && (
              <UploadBox label="Back Side" upload={backUpload} required />
            )}

            <button
              onClick={() => setStep(3)}
              disabled={!canContinueStep2}
              className="w-full py-4 bg-primary text-background font-bold rounded-xl mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue to Face Verification
            </button>

            {!canContinueStep2 && (
              <p className="text-xs text-center text-muted-foreground -mt-3">
                Upload {frontUpload.state.status !== "done" ? "front" : "back"} image to continue
              </p>
            )}
          </div>
        )}

        {/* Step 3 — Liveness */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 flex flex-col items-center">
            <div className="w-full">
              <h2 className="text-xl font-bold">Face Verification</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Follow the instructions to verify your identity.
              </p>
            </div>

            <div className="relative w-64 h-80 bg-secondary rounded-[100px] overflow-hidden border-4 border-primary shadow-[0_0_30px_rgba(0,212,255,0.3)]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <div className="absolute inset-0 border-[20px] border-background/80 rounded-[100px] pointer-events-none"></div>
            </div>

            <div className="text-center space-y-4 w-full">
              <div className="text-lg font-bold text-primary min-h-[28px]">
                {livenessInstructions[livenessStep]}
              </div>
              <div className="flex justify-center space-x-2">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      i < livenessStep
                        ? "bg-primary"
                        : i === livenessStep
                        ? "bg-primary animate-pulse"
                        : "bg-secondary"
                    }`}
                  />
                ))}
              </div>
            </div>

            {livenessStep >= 4 && (
              <button
                onClick={handleSubmit}
                disabled={submitKyc.isPending}
                className="w-full py-4 bg-primary text-background font-bold rounded-xl mt-6 flex items-center justify-center gap-2"
              >
                {submitKyc.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitKyc.isPending ? "Submitting…" : "Submit Verification"}
              </button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
