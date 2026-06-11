/**
 * Site-wide legal footer. Carries the Wizards of the Coast Fan Content Policy
 * disclaimer (required for an unofficial, non-commercial fan app that uses MTG
 * IP) and the Scryfall imagery attribution. Rendered globally from the root
 * layout so the disclaimer is prominent on every screen. Purely informational —
 * external links open in a new tab; CSP does not restrict top-level navigation.
 */
export function Footer() {
  return (
    <footer className="mx-auto max-w-md px-6 pb-24 pt-10 text-center text-xs leading-relaxed text-muted-foreground">
      <p>
        MTG Pod Manager is unofficial Fan Content permitted under the{" "}
        <a
          href="https://company.wizards.com/en/legal/fancontentpolicy"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Wizards of the Coast Fan Content Policy
        </a>
        . Not approved or endorsed by Wizards. Portions of the materials used are property of
        Wizards of the Coast. © Wizards of the Coast LLC. This project is non-commercial and made
        for fun.
      </p>
      <p className="mt-2">
        Card data and images courtesy of{" "}
        <a
          href="https://scryfall.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Scryfall
        </a>
        ; card art remains © its respective artists.
      </p>
    </footer>
  );
}
