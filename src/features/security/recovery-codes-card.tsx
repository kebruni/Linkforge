"use client";

import { useMemo, useState } from "react";
import { Copy, Download, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toaster";

interface Props {
  codes: string[];
  onAcknowledge?: () => void;
  description?: string;
}

export function RecoveryCodesCard({ codes, onAcknowledge, description }: Props) {
  const [confirmed, setConfirmed] = useState(false);

  const blob = useMemo(
    () =>
      codes
        .map((c, i) => `${String(i + 1).padStart(2, "0")}.  ${c}`)
        .join("\n"),
    [codes],
  );

  const onCopy = async () => {
    await navigator.clipboard.writeText(blob);
    toast({ variant: "success", title: "Copied", description: "Recovery codes copied to clipboard." });
  };

  const onDownload = () => {
    const file = new Blob(
      [
        "# Linkforge recovery codes\n",
        "# Each code can be used ONCE.  Treat them like passwords.\n\n",
        blob,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = "linkforge-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-amber-600" />
          <CardTitle>Recovery codes</CardTitle>
        </div>
        <CardDescription>
          {description ??
            "Save these codes somewhere safe. Each one can be used once to sign in if you lose your authenticator."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-md border bg-background p-4 font-mono text-sm tabular-nums">
          {codes.map((c) => (
            <div key={c} className="select-all">
              {c}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCopy}>
            <Copy className="mr-2 size-4" />
            Copy
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onDownload}>
            <Download className="mr-2 size-4" />
            Download
          </Button>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>
            I&apos;ve saved my recovery codes somewhere safe. I understand they
            won&apos;t be shown again.
          </span>
        </label>
        {onAcknowledge && (
          <Button
            type="button"
            variant="accent"
            disabled={!confirmed}
            onClick={onAcknowledge}
          >
            Done
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
