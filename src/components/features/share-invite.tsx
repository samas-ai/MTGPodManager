"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Share an invite via the native share sheet (navigator.share) on supporting
 * devices — phones at the table — falling back to copy-to-clipboard elsewhere.
 * Progressive enhancement: the code + QR are always shown alongside this.
 */
export function ShareInvite({ url, code }: { url: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const data: ShareData = {
      title: "Join my MTG pod",
      text: `Join my Commander pod (invite code ${code}).`,
      url,
    };

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        // User dismissed the sheet — nothing to do.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the visible code is the fallback.
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={onShare}>
      {copied ? "Link copied!" : "Share invite"}
    </Button>
  );
}
