# Credits & Legal

MTG Pod Manager is a **non-commercial, for-fun fan project**. It is not affiliated
with, endorsed, or sponsored by Wizards of the Coast or Scryfall.

## Wizards of the Coast — Fan Content Policy
This app is unofficial **Fan Content** permitted under the
[Wizards of the Coast Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy).
Not approved or endorsed by Wizards. Portions of the materials used are property of
Wizards of the Coast. © Wizards of the Coast LLC.

The Fan Content Policy permits this use **because the project is non-commercial**.
If the project is ever monetized, this dependency on WotC intellectual property
(mana symbols, card art, card names) must be re-scoped — see the scope decision in
`MEMORY.md`. The disclaimer above is surfaced in-app via the site-wide footer
(`src/components/features/footer.tsx`).

## Scryfall — card data & imagery
Card identity, data, and images are courtesy of [Scryfall](https://scryfall.com).
Per Scryfall's guidelines:

- **Artist attribution** is shown wherever card art is displayed — card art remains
  © its respective artists. (Scryfall returns `image_uris.art_crop` + `artist`; both
  are stored at import/resolve time and the artist is credited beside the art.)
- We do **not** imply Scryfall or Wizards endorsement.
- API usage stays polite: a descriptive `User-Agent`, batched requests, and results
  cached on our own rows rather than re-fetched per render.

## Open-source dependencies
Next.js, React, Supabase, Tailwind CSS, Zod, `qrcode`, and the rest of the stack —
see `package.json`. Each is used under its own license.
