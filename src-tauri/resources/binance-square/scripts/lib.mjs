import fs from "fs";
import os from "os";
import path from "path";

const BASE_URL_V1 = "https://www.binance.com/bapi/composite/v1/public/pgc/openApi";
const CONFIG_FILE = path.join(os.homedir(), ".config", "binance-square", "openapi-key");

export function maskApiKey(key) { return key.length <= 9 ? `${key.slice(0, 2)}...` : `${key.slice(0, 5)}...${key.slice(-4)}`; }
export function saveApiKey(apiKey) { const key = apiKey.trim(); if (!key) throw new Error("Missing Square OpenAPI key"); fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true, mode: 0o700 }); fs.writeFileSync(CONFIG_FILE, `${key}\n`, { mode: 0o600 }); fs.chmodSync(CONFIG_FILE, 0o600); return CONFIG_FILE; }
export function resolveApiKey(args = []) { if (args.includes("--key")) throw new Error("Do not pass API keys with --key."); const key = process.env.BINANCE_SQUARE_OPENAPI_KEY?.trim() || (fs.existsSync(CONFIG_FILE) ? fs.readFileSync(CONFIG_FILE, "utf8").trim() : ""); if (!key) throw new Error("Missing Square OpenAPI key."); return key; }
export async function publish(apiKey, body) {
  let res;
  try {
    res = await fetch(`${BASE_URL_V1}/content/add`, {
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
  if (res.status === 504) return { id: null, shareLink: null };
  const json = await res.json();
  if (json.code !== "000000") throw new Error(`API error [${json.code}]: ${json.message}`);
  return json.data;
}
export function printPublishSuccess(result) { console.log("Success!"); console.log(`ID: ${result.id ?? "unavailable"}`); console.log(`Link: ${result.shareLink ?? "unavailable"}`); }
export function parseArgs(args, required, optional = []) { const result = {}; for (const flag of [...required, ...optional]) { const index = args.indexOf(`--${flag}`); if (index !== -1 && index + 1 < args.length) result[flag] = args[index + 1]; } for (const flag of required) if (!result[flag]) throw new Error(`--${flag} is required`); return result; }
