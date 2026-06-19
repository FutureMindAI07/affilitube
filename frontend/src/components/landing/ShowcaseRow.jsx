/**
 * ShowcaseRow — full-width feature row for landing pages.
 *
 * Props:
 *   imagePosition: "left" | "right"  — desktop image side (mobile always stacks: image on top)
 *   imageSrc: string                 — image URL
 *   imageAlt: string                 — accessible alt text
 *   heading: string                  — H3 text
 *   body: string                     — paragraph text
 *
 * Desktop: ~50/50 split (md:grid-cols-2).
 * Mobile: stacked, image first.
 * Click image (or tap on touch) → opens a full-screen lightbox at natural resolution
 * via react-medium-image-zoom. Esc / click-outside to close.
 */
import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";


/** Small scrollable lightbox used for tall portrait images that don't fit the
 *  viewport vertically. Renders the image at min(90vw, 1100px) wide with
 *  height: auto, and lets the modal body scroll. Closes on Esc or backdrop click. */
function TallLightbox({ src, alt, open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[9999] bg-black/85 overflow-y-auto flex items-start justify-center py-10"
      onClick={onClose}
      data-testid="showcase-tall-lightbox"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="fixed top-4 right-6 z-[10000] w-10 h-10 rounded-full bg-white/95 text-slate-900 text-xl leading-none flex items-center justify-center shadow-lg hover:bg-white transition"
        data-testid="showcase-tall-lightbox-close"
      >
        ×
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="block rounded-xl shadow-2xl bg-white"
        style={{ width: "min(90vw, 1100px)", height: "auto" }}
      />
    </div>
  );
}

TallLightbox.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string.isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};


export default function ShowcaseRow({
  imagePosition = "left",
  imageSrc,
  imageAlt,
  heading,
  body,
  imageAspect = "wide",
}) {
  const imageOrderClass = imagePosition === "right" ? "md:order-2" : "md:order-1";
  const textOrderClass = imagePosition === "right" ? "md:order-1" : "md:order-2";
  const isTall = imageAspect === "tall";
  const [tallOpen, setTallOpen] = useState(false);

  const ImageEl = (
    <img
      src={imageSrc}
      alt={imageAlt}
      loading="lazy"
      className={`w-full h-auto block transition-transform duration-500 ease-out md:group-hover:scale-[1.02] md:cursor-zoom-in ${
        isTall ? "max-h-[440px] object-cover object-top" : ""
      }`}
      data-testid="showcase-row-image"
    />
  );

  return (
    <div
      className="grid md:grid-cols-2 gap-10 md:gap-14 items-center"
      data-testid="showcase-row"
    >
      <div className={`order-1 ${imageOrderClass}`}>
        <div className="group relative rounded-2xl overflow-hidden border border-slate-200 shadow-xl shadow-slate-900/5 bg-white transition-shadow duration-300 md:hover:shadow-2xl md:hover:shadow-slate-900/10">
          {isTall ? (
            <button
              type="button"
              onClick={() => setTallOpen(true)}
              className="block w-full text-left p-0 m-0 bg-transparent border-0"
              aria-label={`Open full image: ${imageAlt}`}
              data-testid="showcase-row-image-trigger"
            >
              {ImageEl}
            </button>
          ) : (
            <Zoom zoomMargin={48} classDialog="showcase-zoom-dialog">
              {ImageEl}
            </Zoom>
          )}
          {!isTall && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute bottom-3 right-3 px-3 py-1 rounded-full bg-slate-900/80 text-white text-[11px] font-medium tracking-wide backdrop-blur-sm shadow-md"
            >
              Click to enlarge image
            </div>
          )}
          {isTall && (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white via-white/85 to-transparent"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900/85 text-white text-[11px] font-medium tracking-wide backdrop-blur-sm"
              >
                Click to see the full card
              </div>
            </>
          )}
        </div>
      </div>
      <div className={`order-2 ${textOrderClass}`}>
        <h3
          className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 mb-4 leading-tight"
          data-testid="showcase-row-heading"
        >
          {heading}
        </h3>
        <p
          className="text-base text-slate-600 leading-relaxed"
          data-testid="showcase-row-body"
        >
          {body}
        </p>
      </div>
      {isTall && (
        <TallLightbox
          src={imageSrc}
          alt={imageAlt}
          open={tallOpen}
          onClose={() => setTallOpen(false)}
        />
      )}
    </div>
  );
}

ShowcaseRow.propTypes = {
  imagePosition: PropTypes.oneOf(["left", "right"]),
  imageSrc: PropTypes.string.isRequired,
  imageAlt: PropTypes.string.isRequired,
  heading: PropTypes.string.isRequired,
  body: PropTypes.string.isRequired,
  imageAspect: PropTypes.oneOf(["wide", "tall"]),
};
