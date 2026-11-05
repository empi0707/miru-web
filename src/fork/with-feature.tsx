import type { ComponentType } from "react";

/** Renders the wrapped component only when `enabled` is true (fork feature flags). */
export function withFeature<P extends object>(
  enabled: boolean,
  Component: ComponentType<P>,
) {
  function FeatureGated(props: P) {
    return enabled ? <Component {...props} /> : null;
  }
  FeatureGated.displayName = `withFeature(${Component.displayName || Component.name || "Component"})`;
  return FeatureGated;
}
