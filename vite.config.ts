import { defineConfig, loadEnv } from "vite";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { assertPublicEnvironment } from "./scripts/public-env.mjs";
import react from "@vitejs/plugin-react";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { cloudinaryUrl } from "./src/lib/cloudinary";
import { heroImageSources } from "./src/lib/hero-image";
export default defineConfig(({ mode }) => {
  assertPublicEnvironment({ ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env });
  return {
  plugins: [
    {
      name: "cloudinary-content-images",
      writeBundle() {
        // Keep source originals for verification, but do not ship unused copies.
        const output = path.resolve("dist");
        for (const relative of [
          "blog_images/cognac_leather.webp", "blog_images/italian-leather.webp", "blog_images/winter.webp",
          "size-charts/mens-jackets.webp", "size-charts/womens-jackets.webp",
        ]) {
          const target = path.resolve(output, relative);
          if (!target.startsWith(output + path.sep)) throw new Error("Invalid public image path");
          rmSync(target, { force: true });
        }
      },
    },
    {
      name: "homepage-hero-discovery",
      transformIndexHtml() {
        const assets = JSON.parse(readFileSync(new URL("./src/data/cloudinary-assets.json", import.meta.url), "utf8"));
        const hero = assets["/src/assets/banners/hero-main.webp"].url as string;
        // Start the LCP request before the application bundle runs, only on home.
        // Other routes must not download an unrelated campaign banner.
        return [{ tag: "script", injectTo: "head" as const, children:
          `if(/^\\/(?:en|it|de|fr|es)\\/?$/.test(location.pathname)||location.pathname==='/'){var heroPreload=document.createElement('link');heroPreload.rel='preload';heroPreload.as='image';heroPreload.href=${JSON.stringify(cloudinaryUrl(hero, { width: 1280, height: 900, crop: "fill" }))};heroPreload.imageSrcset=${JSON.stringify(heroImageSources(hero))};heroPreload.imageSizes='100vw';heroPreload.fetchPriority='high';document.head.appendChild(heroPreload);}`,
        }];
      },
    },
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  define: {
    global: "globalThis",
  },
  esbuild: { drop: ["debugger"], pure: ["console.debug", "console.log"] },
  build: {
    sourcemap: false,
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          router: ["@tanstack/react-query", "@tanstack/react-router"],
          supabase: ["@supabase/supabase-js"],
          "storefront-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "lucide-react",
            "sonner",
            "zustand",
          ],
        },
      },
    },
  },
  preview: {
    port: 4173,
    headers: Object.fromEntries(readFileSync(new URL("./public/.htaccess", import.meta.url), "utf8").split(/\r?\n/).flatMap((line) => {
      const header = line.match(/^\s*Header always set ([\w-]+) "([^"]*)"$/);
      return header ? [[header[1], header[2]]] : [];
    })),
  },
  };
});
