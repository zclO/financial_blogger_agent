#!/usr/bin/env node
import { maskApiKey, saveApiKey } from "./lib.mjs";
try { const key = process.env.BINANCE_SQUARE_OPENAPI_KEY?.trim(); if (!key) throw new Error("BINANCE_SQUARE_OPENAPI_KEY is required"); console.log(`Saved Square OpenAPI key ${maskApiKey(key)} to ${saveApiKey(key)}`); } catch (err) { console.error(`Failed: ${err.message}`); process.exit(1); }
