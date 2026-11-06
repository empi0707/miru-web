"use client";

/**
 * Fork-only: injects /ads.html into every page at runtime.
 * Edit public/ads.html to add ad network scripts, banners, etc.
 * The file is optional — when absent or empty nothing is injected.
 */
import { useEffect } from "react";

export default function AdsLoader() {
  useEffect(() => {
    fetch("/ads.html")
      .then((r) => (r.ok ? r.text() : ""))
      .then((html) => {
        if (!html.trim()) return;
        const wrapper = document.createElement("div");
        wrapper.id = "fork-ads";
        wrapper.innerHTML = html;
        // dangerouslySetInnerHTML skips <script> execution; recreate them so they run.
        wrapper.querySelectorAll("script").forEach((orig) => {
          const script = document.createElement("script");
          Array.from(orig.attributes).forEach((a) => script.setAttribute(a.name, a.value));
          script.textContent = orig.textContent;
          document.head.appendChild(script);
          orig.remove();
        });
        document.body.appendChild(wrapper);
      })
      .catch(() => {});
  }, []);

  return null;
}
