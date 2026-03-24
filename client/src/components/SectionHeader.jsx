export default function SectionHeader({ eyebrow, title, description, actions = null }) {
  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        {eyebrow ? (
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--text-muted)]">{eyebrow}</p>
        ) : null}
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-[var(--text-main)] sm:text-[2.4rem]">{title}</h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-7 text-[var(--text-muted)] sm:text-[15px]">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
