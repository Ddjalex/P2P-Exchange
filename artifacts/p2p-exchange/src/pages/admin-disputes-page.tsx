import { useEffect, useState } from "react";
import { AdminLayout, AdminGuard } from "@/components/admin-layout";
import { adminGet } from "@/lib/admin-api";
import { Link } from "wouter";
import { Clock } from "lucide-react";

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminGet<any[]>(`/disputes?status=${status}`);
      setDisputes(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, [status]);

  return (
    <AdminGuard>
      <AdminLayout title="Disputes & Appeals">
        <div className="flex space-x-2 mb-5">
          {["pending", "resolved", "all"].map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${status === s ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:border-primary'}`}>
              {s}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-left text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="px-4 py-3">Appeal ID</th>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Raised By</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Evidence</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Filed</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-secondary rounded animate-pulse w-20" /></td>)}
                    </tr>
                  ))
                ) : disputes.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No disputes found</td></tr>
                ) : disputes.map(d => (
                  <tr key={d.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${d.isOld && d.status === 'pending' ? 'bg-orange/5' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs">#{d.id}</td>
                    <td className="px-4 py-3 font-mono text-xs">#{d.orderId}</td>
                    <td className="px-4 py-3 font-medium">{d.raisedByUsername}</td>
                    <td className="px-4 py-3 text-sm max-w-[200px] truncate">{d.reason}</td>
                    <td className="px-4 py-3 text-center">{d.evidenceCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.status === 'pending' ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'}`}>{d.status}</span>
                        {d.isOld && d.status === 'pending' && <Clock className="w-3.5 h-3.5 text-yellow-400" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/disputes/${d.id}`} className="text-xs text-primary hover:underline">Review</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AdminLayout>
    </AdminGuard>
  );
}
