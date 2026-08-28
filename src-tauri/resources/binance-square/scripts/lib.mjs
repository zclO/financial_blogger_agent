import fs from "fs";
import os from "os";
import path from "path";

const BASE_URL_V1 = "https://www.binance.com/bapi/composite/v1/public/pgc/openApi";
const BASE_URL_V2 = "https://www.binance.com/bapi/composite/v2/public/pgc/openApi";
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_RETRIES = 20;
const CONFIG_FILE = path.join(os.homedir(), ".config", "binance-square", "openapi-key");

const CONTENT_TYPE_MAP = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  webm: "video/webm",
  mkv: "video/x-matroska",
};

export function getContentType(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return CONTENT_TYPE_MAP[ext] || "application/octet-stream";
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function maskApiKey(key) {
  return key.length <= 9 ? `${key.slice(0, 2)}...` : `${key.slice(0, 5)}...${key.slice(-4)}`;
}

export function saveApiKey(apiKey) {
  const key = apiKey.trim();
  if (!key) throw new Error("Missing Square OpenAPI key");
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG_FILE, `${key}\n`, { mode: 0o600 });
  fs.chmodSync(CONFIG_FILE, 0o600);
  return CONFIG_FILE;
}

export function resolveApiKey(args = []) {
  if (args.includes("--key")) throw new Error("Do not pass API keys with --key.");
  const key =
    process.env.BINANCE_SQUARE_OPENAPI_KEY?.trim() ||
    (fs.existsSync(CONFIG_FILE) ? fs.readFileSync(CONFIG_FILE, "utf8").trim() : "");
  if (!key) throw new Error("Missing Square OpenAPI key.");
  return key;
}

export async function api(endpoint, apiKey, body, baseUrl = BASE_URL_V2) {
  let res;
  try {
    res = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "X-Square-OpenAPI-Key": apiKey,
        "Content-Type": "application/json",
        clienttype: "binanceSkill",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const cause = err?.cause?.message ? `; cause: ${err.cause.message}` : "";
    throw new Error(`Network request failed: ${err.message}${cause}`);
  }

  const raw = await res.text();
  if (endpoint === "/content/add" && res.status === 504) {
    return { id: null, shareLink: null, publishStatus: "success_without_post_id" };
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`API returned non-JSON response: ${res.status} ${res.statusText}`);
  }
  if (json.code !== "000000") {
    throw new Error(`API error [${json.code}]: ${json.message}`);
  }
  return json.data;
}

export async function uploadToS3(presignedUrl, filePath, contentType) {
  const fileBuffer = fs.readFileSync(filePath);
  let res;
  try {
    res = await fetch(presignedUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: fileBuffer,
    });
  } catch (err) {
    const cause = err?.cause?.message ? `; cause: ${err.cause.message}` : "";
    throw new Error(`S3 upload network failed: ${err.message}${cause}`);
  }
  if (!res.ok) throw new Error(`S3 upload failed: ${res.status} ${res.statusText}`);
}

export async function pollFileStatus(apiKey, fileTicket, mediaType) {
  const endpoint = mediaType === "video" ? "/video/videoStatus" : "/image/imageStatus";
  for (let i = 0; i < MAX_POLL_RETRIES; i++) {
    const data = await api(endpoint, apiKey, { fileTicket });
    if (data.status === 1) return data;
    if (data.status === 2) throw new Error(`Processing failed: ${data.failedReason || "unknown"}`);
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Poll timed out after ${MAX_POLL_RETRIES} retries`);
}

export async function uploadImage(apiKey, imagePath) {
  const imageName = path.basename(imagePath);
  const contentType = getContentType(imagePath);
  const { presignedUrl, fileTicket } = await api("/image/presignedUrl", apiKey, { imageName });
  await uploadToS3(presignedUrl, imagePath, contentType);
  const status = await pollFileStatus(apiKey, fileTicket, "image");
  return status.imageUrl;
}

export async function uploadVideo(apiKey, videoPath) {
  const fileName = path.basename(videoPath);
  const size = fs.statSync(videoPath).size;
  const contentType = getContentType(videoPath);
  const { presignedUrl, fileTicket } = await api("/video/preSign", apiKey, { fileName, size });
  await uploadToS3(presignedUrl, videoPath, contentType);
  await pollFileStatus(apiKey, fileTicket, "video");
  return { fileTicket };
}

export async function publish(apiKey, body) {
  return await api("/content/add", apiKey, body, BASE_URL_V1);
}

export function printPublishSuccess(result) {
  console.log("Success!");
  console.log(`ID: ${result.id ?? "unavailable"}`);
  console.log(`Link: ${result.shareLink ?? "unavailable"}`);
}

export function parseArgs(args, required, optional = []) {
  const result = {};
  for (const flag of [...required, ...optional]) {
    const index = args.indexOf(`--${flag}`);
    if (index !== -1 && index + 1 < args.length) result[flag] = args[index + 1];
  }
  for (const flag of required) if (!result[flag]) throw new Error(`--${flag} is required`);
  return result;
}
