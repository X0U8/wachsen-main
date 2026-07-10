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
          <path d="M6 2h12v2c0 3-2 6-6 8-4-2-6-5-6-8V2z" />
          <path d="M12 12c-3 1-5 3-5 6v2h10v-2c0-3-2-5-5-6z" />
          <path d="M8 2H5a2 2 0 0 0-2 2v1c0 2 1.5 4 5 5V2z" />
          <path d="M16 2h3a2 2 0 0 1 2 2v1c0 2-1.5 4-5 5V2z" />
          <path d="M12 19v3" strokeWidth="2" stroke="currentColor" fill="none" />
        </svg>
      </div>
    );
  }
);

TrophyIcon.displayName = "TrophyIcon";

export { TrophyIcon };
