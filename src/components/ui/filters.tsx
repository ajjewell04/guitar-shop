import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useState } from "react";

function PartFilters() {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeSort, setActiveSort] = useState<"asc" | "desc">("asc");

  return (
    <div className="flex flex-row gap-3 flex-wrap">
      <Button
        className="flex items-center"
        onClick={() => setActiveFilter(null)}
      >
        All
      </Button>
      <Button
        className="flex items-center"
        onClick={() => setActiveFilter("Bodies")}
      >
        <Image
          src="/icons/body.png"
          alt="Bodies"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {activeFilter === "Bodies" && "Bodies"}
      </Button>
      <Button
        className="flex items-center"
        onClick={() => setActiveFilter("Necks")}
      >
        <Image
          src="/icons/neck.png"
          alt="Neck"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {activeFilter === "Necks" && "Necks"}
      </Button>
      <Button
        className="flex items-center"
        onClick={() => setActiveFilter("Headstocks")}
      >
        <Image
          src="/icons/headstock.png"
          alt="Headstock"
          width={64}
          height={64}
          className="invert rotate-245"
        />
        {activeFilter === "Headstocks" && "Headstocks"}
      </Button>
      <Button
        className="flex items-center"
        onClick={() => setActiveFilter("Bridges")}
      >
        <Image
          src="/icons/bridge.png"
          alt="Bridge"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {activeFilter === "Bridges" && "Bridges"}
      </Button>
      <Button
        className="flex items-center"
        onClick={() => setActiveFilter("Tuning Machines")}
      >
        <Image
          src="/icons/tuningmachine.png"
          alt="Tuning Machine"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {activeFilter === "Tuning Machines" && "Tuning Machines"}
      </Button>
      <Button
        className="flex items-center"
        onClick={() => setActiveFilter("Pickguards")}
      >
        <Image
          src="/icons/pickup.png"
          alt="Pickups"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {activeFilter === "Pickups" && "Pickups"}
      </Button>
      <Button
        className="flex items-center"
        onClick={() => setActiveFilter("Pickguards")}
      >
        <Image
          src="/icons/pickguard.png"
          alt="Pickguard"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {activeFilter === "Pickguards" && "Pickguards"}
      </Button>
      <Button
        className="flex items-center"
        onClick={() => setActiveFilter("Knobs")}
      >
        <Image
          src="/icons/knob.png"
          alt="Knob"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {activeFilter === "Knobs" && "Knobs"}
      </Button>
      <Button className="flex items-center">
        <Image
          src="/icons/switch.png"
          alt="Switch"
          width={64}
          height={64}
          className="invert rotate-315"
          onClick={() => setActiveFilter("Switches")}
        />
        {activeFilter === "Switches" && "Switches"}
      </Button>
      <Button
        className="flex items-center"
        onClick={() => setActiveFilter("Strap Buttons")}
      >
        <Image
          src="/icons/strapbutton.png"
          alt="Strap Button"
          width={64}
          height={64}
          className="invert rotate-315"
        />
        {activeFilter === "Strap Buttons" && "Strap Buttons"}
      </Button>
      <Button
        className="flex items-center"
        onClick={() => setActiveFilter("Output Jacks")}
      >
        <Image
          src="/icons/outputjack.png"
          alt="Output Jack"
          width={64}
          height={64}
          className="invert rotate-270"
        />
        {activeFilter === "Output Jacks" && "Output Jacks"}
      </Button>
      <Button className="flex items-center">
        <Image
          src="/icons/filter.png"
          alt="Filter"
          width={24}
          height={24}
          className="invert"
        />
      </Button>
      <Button
        className="flex items-center"
        onClick={() =>
          setActiveSort((prev) => (prev === "asc" ? "desc" : "asc"))
        }
      >
        <Image
          src={
            activeSort === "asc"
              ? "/icons/ascending.png"
              : "/icons/descending.png"
          }
          alt={activeSort === "asc" ? "Ascending" : "Descending"}
          width={32}
          height={32}
          className="invert"
        />
      </Button>
    </div>
  );
}

export { PartFilters };
