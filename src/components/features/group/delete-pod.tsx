"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteGroup } from "@/lib/services/groups";

/**
 * Type-to-confirm guard for the irreversible pod delete. The Delete button only
 * arms once the typed text matches the pod name exactly. The delete_group RPC
 * re-checks admin authorization server-side regardless of this UI.
 */
export function DeletePod({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [confirmText, setConfirmText] = useState("");
  const armed = confirmText.trim() === groupName;

  return (
    <form action={deleteGroup} className="flex flex-col gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <label htmlFor="confirmDelete" className="text-sm text-muted-foreground">
        Deleting <span className="font-medium text-foreground">{groupName}</span> permanently
        removes its matches, standings, members, and invites — this can&apos;t be undone. Type the
        pod name to confirm.
      </label>
      <Input
        id="confirmDelete"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        autoComplete="off"
        placeholder={groupName}
        aria-label="Type the pod name to confirm deletion"
      />
      <Button type="submit" variant="destructive" disabled={!armed} className="self-start">
        Delete pod
      </Button>
    </form>
  );
}
