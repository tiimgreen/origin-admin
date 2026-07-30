"use client";

import { useState, useTransition } from "react";

import { setFeatureFlag } from "@/app/shops/[shop]/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FeatureFlagState } from "@/lib/data/shop-profile";

type FeatureFlagsCardProps = {
  shop: string;
  subscriptionId: number | null;
  flags: Array<FeatureFlagState>;
};

export const FeatureFlagsCard = ({
  shop,
  subscriptionId,
  flags,
}: FeatureFlagsCardProps) => {
  const [states, setStates] = useState(flags);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggle = (name: string, active: boolean) => {
    if (!subscriptionId) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await setFeatureFlag({
        shop,
        subscriptionId,
        name,
        active,
      });

      if (!result.success) {
        setError(result.error ?? "Failed to update feature flag");
        return;
      }

      setStates((prev) => {
        return prev.map((flag) => {
          return flag.name === name ? { ...flag, active } : flag;
        });
      });
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          Feature flags
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          {subscriptionId
            ? "Toggles apply to the shop's active subscription immediately."
            : "No active subscription — flags cannot be changed."}
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y">
          {states.map((flag) => {
            return (
              <div
                key={flag.name}
                className="flex items-center justify-between py-2.5"
              >
                <span className="font-mono text-xs">{flag.name}</span>
                <button
                  type="button"
                  disabled={!subscriptionId || isPending}
                  onClick={() => {
                    toggle(flag.name, !flag.active);
                  }}
                  className={cn(
                    "relative h-5 w-9 rounded-full transition-colors disabled:opacity-50",
                    flag.active ? "bg-primary" : "bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform",
                      flag.active ? "translate-x-4" : "translate-x-0.5",
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {error ? (
          <p className="mt-3 text-xs text-destructive">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
};
