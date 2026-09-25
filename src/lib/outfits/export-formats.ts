/** Layout variant an ExportableOutfitCard renders for a given format. */
export type ExportLayout = "default" | "square" | "story";

export interface ExportFormat {
  id: string;
  label: string;
  width: number;
  height: number;
  layout: ExportLayout;
}

export const EXPORT_FORMATS: ExportFormat[] = [
  { id: "default", label: "Default Card", width: 600, height: 800, layout: "default" },
  { id: "ig-post", label: "Instagram Post", width: 1080, height: 1080, layout: "square" },
  { id: "ig-story", label: "Instagram Story", width: 1080, height: 1920, layout: "story" },
];

export const DEFAULT_EXPORT_FORMAT = EXPORT_FORMATS[0];

export function getExportFormat(id: string): ExportFormat {
  return EXPORT_FORMATS.find((f) => f.id === id) ?? DEFAULT_EXPORT_FORMAT;
}
