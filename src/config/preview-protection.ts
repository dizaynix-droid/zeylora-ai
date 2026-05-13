export type PreviewProtectionStrategy = {
  enabled: boolean;
  mode: "current_watermarked_export" | "protected_preview";
  plannedHooks: {
    centerWatermark: "planned";
    lowerResolutionPreview: "planned";
    paidCleanExportOnly: "planned";
  };
  notes: string[];
};

export const previewProtectionStrategy: PreviewProtectionStrategy = {
  enabled: false,
  mode: "current_watermarked_export",
  plannedHooks: {
    centerWatermark: "planned",
    lowerResolutionPreview: "planned",
    paidCleanExportOnly: "planned"
  },
  notes: [
    "Launch keeps the current protected pattern badge watermark behavior.",
    "Next watermark pass should add stronger center preview protection before payment traffic scales.",
    "Paid credit exports should remain clean and watermark-free."
  ]
};
