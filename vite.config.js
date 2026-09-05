import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Not autoUpdate: swapping the worker mid-session can leave a
      // half-updated app against a stale cache, which is genuinely confusing
      // if it happens while a form is open.
      registerType: "prompt",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Ralphy Tools",
        short_name: "Ralphy",
        description:
          "Currency converter, time tools, shopping list, and work tracking",
        theme_color: "#1976d2",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Log time",
            url: "/work/logs",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
          },
          {
            name: "My tasks",
            url: "/work/tasks",
            icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Auth first — order matters, Workbox takes the first match.
            // Tokens sitting in a cache are a real problem.
            // The hostname is written out in full on purpose: Workbox
            // stringifies these matchers into sw.js, so anything they close
            // over is undefined at runtime.
            urlPattern: ({ url }) =>
              url.hostname === "ralph-portfolio-production.up.railway.app" &&
              url.pathname.includes("/work/auth"),
            handler: "NetworkOnly",
          },
          {
            // API GETs: fresh when online, cached when not.
            urlPattern: ({ url, request }) =>
              url.hostname === "ralph-portfolio-production.up.railway.app" &&
              url.pathname.startsWith("/api/") &&
              request.method === "GET",
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: { enabled: false }, // flip on to debug the SW against `vite dev`
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
