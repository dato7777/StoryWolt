/** Fixed decorative shapes — visibility controlled per theme in index.css */
export function PageBackgroundDecor() {
  return (
    <div className="bg-decor" aria-hidden>
      {/* Ocean Wave */}
      <div className="bg-shape bg-deco-ocean-ring" />
      <div className="bg-shape bg-deco-ocean-blob-tr" />
      <div className="bg-shape bg-deco-ocean-blob-bl" />

      {/* Sunset Bloom */}
      <div className="bg-shape bg-deco-sunset-blob-1" />
      <div className="bg-shape bg-deco-sunset-blob-2" />
      <div className="bg-shape bg-deco-sunset-stripes" />

      {/* Violet Circuit */}
      <div className="bg-shape bg-deco-violet-diamond" />
      <div className="bg-shape bg-deco-violet-ring" />
      <div className="bg-shape bg-deco-violet-beam" />

      {/* Sage Terrace */}
      <div className="bg-shape bg-deco-sage-arch" />
      <div className="bg-shape bg-deco-sage-blob" />
      <div className="bg-shape bg-deco-sage-leaf" />
    </div>
  );
}
