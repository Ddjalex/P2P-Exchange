import { AppLayout } from "@/components/layout";
import { ArrowLeft, Check, Camera, UploadCloud } from "lucide-react";
import { useSubmitKyc, getGetMeQueryKey } from "@workspace/api-client-react";
import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function KycPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: "",
    dateOfBirth: "",
    nationality: "ET",
    idType: "national_id" as "national_id" | "passport" | "drivers_license" | "kebele_id",
    frontImageUrl: "https://example.com/mock-front.jpg", // mocked for demo
    backImageUrl: "https://example.com/mock-back.jpg",
    selfieUrl: "https://example.com/mock-selfie.jpg",
  });
  
  const [livenessStep, setLivenessStep] = useState(0); // 0=start, 1=turn left, 2=turn right, 3=blink, 4=done
  const videoRef = useRef<HTMLVideoElement>(null);

  const submitKyc = useSubmitKyc();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const livenessInstructions = [
    "Position your face in the oval",
    "Turn your head slowly to the left",
    "Turn your head slowly to the right",
    "Blink your eyes",
    "Verifying..."
  ];

  // Mock liveness flow on step 3
  useEffect(() => {
    if (step === 3 && livenessStep < 4) {
      // Setup webcam (mocked if blocked)
      navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }).catch(err => console.log("Camera access denied, continuing anyway"));

      const timer = setTimeout(() => {
        setLivenessStep(s => s + 1);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [step, livenessStep]);

  const handleSubmit = () => {
    submitKyc.mutate({
      data: {
        ...formData,
        livenessResult: { score: 0.98, passed: true }
      }
    }, {
      onSuccess: () => {
        toast({ title: "KYC Submitted successfully" });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        setLocation("/wallet");
      }
    });
  };

  return (
    <AppLayout showNav={false}>
      <header className="flex items-center space-x-3 p-4 border-b border-border bg-background z-10 sticky top-0">
        {step === 1 ? (
          <Link href="/wallet" className="text-muted-foreground"><ArrowLeft className="w-5 h-5" /></Link>
        ) : (
          <button onClick={() => setStep(s => s - 1)} className="text-muted-foreground"><ArrowLeft className="w-5 h-5" /></button>
        )}
        <h1 className="font-bold">Identity Verification</h1>
      </header>

      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between mb-4 relative">
          <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-border -z-10"></div>
          {[1, 2, 3].map(s => (
            <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= s ? "bg-primary text-background" : "bg-card border border-border text-muted-foreground"}`}>
              {step > s ? <Check className="w-4 h-4" /> : s}
            </div>
          ))}
        </div>

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

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <h2 className="text-xl font-bold">Upload Documents</h2>
            <p className="text-sm text-muted-foreground mb-4">Take clear photos of the original document. No photocopies or scans.</p>

            <div className="space-y-2">
              <label className="text-sm font-medium">Front Side</label>
              <div className="h-32 border-2 border-dashed border-primary/50 bg-primary/5 rounded-xl flex flex-col items-center justify-center text-primary cursor-pointer hover:bg-primary/10 transition-colors">
                <UploadCloud className="w-8 h-8 mb-2" />
                <span className="text-sm font-medium">Tap to upload</span>
              </div>
            </div>

            {formData.idType !== "passport" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Back Side</label>
                <div className="h-32 border-2 border-dashed border-border bg-card rounded-xl flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:bg-secondary/50 transition-colors">
                  <UploadCloud className="w-8 h-8 mb-2" />
                  <span className="text-sm font-medium">Tap to upload</span>
                </div>
              </div>
            )}

            <button 
              onClick={() => setStep(3)}
              className="w-full py-4 bg-primary text-background font-bold rounded-xl mt-6"
            >
              Continue to Face Verification
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 flex flex-col items-center">
            <h2 className="text-xl font-bold w-full text-left">Face Verification</h2>
            <p className="text-sm text-muted-foreground w-full text-left mb-4">Follow the instructions to verify your identity.</p>

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
                  <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i < livenessStep ? 'bg-primary' : i === livenessStep ? 'bg-primary animate-pulse' : 'bg-secondary'}`} />
                ))}
              </div>
            </div>

            {livenessStep >= 4 && (
              <button 
                onClick={handleSubmit}
                disabled={submitKyc.isPending}
                className="w-full py-4 bg-primary text-background font-bold rounded-xl mt-6"
              >
                {submitKyc.isPending ? "Submitting..." : "Submit Verification"}
              </button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}