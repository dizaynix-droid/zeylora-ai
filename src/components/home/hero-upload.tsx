"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Gauge,
  History,
  ImagePlus,
  Layers3,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Tag,
  Wand2,
  Zap
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CleanExportButton } from "@/components/jobs/clean-export-button";
import { DownloadResultButton } from "@/components/jobs/download-result-button";
import { BeforeAfterSlider } from "@/components/showcase/before-after-slider";
import { Button } from "@/components/ui/button";
import { trackingEvents } from "@/config/tracking";
import { getQualityTierLabel, resolveToolEconomy } from "@/config/tool-economy";
import { trackEvent } from "@/lib/analytics/events";

type FlowStatus = "idle" | "selected" | "uploading" | "processing" | "succeeded" | "failed";
type QualityMode = "fast" | "standard" | "high";
type MarketplaceCropFormat = "square" | "portrait" | "story" | "horizontal" | "marketplace-white";
type ProductShadowPreset = "soft-studio" | "floating-shadow" | "luxury-catalog" | "soft-floor";
type AiRelightPreset = "soft-studio-light" | "luxury-glow" | "bright-catalog" | "dramatic-product-light";
type HdUpscalePreset = "2x-hd" | "4x-ultra" | "sharp-catalog" | "social-cleanup";
type ObjectRemovalQualityMode = "standard" | "pro";
type ResultRating = "looks_good" | "needs_improvement";
type HomeToolMode = "background-remover" | "photo-enhancer" | "marketplace-crop" | "product-shadow" | "ai-relight" | "hd-upscale" | "object-remover";

type UploadResponse = {
  ok: boolean;
  media?: {
    id: string;
    mimeType: string;
    fileSize: number;
    width?: number;
    height?: number;
  };
  error?: string;
};

type JobResponse = {
  ok: boolean;
  job?: {
    id: string;
    status: string;
    errorMessage?: string;
  };
  preview?: {
    signedUrl: string;
    expiresInSeconds: number;
  };
  error?: string;
  message?: string;
};

const homeToolOptions: Array<{
  key: HomeToolMode;
  name: string;
  badge?: string;
  endpoint: string;
  processingLabel: string;
  creditCost: number;
  downloadLabel: string;
  downloadFilename: string;
  successMessage: string;
  resultNote: string;
}> = [
  {
    key: "hd-upscale",
    name: "HD Upscale",
    badge: "Recommended",
    endpoint: "/api/v1/jobs/hd-upscale",
    processingLabel: "Upscaling image...",
    creditCost: 2,
    downloadLabel: "Download PNG",
    downloadFilename: "zeylora-hd-upscale.png",
    successMessage: "HD upscale created successfully",
    resultNote: "Upscale blurry or low-resolution images into sharper, cleaner ecommerce-ready visuals. Very tiny text or missing detail may vary."
  },
  {
    key: "ai-relight",
    name: "AI Relight",
    badge: "Popular",
    endpoint: "/api/v1/jobs/ai-relight",
    processingLabel: "Relighting product photo...",
    creditCost: 1,
    downloadLabel: "Download PNG",
    downloadFilename: "zeylora-ai-relight.png",
    successMessage: "Product photo relit successfully",
    resultNote: "Transforms dull product photos into brighter, cleaner, premium studio-style visuals for Shopify, Amazon, Etsy, ads, and catalog pages. Luxury Glow is strongest; Dramatic may be moodier on dark products."
  },
  {
    key: "photo-enhancer",
    name: "Photo Enhancer",
    endpoint: "/api/v1/jobs/photo-enhancer",
    processingLabel: "Enhancing photo...",
    creditCost: 3,
    downloadLabel: "Download PNG/JPG",
    downloadFilename: "zeylora-photo-enhancer.png",
    successMessage: "Photo enhanced successfully",
    resultNote: "Enhancement is strong for cosmetics, perfume, and catalog products. Very fine textures may smooth slightly depending on the source image."
  },
  {
    key: "object-remover",
    name: "Object Remover",
    badge: "Cleanup",
    endpoint: "/api/v1/jobs/object-remover",
    processingLabel: "Cleaning product photo...",
    creditCost: 4,
    downloadLabel: "Download PNG",
    downloadFilename: "zeylora-object-remover.png",
    successMessage: "Object cleanup created successfully",
    resultNote: "Remove distracting objects, cables, props, stains, and dust from product photos. Best results come from clear product shots and specific cleanup descriptions."
  },
  {
    key: "marketplace-crop",
    name: "Marketplace Crop",
    endpoint: "/api/v1/jobs/marketplace-crop",
    processingLabel: "Framing product image...",
    creditCost: 1,
    downloadLabel: "Download PNG",
    downloadFilename: "zeylora-marketplace-crop.png",
    successMessage: "Marketplace crop created successfully",
    resultNote: "Resize and frame product photos for Shopify, Amazon, Etsy, marketplace grids, story ads, and product launch creatives. The white frame preset is strongest for ecommerce marketplaces."
  },
  {
    key: "background-remover",
    name: "Background Remover",
    endpoint: "/api/v1/jobs/background-remover",
    processingLabel: "Removing background...",
    creditCost: 2,
    downloadLabel: "Download PNG",
    downloadFilename: "zeylora-background-remover.png",
    successMessage: "Background removed successfully",
    resultNote: "Best for product photos, objects, and clean foregrounds. Complex human poses, hair, hands, and shoes may vary."
  },
  {
    key: "product-shadow",
    name: "Product Shadow",
    badge: "Beta look",
    endpoint: "/api/v1/jobs/product-shadow",
    processingLabel: "Adding studio shadow...",
    creditCost: 1,
    downloadLabel: "Download PNG",
    downloadFilename: "zeylora-product-shadow.png",
    successMessage: "Product shadow created successfully",
    resultNote: "Best results with clean cutouts or transparent PNGs. Use as a creative catalog look for launch; realistic AI shadow upgrades can come later."
  }
];

const marketplaceCropFormats: Array<{
  value: MarketplaceCropFormat;
  label: string;
  shortLabel: string;
}> = [
  { value: "square", label: "1:1 Square", shortLabel: "1:1" },
  { value: "portrait", label: "4:5 Portrait", shortLabel: "4:5" },
  { value: "story", label: "9:16 Story/Reels", shortLabel: "9:16" },
  { value: "horizontal", label: "16:9 Horizontal", shortLabel: "16:9" },
  { value: "marketplace-white", label: "Marketplace White Frame", shortLabel: "White" }
];

const productShadowPresets: Array<{
  value: ProductShadowPreset;
  label: string;
  shortLabel: string;
}> = [
  { value: "soft-studio", label: "Soft Studio", shortLabel: "Studio" },
  { value: "floating-shadow", label: "Floating Shadow", shortLabel: "Float" },
  { value: "luxury-catalog", label: "Luxury Catalog", shortLabel: "Luxury" },
  { value: "soft-floor", label: "Soft Floor", shortLabel: "Floor" }
];

const aiRelightPresets: Array<{
  value: AiRelightPreset;
  label: string;
  shortLabel: string;
}> = [
  { value: "soft-studio-light", label: "Soft Studio Light", shortLabel: "Studio" },
  { value: "luxury-glow", label: "Luxury Glow", shortLabel: "Luxury" },
  { value: "bright-catalog", label: "Bright Catalog", shortLabel: "Bright" },
  { value: "dramatic-product-light", label: "Dramatic Product Light", shortLabel: "Drama" }
];

const hdUpscalePresets: Array<{
  value: HdUpscalePreset;
  label: string;
  shortLabel: string;
}> = [
  { value: "2x-hd", label: "2x HD", shortLabel: "2x HD" },
  { value: "4x-ultra", label: "4x Ultra", shortLabel: "4x" },
  { value: "sharp-catalog", label: "Sharp Catalog", shortLabel: "Catalog" },
  { value: "social-cleanup", label: "Social Cleanup", shortLabel: "Social" }
];

const trialPackUrl = "/pricing?trial=1";

