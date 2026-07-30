import type { ReactNode } from "react";

export type PrototypeTokens = {
  color: {
    ink: string;
    slate: string;
    steel: string;
    mist: string;
    paper: string;
    chalk: string;
    signal: string;
    signalHover: string;
    pass: string;
    fail: string;
    border: string;
    focus: string;
  };
  typography: {
    display: string;
    body: string;
    mono: string;
  };
  radius: { sm: string; md: string; lg: string };
};

export const DEFAULT_TOKENS: PrototypeTokens = {
  color: {
    ink: "#121417",
    slate: "#2C333A",
    steel: "#5B6770",
    mist: "#E6EAEE",
    paper: "#F4F6F8",
    chalk: "#FBFCFD",
    signal: "#B5471D",
    signalHover: "#8F3816",
    pass: "#1F6B4A",
    fail: "#9B1C1C",
    border: "#C9D1D8",
    focus: "#0B5FFF",
  },
  typography: {
    display: '"IBM Plex Sans", "Segoe UI", sans-serif',
    body: '"IBM Plex Sans", "Segoe UI", sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, monospace',
  },
  radius: { sm: "2px", md: "4px", lg: "6px" },
};

export function PrototypeShell({
  tokens,
  children,
  title,
}: {
  tokens: PrototypeTokens;
  children: ReactNode;
  title?: string;
}) {
  const t = tokens;
  return (
    <div
      style={{
        ["--sf-ink" as string]: t.color.ink,
        ["--sf-slate" as string]: t.color.slate,
        ["--sf-steel" as string]: t.color.steel,
        ["--sf-mist" as string]: t.color.mist,
        ["--sf-paper" as string]: t.color.paper,
        ["--sf-chalk" as string]: t.color.chalk,
        ["--sf-signal" as string]: t.color.signal,
        ["--sf-signal-hover" as string]: t.color.signalHover,
        ["--sf-pass" as string]: t.color.pass,
        ["--sf-fail" as string]: t.color.fail,
        ["--sf-border" as string]: t.color.border,
        ["--sf-focus" as string]: t.color.focus,
        ["--sf-radius" as string]: t.radius.md,
        fontFamily: t.typography.body,
        background: t.color.paper,
        color: t.color.ink,
        minHeight: "100%",
      }}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header
        style={{
          borderBottom: `1px solid ${t.color.border}`,
          background: t.color.chalk,
        }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: t.color.steel }}>
              Prototype
            </div>
            <div className="text-lg font-semibold tracking-tight" style={{ fontFamily: t.typography.display }}>
              {title ?? "Design system"}
            </div>
          </div>
          <nav aria-label="Prototype" className="hidden gap-4 text-sm md:flex" style={{ color: t.color.slate }}>
            <a href="#products" className="underline-offset-2 hover:underline">Products</a>
            <a href="#engineering" className="underline-offset-2 hover:underline">Engineering</a>
            <a href="#resources" className="underline-offset-2 hover:underline">Resources</a>
            <a href="#distributors" className="underline-offset-2 hover:underline">Distributors</a>
            <a href="#contact" className="underline-offset-2 hover:underline">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <details className="relative md:hidden">
              <summary
                className="cursor-pointer list-none px-3 py-2 text-sm font-medium"
                style={{
                  border: `1px solid ${t.color.border}`,
                  borderRadius: t.radius.md,
                  color: t.color.ink,
                  background: t.color.paper,
                }}
              >
                Menu
              </summary>
              <div
                className="absolute right-0 z-20 mt-1 min-w-[12rem] p-2 text-sm shadow-md"
                style={{
                  background: t.color.chalk,
                  border: `1px solid ${t.color.border}`,
                  borderRadius: t.radius.md,
                }}
              >
                <a className="block px-2 py-2" href="#products">Products</a>
                <a className="block px-2 py-2" href="#engineering">Engineering</a>
                <a className="block px-2 py-2" href="#resources">Resources</a>
                <a className="block px-2 py-2" href="#distributors">Distributors</a>
                <a className="block px-2 py-2" href="#contact">Contact</a>
              </div>
            </details>
            <button
              type="button"
              className="px-3 py-2 text-sm font-medium text-white"
              style={{ background: t.color.signal, borderRadius: t.radius.md }}
            >
              Build submittal
            </button>
          </div>
        </div>
      </header>
      <div id="main">{children}</div>
      <footer
        className="mt-16 border-t px-4 py-6 text-xs md:px-6"
        style={{ borderColor: t.color.border, color: t.color.steel }}
      >
        <div className="mx-auto max-w-[1200px]">
          Unofficial redesign concept prepared for private business-development
          discussion. Not affiliated with or endorsed by the referenced company.
        </div>
      </footer>
    </div>
  );
}

