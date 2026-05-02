import * as React from "react";

import { cn } from "@/lib/utils";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = ({ className, ...props }: DivProps) => {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    />
  );
};

export const CardHeader = ({ className, ...props }: DivProps) => {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  );
};

export const CardTitle = ({ className, ...props }: DivProps) => {
  return (
    <div
      className={cn(
        "text-sm font-medium tracking-tight text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
};

export const CardDescription = ({ className, ...props }: DivProps) => {
  return (
    <div
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
};

export const CardContent = ({ className, ...props }: DivProps) => {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
};

export const CardFooter = ({ className, ...props }: DivProps) => {
  return (
    <div
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  );
};
