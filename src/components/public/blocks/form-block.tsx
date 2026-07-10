"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Field = {
  name: string;
  label: string;
  type: "text" | "email" | "textarea";
  required?: boolean;
};

export function FormBlock({
  pageId,
  blockId,
  data,
  isEditing = false,
}: {
  pageId: string;
  blockId: string;
  data: Record<string, unknown>;
  isEditing?: boolean;
}) {
  const title = typeof data.title === "string" ? data.title : "Contact";
  const submitLabel = typeof data.submitLabel === "string" ? data.submitLabel : "Send";
  const fields = Array.isArray(data.fields) ? (data.fields as Field[]) : [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEditing) return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/forms/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pageId, blockId, payload: values }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        setStatus("err");
        setError(json?.message ?? "Something went wrong");
        return;
      }
      setStatus("ok");
      setValues({});
    } catch {
      setStatus("err");
      setError("Network error");
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-[var(--lf-radius)] bg-[color:var(--lf-surface)] p-6 text-center ring-1 ring-current/10">
        <p className="text-sm font-medium">Thanks! We got your message.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-[var(--lf-radius)] bg-[color:var(--lf-surface)] p-4 ring-1 ring-current/10"
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      {fields.map((f) => (
        <div key={f.name} className="space-y-1.5">
          <Label htmlFor={`${blockId}-${f.name}`} className="text-xs">
            {f.label}
            {f.required ? " *" : ""}
          </Label>
          {f.type === "textarea" ? (
            <Textarea
              id={`${blockId}-${f.name}`}
              required={!!f.required}
              value={values[f.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              disabled={isEditing || status === "sending"}
              rows={3}
            />
          ) : (
            <Input
              id={`${blockId}-${f.name}`}
              type={f.type === "email" ? "email" : "text"}
              required={!!f.required}
              value={values[f.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              disabled={isEditing || status === "sending"}
            />
          )}
        </div>
      ))}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <Button
        type="submit"
        className="w-full"
        style={{ background: "var(--lf-accent)", color: "#fff" }}
        disabled={isEditing || status === "sending"}
      >
        {status === "sending" ? "Sending…" : submitLabel}
      </Button>
    </form>
  );
}