export function SfButton({
  children,
  variant = "primary",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";
  if (variant === "primary") {
    return (
      <button
        type="button"
        className={base}
        style={{
          background: "var(--sf-signal)",
          color: "#fff",
          borderRadius: "var(--sf-radius)",
          outlineColor: "var(--sf-focus)",
        }}
      >
        {children}
      </button>
    );
  }
  if (variant === "secondary") {
    return (
      <button
        type="button"
        className={base}
        style={{
          background: "var(--sf-chalk)",
          color: "var(--sf-ink)",
          border: "1px solid var(--sf-border)",
          borderRadius: "var(--sf-radius)",
          outlineColor: "var(--sf-focus)",
        }}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      className={base}
      style={{ color: "var(--sf-slate)", outlineColor: "var(--sf-focus)" }}
    >
      {children}
    </button>
  );
}

export function SfField({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="block text-sm">
      <span className="mb-1 block font-medium" style={{ color: "var(--sf-slate)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

export function SfInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 text-sm ${props.className ?? ""}`}
      style={{
        border: "1px solid var(--sf-border)",
        borderRadius: "var(--sf-radius)",
        background: "var(--sf-chalk)",
        color: "var(--sf-ink)",
        outlineColor: "var(--sf-focus)",
        ...((props.style as object) || {}),
      }}
    />
  );
}

export function SfSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 text-sm ${props.className ?? ""}`}
      style={{
        border: "1px solid var(--sf-border)",
        borderRadius: "var(--sf-radius)",
        background: "var(--sf-chalk)",
        color: "var(--sf-ink)",
        outlineColor: "var(--sf-focus)",
      }}
    />
  );
}

export function ProductRow({
  name,
  family,
  depth,
  thickness,
}: {
  name: string;
  family: string;
  depth: string;
  thickness: string;
}) {
  return (
    <div
      className="grid grid-cols-1 items-center gap-2 px-3 py-3 text-sm md:grid-cols-12"
      style={{ borderBottom: "1px solid var(--sf-border)" }}
    >
      <div className="md:col-span-4">
        <div className="font-medium">{name}</div>
        <div className="text-xs" style={{ color: "var(--sf-steel)" }}>
          {family}
        </div>
      </div>
      <div className="font-mono text-xs md:col-span-2" style={{ fontFamily: "var(--sf-mono, monospace)" }}>
        {depth}
      </div>
      <div className="font-mono text-xs md:col-span-2">{thickness}</div>
      <div className="flex gap-2 md:col-span-4 md:justify-end">
        <SfButton variant="secondary">Compare</SfButton>
        <SfButton>Add to project</SfButton>
      </div>
    </div>
  );
}

export function DocumentRow({
  title,
  type,
  status,
}: {
  title: string;
  type: string;
  status: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm"
      style={{ borderBottom: "1px solid var(--sf-border)" }}
    >
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-xs" style={{ color: "var(--sf-steel)" }}>
          {type} · {status}
        </div>
      </div>
      <div className="flex gap-2">
        <SfButton variant="secondary">Download</SfButton>
        <SfButton variant="ghost">Add to submittal</SfButton>
      </div>
    </div>
  );
}

export function ResultState({
  kind,
  title,
  detail,
}: {
  kind: "pass" | "fail" | "empty" | "error";
  title: string;
  detail: string;
}) {
  const color =
    kind === "pass"
      ? "var(--sf-pass)"
      : kind === "fail" || kind === "error"
        ? "var(--sf-fail)"
        : "var(--sf-steel)";
  return (
    <div
      className="px-3 py-3 text-sm"
      style={{
        border: `1px solid var(--sf-border)`,
        borderLeft: `3px solid ${color}`,
        borderRadius: "var(--sf-radius)",
        background: "var(--sf-chalk)",
      }}
      role="status"
    >
      <div className="font-semibold" style={{ color }}>
        {title}
      </div>
      <div style={{ color: "var(--sf-slate)" }}>{detail}</div>
    </div>
  );
}
