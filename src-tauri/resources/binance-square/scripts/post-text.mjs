#!/usr/bin/env node
import { parseArgs, printPublishSuccess, publish, resolveApiKey } from "./lib.mjs";
try {
  const args = process.argv.slice(2);
  const { text } = parseArgs(args, ["text"]);
  const { title } = parseArgs(args, [], ["title"]);
  const body = { contentType: title ? 2 : 1, bodyTextOnly: text };
  if (title) body.title = title;
  printPublishSuccess(await publish(resolveApiKey(args), body));
} catch (err) {
  const cause = err?.cause?.message ? `; cause: ${err.cause.message}` : "";
  console.error(`Failed: ${err.message}${cause}`);
  process.exit(1);
}
