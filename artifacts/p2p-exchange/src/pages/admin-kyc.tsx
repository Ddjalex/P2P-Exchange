import { AppLayout } from "@/components/layout";
import { useAdminListKyc, useAdminReviewKyc, getAdminListKycQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { KycSubmission } from "@workspace/api-client-react/src/generated/api.schemas";

export default function AdminKycPage() {
  const [tab, setTab] = useState<"pending" | "verified" | "rejected" | "more_info_required">("pending");
  const { data: kycs, isLoading } = useAdminListKyc({ status: tab });
  const [selectedUser, setSelectedUser] = useState<KycSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  
  const reviewKyc = useAdminReviewKyc();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAction = (decision: "verified" | "rejected" | "more_info_required") => {
    if (!selectedUser) return;
    if ((decision === "rejected" || decision === "more_info_required") && !rejectReason) {
      toast({ title: "Please provide a reason", variant: "destructive" });
      return;
    }

    reviewKyc.mutate({ 
      data: { decision, rejectionReason: rejectReason, adminMessage: rejectReason } 
    }, {
      onSuccess: () => {
        toast({ title: `KYC marked as ${decision}` });
        setSelectedUser(null);
        setRejectReason("");
        queryClient.invalidateQueries({ queryKey: getAdminListKycQueryKey() });
      }
    });
  };

  if (selectedUser) {
    return (
      <AppLayout showNav={false}>
        <header className="p-4 border-b border-border flex items-center space-x-3">
          <button onClick={() => setSelectedUser(null)} className="text-muted-foreground">←</button>
          <h1 className="font-bold">Review KYC</h1>
        </header>

        <div className="p-4 space-y-6">
          <div className="bg-card p-4 rounded-xl border border-card-border space-y-3">
            <h2 className="font-semibold mb-2">User Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground block">Name</span>{selectedUser.fullName}</div>
              <div><span className="text-muted-foreground block">Username</span>{selectedUser.username}</div>
              <div><span className="text-muted-foreground block">DOB</span>{selectedUser.dateOfBirth}</div>
              <div><span className="text-muted-foreground block">Nationality</span>{selectedUser.nationality}</div>
              <div><span className="text-muted-foreground block">ID Type</span><span className="uppercase">{selectedUser.idType.replace('_', ' ')}</span></div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold">Documents</h2>
            <div className="space-y-4">
              <div>
                <span className="text-sm text-muted-foreground mb-1 block">Front Image</span>
                <div className="h-40 bg-secondary rounded-lg border border-border flex items-center justify-center text-muted-foreground overflow-hidden">
                  <img src={selectedUser.frontImageUrl} alt="Front" className="object-cover w-full h-full" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  <span className="absolute">Image Preview</span>
                </div>
              </div>
              {selectedUser.backImageUrl && (
                <div>
                  <span className="text-sm text-muted-foreground mb-1 block">Back Image</span>
                  <div className="h-40 bg-secondary rounded-lg border border-border flex items-center justify-center text-muted-foreground overflow-hidden">
                    <img src={selectedUser.backImageUrl} alt="Back" className="object-cover w-full h-full" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    <span className="absolute">Image Preview</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-border">
            <textarea 
              placeholder="Reason for rejection or more info..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              className="w-full p-3 bg-card border border-border rounded-lg outline-none text-sm min-h-[80px]"
            />
            <div className="flex space-x-2">
              <button onClick={() => handleAction('rejected')} className="flex-1 py-3 bg-destructive/10 text-destructive rounded-lg font-semibold text-sm">Reject</button>
              <button onClick={() => handleAction('more_info_required')} className="flex-1 py-3 bg-warning/10 text-warning rounded-lg font-semibold text-sm">More Info</button>
              <button onClick={() => handleAction('verified')} className="flex-1 py-3 bg-success text-background rounded-lg font-semibold text-sm">Approve</button>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showNav={false}>
      <header className="p-4 border-b border-border">
        <h1 className="font-bold text-xl">Admin: KYC Review</h1>
      </header>

      <div className="flex border-b border-border overflow-x-auto no-scrollbar">
        {["pending", "verified", "rejected", "more_info_required"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap capitalize ${tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          >
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
        ) : kycs?.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">No submissions in this category</div>
        ) : (
          kycs?.map(kyc => (
            <div key={kyc.id} className="p-4 bg-card border border-card-border rounded-xl flex justify-between items-center">
              <div>
                <div className="font-semibold text-sm">{kyc.fullName}</div>
                <div className="text-xs text-muted-foreground">{kyc.username} • {kyc.idType.replace('_', ' ')}</div>
                <div className="text-[10px] mt-1 text-muted-foreground">{new Date(kyc.submittedAt).toLocaleDateString()}</div>
              </div>
              <button onClick={() => setSelectedUser(kyc)} className="px-4 py-1.5 bg-primary/10 text-primary rounded text-xs font-semibold">
                Review
              </button>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}