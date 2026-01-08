import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Senior Project Test2</h1>
        <p>
          Edit <code>src/app/page.tsx</code> and{" "}
          <code>src/app/globals.css</code> to make it yours.
        </p>
        <div className={styles.ctas}>
          <a
            className={styles.primary}
            href="https://nextjs.org/docs"
            target="_blank"
            rel="noreferrer"
          >
            <Image
              className={styles.logo}
              src="/next.svg"
              alt="Next.js logo"
              width={20}
              height={20}
            />
            Next.js docs
          </a>
          <a
            className={styles.secondary}
            href="https://vercel.com/templates"
            target="_blank"
            rel="noreferrer"
          >
            Project templates
          </a>
        </div>
      </main>
      <footer className={styles.footer}>
        <a href="https://nextjs.org" target="_blank" rel="noreferrer">
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org
        </a>
      </footer>
    </div>
  );
}
