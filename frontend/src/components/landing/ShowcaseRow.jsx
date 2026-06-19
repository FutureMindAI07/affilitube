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
import PropTypes from "prop-types";
import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";

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

  return (
    <div
      className="grid md:grid-cols-2 gap-10 md:gap-14 items-center"
      data-testid="showcase-row"
    >
      <div className={`order-1 ${imageOrderClass}`}>
        <div className="group relative rounded-2xl overflow-hidden border border-slate-200 shadow-xl shadow-slate-900/5 bg-white transition-shadow duration-300 md:hover:shadow-2xl md:hover:shadow-slate-900/10">
          <Zoom zoomMargin={48} classDialog="showcase-zoom-dialog">
            <img
              src={imageSrc}
              alt={imageAlt}
              loading="lazy"
              className={`w-full h-auto block transition-transform duration-500 ease-out md:group-hover:scale-[1.02] md:cursor-zoom-in ${
                isTall ? "max-h-[440px] object-cover object-top" : ""
              }`}
              data-testid="showcase-row-image"
            />
          </Zoom>
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
