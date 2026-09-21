"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Wraps a thumbnail; tapping it opens the full-resolution image (TMDB
 * "original") in a fullscreen overlay. Tap anywhere / Esc / X to close.
 */
export default function ImageLightbox({
  src,
  alt,
  children,
  className,
}: {
  src: string | null;
  alt: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!src) return <>{children}</>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge ${alt}`}
        className={className}
      >
        {children}
      </button>
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 rounded-full bg-white/15 p-2 text-white"
            >
              <X size={22} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- must be the untouched original file */}
            <img
              src={src}
              alt={alt}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          </div>,
          document.body
        )}
    </>
  );
}
