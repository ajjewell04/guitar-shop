export default function Sidebar() {
  return (
    <aside className="flex h-screen justify-between flex-col px-8 py-6">
      <nav>
        <ul className="flex flex-col items-center gap-6">
          <li>
            <a href="#">Home</a>
          </li>
          <li>
            <a href="#">My Library</a>
          </li>
          <li>
            <a href="#">Community Library</a>
          </li>
        </ul>
      </nav>
      <section>
        <div className="flex justify-between items-center mb-4">
          <h4>Projects</h4>
          <button className="cursor-pointer text-xl rounded-lg p-2">+</button>
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
