import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  base: "/city-quest/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "City Quest",
        short_name: "CityQuest",
        description: "Gamify exploring your city — discover venues, check in, unlock achievements.",
        theme_color: "#0f0f1a",
        background_color: "#0f0f1a",
        display: "standalone",
        start_url: "/city-quest/",
        icons: [
          { src: "/city-quest/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
          { src: "/city-quest/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
          { src: "/city-quest/icon-maskable.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff,woff2}"],
      },
    }),
  ],
  server: {
    port: 5174,
    host: true,
  },
});
