"use client";

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

type RangeSelectProps = {
  value: string;
  options: Record<string, { label: string }>;
  basePath: string;
};

export const RangeSelect = ({ value, options, basePath }: RangeSelectProps) => {
  const router = useRouter();

  return (
    <label className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(event) => {
          router.push(`${basePath}?range=${event.target.value}`);
        }}
        className="h-9 appearance-none rounded-md border bg-background pl-3 pr-8 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {Object.entries(options).map(([key, spec]) => {
          return (
            <option key={key} value={key}>
              {spec.label}
            </option>
          );
        })}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted-foreground" />
    </label>
  );
};
