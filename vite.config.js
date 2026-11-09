import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [react(), tailwindcss(), svgr()],
  optimizeDeps: {
    exclude: ["@react-native-async-storage/async-storage"],
  },
  server: {
    // Bind on all interfaces so Tailscale (or LAN) peers can reach the dev
    // server. The frontend then talks to the backend via VITE_SERVER_URL set
    // in frontend/.env.local. Restart `npm run dev` after toggling this.
    host: true,
    // Not `true` (any Host header -> DNS-rebinding exposure). localhost is
    // always allowed; add the Tailscale MagicDNS names dev is reached by.
    allowedHosts: ["localhost", ".ts.net", "jzenbook"],
  },
});
