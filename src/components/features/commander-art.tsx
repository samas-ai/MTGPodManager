import Image from "next/image";

/**
 * Commander art banner (Scryfall art_crop) with the required artist credit.
 * Renders nothing when there's no art (manual decks whose commander didn't
 * resolve). Artist attribution is mandatory wherever art shows — Scryfall
 * guidelines + the Fan Content Policy (see CREDITS.md). next/image optimizes
 * and serves from our origin, so it stays within the CSP.
 */
export function CommanderArt({
  src,
  artist,
  alt,
  className,
}: {
  src: string | null;
  artist: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) return null;

  return (
    <div className={className}>
      <div className="relative aspect-[626/240] w-full overflow-hidden rounded-md">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 448px) 100vw, 448px"
          className="object-cover object-center"
        />
        {/* token-gradient scrim so the artist credit stays legible over art */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
          {artist ? (
            <p className="text-right text-[10px] leading-none text-white/85">Art: {artist}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
