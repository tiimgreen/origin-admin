"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type NumericFilterOp = ">" | ">=" | "<" | "<=";

export type NumericFilterCondition = {
  op: NumericFilterOp;
  value: string;
};

const OPS: Array<NumericFilterOp> = [">", ">=", "<", "<="];

export const isActiveCondition = (
  condition: NumericFilterCondition | undefined,
): condition is NumericFilterCondition => {
  if (!condition || condition.value.trim() === "") {
    return false;
  }
  return !Number.isNaN(Number(condition.value));
};

type NumericFiltersProps = {
  label: string;
  fields: Array<{ key: string; label: string }>;
  conditions: Record<string, NumericFilterCondition>;
  onChange: (conditions: Record<string, NumericFilterCondition>) => void;
};

// Dropdown of per-field numeric conditions (op + value). A field with an
// empty value is inactive; active conditions are combined with AND by the
// consumer.
export const NumericFilters = ({
  label,
  fields,
  conditions,
  onChange,
}: NumericFiltersProps) => {
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

  const activeCount = fields.filter((field) => {
    return isActiveCondition(conditions[field.key]);
  }).length;

  const setCondition = (key: string, condition: NumericFilterCondition) => {
    onChange({ ...conditions, [key]: condition });
  };

  const clear = () => {
    onChange({});
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
          activeCount > 0 && "border-ring",
        )}
      >
        {label}
        {activeCount > 0 ? (
          <span className="rounded-sm bg-muted px-1 text-xs tabular-nums text-muted-foreground">
            {activeCount}
          </span>
        ) : null}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-80 rounded-md border bg-card p-2 shadow-md">
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={clear}
              className="mb-1 w-full rounded-sm px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Clear all
            </button>
          ) : null}
          <div className="space-y-1.5">
            {fields.map((field) => {
              const condition = conditions[field.key] ?? {
                op: ">" as NumericFilterOp,
                value: "",
              };

              return (
                <div key={field.key} className="flex items-center gap-2">
                  <span className="flex-1 text-sm">{field.label}</span>
                  <select
                    value={condition.op}
                    onChange={(e) => {
                      setCondition(field.key, {
                        op: e.target.value as NumericFilterOp,
                        value: condition.value,
                      });
                    }}
                    className="h-8 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {OPS.map((op) => {
                      return (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      );
                    })}
                  </select>
                  <input
                    type="number"
                    value={condition.value}
                    onChange={(e) => {
                      setCondition(field.key, {
                        op: condition.op,
                        value: e.target.value,
                      });
                    }}
                    placeholder="any"
                    className="h-8 w-24 rounded-md border bg-background px-2 text-sm tabular-nums outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
