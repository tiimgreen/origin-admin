"use client";

import { useState, useTransition } from "react";

import { lookupAppName } from "@/app/shops/[shop]/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AppNameLookupCardProps = {
  shop: string;
};

export const AppNameLookupCard = ({ shop }: AppNameLookupCardProps) => {
  const [appId, setAppId] = useState("");
  const [title, setTitle] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const lookup = () => {
    if (!/^\d+$/.test(appId)) {
      setError("Enter a numeric app ID");
      return;
    }

    setError(null);
    setSearched(false);
    startTransition(async () => {
      const result = await lookupAppName({ shop, appId });

      if (!result.success) {
        setError(result.error ?? "Failed to look up app name");
        return;
      }

      setTitle(result.title ?? null);
      setSearched(true);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          App name lookup
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Resolve a Shopify app ID to its name using this shop&apos;s access
          token.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            inputMode="numeric"
            value={appId}
            onChange={(e) => {
              setAppId(e.target.value);
            }}
            placeholder="App ID, e.g. 580111"
            className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={isPending || appId.length === 0}
            className="h-9 shrink-0 rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            {isPending ? "Looking up…" : "Look up"}
          </button>
        </form>

        {error ? (
          <p className="mt-3 text-xs text-destructive">{error}</p>
        ) : null}

        {searched ? (
          title ? (
            <p className="mt-3 text-sm font-medium">{title}</p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              No app found for that ID.
            </p>
          )
        ) : null}
      </CardContent>
    </Card>
  );
};
