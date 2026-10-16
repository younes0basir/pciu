export function ChiefDashboardSection({ id, title, description, children, className = '' }) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-heading` : undefined}
      className={`scroll-mt-24 space-y-4 rounded-3xl border border-amber-100/90 bg-white p-4 shadow-sm sm:p-5 ${className}`}
    >
      <header className="border-b border-slate-100 pb-3">
        <h2 id={id ? `${id}-heading` : undefined} className="text-sm font-extrabold uppercase tracking-wide text-amber-950">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-relaxed text-slate-500">{description}</p>
        ) : null}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
