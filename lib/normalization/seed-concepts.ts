import type { CanonicalConcept } from "@/lib/normalization/schemas";
import { normalizeKey } from "@/lib/knowledge/ids";

function concept(
  name: string,
  type: CanonicalConcept["concept_type"],
  description: string,
  aliases: string[],
  extras: Partial<CanonicalConcept> = {},
): CanonicalConcept {
  const now = new Date().toISOString();
  const key = normalizeKey(name);
  return {
    id: `canon_${key}`,
    schemaVersion: "1.0.0",
    canonical_name: name,
    description,
    concept_type: type,
    industry: "cold-formed-steel",
    aliases,
    company_specific_aliases: {},
    status: "accepted",
    confidence: 0.95,
    version: "1.0.0",
    created_at: now,
    updated_at: now,
    reviewed_by: "platform",
    reviewed_at: now,
    notes: "Seeded industry concept for CFS manufacturer normalization",
    ...extras,
  };
}

/** Industry-agnostic enough for CFS manufacturers; not closed-world. */
export function seedCanonicalConcepts(): CanonicalConcept[] {
  return [
    concept(
      "Document Center",
      "resource",
      "Centralized technical literature and downloadable documents.",
      [
        "Engineering Resources",
        "Technical Documents",
        "Downloads",
        "Literature",
        "Resources",
        "Technical Library",
        "Document Library",
      ],
    ),
    concept(
      "Engineering Calculator",
      "tool",
      "Interactive or table-driven engineering calculation tool.",
      [
        "Wall Selector",
        "Stud Selector",
        "Limiting Height Calculator",
        "Limiting Height Tool",
        "Span Calculator",
        "Load Calculator",
        "Engineering Tools",
      ],
    ),
    concept(
      "Product Selector",
      "tool",
      "Guided product selection experience.",
      ["Product Finder", "Selector Tool", "Choose a Product"],
    ),
    concept(
      "Submittal Workflow",
      "workflow",
      "Assembling or requesting product submittal packages.",
      [
        "Submittals",
        "Submittal Builder",
        "Package Builder",
        "Request a Submittal",
        "Submittal Package",
      ],
    ),
    concept(
      "Technical Resources",
      "resource",
      "Engineering and specification support materials.",
      ["Tech Resources", "Engineering Support", "Technical Support"],
    ),
    concept(
      "Product Catalog",
      "product_structure",
      "Browsable catalog of product families and SKUs.",
      ["Products", "Product Line", "Catalog", "Our Products"],
    ),
    concept(
      "Product Data Sheet",
      "document_type",
      "Technical product sheet or datasheet.",
      ["Data Sheet", "Datasheet", "Product Sheet", "Tech Sheet"],
    ),
    concept(
      "Installation Guide",
      "document_type",
      "Installation instructions or guide.",
      ["Install Guide", "Installation Instructions", "How to Install"],
    ),
    concept(
      "Specification",
      "document_type",
      "Architectural or CSI-style specification content.",
      ["Specs", "Architectural Specifications", "Guide Spec", "CSI Spec"],
    ),
    concept(
      "CAD/BIM Resource",
      "document_type",
      "CAD, BIM, Revit, or drawing assets.",
      ["CAD", "BIM", "Revit Families", "Details", "Drawings", "DWG"],
    ),
    concept(
      "Code Report",
      "document_type",
      "Code compliance or evaluation report.",
      ["ESR", "Code Compliance", "Evaluation Report", "ICC Report"],
    ),
    concept(
      "Engineering Table",
      "document_type",
      "Tabulated engineering values (heights, spans, loads).",
      [
        "Load Tables",
        "Span Tables",
        "Limiting Height Tables",
        "Engineering Tables",
        "Allowable Height",
      ],
    ),
    concept(
      "Limiting Height Tool",
      "tool",
      "Tool or table focused on limiting wall/stud height.",
      ["Limiting Heights", "Wall Height Tool", "Stud Height"],
    ),
    concept(
      "Product Family",
      "product_structure",
      "Named family of related framing products.",
      ["Product Line", "Product Series", "Product Family"],
    ),
    concept(
      "Product Detail",
      "product_structure",
      "Detail page for a specific product.",
      ["Product Page", "SKU Detail", "Item Detail"],
    ),
    concept(
      "Project Resource",
      "resource",
      "Project-oriented support content.",
      ["Projects", "Case Studies", "Project Gallery"],
    ),
    concept(
      "Contact / Rep Locator",
      "experience",
      "Contact or representative/distributor locator.",
      [
        "Contact",
        "Find a Rep",
        "Rep Locator",
        "Distributor Locator",
        "Sales Contact",
      ],
    ),
    concept(
      "Search Experience",
      "experience",
      "Site search for products or documents.",
      ["Search", "Site Search", "Find"],
    ),
    concept(
      "Navigation Pattern",
      "navigation",
      "Primary information architecture / nav pattern.",
      ["Main Menu", "Primary Navigation", "Header Navigation"],
    ),
    concept(
      "Download Workflow",
      "workflow",
      "Document download or gated download flow.",
      ["Download", "File Download", "Get the PDF"],
    ),
    // Observation signals used by maturity extract
    concept(
      "Mobile Experience Gap",
      "observation_signal",
      "Mobile UX friction or density issues.",
      ["mobile stress", "mobile viewport", "dense homepage mobile"],
    ),
    concept(
      "SEO Metadata Gap",
      "observation_signal",
      "Missing or weak SEO metadata.",
      ["seo weak", "meta description", "template metadata"],
    ),
    concept(
      "Accessibility Gap",
      "observation_signal",
      "Accessibility debt or a11y issues.",
      ["accessibility", "a11y", "accessible components"],
    ),
    concept(
      "Performance Gap",
      "observation_signal",
      "Performance concerns on public site.",
      ["performance", "lighthouse", "third-party assets"],
    ),
    concept(
      "Calculator Opportunity",
      "observation_signal",
      "Missing or weak engineering calculator UX.",
      [
        "no clear first-class limiting-height calculator",
        "calculator opportunity",
        "calculator ux gap",
        "weak calculator experience",
        "Calculators",
        "calculator maturity",
      ],
    ),
  ];
}
