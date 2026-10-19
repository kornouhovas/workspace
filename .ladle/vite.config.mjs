// Ladle owns its React plugin and preview root; share the desktop CSS compiler.
import tailwindcss from "@tailwindcss/vite";
export default { plugins: [tailwindcss()] };
