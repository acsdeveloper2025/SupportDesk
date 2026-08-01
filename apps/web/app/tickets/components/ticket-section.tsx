export function TicketSection({
  children,
  title,
}: Readonly<{ children: React.ReactNode; title: string }>) {
  return (
    <section aria-labelledby={`section-${title.toLowerCase().replaceAll(" ", "-")}`}>
      <h2
        className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500"
        id={`section-${title.toLowerCase().replaceAll(" ", "-")}`}
      >
        {title}
      </h2>
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">{children}</div>
    </section>
  );
}
