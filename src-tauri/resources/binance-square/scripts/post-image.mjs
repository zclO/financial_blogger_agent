#!/usr/bin/env node
import { parseArgs, printPublishSuccess, publish, resolveApiKey, uploadImage } from "./lib.mjs";
try {
  const args = process.argv.slice(2);
  const { text } = parseArgs(args, ["text"]);
  const { title, images, cover } = parseArgs(args, [], ["title", "images", "cover"]);
  const mode = title?.trim() ? "article" : "post";

  const apiKey = resolveApiKey(args);

  if (mode === "article") {
    // Article with optional cover image
    if (!title.trim()) throw new Error("title is required for article");
    const body = { bodyTextOnly: text, contentType: 2, title: title.trim() };

    if (cover) {
      const imageUrl = await uploadImage(apiKey, cover);
      body.cover = imageUrl;
    }

    printPublishSuccess(await publish(apiKey, body));
  } else {
    // Short post with images (up to 4)
    if (!images) throw new Error("--images is required for image post (comma-separated paths, max 4)");
    const imagePaths = images.split(",").map((p) => p.trim()).filter(Boolean);
    if (imagePaths.length === 0) throw new Error("No valid image paths provided");
    if (imagePaths.length > 4) throw new Error("Max 4 images per post");

    // Upload all images
    const imageUrls = [];
    for (const p of imagePaths) {
      imageUrls.push(await uploadImage(apiKey, p));
    }

    const body = { bodyTextOnly: text, contentType: 1, imageList: imageUrls };
    printPublishSuccess(await publish(apiKey, body));
  }
} catch (err) {
  const cause = err?.cause?.message ? `; cause: ${err.cause.message}` : "";
  console.error(`Failed: ${err.message}${cause}`);
  process.exit(1);
}
