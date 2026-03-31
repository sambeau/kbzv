// src/components/common/StatusBadge.tsx

import { Badge } from "@radix-ui/themes";
import { getStatusColour } from "@/lib/constants/status-colours";
import { useUIStore } from "@/lib/store/ui-store";

// Map the status-colour names used internally to Radix Themes colour names.
// Radix uses "gray" (not "grey") and its own amber/orange scale.
const RT_COLOUR: Record<string, string> = {
  grey: "gray",
  blue: "blue",
  yellow: "yellow",
  orange: "orange",
  green: "green",
  red: "red",
  purple: "purple",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
  /** Optional override: called instead of the default activateFilter action */
  onClick?: () => void;
}

function StatusBadge({ status, className, onClick }: StatusBadgeProps) {
  const activateFilter = useUIStore((s) => s.activateFilter);
  const colour = getStatusColour(status);
  const rtColour = RT_COLOUR[colour] ?? "gray";

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else {
      activateFilter("workflows", "statusColour", colour);
    }
  }

  return (
    <Badge
      color={rtColour as React.ComponentProps<typeof Badge>["color"]}
      variant="soft"
      className={className}
      style={{ cursor: "pointer" }}
      onClick={handleClick}
    >
      {status}
    </Badge>
  );
}

export { StatusBadge };
export type { StatusBadgeProps };
