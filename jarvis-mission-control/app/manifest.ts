import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ATLAS — Mission Control",
    short_name: "ATLAS",
    description: "Personal mission control dashboard",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#04080c",
    theme_color: "#04080c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
