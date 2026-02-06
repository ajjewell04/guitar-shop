import Link from "next/link";
import { Button } from "@/components/ui/button";

type SidebarProps = {
  onNewProject?: () => void;
};

export default function Sidebar({ onNewProject }: SidebarProps) {
  return (
    <aside className="flex h-screen justify-between flex-col bg-foreground px-8 py-6">
      <nav>
        <ul className="flex flex-col items-center gap-6">
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>
            <Link href="#">My Library</Link>
          </li>
          <li>
            <Link href="#">Community Library</Link>
          </li>
        </ul>
      </nav>
      <section>
        <div className="flex justify-between items-center mb-4">
          <h4>Projects</h4>
          <Button
            id="newProjBtn"
            className="cursor-pointer text-xl rounded-lg p-2"
            onClick={onNewProject}
          >
            +
          </Button>
        </div>
        <ul className="flex flex-col items-center gap-4 overflow-y-auto">
          <li>
            <a href="#">Project 1</a>
          </li>
          <li>
            <a href="#">Project 2</a>
          </li>
          <li>
            <a href="#">Project 3</a>
          </li>
          <li>
            <a href="#">See All</a>
          </li>
        </ul>
      </section>
      <nav>
        <ul className="flex flex-col items-center gap-6">
          <li>
            <a href="#">Help</a>
          </li>
          <li>
            <a href="#">Settings</a>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
