import {
  DEFAULT_TOKENS,
  DocumentRow,
  ProductRow,
  PrototypeShell,
  ResultState,
  SfButton,
  SfField,
  SfInput,
  SfSelect,
  type PrototypeTokens,
} from "@/components/prototype/system";
import { fileExists, readProjectConfig } from "@/lib/project";
import { readDesignTokens } from "@/lib/project-server";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ projectSlug: string }> };

function asTokens(raw: Record<string, unknown> | null): PrototypeTokens {
  if (!raw) return DEFAULT_TOKENS;
  const color = (raw.color ?? {}) as Partial<PrototypeTokens["color"]>;
  const typography = (raw.typography ?? {}) as Partial<PrototypeTokens["typography"]>;
  const radius = (raw.radius ?? {}) as Partial<PrototypeTokens["radius"]>;
  return {
    color: { ...DEFAULT_TOKENS.color, ...color },
    typography: { ...DEFAULT_TOKENS.typography, ...typography },
    radius: { ...DEFAULT_TOKENS.radius, ...radius },
  };
}

export default async function DesignSystemPage({ params }: Props) {
  const { projectSlug } = await params;
  if (!fileExists(projectSlug, "config.json")) notFound();
  const config = readProjectConfig(projectSlug);
  const tokens = asTokens(readDesignTokens(projectSlug));

  return (
    <PrototypeShell tokens={tokens} title={`${config.name} · Design system`}>
      <div className="mx-auto max-w-[1200px] px-4 py-8 md:px-6">
        <section className="mb-12">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: "var(--sf-steel)" }}
          >
            Gate 5 · Component system
          </p>
          <h1
            className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl"
            style={{ fontFamily: tokens.typography.display }}
          >
            Industrial interface kit for product discovery, engineering tools, and
            submittal workflows.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--sf-slate)" }}>
            Built from approved art-direction tokens. Dense, precise, and task-led —
            not a generic SaaS kit.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <SfButton>Primary action</SfButton>
            <SfButton variant="secondary">Secondary</SfButton>
            <SfButton variant="ghost">Ghost</SfButton>
          </div>
        </section>

        <section className="mb-12 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-lg font-semibold">Form controls</h2>
            <div
              className="space-y-3 p-4"
              style={{
                background: "var(--sf-chalk)",
                border: "1px solid var(--sf-border)",
                borderRadius: "var(--sf-radius)",
              }}
            >
              <SfField label="Required wall height (ft)" id="height">
                <SfInput id="height" defaultValue="12" inputMode="decimal" />
              </SfField>
              <SfField label="Member depth" id="depth">
                <SfSelect id="depth" defaultValue="3.625">
                  <option value="3.625">3-5/8 in</option>
                  <option value="6">6 in</option>
                </SfSelect>
              </SfField>
              <fieldset>
                <legend className="mb-2 text-sm font-medium" style={{ color: "var(--sf-slate)" }}>
                  Condition
                </legend>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="condition" defaultChecked /> Non-composite
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="condition" /> Composite
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked /> Include bracing assumption
                  </label>
                </div>
              </fieldset>
            </div>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Calculator result states</h2>
            <div className="space-y-3">
              <ResultState
                kind="pass"
                title="Passing — 362S162-43 (demo)"
                detail="Max height 14.2 ft · margin +2.2 ft · conceptual demo data"
              />
              <ResultState
                kind="fail"
                title="Below required height"
                detail="Member max 11.0 ft vs required 12.0 ft"
              />
              <ResultState
                kind="empty"
                title="No results yet"
                detail="Enter wall height and load criteria to evaluate members."
              />
              <ResultState
                kind="error"
                title="Validation error"
                detail="Wall height must be greater than zero."
              />
            </div>
            <p className="mt-3 text-xs" style={{ color: "var(--sf-steel)" }}>
              Conceptual prototype using demonstration data. Not for engineering,
              specification, procurement, or construction use.
            </p>
          </div>
        </section>

        <section className="mb-12" id="products">
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 className="text-lg font-semibold">Product rows</h2>
            <p className="text-xs" style={{ color: "var(--sf-steel)" }}>
              3 results · demo attributes
            </p>
          </div>
          <div style={{ border: "1px solid var(--sf-border)", background: "var(--sf-chalk)" }}>
            <div
              className="hidden grid-cols-12 gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide md:grid"
              style={{ color: "var(--sf-steel)", borderBottom: "1px solid var(--sf-border)" }}
            >
              <div className="col-span-4">Product</div>
              <div className="col-span-2">Depth</div>
              <div className="col-span-2">Thickness</div>
              <div className="col-span-4 text-right">Actions</div>
            </div>
            <ProductRow name="362S162-33 (demo)" family="Interior stud" depth="3.625 in" thickness="33 mil" />
            <ProductRow name="362S162-43 (demo)" family="Interior stud" depth="3.625 in" thickness="43 mil" />
            <ProductRow name="600S162-54 (demo)" family="Structural stud" depth="6.00 in" thickness="54 mil" />
          </div>
        </section>

        <section className="mb-12" id="resources">
          <h2 className="mb-3 text-lg font-semibold">Document rows</h2>
          <div style={{ border: "1px solid var(--sf-border)", background: "var(--sf-chalk)" }}>
            <DocumentRow title="Product data — studs (demo)" type="PDF · Product data" status="Status unknown" />
            <DocumentRow title="Limiting-height tables (demo)" type="PDF · Engineering table" status="Status unknown" />
            <DocumentRow title="Guide specification (demo)" type="DOCX · Specification" status="Status unknown" />
          </div>
        </section>

        <section className="mb-12" id="engineering">
          <h2 className="mb-3 text-lg font-semibold">Technical table</h2>
          <div className="hidden overflow-x-auto md:block" style={{ border: "1px solid var(--sf-border)" }}>
            <table className="min-w-full text-left text-sm">
              <thead style={{ background: "var(--sf-mist)", color: "var(--sf-slate)" }}>
                <tr>
                  <th className="px-3 py-2 font-semibold">Designation</th>
                  <th className="px-3 py-2 font-semibold">Spacing</th>
                  <th className="px-3 py-2 font-semibold">Load</th>
                  <th className="px-3 py-2 font-semibold">Deflection</th>
                  <th className="px-3 py-2 font-semibold">Max height</th>
                </tr>
              </thead>
              <tbody style={{ background: "var(--sf-chalk)", fontFamily: tokens.typography.mono }}>
                <tr style={{ borderTop: "1px solid var(--sf-border)" }}>
                  <td className="px-3 py-2">362S162-33 (demo)</td>
                  <td className="px-3 py-2">16 in</td>
                  <td className="px-3 py-2">5 psf</td>
                  <td className="px-3 py-2">L/240</td>
                  <td className="px-3 py-2">12.5 ft</td>
                </tr>
                <tr style={{ borderTop: "1px solid var(--sf-border)" }}>
                  <td className="px-3 py-2">362S162-43 (demo)</td>
                  <td className="px-3 py-2">16 in</td>
                  <td className="px-3 py-2">5 psf</td>
                  <td className="px-3 py-2">L/240</td>
                  <td className="px-3 py-2">14.2 ft</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden" aria-label="Technical table stacked for mobile">
            {[
              {
                designation: "362S162-33 (demo)",
                spacing: "16 in",
                load: "5 psf",
                deflection: "L/240",
                maxHeight: "12.5 ft",
              },
              {
                designation: "362S162-43 (demo)",
                spacing: "16 in",
                load: "5 psf",
                deflection: "L/240",
                maxHeight: "14.2 ft",
              },
            ].map((row) => (
              <dl
                key={row.designation}
                className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1 px-3 py-3 text-sm"
                style={{
                  border: "1px solid var(--sf-border)",
                  background: "var(--sf-chalk)",
                  borderRadius: "var(--sf-radius)",
                  fontFamily: tokens.typography.mono,
                }}
              >
                <dt style={{ color: "var(--sf-steel)" }}>Designation</dt>
                <dd className="font-medium" style={{ fontFamily: tokens.typography.body }}>
                  {row.designation}
                </dd>
                <dt style={{ color: "var(--sf-steel)" }}>Spacing</dt>
                <dd>{row.spacing}</dd>
                <dt style={{ color: "var(--sf-steel)" }}>Load</dt>
                <dd>{row.load}</dd>
                <dt style={{ color: "var(--sf-steel)" }}>Deflection</dt>
                <dd>{row.deflection}</dd>
                <dt style={{ color: "var(--sf-steel)" }}>Max height</dt>
                <dd>{row.maxHeight}</dd>
              </dl>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 text-lg font-semibold">Drawer / package panel</h2>
            <aside
              className="p-4"
              style={{
                border: "1px solid var(--sf-border)",
                background: "var(--sf-chalk)",
                boxShadow: "0 8px 24px rgba(18,20,23,0.08)",
                borderRadius: "var(--sf-radius)",
              }}
              aria-label="Submittal package"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">Project package</h3>
                <span className="text-xs" style={{ color: "var(--sf-steel)" }}>
                  Untitled — name required
                </span>
              </div>
              <SfField label="Package name" id="pkg">
                <SfInput id="pkg" placeholder="e.g. North Wing interior walls" />
              </SfField>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex justify-between border-b py-2" style={{ borderColor: "var(--sf-border)" }}>
                  <span>362S162-43 (demo)</span>
                  <button type="button" className="text-xs underline">Remove</button>
                </li>
                <li className="flex justify-between border-b py-2" style={{ borderColor: "var(--sf-border)" }}>
                  <span>Limiting-height table (demo)</span>
                  <button type="button" className="text-xs underline">Remove</button>
                </li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <SfButton>Download PDF</SfButton>
                <SfButton variant="secondary">Download ZIP</SfButton>
              </div>
            </aside>
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold">Alerts & empty</h2>
            <div className="space-y-3">
              <div
                className="px-3 py-3 text-sm"
                role="alert"
                style={{
                  border: "1px solid var(--sf-border)",
                  borderLeft: "3px solid var(--sf-signal)",
                  background: "var(--sf-mist)",
                  borderRadius: "var(--sf-radius)",
                }}
              >
                Name the package before downloading. No default unnamed package is created.
              </div>
              <div
                className="px-3 py-8 text-center text-sm"
                style={{
                  border: "1px dashed var(--sf-border)",
                  color: "var(--sf-steel)",
                  borderRadius: "var(--sf-radius)",
                }}
              >
                No products match these filters. Adjust depth or application.
              </div>
            </div>
          </div>
        </section>
      </div>
    </PrototypeShell>
  );
}
