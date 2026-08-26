/**
 * Affilitube brand mark — "AT" monogram in a purple/indigo gradient tile.
 *
 * Replaces the prior YouTube play-button icon which was flagged under the
 * YouTube Developer Policy (III.F.2a/b) for improperly modified branding.
 * The mark uses only Affilitube-owned typography/colours and contains no
 * reference to YouTube shapes, colours, or wordmarks.
 */
export function BrandMark({ size = "md", className = "" }) {
  const map = {
    xs: { box: "h-6 w-6 rounded-md",   text: "text-[9px]" },
    sm: { box: "h-7 w-7 rounded-lg",   text: "text-[10px]" },
    md: { box: "h-9 w-9 rounded-xl",   text: "text-xs" },
    lg: { box: "h-10 w-10 rounded-xl", text: "text-sm" },
    xl: { box: "h-14 w-14 rounded-2xl", text: "text-lg" },
  };
  const s = map[size] || map.md;
  return (
    <div
      className={`${s.box} bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 ${className}`}
      aria-label="Affilitube"
      data-testid="brand-mark"
    >
      <span
        className={`font-heading font-black text-white ${s.text} tracking-tighter leading-none select-none`}
      >
        AT
      </span>
    </div>
  );
}
