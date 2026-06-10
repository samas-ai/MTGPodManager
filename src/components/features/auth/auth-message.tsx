import { cn } from "@/lib/utils";

/** Inline form feedback. `error` styles destructive; `message` is neutral info. */
export function AuthMessage({ error, message }: { error?: string; message?: string }) {
  const text = error ?? message;
  if (!text) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={cn("text-sm", error ? "text-destructive" : "text-muted-foreground")}
    >
      {text}
    </p>
  );
}
