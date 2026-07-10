export function MapBlock({ data }: { data: Record<string, unknown> }) {
  const query = typeof data.query === "string" ? data.query : "New York, NY";
  const zoom = typeof data.zoom === "number" ? data.zoom : 13;
  const src = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`;

  return (
    <div className="overflow-hidden rounded-[var(--lf-radius)] ring-1 ring-current/10">
      <iframe
        title={`Map: ${query}`}
        src={src}
        className="h-56 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      <p className="bg-[color:var(--lf-surface)] px-3 py-2 text-xs opacity-70">{query}</p>
    </div>
  );
}
