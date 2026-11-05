import { BRAND_PRIMARY, BRAND_SECONDARY } from "./config";
import { brandColorCss } from "./brand-colors";

/** Injects brand colour CSS variables (rendered in <head> of the root layout). */
export default function BrandStyle() {
  const css = brandColorCss(BRAND_PRIMARY, BRAND_SECONDARY);
  return css ? <style id="brand-colors" dangerouslySetInnerHTML={{ __html: css }} /> : null;
}
