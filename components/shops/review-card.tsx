import { ExternalLink, Star } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import {
  APP_STORE_REVIEW_URL,
  APP_STORE_URL,
  type AppReview,
} from "@/lib/data/app-reviews";
import { formatDayLabel } from "@/lib/data/dates";
import { cn } from "@/lib/utils";

type StarRatingProps = {
  rating: number;
};

const StarRating = ({ rating }: StarRatingProps) => {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        return (
          <Star
            key={star}
            className={cn(
              "h-3.5 w-3.5",
              star <= rating
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40",
            )}
          />
        );
      })}
    </span>
  );
};

type ReviewCardProps = {
  review: AppReview | null;
};

export const ReviewCard = ({ review }: ReviewCardProps) => {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold text-foreground">
            App Store review
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {review
              ? `Left ${formatDayLabel(review.date.slice(0, 10))}`
              : "Matched by store name against the Origin listing"}
          </p>
        </div>
        {review ? (
          <a
            href={`${APP_STORE_URL}/reviews/${review.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            View
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        {review ? (
          <div className="space-y-2">
            <StarRating rating={review.rating} />
            <p className="whitespace-pre-line text-sm text-foreground">
              {review.body}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              This shop hasn&apos;t left a review yet.
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span className="font-mono text-muted-foreground">
                {APP_STORE_REVIEW_URL}
              </span>
              <CopyButton value={APP_STORE_REVIEW_URL} />
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
