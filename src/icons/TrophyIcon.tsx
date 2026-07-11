import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cn } from "../lib/utils";

interface TrophyIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

const TrophyIcon = forwardRef<HTMLDivElement, TrophyIconProps>(
  ({ className, size = 28, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(className)}
        {...props}
      >
        <svg
          fill="currentColor"
          height={size}
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M8 2h8v7c0 2.2-1.8 4-4 4s-4-1.8-4-4V2z" />
          <path d="M8 3H5a1 1 0 0 0-1 1v2c0 2.5 2 4.5 4.5 5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M16 3h3a1 1 0 0 1 1 1v2c0 2.5-2 4.5-4.5 5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M11 13h2v3h-2z" />
          <path d="M7 20h10v2H7z" />
          <path d="M9 20c0-2 1-3.5 3-3.5s3 1.5 3 3.5z" />
        </svg>
      </div>
    );
  }
);

TrophyIcon.displayName = "TrophyIcon";

export { TrophyIcon };
