"use client";

import { Button } from "@/components/ui/button";
import Image from "next/image";

type PartType =
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

type SortKey = "asc" | "desc";

type PartFiltersProps = {
  activePart: PartType;
  sort: SortKey;
  onPartChange: (part: PartType) => void;
  onSortChange: (sort: SortKey) => void;
};

function PartFilters({
  activePart,
  sort,
  onPartChange,
  onSortChange,
}: PartFiltersProps) {
  const isActive = (part: PartType) => activePart === part;

  return (
    <div className="flex flex-row gap-2 flex-wrap">
      <Button className="flex items-center" onClick={() => onPartChange("all")}>
        All
      </Button>
      <Button
        className="flex items-center"
        type="button"
        onClick={() => onPartChange("body")}
      >
        <Image
          src="/icons/body.png"
          alt="Bodies"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {isActive("body") && "Bodies"}
      </Button>
      <Button
        className="flex items-center"
        type="button"
        onClick={() => onPartChange("neck")}
      >
        <Image
          src="/icons/neck.png"
          alt="Neck"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {isActive("neck") && "Necks"}
      </Button>
      <Button
        className="flex items-center"
        type="button"
        onClick={() => onPartChange("headstock")}
      >
        <Image
          src="/icons/headstock.png"
          alt="Headstock"
          width={64}
          height={64}
          className="invert rotate-245"
        />
        {isActive("headstock") && "Headstocks"}
      </Button>
      <Button
        className="flex items-center"
        type="button"
        onClick={() => onPartChange("bridge")}
      >
        <Image
          src="/icons/bridge.png"
          alt="Bridge"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {isActive("bridge") && "Bridges"}
      </Button>
      <Button
        className="flex items-center"
        type="button"
        onClick={() => onPartChange("tuning_machine")}
      >
        <Image
          src="/icons/tuningmachine.png"
          alt="Tuning Machine"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {isActive("tuning_machine") && "Tuning Machines"}
      </Button>
      <Button
        className="flex items-center"
        type="button"
        onClick={() => onPartChange("pickup")}
      >
        <Image
          src="/icons/pickup.png"
          alt="Pickups"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {isActive("pickup") && "Pickup"}
      </Button>
      <Button
        className="flex items-center"
        type="button"
        onClick={() => onPartChange("pickguard")}
      >
        <Image
          src="/icons/pickguard.png"
          alt="Pickguard"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {isActive("pickguard") && "Pickguards"}
      </Button>
      <Button
        className="flex items-center"
        type="button"
        onClick={() => onPartChange("knob")}
      >
        <Image
          src="/icons/knob.png"
          alt="Knob"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {isActive("knob") && "Knobs"}
      </Button>
      <Button
        className="flex items-center"
        type="button"
        onClick={() => onPartChange("switch")}
      >
        <Image
          src="/icons/switch.png"
          alt="Switch"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {isActive("switch") && "Switches"}
      </Button>
      <Button
        className="flex items-center"
        type="button"
        onClick={() => onPartChange("strap_button")}
      >
        <Image
          src="/icons/strapbutton.png"
          alt="Strap Button"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {isActive("strap_button") && "Strap Buttons"}
      </Button>
      <Button
        className="flex items-center"
        type="button"
        onClick={() => onPartChange("output_jack")}
      >
        <Image
          src="/icons/outputjack.png"
          alt="Output Jack"
          width={64}
          height={64}
          className="invert rotate-270"
        />
        {isActive("output_jack") && "Output Jacks"}
      </Button>
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
