import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthMessage } from "@/components/features/auth/auth-message";
import { Badge } from "@/components/ui/badge";
import { ColorPips } from "@/components/features/color-pips";
import { CommanderArt } from "@/components/features/commander-art";
import { PageHeader } from "@/components/ui/page-header";
import { createDeck, deleteDeck, importDeck } from "@/lib/services/decks";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My decks" };

export default async function DecksPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  // decks_all_own RLS scopes this to the signed-in user's decks.
  const { data: decks, error } = await supabase
    .from("decks")
    .select("id, name, commander_name, color_identity, source, art_crop_url, artist")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6 pb-24">
      <PageHeader title="My decks" back={{ href: "/profile", label: "Profile" }} />

      <AuthMessage error={searchParams.error} />

      <section className="flex flex-col gap-2">
        {decks && decks.length > 0 ? (
          decks.map((d) => (
            <div
              key={d.id}
              className="flex flex-col gap-3 rounded-md border border-border bg-card p-4"
            >
              <CommanderArt src={d.art_crop_url} artist={d.artist} alt={`${d.commander_name} art`} />
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{d.name}</p>
                    {d.source === "archidekt" ? <Badge>imported</Badge> : null}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <ColorPips identity={d.color_identity} />
                    <p className="truncate text-sm text-muted-foreground">{d.commander_name}</p>
                  </div>
                </div>
                <form action={deleteDeck}>
                  <input type="hidden" name="deckId" value={d.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Remove
                  </Button>
                </form>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No decks yet. Add one below — you&apos;ll pick it when logging a match.
          </p>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Import from Archidekt</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={importDeck} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="url">Archidekt deck URL</Label>
              <Input
                id="url"
                name="url"
                required
                inputMode="url"
                placeholder="https://archidekt.com/decks/123456/my-deck"
              />
            </div>
            <Button type="submit">Import deck</Button>
            <p className="text-xs text-muted-foreground">
              Best-effort import. If it fails, just add the deck manually below.
            </p>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add a deck manually</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createDeck} className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Deck name</Label>
              <Input id="name" name="name" required maxLength={80} placeholder="Atraxa Superfriends" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="commanderName">Commander</Label>
              <Input
                id="commanderName"
                name="commanderName"
                required
                maxLength={100}
                placeholder="Atraxa, Praetors' Voice"
              />
            </div>
            <Button type="submit">Add deck</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
