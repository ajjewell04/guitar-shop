import styles from "./workview.module.css";

export default function WorkView({ children }: { children: React.ReactNode }) {
  return (
    <main className={styles.workview}>
      <header className={styles.taskBar}>
        <div className={styles.taskTitle}>Work View</div>
        <input className={styles.searchBar} type="text" placeholder="Search" />
        <div className={styles.taskActions}>
          <button id="newProjBtn">+ New Project</button>
          <button id="accountBtn">■ Account</button>
        </div>
      </header>
      <hr />
      <section className={styles.contentView}>{children}</section>
    </main>
  );
}
