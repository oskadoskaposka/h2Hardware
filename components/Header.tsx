// components/Header.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { usePathname } from "next/navigation";
import { auth } from "../lib/firebaseClient";
import { isAdminUser } from "../lib/admin";
import { clearCart, getCartItemCount, onCartChanged } from "../lib/cart";
import { clearOrderActivitySummary } from "../lib/orderActivity";
import styles from "../styles/header.module.css";

export default function Header() {
  const pathname = usePathname();
  const [isLogged, setIsLogged] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setIsLogged(!!u);
      setIsAdmin(await isAdminUser(u));
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    function refreshCartCount() {
      setCartCount(getCartItemCount());
    }

    refreshCartCount();
    const unsubscribe = onCartChanged(refreshCartCount);

    return () => unsubscribe();
  }, []);

  async function handleLogout() {
    try {
      await signOut(auth);
      clearCart(false);
      clearOrderActivitySummary();
    } catch {
      // keep simple
    }
  }

  const isCurrent = (href: string) => (pathname === href ? "page" : undefined);

  return (
    <header className={styles.header}>
      <div className={styles.topBar}>
        <div className={`${styles.inner} container`}>
          <Link href="/" prefetch={false} className={styles.brand} aria-label="H2 Hardware Home" style={{ textDecoration: "none" }}>
            <img src="/h2-logo.svg" alt="H2 Hardware" className={styles.logo} />
          </Link>

          <div className={styles.topLinks}>
            {isAdmin && (
              <>
                <div className={styles.adminMenu}>
                  <Link href="/admin/orders" prefetch={false} className={styles.link}>Admin</Link>
                  <div className={styles.adminDropdown} role="menu" aria-label="Admin menu">
                    <Link href="/admin/statistics" prefetch={false} className={styles.adminItem} role="menuitem">Business Statistics</Link>
                    <Link href="/admin/orders" prefetch={false} className={styles.adminItem} role="menuitem">All Orders</Link>
                    <Link href="/admin/products" prefetch={false} className={styles.adminItem} role="menuitem">Manage Products</Link>
                    <Link href="/admin/carousel-builder" prefetch={false} className={styles.adminItem} role="menuitem">Carousel Builder</Link>
                    <Link href="/admin/category-highlights" prefetch={false} className={styles.adminItem} role="menuitem">Category Highlights</Link>
                    <Link href="/admin/sample-requests" prefetch={false} className={styles.adminItem} role="menuitem">Sample Requests</Link>
                    <Link href="/admin/registration-requests" prefetch={false} className={styles.adminItem} role="menuitem">Registration Requests</Link>
                    <Link href="/admin/registration-codes" prefetch={false} className={styles.adminItem} role="menuitem">Registration Codes</Link>
                  </div>
                </div>
                <span className={styles.sep}>|</span>
              </>
            )}

            {isLogged ? (
              <Link className={styles.link} href="/login" prefetch={false}>My Profile</Link>
            ) : (
              <Link className={styles.link} href="/login" prefetch={false}>Login</Link>
            )}

            <span className={styles.sep}>|</span>

            <Link className={`${styles.link} ${styles.cartLink}`} href="/cart" prefetch={false}>
              <span>View Cart</span>
              {cartCount > 0 ? (
                <span className={styles.cartBadge} aria-label={`${cartCount} item${cartCount === 1 ? "" : "s"} in cart`}>
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              ) : null}
            </Link>

            {isLogged ? (
              <>
                <span className={styles.sep}>|</span>
                <button type="button" className={styles.link} onClick={handleLogout} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                  Logout
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.navBar}>
        <div className={`${styles.inner} container`}>
          <nav className={styles.nav} aria-label="Primary navigation">
            <Link href="/" prefetch={false} className={styles.navItem} aria-current={isCurrent("/")}>CATALOG</Link>
            <Link href="/about" prefetch={false} className={styles.navItem} aria-current={isCurrent("/about")}>ABOUT</Link>
            <Link href="/contact" prefetch={false} className={styles.navItem} aria-current={isCurrent("/contact")}>CONTACT</Link>
            <Link href="/orders" prefetch={false} className={styles.navItem} aria-current={isCurrent("/orders")}>ORDERS</Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
