#!/usr/bin/env node

import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import {
  parseArgs,
  printPublishSuccess,
  publish,
  resolveApiKey,
  uploadImage,
  uploadVideo,
} from "./lib.mjs";

function probeDurationSeconds(videoPath) {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ],
    { encoding: "utf8" },
  );

  if (result.error) {
    throw new Error(`Failed to run ffprobe: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Failed to read video duration: ${result.stderr || "ffprobe exited with an error"}`);
  }
  const value = Number(result.stdout.trim());
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Failed to parse video duration from ffprobe output.");
  }
  return Math.max(1, Math.ceil(value));
}

function extractVideoCover(videoPath) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "square-video-cover-"));
  const coverPath = path.join(tempDir, `${path.parse(videoPath).name}-cover.png`);
  const result = spawnSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-i", videoPath, "-frames:v", "1", "-q:v", "2", coverPath],
    { encoding: "utf8" },
  );

  if (result.error) {
    throw new Error(`Failed to run ffmpeg: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Failed to extract video cover: ${result.stderr || "ffmpeg exited with an error"}`);
  }
  if (!fs.existsSync(coverPath) || fs.statSync(coverPath).size === 0) {
    throw new Error("Failed to extract video cover: empty cover file");
  }

  return { coverPath, tempDir };
}

function cleanupCover(coverPath, tempDir) {
  if (coverPath && fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
  if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
}

try {
  const args = process.argv.slice(2);
  const { video } = parseArgs(args, ["video"]);
  const { text, title } = parseArgs(args, [], ["text", "title"]);

  const videoPath = path.resolve(video);
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const videoTimeSeconds = probeDurationSeconds(videoPath);
  const key = resolveApiKey(args);

  console.log("Uploading video...");
  const { fileTicket } = await uploadVideo(key, videoPath);

  console.log("Generating and uploading cover...");
  let coverPath;
  let coverTempDir;
  try {
    ({ coverPath, tempDir: coverTempDir } = extractVideoCover(videoPath));
    const cover = await uploadImage(key, coverPath);

    console.log("Publishing...");
    const body = {
      contentType: 3,
      fileTicket,
      cover,
      videoTimeSeconds,
      isPublish: true,
    };
    if (text?.trim()) body.bodyTextOnly = text.trim();
    if (title?.trim()) body.title = title.trim();

    const result = await publish(key, body);
    printPublishSuccess(result);
  } finally {
    cleanupCover(coverPath, coverTempDir);
  }
} catch (err) {
  const cause = err?.cause?.message ? `; cause: ${err.cause.message}` : "";
  console.error(`Failed: ${err.message}${cause}`);
  process.exit(1);
}
