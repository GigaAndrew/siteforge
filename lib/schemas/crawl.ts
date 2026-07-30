import { z } from "zod";

export const FormFieldSchema = z.object({
  name: z.string().optional(),
  type: z.string().optional(),
  label: z.string().optional(),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
});

export const FormRecordSchema = z.object({
  pageUrl: z.string().url(),
  action: z.string().optional(),
  method: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  fields: z.array(FormFieldSchema),
});

export const TableRecordSchema = z.object({
  pageUrl: z.string().url(),
  caption: z.string().optional(),
  headers: z.array(z.string()),
  rowCount: z.number().int().nonnegative(),
  sampleRows: z.array(z.array(z.string())).max(5),
});

export const ImageRecordSchema = z.object({
  pageUrl: z.string().url(),
  src: z.string(),
  alt: z.string().optional(),
  width: z.string().optional(),
  height: z.string().optional(),
});

export const DocumentLinkSchema = z.object({
  pageUrl: z.string().url(),
  href: z.string(),
  text: z.string().optional(),
  fileType: z.enum([
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "csv",
    "dwg",
    "dxf",
    "rvt",
    "ifc",
    "other",
  ]),
});

export const ExternalToolSchema = z.object({
  pageUrl: z.string().url(),
  href: z.string().url(),
  label: z.string().optional(),
  host: z.string(),
  notes: z.string().optional(),
});

export const CrawlErrorSchema = z.object({
  url: z.string(),
  error: z.string(),
  timestamp: z.string(),
  stage: z.string().optional(),
});

export const PageRecordSchema = z.object({
  url: z.string().url(),
  canonicalUrl: z.string().optional(),
  statusCode: z.number().int().optional(),
  redirectChain: z.array(z.string()).default([]),
  title: z.string().optional(),
  metaDescription: z.string().optional(),
  h1: z.array(z.string()).default([]),
  h2: z.array(z.string()).default([]),
  h3: z.array(z.string()).default([]),
  mainTextSummary: z.string().optional(),
  navigationLinks: z.array(z.string()).default([]),
  internalLinks: z.array(z.string()).default([]),
  externalLinks: z.array(z.string()).default([]),
  buttons: z.array(z.string()).default([]),
  callsToAction: z.array(z.string()).default([]),
  forms: z.array(FormRecordSchema).default([]),
  tables: z.array(TableRecordSchema).default([]),
  images: z.array(ImageRecordSchema).default([]),
  iframes: z.array(z.string()).default([]),
  pdfLinks: z.array(z.string()).default([]),
  wordLinks: z.array(z.string()).default([]),
  spreadsheetLinks: z.array(z.string()).default([]),
  cadBimLinks: z.array(z.string()).default([]),
  productIdentifiers: z.array(z.string()).default([]),
  productFamilyTerms: z.array(z.string()).default([]),
  phoneNumbers: z.array(z.string()).default([]),
  emailAddresses: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  thirdPartyTools: z.array(z.string()).default([]),
  jsonLd: z.array(z.unknown()).default([]),
  technologyIndicators: z.array(z.string()).default([]),
  crawledAt: z.string(),
});

export const NavigationSchema = z.object({
  sourceUrl: z.string().url(),
  items: z.array(
    z.object({
      label: z.string(),
      href: z.string(),
      depth: z.number().int().nonnegative().default(0),
    }),
  ),
  capturedAt: z.string(),
});

export const ScreenshotManifestEntrySchema = z.object({
  url: z.string().url(),
  pageLabel: z.string(),
  viewport: z.enum(["desktop", "tablet", "mobile"]),
  width: z.number().int(),
  height: z.number().int(),
  filePath: z.string(),
  capturedAt: z.string(),
  success: z.boolean(),
  error: z.string().optional(),
});

export const ScreenshotManifestSchema = z.object({
  projectSlug: z.string(),
  entries: z.array(ScreenshotManifestEntrySchema),
  updatedAt: z.string(),
});

export type PageRecord = z.infer<typeof PageRecordSchema>;
export type FormRecord = z.infer<typeof FormRecordSchema>;
export type TableRecord = z.infer<typeof TableRecordSchema>;
export type ImageRecord = z.infer<typeof ImageRecordSchema>;
export type DocumentLink = z.infer<typeof DocumentLinkSchema>;
export type ExternalTool = z.infer<typeof ExternalToolSchema>;
export type CrawlError = z.infer<typeof CrawlErrorSchema>;
export type NavigationData = z.infer<typeof NavigationSchema>;
export type ScreenshotManifest = z.infer<typeof ScreenshotManifestSchema>;
