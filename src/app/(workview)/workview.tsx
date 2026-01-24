export default function WorkView({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col m-h-0 bg-(--background2) rounded-lg m-2 p-4">
      <header className="flex h-16 justify-between items-center">
        <div className="text-xl font-bold">Workview</div>
        <input
          className="flex flex-1 min-w-xs max-w-3xl rounded-2xl p-2 m-2 bg-(--background)"
          type="text"
          placeholder=" Search"
        />
        <div className="flex gap-6">
          <button id="newProjBtn">+ New Project</button>
          <button id="accountBtn">■ Account</button>
        </div>
      </header>
      <hr />
      <section>{children}</section>
    </main>
  );
}
