export type ReplicatePrediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  model?: string;
  version?: string;
  input?: unknown;
  output?: string | string[] | Record<string, unknown> | null;
  error?: string | null;
  logs?: string | null;
  urls?: {
    get?: string;
    cancel?: string;
    web?: string;
  };
  metrics?: {
    predict_time?: number;
  };
};

type ReplicateCreateInput = {
  model: string;
  imageUrl: string;
  input?: Record<string, unknown>;
};

const replicateApiBase = "https://api.replicate.com/v1";
const modelVersionCache = new Map<string, string>();

export class ReplicateApiError extends Error {
  status: number;
  responseBody: string;
  responseJson: unknown;

  constructor(message: string, input: { status: number; responseBody: string; responseJson: unknown }) {
    super(message);
    this.name = "ReplicateApiError";
    this.status = input.status;
    this.responseBody = input.responseBody;
    this.responseJson = input.responseJson;
  }
}

export class ReplicatePredictionError extends Error {
  prediction: ReplicatePrediction;

  constructor(prediction: ReplicatePrediction) {
    super(prediction.error || `Replicate prediction ${prediction.status}`);
    this.name = "ReplicatePredictionError";
    this.prediction = prediction;
  }
}

export async function createReplicatePrediction(input: ReplicateCreateInput) {
  const version = await resolveModelVersion(input.model);
  const requestBody = {
    version,
    input: input.input ?? createDefaultInput(input.imageUrl)
  };

  debugReplicate("create_prediction_request", {
    model: input.model,
    version,
    inputImage: sanitizeUrl(input.imageUrl),
    hasToken: Boolean(process.env.REPLICATE_API_TOKEN)
  });

  const response = await fetch(`${replicateApiBase}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getReplicateToken()}`,
      "Content-Type": "application/json",
      Prefer: "wait=10"
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw await createReplicateHttpError("Replicate create failed", response);
  }

  const prediction = (await response.json()) as ReplicatePrediction;
  debugReplicate("create_prediction_response", summarizePrediction(prediction));

  return prediction;
}

function createDefaultInput(imageUrl: string) {
  return {
    image: imageUrl,
    format: "png",
    background_type: "rgba"
  };
}

export async function getReplicatePrediction(predictionUrl: string) {
  const response = await fetch(predictionUrl, {
    headers: {
      Authorization: `Bearer ${getReplicateToken()}`
    }
  });

  if (!response.ok) {
    throw await createReplicateHttpError("Replicate status failed", response);
  }

  const prediction = (await response.json()) as ReplicatePrediction;
  debugReplicate("prediction_poll_response", summarizePrediction(prediction));

  return prediction;
}

export async function waitForReplicatePrediction(input: {
  prediction: ReplicatePrediction;
  timeoutSeconds: number;
  pollIntervalSeconds: number;
}) {
  const startedAt = Date.now();
  let prediction = input.prediction;

  while (true) {
    if (prediction.status === "succeeded") {
      return prediction;
    }

    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new ReplicatePredictionError(prediction);
    }

    if (Date.now() - startedAt > input.timeoutSeconds * 1000) {
      throw new Error("Replicate prediction timed out.");
    }

    if (!prediction.urls?.get) {
      throw new Error("Replicate prediction status URL is missing.");
    }

    await sleep(input.pollIntervalSeconds * 1000);
    prediction = await getReplicatePrediction(prediction.urls.get);
  }
}

export function extractReplicateOutputUrl(prediction: ReplicatePrediction) {
  const output = prediction.output;

  if (typeof output === "string") {
    return output;
  }

  if (Array.isArray(output) && typeof output[0] === "string") {
    return output[0];
  }

  if (output && typeof output === "object") {
    const values = Object.values(output);
    const firstUrl = values.find((value) => typeof value === "string" && value.startsWith("http"));
    if (typeof firstUrl === "string") return firstUrl;
  }

  return null;
}

async function resolveModelVersion(model: string) {
  if (isVersionId(model)) {
    return model;
  }

  const explicitVersion = parseExplicitVersion(model);
  if (explicitVersion) {
    return explicitVersion;
  }

  const cachedVersion = modelVersionCache.get(model);
  if (cachedVersion) {
    return cachedVersion;
  }

  const [owner, name] = model.split("/");
  if (!owner || !name) {
    throw new Error(`Invalid Replicate model identifier: ${model}`);
  }

  const response = await fetch(`${replicateApiBase}/models/${owner}/${name}`, {
    headers: {
      Authorization: `Bearer ${getReplicateToken()}`
    }
  });

  if (!response.ok) {
    throw await createReplicateHttpError("Replicate model lookup failed", response);
  }

  const modelInfo = (await response.json()) as {
    latest_version?: {
      id?: string;
    };
  };
  const latestVersion = modelInfo.latest_version?.id;

  if (!latestVersion) {
    throw new Error(`Replicate latest version missing for ${model}.`);
  }

  modelVersionCache.set(model, latestVersion);
  debugReplicate("model_version_resolved", {
    model,
    version: latestVersion
  });

  return latestVersion;
}

function parseExplicitVersion(model: string) {
  const [, version] = model.split(":");
  return version && isVersionId(version) ? version : null;
}

function isVersionId(value: string) {
  return /^[a-f0-9]{64}$/i.test(value);
}

async function createReplicateHttpError(label: string, response: Response) {
  const responseBody = await response.text();
  const responseJson = parseJsonSafely(responseBody);
  debugReplicate("http_error", {
    label,
    status: response.status,
    response: responseJson ?? truncate(responseBody, 1200)
  });

  return new ReplicateApiError(`${label}: ${response.status} ${responseBody}`, {
    status: response.status,
    responseBody,
    responseJson
  });
}

function summarizePrediction(prediction: ReplicatePrediction) {
  return {
    id: prediction.id,
    status: prediction.status,
    model: prediction.model,
    version: prediction.version,
    output: summarizeOutput(prediction.output),
    error: prediction.error,
    logs: truncate(prediction.logs, 800),
    urls: {
      get: Boolean(prediction.urls?.get),
      web: prediction.urls?.web
    },
    metrics: prediction.metrics
  };
}

function summarizeOutput(output: ReplicatePrediction["output"]) {
  if (typeof output === "string") return sanitizeUrl(output);
  if (Array.isArray(output)) return output.map((item) => (typeof item === "string" ? sanitizeUrl(item) : item));
  return output;
}

function sanitizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return "invalid-url";
  }
}

function parseJsonSafely(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function truncate(value: string | null | undefined, length: number) {
  if (!value) return value;
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function getReplicateToken() {
  const token = process.env.REPLICATE_API_TOKEN;

  if (!token) {
    throw new Error("Missing REPLICATE_API_TOKEN.");
  }

  return token;
}

function debugReplicate(event: string, payload: unknown) {
  if (process.env.NODE_ENV !== "development") return;
  console.info(`[replicate:${event}]`, JSON.stringify(payload, null, 2));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
