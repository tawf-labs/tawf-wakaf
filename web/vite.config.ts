import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative base so a production build works from IPFS or any subpath, not just a domain root.
  // This holds because every route is exactly one level deep (/earn, /dashboard, …): `./assets/x`
  // resolved against `/earn` still lands on `/assets/x`. Adding a nested route would break that,
  // and would need an absolute base or a router basename instead.
  base: './',
})
