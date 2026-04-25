"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";

export type PartType =
  | "all"
  | "body"
  | "neck"
  | "headstock"
  | "bridge"
  | "tuning_machine"
  | "pickup"
  | "pickguard"
  | "knob"
  | "switch"
  | "strap_button"
  | "output_jack"
  | "miscellaneous";

export type SortKey = "asc" | "desc";

type PartFiltersProps = {
  activePart: PartType;
  sort: SortKey;
  onPartChange: (part: PartType) => void;
  onSortChange: (sort: SortKey) => void;
};

type PartButton = {
  part: PartType;
  label: string;
  icon: string;
  alt: string;
  rotation: string;
};

const PART_BUTTONS: PartButton[] = [
  {
    part: "body",
    label: "Bodies",
    icon: "/icons/body.png",
    alt: "Bodies",
    rotation: "rotate-315",
  },
  {
    part: "neck",
    label: "Necks",
    icon: "/icons/neck.png",
    alt: "Neck",
    rotation: "rotate-315",
  },
  {
    part: "headstock",
    label: "Headstocks",
    icon: "/icons/headstock.png",
    alt: "Headstock",
    rotation: "rotate-245",
  },
  {
    part: "bridge",
    label: "Bridges",
    icon: "/icons/bridge.png",
    alt: "Bridge",
    rotation: "rotate-315",
  },
  {
    part: "tuning_machine",
    label: "Tuning Machines",
    icon: "/icons/tuningmachine.png",
    alt: "Tuning Machine",
    rotation: "rotate-315",
  },
  {
    part: "pickup",
    label: "Pickup",
    icon: "/icons/pickup.png",
    alt: "Pickups",
    rotation: "rotate-315",
  },
  {
    part: "pickguard",
    label: "Pickguards",
    icon: "/icons/pickguard.png",
    alt: "Pickguard",
    rotation: "rotate-315",
  },
  {
    part: "knob",
    label: "Knobs",
    icon: "/icons/knob.png",
    alt: "Knob",
    rotation: "rotate-315",
  },
  {
    part: "switch",
    label: "Switches",
    icon: "/icons/switch.png",
    alt: "Switch",
    rotation: "rotate-315",
  },
  {
    part: "strap_button",
    label: "Strap Buttons",
    icon: "/icons/strapbutton.png",
    alt: "Strap Button",
    rotation: "rotate-315",
  },
  {
    part: "output_jack",
    label: "Output Jacks",
    icon: "/icons/outputjack.png",
    alt: "Output Jack",
    rotation: "rotate-270",
  },
];

function PartFilters({
  activePart,
  sort,
  onPartChange,
  onSortChange,
}: PartFiltersProps) {
  return (
    <div className="flex flex-row gap-2 flex-wrap">
      <Button className="flex items-center" onClick={() => onPartChange("all")}>
        All
      </Button>

      {PART_BUTTONS.map(({ part, label, icon, alt, rotation }) => (
        <Button
          key={part}
          className="flex items-center"
          type="button"
          onClick={() => onPartChange(part)}
        >
          <Image
            src={icon}
            alt={alt}
            width={64}
            height={64}
            className={`invert ${rotation}`}
          />
          {activePart === part && label}
        </Button>
      ))}

      <Button
        className="flex items-center"
        type="button"
        onClick={() => onSortChange(sort === "asc" ? "desc" : "asc")}
      >
        <Image
          src={
            sort === "asc" ? "/icons/descending.png" : "/icons/ascending.png"
          }
          alt={sort === "asc" ? "Ascending" : "Descending"}
          width={32}
          height={32}
          className="invert"
        />
      </Button>
    </div>
  );
}

export { PartFilters };
