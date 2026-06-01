// components/Header.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { usePathname } from "next/navigation";
import { auth } from "../lib/firebaseClient";
import { isAdminEmail } from "../lib/admin";
import styles from "../styles/header.module.css";

export default function Header() {
  const pathname = usePathname();
  const [isLogged, setIsLogged] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      const logged = !!u;
      setIsLogged(logged);
      setIsAdmin(isAdminEmail(u?.email));
    });

    return () => unsub();
  }, []);

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch {
      // keep simple
    }
  }

  const isCurrent = (href: string) => (pathname === href ? "page" : undefined);

  return (
    <header className={styles.header}>
      {/* TOP BAR */}
      <div className={styles.topBar}>
        <div className={`${styles.inner} container`}>
          <Link
            href="/"
            className={styles.brand}
            aria-label="H2 Hardware Home"
            style={{ textDecoration: "none" }}
          >
            <img
              src="/h2-logo.svg"
              alt="H2 Hardware"
              className={styles.logo}
            />
          </Link>

          <div className={styles.topLinks}>
            {isAdmin && (
              <>
                <div className={styles.adminMenu}>
                  <Link href="/admin/orders" className={styles.link}>
                    Admin
                  </Link>

                  <div
                    className={styles.adminDropdown}
                    role="menu"
                    aria-label="Admin menu"
                  >
                    <Link
                      href="/admin/orders"
                      className={styles.adminItem}
                      role="menuitem"
                    >
                      All Orders
                    </Link>

                    <Link
                      href="/admin/products"
                      className={styles.adminItem}
                      role="menuitem"
                    >
                      Manage Products
                    </Link>

                    <Link
                      href="/admin/carousel-builder"
                      className={styles.adminItem}
                      role="menuitem"
                    >
                      Carousel Builder
                    </Link>

                    <Link
                      href="/admin/sample-requests"
                      className={styles.adminItem}
                      role="menuitem"
                    >
                      Sample Requests
                    </Link>
                  </div>
                </div>

                <span className={styles.sep}>|</span>
              </>
            )}

            {isLogged ? (
              <Link className={styles.link} href="/login">
                My Profile
              </Link>
            ) : (
              <Link className={styles.link} href="/login">
                Login
              </Link>
            )}

            <span className={styles.sep}>|</span>

            <Link className={styles.link} href="/cart">
              View Cart
            </Link>

            {isLogged ? (
              <>
                <span className={styles.sep}>|</span>
                <button
                  type="button"
                  className={styles.link}
                  onClick={handleLogout}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  Logout
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* NAV BAR */}
      <div className={styles.navBar}>
        <div className={`${styles.inner} container`}>
          <nav className={styles.nav} aria-label="Primary navigation">
            <Link
              href="/"
              className={styles.navItem}
              aria-current={isCurrent("/")}
            >
              CATALOG
            </Link>

            <Link
              href="/about"
              className={styles.navItem}
              aria-current={isCurrent("/about")}
            >
              ABOUT
            </Link>

            <Link
              href="/contact"
              className={styles.navItem}
              aria-current={isCurrent("/contact")}
            >
              CONTACT
            </Link>

            <Link
              href="/orders"
              className={styles.navItem}
              aria-current={isCurrent("/orders")}
            >
              ORDERS
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
