"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";

type Report = {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  pageId: string | null;
  createdAt: string;
  reporter: { username: string; email: string };
  reportedUser: { username: string; email: string } | null;
};

export function ReportsPanel() {
  const [rows, setRows] = useState<Report[]>([]);
  const [status, setStatus] = useState("OPEN");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/reports?status=${status}`);
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok && json?.ok) setRows(json.data as Report[]);
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setReportStatus(id: string, next: "RESOLVED" | "DISMISSED" | "OPEN") {
    setBusy(id);
    const res = await fetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status: next }),
    });
    setBusy(null);
    if (!res.ok) {
      toast({ variant: "destructive", title: "Update failed" });
      return;
    }
    toast({ variant: "success", title: `Marked ${next.toLowerCase()}` });
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["OPEN", "RESOLVED", "DISMISSED", "ALL"].map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => setStatus(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reports in this filter.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => (
            <li key={r.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{r.reason}</Badge>
                <Badge variant={r.status === "OPEN" ? "accent" : "outline"}>{r.status}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm">{r.details || "—"}</p>
              <p className="text-xs text-muted-foreground">
                Reporter @{r.reporter.username}
                {r.reportedUser ? ` → @${r.reportedUser.username}` : ""}
                {r.pageId ? ` · page ${r.pageId.slice(0, 8)}…` : ""}
              </p>
              {r.status === "OPEN" && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy === r.id}
                    onClick={() => setReportStatus(r.id, "RESOLVED")}
                  >
                    Resolve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy === r.id}
                    onClick={() => setReportStatus(r.id, "DISMISSED")}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
