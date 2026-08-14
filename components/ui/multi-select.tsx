"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type MultiSelectProps = {
  label: string;
  options: Array<string>;
  selected: Array<string>;
  onChange: (selected: Array<string>) => void;
};

// Checkbox dropdown filter. An empty selection means "no filter applied".
export const MultiSelect = ({
  label,
  options,
  selected,
  onChange,
}: MultiSelectProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  const toggle = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((value) => value !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected.length > 0 && "border-ring",
        )}
      >
        {label}
        {selected.length > 0 ? (
          <span className="rounded-sm bg-muted px-1 text-xs tabular-nums text-muted-foreground">
            {selected.length}
          </span>
        ) : null}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 min-w-48 overflow-auto rounded-md border bg-card p-1 shadow-md">
          {selected.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                onChange([]);
              }}
              className="w-full rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Clear selection
            </button>
          ) : null}
          {options.map((option) => {
            return (
              <label
                key={option}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => {
                    toggle(option);
                  }}
                  className="h-3.5 w-3.5 accent-primary"
                />
                {option}
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
