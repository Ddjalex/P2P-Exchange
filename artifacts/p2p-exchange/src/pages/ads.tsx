import { AppLayout } from "@/components/layout";
import { Plus, Pencil } from "lucide-react";
import { useListAds, useToggleAdStatus, useDeleteAd, getListAdsQueryKey } from "@workspace/api-client-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function AdsPage() {
  const [tab, setTab] = useState<"All" | "online" | "offline" | "private">("All");
  const { data: adsRaw, isLoading } = useListAds({ mine: true, status: tab === "All" ? undefined : tab });
  const ads = Array.isArray(adsRaw) ? adsRaw : [];
  const toggleStatus = useToggleAdStatus();
  const deleteAd = useDeleteAd();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleToggle = (id: number) => {
    toggleStatus.mutate({ id, data: {} }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAdsQueryKey({ mine: true }) });
      }
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this ad?")) {
      deleteAd.mutate({ id, data: undefined as any }, {
        onSuccess: () => {
          toast({ title: "Ad deleted" });
          queryClient.invalidateQueries({ queryKey: getListAdsQueryKey({ mine: true }) });
        }
      });
    }
  };

  const handleShareAd = (adId: number) => {
    const shareUrl = `${window.location.origin}/p2p/ad/${adId}`;
    if (navigator.share) {
      navigator.share({
        title: "EthioP2P Trade Offer",
        text: "Trade USDT with me on EthioP2P!",
        url: shareUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        toast({ title: "Link copied to clipboard!" });
      }).catch(() => {
        toast({ title: "Could not copy link", variant: "destructive" });
      });
    }
  };

  return (
    <AppLayout>
      <header className="flex items-center justify-between p-4 border-b border-border">
        <h1 className="font-bold text-xl">Ads</h1>
        <Link href="/ads/post" className="bg-secondary text-foreground p-2 rounded-md flex items-center text-sm font-medium">
          <Plus className="w-4 h-4 mr-1" /> Post Ad
        </Link>
      </header>

      <div className="flex border-b border-border overflow-x-auto no-scrollbar">
        {["All", "online", "offline", "private"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap capitalize ${tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
        ) : ads?.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <p className="mb-4">No ads yet</p>
            <Link href="/ads/post" className="text-primary font-medium">Post your first ad</Link>
          </div>
        ) : (
          ads?.map(ad => (
            <div key={ad.id} className="bg-card border border-card-border p-4 rounded-xl">
              <div className="flex justify-between items-center mb-3">
                <div className="flex space-x-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${ad.type === 'buy' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'}`}>
                    {ad.type.toUpperCase()}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-secondary text-xs text-muted-foreground capitalize">
                    {ad.status}
                  </span>
                </div>
                <div className="text-sm font-medium">
                  {ad.asset}/{ad.fiat}
                </div>
              </div>
              
              <div className="flex justify-between mb-4">
                <div>
                  <div className="text-xs text-muted-foreground">Price</div>
                  <div className="font-bold font-mono">{Number(ad.price).toLocaleString()} {ad.fiat}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Available / Total</div>
                  <div className="font-mono text-sm">{Number(ad.availableAmount).toLocaleString()} / {Number(ad.totalAmount).toLocaleString()} {ad.asset}</div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-border">
                <div className="flex flex-wrap gap-1 max-w-[60%]">
                  {ad.paymentMethods.slice(0,2).map((pm) => (
                    <span key={pm} className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{pm}</span>
                  ))}
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleShareAd(ad.id)}
                    className="text-xs text-primary flex items-center gap-1 hover:opacity-80 transition-opacity"
                  >
                    🔗 Share
                  </button>
                  <Link href={`/ads/edit/${ad.id}`} className="text-xs text-primary flex items-center gap-1 hover:opacity-80 transition-opacity">
                    <Pencil className="w-3 h-3" /> Edit
                  </Link>
                  <button onClick={() => handleToggle(ad.id)} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    {ad.status === 'online' ? 'Offline' : 'Online'}
                  </button>
                  <button onClick={() => handleDelete(ad.id)} className="text-xs text-destructive">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}