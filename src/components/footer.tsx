"use client";

import { t } from "@/fork/i18n";
import React from "react";
import Image from "next/image";
import { useBrandOverride } from "@/fork/brand-override";
import { LOGO_TEXT_ENABLED } from "@/fork/config";

const Footer = () => {
  const { brand, logo, isExternalLogo } = useBrandOverride();
  return (
    <footer className="w-full bg-slate-950/80 border-t border-slate-900 shadow-xl p-6 flex flex-col items-center space-y-4">
      <div className="flex items-center gap-2">
        {isExternalLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={`${brand} logo`} width={40} height={40} className="rounded-xl shadow-md" />
        ) : (
          <Image src={logo} alt={`${brand} logo`} width={40} height={40} className="rounded-xl shadow-md" />
        )}
        {LOGO_TEXT_ENABLED && (
          <span className="text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-pink-500 to-cyan-400">
            {brand}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 text-center max-w-xl">
        {t("{brand} does not store any files on the server; it only displays metadata and links to media hosted on 3rd party services.", { brand })}
      </p>
      <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} {brand}. {t("All rights reserved.")}</p>
    </footer>
  );
};

export default Footer;
