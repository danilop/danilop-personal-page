import { deployment } from "../core/deployment.mjs";
import { verifySharedLink } from "../core/social-link-check";

async function main() {
  const urls = process.argv.slice(2);
  if (!urls.length)
    throw Error(
      "Usage: npm run verify:social -- <full-or-short-https-url> [...]",
    );
  for (const url of urls)
    console.log(
      JSON.stringify(await verifySharedLink(url, deployment.origin), null, 2),
    );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
