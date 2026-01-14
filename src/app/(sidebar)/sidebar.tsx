import styles from "./sidebar.module.css";

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <nav className={styles.mainNav}>
        <ul>
          <li>
            <a href="#">Home</a>
          </li>
          <br />
          <li>
            <a href="#">My Library</a>
          </li>
          <br />
          <li>
            <a href="#">Community Library</a>
          </li>
        </ul>
      </nav>
      <section className={styles.projects}>
        <div className={styles.projectsHeader}>
          <h4>Projects</h4>
          <button>+</button>
        </div>
        <ul>
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
            <a href="#">Project 4</a>
          </li>
          <li>
            <a href="#">See All</a>
          </li>
        </ul>
      </section>
      <nav className={styles.mainNav}>
        <ul>
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
