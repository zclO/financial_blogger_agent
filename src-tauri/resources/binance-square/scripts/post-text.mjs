#!/usr/bin/env node
import { parseArgs, printPublishSuccess, publish, resolveApiKey, uploadImage } from "./lib.mjs";
try {
  const args = process.argv.slice(2);
  const { text } = parseArgs(args, ["text"]);
  const { title, contentType, videoUrl, image } = parseArgs(args, [], ["title", "contentType", "videoUrl", "image"]);
  const mode = (contentType || (title ? "article" : "post")).toLowerCase();

  if (!["post", "article", "video"].includes(mode)) {
    throw new Error("contentType must be one of: post, article, video");
  }

  const apiKey = resolveApiKey(args);

  // Upload image first if provided
  let imageUrl = null;
  if (image) {
    imageUrl = await uploadImage(apiKey, image);
  }

  const body = { bodyTextOnly: text };

  if (mode === "post") {
    body.contentType = 1;
    if (imageUrl) body.imageUrl = imageUrl;
  } else if (mode === "article") {
    body.contentType = 2;
    if (!title?.trim()) throw new Error("title is required for article");
    body.title = title.trim();
    if (imageUrl) body.imageUrl = imageUrl;
  } else {
    body.contentType = 3;
    if (!videoUrl?.trim()) throw new Error("videoUrl is required for video");
    body.videoUrl = videoUrl.trim();
    if (title?.trim()) body.title = title.trim();
  }

  printPublishSuccess(await publish(apiKey, body));
} catch (err) {
  const cause = err?.cause?.message ? `; cause: ${err.cause.message}` : "";
  console.error(`Failed: ${err.message}${cause}`);
  process.exit(1);
}