export function HeroUpload({
  trialCredits = 15,
  trialPrice = 7.99
}: {
  trialCredits?: number;
  trialPrice?: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolControlsRef = useRef<HTMLDivElement>(null);
  const jobRequestRef = useRef(0);
  const [status, setStatus] = useState<FlowStatus>("idle");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploadedMediaId, setUploadedMediaId] = useState<string | null>(null);
  const [inputPreviewUrl, setInputPreviewUrl] = useState<string | null>(null);
  const [resultPreviewUrl, setResultPreviewUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [comparisonPosition, setComparisonPosition] = useState(52);
  const [qualityMode, setQualityMode] = useState<QualityMode>("high");
  const [appliedQualityMode, setAppliedQualityMode] = useState<QualityMode | null>(null);
  const [marketplaceCropFormat, setMarketplaceCropFormat] = useState<MarketplaceCropFormat>("square");
  const [appliedMarketplaceCropFormat, setAppliedMarketplaceCropFormat] = useState<MarketplaceCropFormat | null>(null);
  const [productShadowPreset, setProductShadowPreset] = useState<ProductShadowPreset>("soft-studio");
  const [appliedProductShadowPreset, setAppliedProductShadowPreset] = useState<ProductShadowPreset | null>(null);
  const [aiRelightPreset, setAiRelightPreset] = useState<AiRelightPreset>("soft-studio-light");
  const [appliedAiRelightPreset, setAppliedAiRelightPreset] = useState<AiRelightPreset | null>(null);
  const [hdUpscalePreset, setHdUpscalePreset] = useState<HdUpscalePreset>("2x-hd");
  const [appliedHdUpscalePreset, setAppliedHdUpscalePreset] = useState<HdUpscalePreset | null>(null);
  const [objectRemovalQualityMode, setObjectRemovalQualityMode] = useState<ObjectRemovalQualityMode>("standard");
  const [appliedObjectRemovalQualityMode, setAppliedObjectRemovalQualityMode] = useState<ObjectRemovalQualityMode | null>(null);
  const [objectRemovalPrompt, setObjectRemovalPrompt] = useState("");
  const [appliedObjectRemovalPrompt, setAppliedObjectRemovalPrompt] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<HomeToolMode>("hd-upscale");
  const [rating, setRating] = useState<ResultRating | null>(null);
  const hasActivePreview = Boolean(inputPreviewUrl || resultPreviewUrl || status === "failed");
  const isResultMode = status === "succeeded" && Boolean(inputPreviewUrl && resultPreviewUrl);
  const selectedToolConfig = homeToolOptions.find((tool) => tool.key === selectedTool) ?? homeToolOptions[0];
  const selectedEconomy = useMemo(
    () => resolveToolEconomy({
      toolSlug: getEconomyToolSlug(selectedTool),
      qualityMode: selectedTool === "object-remover" ? objectRemovalQualityMode : qualityMode,
      preset: getEconomyPreset(selectedTool, marketplaceCropFormat, productShadowPreset, aiRelightPreset, hdUpscalePreset),
      providerKey: selectedTool === "background-remover" && qualityMode === "high" ? "photoroom" : undefined
    }),
    [aiRelightPreset, hdUpscalePreset, marketplaceCropFormat, objectRemovalQualityMode, productShadowPreset, qualityMode, selectedTool]
  );
  const canRunExistingSource = Boolean(
    uploadedMediaId &&
    inputPreviewUrl &&
    status !== "uploading" &&
    status !== "processing" &&
    !isResultMode
  );
  const hasPendingQualityMode =
    selectedTool === "background-remover" &&
    status === "succeeded" &&
    Boolean(appliedQualityMode) &&
    appliedQualityMode !== qualityMode;
  const hasPendingMarketplaceFormat =
    selectedTool === "marketplace-crop" &&
    status === "succeeded" &&
    Boolean(appliedMarketplaceCropFormat) &&
    appliedMarketplaceCropFormat !== marketplaceCropFormat;
  const hasPendingProductShadowPreset =
    selectedTool === "product-shadow" &&
    status === "succeeded" &&
    Boolean(appliedProductShadowPreset) &&
    appliedProductShadowPreset !== productShadowPreset;
  const hasPendingAiRelightPreset =
    selectedTool === "ai-relight" &&
    status === "succeeded" &&
    Boolean(appliedAiRelightPreset) &&
    appliedAiRelightPreset !== aiRelightPreset;
  const hasPendingHdUpscalePreset =
    selectedTool === "hd-upscale" &&
    status === "succeeded" &&
    Boolean(appliedHdUpscalePreset) &&
    appliedHdUpscalePreset !== hdUpscalePreset;
  const hasPendingObjectRemoval =
    selectedTool === "object-remover" &&
    status === "succeeded" &&
    Boolean(appliedObjectRemovalPrompt) &&
    (appliedObjectRemovalPrompt !== objectRemovalPrompt.trim() ||
      appliedObjectRemovalQualityMode !== objectRemovalQualityMode);

  const trustItems: Array<[string, LucideIcon]> = [
    ["Private signed downloads", ShieldCheck],
    ["Seven studio workflows", Zap],
    ["Saved dashboard history", ImagePlus]
  ];

  useEffect(() => {
    return () => {
      if (inputPreviewUrl) {
        URL.revokeObjectURL(inputPreviewUrl);
      }
    };
  }, [inputPreviewUrl]);

  async function handleFileSelected(file: File | undefined) {
    if (!file) return;

    const hasAccess = await ensureProcessingAccess({
      intent: "upload_file",
      tool: selectedTool
    });
    if (!hasAccess) return;

    jobRequestRef.current += 1;
    setSelectedFileName(file.name);
    setUploadedMediaId(null);
    setResultPreviewUrl(null);
    setJobId(null);
    setErrorMessage(null);
    setAppliedQualityMode(null);
    setAppliedMarketplaceCropFormat(null);
    setAppliedProductShadowPreset(null);
    setAppliedAiRelightPreset(null);
    setAppliedHdUpscalePreset(null);
    setAppliedObjectRemovalQualityMode(null);
    setAppliedObjectRemovalPrompt(null);
    setRating(null);
    trackEvent({
      event: trackingEvents.uploadStarted,
      properties: {
        tool: selectedTool,
        fileType: file.type,
        fileSize: file.size
      }
    });

    const localPreviewUrl = URL.createObjectURL(file);
    setInputPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return localPreviewUrl;
    });
    setStatus("selected");
    await waitForPreviewPaint();

    try {
      setStatus("uploading");
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/v1/uploads", {
        method: "POST",
        body: formData
      });
      const uploadJson = (await uploadResponse.json().catch(() => null)) as UploadResponse | null;

      if (uploadResponse.status === 401) {
        redirectToSignIn();
        return;
      }

      if (!uploadResponse.ok || !uploadJson?.ok || !uploadJson.media?.id) {
        throw new Error(uploadJson?.error || "Upload could not be completed.");
      }

      setUploadedMediaId(uploadJson.media.id);
      trackEvent({
        event: trackingEvents.uploadCompleted,
        properties: {
          tool: selectedTool,
          mediaId: uploadJson.media.id,
          fileType: file.type,
          fileSize: file.size
        }
      });
      if (selectedTool === "object-remover") {
        trackEvent({
          event: trackingEvents.objectRemoverUpload,
          properties: {
            mediaId: uploadJson.media.id,
            fileType: file.type,
            fileSize: file.size
          }
        });
      }
      await runToolJob({
        inputMediaId: uploadJson.media.id,
        tool: selectedTool,
        cropFormat: marketplaceCropFormat,
        shadowPreset: productShadowPreset,
        relightPreset: aiRelightPreset,
        upscalePreset: hdUpscalePreset,
        quality: qualityMode
      });
    } catch (error) {
      setStatus("failed");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  async function runToolJob(input: {
    inputMediaId: string;
    tool: HomeToolMode;
    cropFormat: MarketplaceCropFormat;
    shadowPreset: ProductShadowPreset;
    relightPreset: AiRelightPreset;
    upscalePreset: HdUpscalePreset;
    quality: QualityMode;
  }) {
    if (input.tool === "object-remover" && !objectRemovalPrompt.trim()) {
      setStatus(inputPreviewUrl ? "selected" : "idle");
      setErrorMessage("Describe what to remove first. Example: remove the cable on the left.");
      return;
    }

    const hasAccess = await ensureProcessingAccess({
      intent: "run_tool",
      tool: input.tool
    });
    if (!hasAccess) return;

    const requestId = jobRequestRef.current + 1;
    jobRequestRef.current = requestId;
    const toolConfig = homeToolOptions.find((tool) => tool.key === input.tool) ?? homeToolOptions[0];

    setStatus("processing");
    setResultPreviewUrl(null);
    setJobId(null);
    setErrorMessage(null);
    setRating(null);
    setAppliedQualityMode(null);
    setAppliedMarketplaceCropFormat(null);
    setAppliedProductShadowPreset(null);
    setAppliedAiRelightPreset(null);
    setAppliedHdUpscalePreset(null);
    setAppliedObjectRemovalQualityMode(null);
    setAppliedObjectRemovalPrompt(null);
    trackEvent({
      event: trackingEvents.jobStarted,
      properties: {
        tool: input.tool,
        quality: input.quality,
        cropFormat: input.cropFormat,
        shadowPreset: input.shadowPreset,
        relightPreset: input.relightPreset,
        upscalePreset: input.upscalePreset,
        removalPrompt: input.tool === "object-remover" ? objectRemovalPrompt.trim() : undefined,
        objectRemovalQualityMode
      }
    });

    const jobResponse = await fetch(toolConfig.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputMediaId: input.inputMediaId,
        ...(input.tool === "background-remover" ? { qualityMode: input.quality } : {}),
        ...(input.tool === "marketplace-crop" ? { targetFormat: input.cropFormat } : {}),
        ...(input.tool === "product-shadow" ? { shadowPreset: input.shadowPreset } : {}),
        ...(input.tool === "ai-relight" ? { relightPreset: input.relightPreset } : {}),
        ...(input.tool === "hd-upscale" ? { upscalePreset: input.upscalePreset } : {}),
        ...(input.tool === "object-remover"
          ? { removalPrompt: objectRemovalPrompt.trim(), qualityMode: objectRemovalQualityMode }
          : {})
      })
    });
    const jobJson = (await jobResponse.json().catch(() => null)) as JobResponse | null;

    if (requestId !== jobRequestRef.current) {
      return;
    }

    if (jobResponse.status === 401) {
      redirectToSignIn();
      return;
    }

    if (!jobResponse.ok || !jobJson?.ok || !jobJson.preview?.signedUrl) {
      trackEvent({
        event: trackingEvents.jobFailed,
        properties: {
          tool: input.tool,
          status: jobJson?.job?.status || "failed"
        }
      });
      throw new Error(
        jobJson?.message ||
        jobJson?.job?.errorMessage ||
          jobJson?.error ||
          `${toolConfig.name} could not be completed. Please try another image.`
      );
    }

    setJobId(jobJson.job?.id || null);
    setResultPreviewUrl(jobJson.preview.signedUrl);
    setAppliedQualityMode(input.tool === "background-remover" ? input.quality : null);
    setAppliedMarketplaceCropFormat(input.tool === "marketplace-crop" ? input.cropFormat : null);
    setAppliedProductShadowPreset(input.tool === "product-shadow" ? input.shadowPreset : null);
    setAppliedAiRelightPreset(input.tool === "ai-relight" ? input.relightPreset : null);
    setAppliedHdUpscalePreset(input.tool === "hd-upscale" ? input.upscalePreset : null);
    setAppliedObjectRemovalQualityMode(input.tool === "object-remover" ? objectRemovalQualityMode : null);
    setAppliedObjectRemovalPrompt(input.tool === "object-remover" ? objectRemovalPrompt.trim() : null);
    setStatus("succeeded");
    trackEvent({
      event: trackingEvents.jobCompleted,
      properties: {
        tool: input.tool,
        jobId: jobJson.job?.id || null
      }
    });
    trackEvent({
      event: trackingEvents.previewGenerated,
      properties: {
        tool: input.tool,
        jobId: jobJson.job?.id || null,
        quality: input.quality,
        cropFormat: input.cropFormat,
        shadowPreset: input.shadowPreset,
        relightPreset: input.relightPreset,
        upscalePreset: input.upscalePreset
      }
    });
  }

  async function ensureProcessingAccess(input: { intent: string; tool: HomeToolMode }) {
    try {
      const authResponse = await fetch("/api/auth/me", {
        cache: "no-store"
      });
      const authJson = (await authResponse.json().catch(() => null)) as { authenticated?: boolean } | null;

      if (!authResponse.ok || !authJson?.authenticated) {
        trackEvent({
          event: trackingEvents.authRequired,
          properties: {
            intent: input.intent,
            tool: input.tool
          }
        });
        redirectToSignIn();
        return false;
      }

      const creditsResponse = await fetch("/api/v1/dashboard/credits", {
        cache: "no-store"
      });
      const creditsJson = (await creditsResponse.json().catch(() => null)) as { creditBalance?: number } | null;

      if (creditsResponse.status === 401) {
        trackEvent({
          event: trackingEvents.authRequired,
          properties: {
            intent: input.intent,
            tool: input.tool
          }
        });
        redirectToSignIn();
        return false;
      }

      const creditBalance = Number(creditsJson?.creditBalance ?? 0);
      const requiredCredits = selectedEconomy.creditCost;
      if (!creditsResponse.ok || creditBalance < requiredCredits) {
        trackEvent({
          event: trackingEvents.trialPackView,
          properties: {
            reason: creditsResponse.ok ? "no_credits" : "credits_check_failed",
            intent: input.intent,
            tool: input.tool,
            creditBalance,
            requiredCredits
          }
        });
        window.location.assign(trialPackUrl);
        return false;
      }

      return true;
    } catch {
      window.location.assign(trialPackUrl);
      return false;
    }
  }

  async function handleMarketplaceFormatChange(format: MarketplaceCropFormat) {
    if (format === marketplaceCropFormat) return;

    setMarketplaceCropFormat(format);
    trackEvent({
      event: trackingEvents.presetSelected,
      properties: {
        tool: "marketplace-crop",
        preset: format
      }
    });
  }

  async function applyQualityMode() {
    if (selectedTool !== "background-remover" || !uploadedMediaId) return;

    try {
      await runToolJob({
        inputMediaId: uploadedMediaId,
        tool: "background-remover",
        cropFormat: marketplaceCropFormat,
        shadowPreset: productShadowPreset,
        relightPreset: aiRelightPreset,
        upscalePreset: hdUpscalePreset,
        quality: qualityMode
      });
    } catch (error) {
      setStatus("failed");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  async function runCurrentToolAgain() {
    if (!uploadedMediaId) {
      fileInputRef.current?.click();
      return;
    }

    try {
      await runToolJob({
        inputMediaId: uploadedMediaId,
        tool: selectedTool,
        cropFormat: marketplaceCropFormat,
        shadowPreset: productShadowPreset,
        relightPreset: aiRelightPreset,
        upscalePreset: hdUpscalePreset,
        quality: qualityMode
      });
    } catch (error) {
      setStatus("failed");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  function focusToolControls() {
    toolControlsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  async function applyMarketplaceFormat() {
    if (selectedTool !== "marketplace-crop" || !uploadedMediaId) return;

    try {
      await runToolJob({
        inputMediaId: uploadedMediaId,
        tool: "marketplace-crop",
        cropFormat: marketplaceCropFormat,
        shadowPreset: productShadowPreset,
        relightPreset: aiRelightPreset,
        upscalePreset: hdUpscalePreset,
        quality: qualityMode
      });
    } catch (error) {
      setStatus("failed");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  async function handleProductShadowPresetChange(preset: ProductShadowPreset) {
    if (preset === productShadowPreset) return;

    setProductShadowPreset(preset);
    trackEvent({
      event: trackingEvents.presetSelected,
      properties: {
        tool: "product-shadow",
        preset
      }
    });
  }

  async function applyProductShadowPreset() {
    if (selectedTool !== "product-shadow" || !uploadedMediaId) return;

    try {
      await runToolJob({
        inputMediaId: uploadedMediaId,
        tool: "product-shadow",
        cropFormat: marketplaceCropFormat,
        shadowPreset: productShadowPreset,
        relightPreset: aiRelightPreset,
        upscalePreset: hdUpscalePreset,
        quality: qualityMode
      });
    } catch (error) {
      setStatus("failed");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  async function handleAiRelightPresetChange(preset: AiRelightPreset) {
    if (preset === aiRelightPreset) return;

    setAiRelightPreset(preset);
    trackEvent({
      event: trackingEvents.presetSelected,
      properties: {
        tool: "ai-relight",
        preset
      }
    });
  }

  async function applyAiRelightPreset() {
    if (selectedTool !== "ai-relight" || !uploadedMediaId) return;

    const previousResultPreviewUrl = resultPreviewUrl;
    const previousJobId = jobId;
    const previousAppliedAiRelightPreset = appliedAiRelightPreset;

    try {
      await runToolJob({
        inputMediaId: uploadedMediaId,
        tool: "ai-relight",
        cropFormat: marketplaceCropFormat,
        shadowPreset: productShadowPreset,
        relightPreset: aiRelightPreset,
        upscalePreset: hdUpscalePreset,
        quality: qualityMode
      });
    } catch (error) {
      setResultPreviewUrl(previousResultPreviewUrl);
      setJobId(previousJobId);
      setAppliedAiRelightPreset(previousAppliedAiRelightPreset);
      setStatus(previousResultPreviewUrl ? "succeeded" : "failed");
      setErrorMessage(
        previousResultPreviewUrl
          ? "This lighting style failed. Please try another preset."
          : error instanceof Error
            ? error.message
            : "This lighting style failed. Please try another preset."
      );
    }
  }

  async function submitRating(nextRating: ResultRating) {
    if (!jobId) return;

    setRating(nextRating);
    await fetch(`/api/v1/jobs/${jobId}/rating`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        rating: nextRating
      })
    }).catch(() => undefined);
  }

  async function handleHdUpscalePresetChange(preset: HdUpscalePreset) {
    if (preset === hdUpscalePreset) return;

    setHdUpscalePreset(preset);
    trackEvent({
      event: trackingEvents.presetSelected,
      properties: {
        tool: "hd-upscale",
        preset
      }
    });
  }

  async function applyHdUpscalePreset() {
    if (selectedTool !== "hd-upscale" || !uploadedMediaId) return;

    try {
      await runToolJob({
        inputMediaId: uploadedMediaId,
        tool: "hd-upscale",
        cropFormat: marketplaceCropFormat,
        shadowPreset: productShadowPreset,
        relightPreset: aiRelightPreset,
        upscalePreset: hdUpscalePreset,
        quality: qualityMode
      });
    } catch (error) {
      setStatus("failed");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  async function applyObjectRemoval() {
    if (selectedTool !== "object-remover" || !uploadedMediaId) return;

    try {
      await runToolJob({
        inputMediaId: uploadedMediaId,
        tool: "object-remover",
        cropFormat: marketplaceCropFormat,
        shadowPreset: productShadowPreset,
        relightPreset: aiRelightPreset,
        upscalePreset: hdUpscalePreset,
        quality: qualityMode
      });
    } catch (error) {
      setStatus("failed");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <section id="top" className="relative overflow-hidden bg-cinematic-depth pb-8 pt-6 md:pb-20 md:pt-20">
      <div className="subtle-grid pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-50" />
      <div className="pointer-events-none absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan/10 blur-3xl" />
      <div className={`section-shell relative grid gap-5 lg:gap-10 lg:items-start ${
        isResultMode
          ? "lg:grid-cols-[minmax(0,1.35fr)_420px] xl:grid-cols-[minmax(0,1.5fr)_430px]"
          : "lg:grid-cols-[minmax(0,1fr)_460px] xl:grid-cols-[minmax(0,1fr)_480px]"
      }`}>
        <div className="animate-fade-up">
          {isResultMode && inputPreviewUrl && resultPreviewUrl ? (
            <div className="premium-ring rounded-[2rem]">
              <div className="glass-panel rounded-[2rem] p-4 md:p-5">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="eyebrow">
                      <Sparkles size={14} />
                      Result workspace
                    </p>
                    <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
                      Your product image is ready.
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                      Compare the original against the generated export, then download or adjust the tool settings from the side panel.
                    </p>
                  </div>
                  <p className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-black uppercase text-cyan">
                    {selectedEconomy.publicName} · {getQualityTierLabel(selectedEconomy.qualityTier)} · {selectedEconomy.creditCost} credits
                  </p>
                </div>
                <BeforeAfterResultSlider
                  beforeUrl={inputPreviewUrl}
                  afterUrl={resultPreviewUrl}
                  beforeLabel={getResultBeforeLabel(selectedTool)}
                  afterLabel={getResultAfterLabel(selectedTool)}
                  position={comparisonPosition}
                  onPositionChange={setComparisonPosition}
                />
              </div>
            </div>
          ) : (
            <>
              <p className="eyebrow">
                <Sparkles size={14} />
                AI Product Photo Editor / Ecommerce Studio
              </p>
              <h1 className="mt-4 max-w-4xl text-[2.45rem] font-black leading-[1.04] tracking-tight text-white min-[390px]:text-[2.65rem] md:mt-5 md:text-6xl lg:text-7xl">
                Bad product photos <span className="gradient-text">kill conversions</span>.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 md:mt-5 md:text-lg md:leading-8">
                Turn blurry, dark, amateur product shots into sharper, brighter, marketplace-ready visuals for Shopify, Amazon, Etsy, and TikTok Shop.
              </p>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row md:mt-7 md:gap-3">
                <Button href="#upload" className="h-12 px-6 text-sm shadow-[0_0_42px_rgba(32,211,255,.28)] md:h-14 md:px-8 md:text-base">
                  Try your first product
                  <ArrowRight className="ml-2" size={18} />
                </Button>
                <Button href="#examples" variant="secondary" className="h-11 px-5 md:h-12 md:px-6">
                  View examples
                </Button>
              </div>

              <div className="mt-5 grid gap-2 text-xs text-slate-300 sm:grid-cols-3 md:mt-8 md:gap-3 md:text-sm">
                {trustItems.map(([label, Icon]) => (
                  <div key={label} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 py-2 md:rounded-2xl">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-cyan/10 text-cyan md:size-8">
                      <Icon size={15} />
                    </span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid max-w-2xl grid-cols-2 gap-3 border-t border-white/10 pt-4 sm:grid-cols-4 md:mt-8 md:pt-6">
                {[
                  ["7", "live tools"],
                  [`$${trialPrice}`, "starter trial"],
                  [String(trialCredits), "trial credits"],
                  ["No", "subscription"]
                ].map(([value, label]) => (
                  <div key={label}>
                    <p className="text-xl font-black text-white md:text-3xl">{value}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">{label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,.08),rgba(32,211,255,.035),rgba(236,72,153,.045))] p-2 shadow-cinematic md:mt-9 md:rounded-[2rem] md:p-3">
                <BeforeAfterSlider
                  before="/showcase/photo-enhancer-before.jpg"
                  after="/showcase/photo-enhancer-after.png"
                  title="Luxury perfume catalog transformation"
                  beforeLabel="Amateur upload"
                  afterLabel="Premium catalog"
                  priority
                />
                <div className="grid gap-3 px-2 py-4 md:grid-cols-[1fr_auto] md:items-center md:px-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan">Hero transformation</p>
                    <p className="mt-1 text-lg font-black text-white md:text-xl">Luxury perfume photo, polished for ecommerce conversion.</p>
                  </div>
                  <p className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-xs font-black uppercase text-slate-200">
                    Drag to compare
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div id="upload" className={`premium-ring rounded-3xl lg:sticky lg:top-24 lg:rounded-[2rem] ${hasActivePreview ? "" : "md:animate-float"}`}>
          <div className={`glass-panel overflow-hidden rounded-3xl p-3 md:p-5 lg:rounded-[2rem] ${
            isResultMode ? "" : "lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
          }`}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => {
                void handleFileSelected(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />

            {status === "succeeded" && resultPreviewUrl && isResultMode ? (
              <div className="z-10 rounded-2xl border border-cyan/20 bg-[linear-gradient(135deg,rgba(32,211,255,.16),rgba(139,92,246,.12),rgba(3,5,13,.92))] p-3 shadow-cinematic backdrop-blur-xl lg:sticky lg:top-3">
                <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase text-cyan">
                  <Sparkles size={14} />
                  Ready to export
                </p>
                {hasPendingMarketplaceFormat && appliedMarketplaceCropFormat ? (
                  <p className="mb-3 rounded-xl border border-warning/25 bg-warning/10 p-3 text-xs font-semibold leading-5 text-warning">
                    Current download is still {getMarketplaceCropFormatLabel(appliedMarketplaceCropFormat)}. Apply {getMarketplaceCropFormatLabel(marketplaceCropFormat)} to generate a new export.
                  </p>
                ) : null}
                {hasPendingQualityMode && appliedQualityMode ? (
                  <p className="mb-3 rounded-xl border border-warning/25 bg-warning/10 p-3 text-xs font-semibold leading-5 text-warning">
                    Current download is still {getQualityModeLabel(appliedQualityMode)}. Apply {getQualityModeLabel(qualityMode)} to generate a new export.
                  </p>
                ) : null}
                {hasPendingProductShadowPreset && appliedProductShadowPreset ? (
                  <p className="mb-3 rounded-xl border border-warning/25 bg-warning/10 p-3 text-xs font-semibold leading-5 text-warning">
                    Current download is still {getProductShadowPresetLabel(appliedProductShadowPreset)}. Apply {getProductShadowPresetLabel(productShadowPreset)} to generate a new export.
                  </p>
                ) : null}
                {hasPendingAiRelightPreset && appliedAiRelightPreset ? (
                  <p className="mb-3 rounded-xl border border-warning/25 bg-warning/10 p-3 text-xs font-semibold leading-5 text-warning">
                    Current download is still {getAiRelightPresetLabel(appliedAiRelightPreset)}. Apply {getAiRelightPresetLabel(aiRelightPreset)} to generate a new export.
                  </p>
                ) : null}
                {hasPendingHdUpscalePreset && appliedHdUpscalePreset ? (
                  <p className="mb-3 rounded-xl border border-warning/25 bg-warning/10 p-3 text-xs font-semibold leading-5 text-warning">
                    Current download is still {getHdUpscalePresetLabel(appliedHdUpscalePreset)}. Apply {getHdUpscalePresetLabel(hdUpscalePreset)} to generate a new export.
                  </p>
                ) : null}
                {hasPendingObjectRemoval && appliedObjectRemovalPrompt ? (
                  <p className="mb-3 rounded-xl border border-warning/25 bg-warning/10 p-3 text-xs font-semibold leading-5 text-warning">
                    Current download uses “{appliedObjectRemovalPrompt}”. Apply the new cleanup request to generate a fresh export.
                  </p>
                ) : null}
                {selectedTool === "ai-relight" && errorMessage ? (
                  <p className="mb-3 rounded-xl border border-warning/25 bg-warning/10 p-3 text-xs font-semibold leading-5 text-warning">
                    {errorMessage}
                  </p>
                ) : null}
                <div className="grid gap-2">
                  {hasPendingQualityMode ? (
                    <button
                      type="button"
                      onClick={() => void applyQualityMode()}
                      className="inline-flex h-12 items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow transition hover:brightness-110"
                    >
                      <Gauge className="mr-2" size={18} />
                      Apply {getQualityModeLabel(qualityMode)}
                    </button>
                  ) : hasPendingMarketplaceFormat ? (
                    <button
                      type="button"
                      onClick={() => void applyMarketplaceFormat()}
                      className="inline-flex h-12 items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow transition hover:brightness-110"
                    >
                      <Gauge className="mr-2" size={18} />
                      Apply {getMarketplaceCropFormatShortLabel(marketplaceCropFormat)} format
                    </button>
                  ) : hasPendingProductShadowPreset ? (
                    <button
                      type="button"
                      onClick={() => void applyProductShadowPreset()}
                      className="inline-flex h-12 items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow transition hover:brightness-110"
                    >
                      <Gauge className="mr-2" size={18} />
                      Apply {getProductShadowPresetShortLabel(productShadowPreset)}
                    </button>
                  ) : hasPendingAiRelightPreset ? (
                    <button
                      type="button"
                      onClick={() => void applyAiRelightPreset()}
                      className="inline-flex h-12 items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow transition hover:brightness-110"
                    >
                      <Gauge className="mr-2" size={18} />
                      Apply {getAiRelightPresetShortLabel(aiRelightPreset)}
                    </button>
                  ) : hasPendingHdUpscalePreset ? (
                    <button
                      type="button"
                      onClick={() => void applyHdUpscalePreset()}
                      className="inline-flex h-12 items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow transition hover:brightness-110"
                    >
                      <Gauge className="mr-2" size={18} />
                      Apply {getHdUpscalePresetShortLabel(hdUpscalePreset)}
                    </button>
                  ) : hasPendingObjectRemoval ? (
                    <button
                      type="button"
                      onClick={() => void applyObjectRemoval()}
                      className="inline-flex h-12 items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow transition hover:brightness-110"
                    >
                      <Gauge className="mr-2" size={18} />
                      Apply cleanup
                    </button>
                  ) : (
                    <div className="grid gap-2">
                      {jobId ? (
                        <CleanExportButton
                          jobId={jobId}
                          creditsRequired={selectedEconomy.creditCost}
                          initialUnlocked
                          filename={getDownloadFilename(
                            selectedToolConfig,
                            appliedMarketplaceCropFormat ?? marketplaceCropFormat,
                            appliedProductShadowPreset ?? productShadowPreset,
                            appliedAiRelightPreset ?? aiRelightPreset,
                            appliedHdUpscalePreset ?? hdUpscalePreset
                          )}
                          className="inline-flex h-12 items-center justify-center rounded-full bg-zeylora-brand px-4 text-sm font-black text-white shadow-glow"
                        />
                      ) : null}
                      <DownloadResultButton
                        href={jobId ? `/api/v1/jobs/${jobId}/download` : resultPreviewUrl}
                        filename={getDownloadFilename(
                          selectedToolConfig,
                          appliedMarketplaceCropFormat ?? marketplaceCropFormat,
                          appliedProductShadowPreset ?? productShadowPreset,
                          appliedAiRelightPreset ?? aiRelightPreset,
                          appliedHdUpscalePreset ?? hdUpscalePreset
                        )}
                        label="Download result"
                        className="inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-4 text-sm font-black text-white transition hover:bg-white/10"
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {selectedTool === "background-remover" ? (
                      <button
                        type="button"
                        onClick={focusToolControls}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 px-3 text-xs font-black text-white transition hover:bg-white/10"
                      >
                        <Gauge className="mr-2" size={15} />
                        Try quality
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void runCurrentToolAgain()}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 px-3 text-xs font-black text-white transition hover:bg-white/10"
                    >
                      <Zap className="mr-2" size={15} />
                      Run again
                    </button>
                    <button
                      type="button"
                      onClick={focusToolControls}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 px-3 text-xs font-black text-white transition hover:bg-white/10"
                    >
                      <Wand2 className="mr-2" size={15} />
                      Change tool
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 px-3 text-xs font-black text-white transition hover:bg-white/10"
                    >
                      <RotateCcw className="mr-2" size={15} />
                      Upload new
                    </button>
                    <a
                      href="/dashboard"
                      className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 px-3 text-xs font-black text-white transition hover:bg-white/10"
                    >
                      <History className="mr-2" size={15} />
                      Dashboard
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-dashed border-cyan/[0.45] bg-[linear-gradient(145deg,rgba(32,211,255,.16),rgba(139,92,246,.1),rgba(255,255,255,.045))] p-4 text-center shadow-[0_0_54px_rgba(32,211,255,.16)] md:rounded-[1.5rem] md:p-6">
                <div className="absolute inset-x-0 top-0 h-px overflow-hidden bg-white/10">
                  <div className="h-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-cyan to-transparent" />
                </div>
                <div className="mx-auto grid size-13 place-items-center rounded-2xl bg-[linear-gradient(135deg,#20D3FF,#8B5CF6)] text-white shadow-glow md:size-16">
                  <ImagePlus size={24} />
                </div>
                <h2 className="mt-4 text-xl font-black text-white md:mt-5 md:text-2xl">Upgrade your product photo</h2>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-slate-300 md:text-sm md:leading-6">
                  Real processing requires credits. Start with {trialCredits} credits for ${trialPrice} and test your first seller-ready product image.
                </p>
                <button
                  type="button"
                  disabled={status === "uploading" || status === "processing"}
                  onClick={() => {
                    trackEvent({
                      event: trackingEvents.uploadClick,
                      properties: {
                        tool: selectedTool,
                        source: "hero_upload_panel"
                      }
                    });
                    if (canRunExistingSource) {
                      void runCurrentToolAgain();
                      return;
                    }
                    fileInputRef.current?.click();
                  }}
                  className="focus-lift mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-zeylora-brand text-sm font-black text-white shadow-[0_0_46px_rgba(32,211,255,.32)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 md:mt-5 md:h-14 md:text-base"
                >
                  {status === "uploading" || status === "processing" ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={18} />
                      {status === "uploading" ? "Uploading image..." : selectedToolConfig.processingLabel}
                    </>
                  ) : (
                    <>
                      {canRunExistingSource ? <Zap className="mr-2" size={18} /> : <ImagePlus className="mr-2" size={18} />}
                      {canRunExistingSource ? "Run selected tool" : "Start with image"}
                    </>
                  )}
                </button>
                <p className="mt-2 text-[11px] font-black uppercase tracking-[0.18em] text-cyan">
                  Default: HD Upscale for seller-ready detail
                </p>
                {uploadedMediaId && inputPreviewUrl ? (
                  <button
                    type="button"
                    disabled={status === "uploading" || status === "processing"}
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-full border border-white/15 px-3 text-xs font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <RotateCcw className="mr-2" size={15} />
                    Upload new image
                  </button>
                ) : null}
                <p className="mt-3 text-xs font-semibold text-slate-400">
                  {selectedFileName ? selectedFileName : "Login required before processing. Trial pack starts at $7.99."}
                </p>
              </div>
            )}

            <div ref={toolControlsRef} className="mt-3 scroll-mt-24 rounded-2xl border border-white/10 bg-white/[0.06] p-2 md:mt-4">
              <p className="mb-2 flex items-center gap-2 px-2 text-xs font-black uppercase text-slate-400">
                <Wand2 size={14} />
                AI tool
              </p>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {homeToolOptions.map((tool) => (
                  <button
                    key={tool.key}
                    type="button"
                    disabled={status === "uploading" || status === "processing"}
                    onClick={() => {
                      trackEvent({
                        event: trackingEvents.toolSelected,
                        properties: {
                          tool: tool.key
                        }
                      });
                      setSelectedTool(tool.key);
                      setResultPreviewUrl(null);
                      setJobId(null);
                      setErrorMessage(null);
                      setAppliedQualityMode(null);
                      setAppliedMarketplaceCropFormat(null);
                      setAppliedProductShadowPreset(null);
                      setAppliedAiRelightPreset(null);
                      setAppliedHdUpscalePreset(null);
                      setAppliedObjectRemovalQualityMode(null);
                      setAppliedObjectRemovalPrompt(null);
                      setRating(null);
                      if (status === "succeeded" || status === "failed") setStatus(inputPreviewUrl ? "selected" : "idle");
                    }}
                    className={`min-h-9 rounded-full px-1.5 py-1.5 text-[10px] font-black leading-tight transition sm:min-h-11 sm:px-2 sm:py-2 sm:text-xs ${
                      selectedTool === tool.key
                        ? "bg-cyan text-ink"
                        : "border border-white/10 bg-black/20 text-slate-300 hover:bg-white/10"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <span>{tool.name}</span>
                    {tool.badge ? (
                      <span className={`mt-1 block text-[9px] uppercase ${
                        tool.badge === "Beta look" ? "text-warning" : selectedTool === tool.key ? "text-ink/70" : "text-cyan"
                      }`}>
                        {tool.badge}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            {selectedTool === "background-remover" ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.06] p-2 md:mt-4">
                <p className="mb-2 flex items-center gap-2 px-2 text-xs font-black uppercase text-slate-400">
                  <Gauge size={14} />
                  Quality mode
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["fast", "Fast"],
                    ["standard", "Standard"],
                    ["high", "High Quality"]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={status === "uploading" || status === "processing"}
                      onClick={() => setQualityMode(value as QualityMode)}
                    className={`min-h-9 rounded-full px-1.5 py-1.5 text-[10px] font-black leading-tight transition sm:min-h-10 sm:px-2 sm:py-2 sm:text-xs ${
                        qualityMode === value
                          ? "bg-cyan text-ink"
                          : "border border-white/10 bg-black/20 text-slate-300 hover:bg-white/10"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {hasPendingQualityMode && appliedQualityMode ? (
                  <p className="mt-2 px-2 text-xs font-semibold leading-5 text-warning">
                    Current download is still {getQualityModeLabel(appliedQualityMode)}. Apply {getQualityModeLabel(qualityMode)} to generate a new export from the same image.
                  </p>
                ) : null}
              </div>
            ) : selectedTool === "marketplace-crop" ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-2">
                <p className="mb-2 flex items-center gap-2 px-2 text-xs font-black uppercase text-slate-400">
                  <Gauge size={14} />
                  Target format
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {marketplaceCropFormats.map((format) => (
                    <button
                      key={format.value}
                      type="button"
                      disabled={status === "uploading" || status === "processing"}
                      onClick={() => void handleMarketplaceFormatChange(format.value)}
                      title={format.label}
                      className={`min-h-9 rounded-full px-1.5 py-1.5 text-[10px] sm:min-h-10 sm:px-2 sm:py-2 sm:text-xs font-black leading-tight transition ${
                        marketplaceCropFormat === format.value
                          ? "bg-cyan text-ink"
                          : "border border-white/10 bg-black/20 text-slate-300 hover:bg-white/10"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {format.shortLabel}
                    </button>
                  ))}
                </div>
                <p className="mt-2 px-2 text-xs font-semibold leading-5 text-slate-400">
                  Resize and frame product photos for Shopify, Amazon, Etsy, and social ads.
                </p>
              </div>
            ) : selectedTool === "product-shadow" ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-2">
                <p className="mb-2 flex items-center gap-2 px-2 text-xs font-black uppercase text-slate-400">
                  <Gauge size={14} />
                  Shadow style
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {productShadowPresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      disabled={status === "uploading" || status === "processing"}
                      onClick={() => void handleProductShadowPresetChange(preset.value)}
                      title={preset.label}
                      className={`min-h-9 rounded-full px-1.5 py-1.5 text-[10px] sm:min-h-10 sm:px-2 sm:py-2 sm:text-xs font-black leading-tight transition ${
                        productShadowPreset === preset.value
                          ? "bg-cyan text-ink"
                          : "border border-white/10 bg-black/20 text-slate-300 hover:bg-white/10"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {preset.shortLabel}
                    </button>
                  ))}
                </div>
                <p className="mt-2 px-2 text-xs font-semibold leading-5 text-slate-400">
                  Best results with clean cutouts or transparent PNGs. Non-transparent product photos still get a premium catalog floor.
                </p>
              </div>
            ) : selectedTool === "ai-relight" ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-2">
                <p className="mb-2 flex items-center gap-2 px-2 text-xs font-black uppercase text-slate-400">
                  <Gauge size={14} />
                  Light preset
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {aiRelightPresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      disabled={status === "uploading" || status === "processing"}
                      onClick={() => void handleAiRelightPresetChange(preset.value)}
                      title={preset.label}
                      className={`min-h-9 rounded-full px-1.5 py-1.5 text-[10px] sm:min-h-10 sm:px-2 sm:py-2 sm:text-xs font-black leading-tight transition ${
                        aiRelightPreset === preset.value
                          ? "bg-cyan text-ink"
                          : "border border-white/10 bg-black/20 text-slate-300 hover:bg-white/10"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {preset.shortLabel}
                    </button>
                  ))}
                </div>
                <p className="mt-2 px-2 text-xs font-semibold leading-5 text-slate-400">
                  Brighten flat product shots with studio-style highlights, cleaner contrast, and premium ecommerce focus.
                </p>
              </div>
            ) : selectedTool === "hd-upscale" ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-2">
                <p className="mb-2 flex items-center gap-2 px-2 text-xs font-black uppercase text-slate-400">
                  <Gauge size={14} />
                  Upscale preset
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {hdUpscalePresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      disabled={status === "uploading" || status === "processing"}
                      onClick={() => void handleHdUpscalePresetChange(preset.value)}
                      title={preset.label}
                      className={`min-h-9 rounded-full px-1.5 py-1.5 text-[10px] sm:min-h-10 sm:px-2 sm:py-2 sm:text-xs font-black leading-tight transition ${
                        hdUpscalePreset === preset.value
                          ? "bg-cyan text-ink"
                          : "border border-white/10 bg-black/20 text-slate-300 hover:bg-white/10"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {preset.shortLabel}
                    </button>
                  ))}
                </div>
                <p className="mt-2 px-2 text-xs font-semibold leading-5 text-slate-400">
                  Upscale blurry, compressed, or small product photos into cleaner HD ecommerce visuals.
                </p>
              </div>
            ) : selectedTool === "object-remover" ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-slate-400">
                  <Gauge size={14} />
                  Cleanup request
                </p>
                <textarea
                  value={objectRemovalPrompt}
                  onChange={(event) => setObjectRemovalPrompt(event.target.value.slice(0, 240))}
                  disabled={status === "uploading" || status === "processing"}
                  rows={3}
                  placeholder="Describe what to remove, e.g. remove the text/logo on the label"
                  className="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-semibold text-white outline-none transition placeholder:text-slate-500 focus:border-cyan disabled:cursor-not-allowed disabled:opacity-60"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    "remove the visible text and logo on the product label",
                    "remove the cable on the left",
                    "remove dust and stains around the product"
                  ].map((example) => (
                    <button
                      key={example}
                      type="button"
                      disabled={status === "uploading" || status === "processing"}
                      onClick={() => setObjectRemovalPrompt(example)}
                      className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 transition hover:border-cyan/40 hover:text-cyan disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {example.includes("text") ? "Text/logo" : example.includes("cable") ? "Cable" : "Dust/stains"}
                    </button>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {[
                    ["standard", "Standard · 4 credits"],
                    ["pro", "Pro · 6 credits"]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={status === "uploading" || status === "processing"}
                      onClick={() => setObjectRemovalQualityMode(value as ObjectRemovalQualityMode)}
                      className={`min-h-9 rounded-full px-2 py-2 text-[10px] font-black leading-tight transition sm:text-xs ${
                        objectRemovalQualityMode === value
                          ? "bg-cyan text-ink"
                          : "border border-white/10 bg-black/20 text-slate-300 hover:bg-white/10"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
                  Ecommerce cleanup for visible text, labels, logos, cables, props, stains, dust, and distracting background items. Be specific about what should disappear. Avoid people, identity documents, adult content, or unsafe edits.
                </p>
                {hasPendingObjectRemoval && appliedObjectRemovalPrompt ? (
                  <p className="mt-2 rounded-xl border border-warning/25 bg-warning/10 p-3 text-xs font-semibold leading-5 text-slate-200">
                    Current download uses “{appliedObjectRemovalPrompt}”. Apply the new cleanup request to generate a fresh export.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-emerald/20 bg-emerald/10 p-3 text-left">
                <p className="text-xs font-black uppercase text-emerald">Enhance MVP</p>
                <p className="mt-1 text-xs leading-5 text-slate-200">
                  Sharpens low-resolution, compressed, ecommerce, portrait, and social images with the existing job pipeline.
                </p>
              </div>
            )}

            {hasActivePreview && !isResultMode ? (
              <div className="mt-4 max-h-[48vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/25 p-3 lg:max-h-[320px] xl:max-h-[380px]">
                {status === "succeeded" && inputPreviewUrl && resultPreviewUrl ? (
                  <BeforeAfterResultSlider
                    beforeUrl={inputPreviewUrl}
                    afterUrl={resultPreviewUrl}
                    beforeLabel={getResultBeforeLabel(selectedTool)}
                    afterLabel={getResultAfterLabel(selectedTool)}
                    position={comparisonPosition}
                    onPositionChange={setComparisonPosition}
                  />
                ) : null}
                {status !== "succeeded" ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <PreviewFrame label="Input" imageUrl={inputPreviewUrl} />
                    <PreviewFrame
                      label="Result"
                      imageUrl={resultPreviewUrl}
                      placeholder={status === "processing" ? "AI is processing..." : "Result appears here"}
                      checkerboard
                    />
                  </div>
                ) : null}
                {status === "succeeded" && resultPreviewUrl ? (
                  <div className="mt-3 grid gap-3">
                    <div className="rounded-2xl border border-cyan/20 bg-[linear-gradient(135deg,rgba(32,211,255,.12),rgba(139,92,246,.08),rgba(255,255,255,.035))] p-4 text-left">
                      <p className="flex items-center gap-2 text-xs font-black uppercase text-cyan">
                        <Sparkles size={14} />
                        Product edit ready
                      </p>
                      <h3 className="mt-2 text-lg font-black text-white">{selectedToolConfig.successMessage}</h3>
                      <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">
                        Your credit-based edit is complete. Download the result or re-run another preset from the same source image.
                      </p>
                      {selectedTool === "background-remover" && appliedQualityMode ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <p className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black uppercase text-slate-200">
                            Generated: {getQualityModeLabel(appliedQualityMode)}
                          </p>
                          {hasPendingQualityMode ? (
                            <p className="rounded-full border border-warning/25 bg-warning/10 px-3 py-1 text-xs font-black uppercase text-warning">
                              Selected: {getQualityModeLabel(qualityMode)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {selectedTool === "marketplace-crop" && appliedMarketplaceCropFormat ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <p className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black uppercase text-slate-200">
                            Generated: {getMarketplaceCropFormatLabel(appliedMarketplaceCropFormat)}
                          </p>
                          {hasPendingMarketplaceFormat ? (
                            <p className="rounded-full border border-warning/25 bg-warning/10 px-3 py-1 text-xs font-black uppercase text-warning">
                              Selected: {getMarketplaceCropFormatLabel(marketplaceCropFormat)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {selectedTool === "product-shadow" && appliedProductShadowPreset ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <p className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black uppercase text-slate-200">
                            Generated: {getProductShadowPresetLabel(appliedProductShadowPreset)}
                          </p>
                          {hasPendingProductShadowPreset ? (
                            <p className="rounded-full border border-warning/25 bg-warning/10 px-3 py-1 text-xs font-black uppercase text-warning">
                              Selected: {getProductShadowPresetLabel(productShadowPreset)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {selectedTool === "ai-relight" && appliedAiRelightPreset ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <p className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black uppercase text-slate-200">
                            Generated: {getAiRelightPresetLabel(appliedAiRelightPreset)}
                          </p>
                          {hasPendingAiRelightPreset ? (
                            <p className="rounded-full border border-warning/25 bg-warning/10 px-3 py-1 text-xs font-black uppercase text-warning">
                              Selected: {getAiRelightPresetLabel(aiRelightPreset)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {selectedTool === "object-remover" && appliedObjectRemovalPrompt ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <p className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black uppercase text-slate-200">
                            Generated: {appliedObjectRemovalQualityMode === "pro" ? "Pro cleanup" : "Standard cleanup"}
                          </p>
                          {hasPendingObjectRemoval ? (
                            <p className="rounded-full border border-warning/25 bg-warning/10 px-3 py-1 text-xs font-black uppercase text-warning">
                              New request selected
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {hasPendingMarketplaceFormat && appliedMarketplaceCropFormat ? (
                      <p className="rounded-xl border border-warning/25 bg-warning/10 p-3 text-left text-xs font-semibold leading-5 text-slate-200">
                        Current download is still {getMarketplaceCropFormatLabel(appliedMarketplaceCropFormat)}. Apply {getMarketplaceCropFormatLabel(marketplaceCropFormat)} to generate a new export.
                      </p>
                    ) : null}
                    {hasPendingProductShadowPreset && appliedProductShadowPreset ? (
                      <p className="rounded-xl border border-warning/25 bg-warning/10 p-3 text-left text-xs font-semibold leading-5 text-slate-200">
                        Current download is still {getProductShadowPresetLabel(appliedProductShadowPreset)}. Apply {getProductShadowPresetLabel(productShadowPreset)} to generate a new export.
                      </p>
                    ) : null}
                    {hasPendingAiRelightPreset && appliedAiRelightPreset ? (
                      <p className="rounded-xl border border-warning/25 bg-warning/10 p-3 text-left text-xs font-semibold leading-5 text-slate-200">
                        Current download is still {getAiRelightPresetLabel(appliedAiRelightPreset)}. Apply {getAiRelightPresetLabel(aiRelightPreset)} to generate a new export.
                      </p>
                    ) : null}
                    {hasPendingObjectRemoval && appliedObjectRemovalPrompt ? (
                      <p className="rounded-xl border border-warning/25 bg-warning/10 p-3 text-left text-xs font-semibold leading-5 text-slate-200">
                        Current download uses “{appliedObjectRemovalPrompt}”. Apply the new cleanup request to generate a fresh export.
                      </p>
                    ) : null}
                    <p className="rounded-xl border border-white/10 bg-white/[0.05] p-3 text-left text-xs font-semibold leading-5 text-slate-300">
                      {selectedToolConfig.resultNote}
                    </p>
                    <div className="grid gap-3">
                      <p className="text-left text-xs font-semibold text-emerald">
                        Secure result saved{jobId ? ` · Job ${jobId.slice(0, 8)}` : ""}.
                      </p>
                    </div>
                    <div className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-3 text-left">
                      <p className="text-xs font-black uppercase text-slate-400">How does this result look?</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => void submitRating("looks_good")}
                          className={`h-10 rounded-full text-xs font-black transition ${
                            rating === "looks_good" ? "bg-emerald text-ink" : "border border-white/10 text-white hover:bg-white/10"
                          }`}
                        >
                          Looks good
                        </button>
                        <button
                          type="button"
                          onClick={() => void submitRating("needs_improvement")}
                          className={`h-10 rounded-full text-xs font-black transition ${
                            rating === "needs_improvement" ? "bg-warning text-ink" : "border border-white/10 text-white hover:bg-white/10"
                          }`}
                        >
                          Needs improvement
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {status === "failed" ? (
                  <div className="mt-3 rounded-xl border border-danger/25 bg-danger/10 p-3 text-left">
                    <p className="text-sm font-bold text-white">We could not finish this edit.</p>
                    <p className="mt-1 text-xs leading-5 text-slate-300">
                      {errorMessage || "Please try again with another image."}
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-3 inline-flex h-9 items-center justify-center rounded-full border border-white/15 px-3 text-xs font-black text-white transition hover:bg-white/10"
                    >
                      <RotateCcw className="mr-2" size={14} />
                      Try another image
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isResultMode ? (
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-cyan/20 bg-[linear-gradient(135deg,rgba(32,211,255,.12),rgba(139,92,246,.08),rgba(255,255,255,.035))] p-4 text-left">
                  <p className="flex items-center gap-2 text-xs font-black uppercase text-cyan">
                    <Sparkles size={14} />
                    Product edit ready
                  </p>
                  <h3 className="mt-2 text-lg font-black text-white">{selectedToolConfig.successMessage}</h3>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">
                    Your credit-based edit is complete. Download the result or re-run another preset from the same source image.
                  </p>
                  {selectedTool === "background-remover" && appliedQualityMode ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <p className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black uppercase text-slate-200">
                        Generated: {getQualityModeLabel(appliedQualityMode)}
                      </p>
                      {hasPendingQualityMode ? (
                        <p className="rounded-full border border-warning/25 bg-warning/10 px-3 py-1 text-xs font-black uppercase text-warning">
                          Selected: {getQualityModeLabel(qualityMode)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {selectedTool === "marketplace-crop" && appliedMarketplaceCropFormat ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <p className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black uppercase text-slate-200">
                        Generated: {getMarketplaceCropFormatLabel(appliedMarketplaceCropFormat)}
                      </p>
                      {hasPendingMarketplaceFormat ? (
                        <p className="rounded-full border border-warning/25 bg-warning/10 px-3 py-1 text-xs font-black uppercase text-warning">
                          Selected: {getMarketplaceCropFormatLabel(marketplaceCropFormat)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {selectedTool === "product-shadow" && appliedProductShadowPreset ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <p className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black uppercase text-slate-200">
                        Generated: {getProductShadowPresetLabel(appliedProductShadowPreset)}
                      </p>
                      {hasPendingProductShadowPreset ? (
                        <p className="rounded-full border border-warning/25 bg-warning/10 px-3 py-1 text-xs font-black uppercase text-warning">
                          Selected: {getProductShadowPresetLabel(productShadowPreset)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {selectedTool === "ai-relight" && appliedAiRelightPreset ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <p className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black uppercase text-slate-200">
                        Generated: {getAiRelightPresetLabel(appliedAiRelightPreset)}
                      </p>
                      {hasPendingAiRelightPreset ? (
                        <p className="rounded-full border border-warning/25 bg-warning/10 px-3 py-1 text-xs font-black uppercase text-warning">
                          Selected: {getAiRelightPresetLabel(aiRelightPreset)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {selectedTool === "object-remover" && appliedObjectRemovalPrompt ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <p className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-black uppercase text-slate-200">
                        Generated: {appliedObjectRemovalQualityMode === "pro" ? "Pro cleanup" : "Standard cleanup"}
                      </p>
                      {hasPendingObjectRemoval ? (
                        <p className="rounded-full border border-warning/25 bg-warning/10 px-3 py-1 text-xs font-black uppercase text-warning">
                          New request selected
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {hasPendingMarketplaceFormat && appliedMarketplaceCropFormat ? (
                  <p className="rounded-xl border border-warning/25 bg-warning/10 p-3 text-left text-xs font-semibold leading-5 text-slate-200">
                    Current download is still {getMarketplaceCropFormatLabel(appliedMarketplaceCropFormat)}. Apply {getMarketplaceCropFormatLabel(marketplaceCropFormat)} to generate a new export.
                  </p>
                ) : null}
                {hasPendingProductShadowPreset && appliedProductShadowPreset ? (
                  <p className="rounded-xl border border-warning/25 bg-warning/10 p-3 text-left text-xs font-semibold leading-5 text-slate-200">
                    Current download is still {getProductShadowPresetLabel(appliedProductShadowPreset)}. Apply {getProductShadowPresetLabel(productShadowPreset)} to generate a new export.
                  </p>
                ) : null}
                {hasPendingAiRelightPreset && appliedAiRelightPreset ? (
                  <p className="rounded-xl border border-warning/25 bg-warning/10 p-3 text-left text-xs font-semibold leading-5 text-slate-200">
                    Current download is still {getAiRelightPresetLabel(appliedAiRelightPreset)}. Apply {getAiRelightPresetLabel(aiRelightPreset)} to generate a new export.
                  </p>
                ) : null}
                {hasPendingObjectRemoval && appliedObjectRemovalPrompt ? (
                  <p className="rounded-xl border border-warning/25 bg-warning/10 p-3 text-left text-xs font-semibold leading-5 text-slate-200">
                    Current download uses “{appliedObjectRemovalPrompt}”. Apply the new cleanup request to generate a fresh export.
                  </p>
                ) : null}
                <p className="rounded-xl border border-white/10 bg-white/[0.05] p-3 text-left text-xs font-semibold leading-5 text-slate-300">
                  {selectedToolConfig.resultNote}
                </p>
                <p className="text-left text-xs font-semibold text-emerald">
                  Secure result saved{jobId ? ` · Job ${jobId.slice(0, 8)}` : ""}.
                </p>
              </div>
            ) : null}

            {status === "succeeded" && resultPreviewUrl && !isResultMode ? (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/35 p-3 shadow-cinematic">
                {hasPendingMarketplaceFormat && appliedMarketplaceCropFormat ? (
                  <p className="mb-3 text-xs font-semibold leading-5 text-warning">
                    Current download is still {getMarketplaceCropFormatLabel(appliedMarketplaceCropFormat)}. Apply {getMarketplaceCropFormatLabel(marketplaceCropFormat)} to generate a new export.
                  </p>
                ) : null}
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 px-3 text-xs font-black text-white transition hover:bg-white/10"
                  >
                    <RotateCcw className="mr-2" size={16} />
                    Try another
                  </button>
                  <a
                    href="/dashboard"
                    className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 px-3 text-xs font-black text-white transition hover:bg-white/10"
                  >
                    <History className="mr-2" size={16} />
                    Dashboard
                  </a>
                  {hasPendingMarketplaceFormat ? (
                    <button
                      type="button"
                      onClick={() => void applyMarketplaceFormat()}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-zeylora-brand px-3 text-xs font-black text-white shadow-glow transition hover:brightness-110"
                    >
                      <Gauge className="mr-2" size={16} />
                      Apply {getMarketplaceCropFormatShortLabel(marketplaceCropFormat)} format
                    </button>
                  ) : hasPendingProductShadowPreset ? (
                    <button
                      type="button"
                      onClick={() => void applyProductShadowPreset()}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-zeylora-brand px-3 text-xs font-black text-white shadow-glow transition hover:brightness-110"
                    >
                      <Gauge className="mr-2" size={16} />
                      Apply {getProductShadowPresetShortLabel(productShadowPreset)}
                    </button>
                  ) : hasPendingAiRelightPreset ? (
                    <button
                      type="button"
                      onClick={() => void applyAiRelightPreset()}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-zeylora-brand px-3 text-xs font-black text-white shadow-glow transition hover:brightness-110"
                    >
                      <Gauge className="mr-2" size={16} />
                      Apply {getAiRelightPresetShortLabel(aiRelightPreset)}
                    </button>
                  ) : hasPendingHdUpscalePreset ? (
                    <button
                      type="button"
                      onClick={() => void applyHdUpscalePreset()}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-zeylora-brand px-3 text-xs font-black text-white shadow-glow transition hover:brightness-110"
                    >
                      <Gauge className="mr-2" size={16} />
                      Apply {getHdUpscalePresetShortLabel(hdUpscalePreset)}
                    </button>
                  ) : hasPendingObjectRemoval ? (
                    <button
                      type="button"
                      onClick={() => void applyObjectRemoval()}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-zeylora-brand px-3 text-xs font-black text-white shadow-glow transition hover:brightness-110"
                    >
                      <Gauge className="mr-2" size={16} />
                      Apply cleanup
                    </button>
                  ) : (
                    <div className="grid gap-2">
                      {jobId ? (
                        <CleanExportButton
                          jobId={jobId}
                          creditsRequired={selectedEconomy.creditCost}
                          filename={getDownloadFilename(
                            selectedToolConfig,
                            appliedMarketplaceCropFormat ?? marketplaceCropFormat,
                            appliedProductShadowPreset ?? productShadowPreset,
                            appliedAiRelightPreset ?? aiRelightPreset,
                            appliedHdUpscalePreset ?? hdUpscalePreset
                          )}
                          className="inline-flex h-10 items-center justify-center rounded-full bg-zeylora-brand px-3 text-xs font-black text-white shadow-glow"
                        />
                      ) : null}
                      <DownloadResultButton
                        href={jobId ? `/api/v1/jobs/${jobId}/download` : resultPreviewUrl}
                        filename={getDownloadFilename(
                          selectedToolConfig,
                          appliedMarketplaceCropFormat ?? marketplaceCropFormat,
                          appliedProductShadowPreset ?? productShadowPreset,
                          appliedAiRelightPreset ?? aiRelightPreset,
                          appliedHdUpscalePreset ?? hdUpscalePreset
                        )}
                        label="Download preview"
                        className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 px-3 text-xs font-black text-white transition hover:bg-white/10"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {isResultMode && jobId ? (
              <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-white/[0.05] p-3 text-left">
                <p className="text-xs font-black uppercase text-slate-400">How does this result look?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void submitRating("looks_good")}
                    className={`h-10 rounded-full text-xs font-black transition ${
                      rating === "looks_good" ? "bg-emerald text-ink" : "border border-white/10 text-white hover:bg-white/10"
                    }`}
                  >
                    Looks good
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitRating("needs_improvement")}
                    className={`h-10 rounded-full text-xs font-black transition ${
                      rating === "needs_improvement" ? "bg-warning text-ink" : "border border-white/10 text-white hover:bg-white/10"
                    }`}
                  >
                    Needs improvement
                  </button>
                </div>
              </div>
            ) : null}

            <div className={`${isResultMode ? "mt-3" : "mt-4"} grid grid-cols-2 gap-3`}>
              <div className={`rounded-2xl border border-white/10 bg-white/[0.08] ${isResultMode ? "p-3" : "p-4"}`}>
                <p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
                  <Wand2 size={14} />
                  Selected tool
                </p>
                <p className="mt-2 font-black text-white">{selectedToolConfig.name}</p>
                <p className="mt-1 text-xs font-bold text-cyan">
                  {getQualityTierLabel(selectedEconomy.qualityTier)} · {selectedEconomy.creditCost} credits
                  {selectedEconomy.highQuality ? " · High quality provider" : ""}
                </p>
              </div>
              <div className={`rounded-2xl border border-white/10 bg-white/[0.08] ${isResultMode ? "p-3" : "p-4"}`}>
                <p className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400">
                  <Layers3 size={14} />
                  Preview export
                </p>
                <p className="mt-2 font-black text-white">Powered by Zeylora</p>
              </div>
            </div>

            {!isResultMode ? (
              <div className="mt-3 rounded-2xl border border-emerald/20 bg-emerald/10 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-emerald">
                  <CheckCircle2 size={16} />
                  Processing uses credits from the first real edit. The Starter Trial Pack is built for your first product test.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewFrame({
  label,
  imageUrl,
  placeholder = "No image yet",
  checkerboard = false
}: {
  label: string;
  imageUrl: string | null;
  placeholder?: string;
  checkerboard?: boolean;
}) {
  return (
    <div className={`relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.05)] ${checkerboard ? "checkerboard-bg" : "bg-black/35"}`}>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={`${label} preview`} className="h-full w-full object-contain" loading="lazy" decoding="async" />
      ) : (
        <div className="grid h-full place-items-center px-4 text-center text-xs font-bold text-slate-500">
          {placeholder}
        </div>
      )}
      <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-black uppercase text-white backdrop-blur">
        {label}
      </span>
    </div>
  );
}

function BeforeAfterResultSlider({
  beforeUrl,
  afterUrl,
  beforeLabel = "Before",
  afterLabel = "Zeylora export",
  position,
  onPositionChange
}: {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel?: string;
  afterLabel?: string;
  position: number;
  onPositionChange: (value: number) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-cinematic">
      <div className="checkerboard-bg relative aspect-[4/3] sm:aspect-[16/10]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={afterUrl} alt="Background removed result" className="h-full w-full object-contain" decoding="async" />
        <div className="absolute inset-0 overflow-hidden bg-black/40" style={{ width: `${position}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={beforeUrl} alt="Original uploaded image" className="h-full w-full object-contain" decoding="async" />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(32,211,255,.14),transparent_34%),linear-gradient(180deg,rgba(3,5,13,.08),transparent_48%,rgba(3,5,13,.24))]" />
        <div
          className="absolute inset-y-0 w-px bg-white/90 shadow-[0_0_28px_rgba(32,211,255,.72)]"
          style={{ left: `${position}%` }}
        />
        <div
          className="absolute top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/55 text-white shadow-glow backdrop-blur-xl"
          style={{ left: `${position}%` }}
        >
          <Tag size={16} />
        </div>
        <span className="absolute left-2 top-2 max-w-[42%] rounded-full bg-black/60 px-2.5 py-1 text-[9px] font-black uppercase text-white sm:left-3 sm:top-3 sm:px-3 sm:text-[10px]">
          {beforeLabel}
        </span>
        <span className="absolute right-2 top-2 max-w-[46%] rounded-full bg-black/60 px-2.5 py-1 text-right text-[9px] font-black uppercase text-white sm:right-3 sm:top-3 sm:px-3 sm:text-[10px]">
          {afterLabel}
        </span>
        <span className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/45 px-3 py-1 text-[10px] font-black uppercase text-slate-200 backdrop-blur max-sm:hidden">
          Slide to compare
        </span>
      </div>
      <input
        type="range"
        min="18"
        max="82"
        value={position}
        onChange={(event) => onPositionChange(Number(event.target.value))}
        className="absolute inset-x-4 bottom-4 h-2 cursor-ew-resize accent-cyan"
        aria-label="Compare original and background removed result"
      />
    </div>
  );
}

function waitForPreviewPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function redirectToSignIn() {
  window.location.href = `/auth/sign-in?next=${encodeURIComponent(trialPackUrl)}`;
}

function getQualityModeLabel(quality: QualityMode) {
  if (quality === "fast") return "Fast";
  if (quality === "standard") return "Standard";
  return "High Quality";
}

function getMarketplaceCropFormatLabel(format: MarketplaceCropFormat) {
  return marketplaceCropFormats.find((item) => item.value === format)?.label ?? "1:1 Square";
}

function getMarketplaceCropFormatShortLabel(format: MarketplaceCropFormat) {
  return marketplaceCropFormats.find((item) => item.value === format)?.shortLabel ?? "1:1";
}

function getDownloadFilename(
  toolConfig: (typeof homeToolOptions)[number],
  cropFormat: MarketplaceCropFormat,
  shadowPreset: ProductShadowPreset,
  relightPreset: AiRelightPreset,
  upscalePreset: HdUpscalePreset
) {
  if (toolConfig.key === "marketplace-crop") {
    return `marketplace-crop-${getMarketplaceCropFilenamePart(cropFormat)}.png`;
  }

  if (toolConfig.key === "product-shadow") {
    return `product-shadow-${getProductShadowFilenamePart(shadowPreset)}.png`;
  }

  if (toolConfig.key === "ai-relight") {
    return `ai-relight-${getAiRelightFilenamePart(relightPreset)}.png`;
  }

  if (toolConfig.key === "hd-upscale") {
    return `hd-upscale-${getHdUpscaleFilenamePart(upscalePreset)}.png`;
  }

  return toolConfig.downloadFilename;
}

function getMarketplaceCropFilenamePart(format: MarketplaceCropFormat) {
  if (format === "portrait") return "4x5";
  if (format === "story") return "9x16";
  if (format === "horizontal") return "16x9";
  if (format === "marketplace-white") return "white";
  return "square";
}

function getProductShadowPresetLabel(preset: ProductShadowPreset) {
  return productShadowPresets.find((item) => item.value === preset)?.label ?? "Soft Studio";
}

function getProductShadowPresetShortLabel(preset: ProductShadowPreset) {
  return productShadowPresets.find((item) => item.value === preset)?.shortLabel ?? "Studio";
}

function getProductShadowFilenamePart(preset: ProductShadowPreset) {
  if (preset === "floating-shadow") return "floating";
  if (preset === "luxury-catalog") return "luxury";
  if (preset === "soft-floor") return "soft-floor";
  return "soft-studio";
}

function getAiRelightPresetLabel(preset: AiRelightPreset) {
  return aiRelightPresets.find((item) => item.value === preset)?.label ?? "Soft Studio Light";
}

function getAiRelightPresetShortLabel(preset: AiRelightPreset) {
  return aiRelightPresets.find((item) => item.value === preset)?.shortLabel ?? "Studio";
}

function getAiRelightFilenamePart(preset: AiRelightPreset) {
  if (preset === "luxury-glow") return "luxury-glow";
  if (preset === "bright-catalog") return "bright-catalog";
  if (preset === "dramatic-product-light") return "dramatic";
  return "soft-studio-light";
}

function getHdUpscalePresetLabel(preset: HdUpscalePreset) {
  return hdUpscalePresets.find((item) => item.value === preset)?.label ?? "2x HD";
}

function getHdUpscalePresetShortLabel(preset: HdUpscalePreset) {
  return hdUpscalePresets.find((item) => item.value === preset)?.shortLabel ?? "2x HD";
}

function getHdUpscaleFilenamePart(preset: HdUpscalePreset) {
  if (preset === "4x-ultra") return "4x-ultra";
  if (preset === "sharp-catalog") return "sharp-catalog";
  if (preset === "social-cleanup") return "social-cleanup";
  return "2x-hd";
}

function getEconomyToolSlug(tool: HomeToolMode) {
  if (tool === "photo-enhancer") return "ai-photo-enhancer";
  return tool;
}

function getEconomyPreset(
  tool: HomeToolMode,
  cropFormat: MarketplaceCropFormat,
  shadowPreset: ProductShadowPreset,
  relightPreset: AiRelightPreset,
  upscalePreset: HdUpscalePreset
) {
  if (tool === "marketplace-crop") return cropFormat;
  if (tool === "product-shadow") return shadowPreset;
  if (tool === "ai-relight") return relightPreset;
  if (tool === "hd-upscale") return upscalePreset;
  return undefined;
}

function getResultBeforeLabel(tool: HomeToolMode) {
  if (tool === "product-shadow") return "Flat product";
  if (tool === "ai-relight") return "Flat lighting";
  if (tool === "hd-upscale") return "Low resolution";
  return "Before";
}

function getResultAfterLabel(tool: HomeToolMode) {
  if (tool === "product-shadow") return "Studio grounded";
  if (tool === "ai-relight") return "Studio relit";
  if (tool === "hd-upscale") return "HD upscale";
  return "Zeylora export";
}
