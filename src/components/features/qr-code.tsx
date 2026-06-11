import QRCode from "qrcode";

/**
 * Server-rendered QR code as inline SVG (no client JS, CSP-safe). The library's
 * default is black modules on a white background — kept as-is because a QR is a
 * functional barcode, not a themeable surface: scanners need fixed high contrast
 * regardless of light/dark mode, so it always sits on a white quiet-zone box.
 */
export async function QrCode({
  value,
  label,
  size = 200,
}: {
  value: string;
  label: string;
  size?: number;
}) {
  const svg = await QRCode.toString(value, { type: "svg", margin: 1, width: size });

  return (
    <div
      role="img"
      aria-label={label}
      className="inline-block rounded-lg bg-white p-3 shadow-sm"
      // The SVG is generated server-side from a trusted value; no user markup.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
