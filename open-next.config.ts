import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

export default defineCloudflareConfig({
  // The demo currently uses dynamic routes and API handlers but does not need
  // Cloudflare-specific cache bindings to run.
});
