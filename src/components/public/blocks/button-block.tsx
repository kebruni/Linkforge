import { safeHref } from "@/lib/url-safety";

export function ButtonBlock({
  id,
  data,
  isEditing,
}: {
  id: string;
  data: Record<string, unknown>;
  isEditing: boolean;
}) {
  const label = typeof data.label === "string" ? data.label : "Button";
  const url = safeHref(typeof data.url === "string" ? data.url : "#", "#");
  const variant = (data.variant as string) ?? "primary";
  const styles =
    variant === "outline"
      ? "border border-current bg-transparent"
      : variant === "ghost"
        ? "bg-transparent"
        : "bg-[color:var(--lf-accent)] text-white";
  return (
    <a
      href={isEditing ? "#" : url}
      target={isEditing || url.startsWith("mailto:") ? undefined : "_blank"}
      rel="noopener noreferrer nofollow"
      data-track-block-id={id}
      onClick={isEditing ? (e) => e.preventDefault() : undefined}
      className={`flex items-center justify-center rounded-[var(--lf-radius)] px-6 py-3 text-sm font-semibold shadow-sm ${styles}`}
    >
      {label}
    </a>
  );
}
