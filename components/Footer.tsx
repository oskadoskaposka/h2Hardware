import Link from "next/link";
import styles from "../styles/footer.module.css";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.columns}>
        <div className={styles.column}>
          <h4 className={styles.title}>Customer Service</h4>
          <Link href="/contact" prefetch={false} className={styles.link}>
            Contact Us
          </Link>
          <Link href="/catalog" prefetch={false} className={styles.link}>
            Catalog
          </Link>
        </div>

        <div className={styles.column}>
          <h4 className={styles.title}>About H2 Hardware</h4>
          <Link href="/about" prefetch={false} className={styles.link}>
            About Us
          </Link>
          <Link href="/" prefetch={false} className={styles.link}>
            Home
          </Link>
        </div>

        <div className={styles.column}>
          <h4 className={styles.title}>Follow</h4>
          <a
            href="https://www.facebook.com"
            className={styles.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            Facebook
          </a>
          <a
            href="https://www.youtube.com"
            className={styles.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            YouTube
          </a>
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.bottomContent}>
          <div className={styles.bottomLeft}>© {year} H2 Hardware</div>
          <div className={styles.bottomRight}>
            We accept major credit cards
          </div>
        </div>
      </div>
    </footer>
  );
}
