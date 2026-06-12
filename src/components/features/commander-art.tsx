import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Commander imagery for a deck. Prefers the full card (Scryfall image_uris.normal
 * — frame, art, text box, mana cost), shown as a contained portrait so nothing is
 * cut off and the artist credit printed on the card satisfies attribution. Falls
 * back to the cropped art (art_crop) rendered at its NATIVE ratio — uncropped, so
 * the commander's head isn't lopped off — with the required "Art: {artist}" credit
 * (Scryfall guidelines + the Fan Content Policy, see CREDITS.md). Renders nothing
 * when neither image exists (manual decks whose commander didn't resolve).
 * next/image optimizes + serves from our origin, so it stays within the CSP.
 */
export function CommanderArt({
  cardImage,
  artCrop,
  artist,
  alt,
  className,
  priority = false,
}: {
  cardImage: string | null;
  artCrop: string | null;
  artist: string | null;
  alt: string;
  className?: string;
  /** Set on the above-the-fold image that's likely the LCP, so it preloads. */
  priority?: boolean;
}) {
  if (cardImage) {
    return (
      <div className={cn("flex justify-center", className)}>
        {/* Native Scryfall card ratio (488×680); contained so it never crops. */}
        <div className="relative aspect-[488/680] w-full max-w-[224px] overflow-hidden rounded-xl">
          <Image
            src={cardImage}
            alt={alt}
            fill
            sizes="224px"
            priority={priority}
            className="object-contain"
          />
        </div>
      </div>
    );
  }

  if (artCrop) {
    return (
      <div className={className}>
        {/* art_crop's native ratio (~626×457): the whole crop shows, no head cut off. */}
        <div className="relative aspect-[626/457] w-full overflow-hidden rounded-md">
          <Image
            src={artCrop}
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

  return null;
}
