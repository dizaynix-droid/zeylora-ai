export type PreviewProtectionStrategy = {
  enabled: boolean;
  mode: "current_watermarked_export" | "protected_preview" | "premium_center_preview";
  plannedHooks: {
    centerWatermark: "active";
    lowerResolutionPreview: "active";
    paidCleanExportOnly: "active";
  };
  notes: string[];
};

export const previewProtectionStrategy: PreviewProtectionStrategy = {
  enabled: true,
  mode: "premium_center_preview",
  plannedHooks: {
    centerWatermark: "active",
    lowerResolutionPreview: "active",
    paidCleanExportOnly: "active"
  },
  notes: [
    "Free preview exports use a premium centered ZEYLORA PREVIEW watermark and subtle quality limiting.",
    "Paid clean export branch must stay full-quality and watermark-free.",
    "Paid credit exports should remain clean and watermark-free."
  ]
};
