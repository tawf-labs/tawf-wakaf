/// Shared entrance animation. Lives outside components/ui.tsx so that file exports components
/// only — a module that mixes the two opts itself out of React Fast Refresh.
export const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.8, ease: "easeOut" as const },
};
