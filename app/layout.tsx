import "./globals.css";
import "./catalog-size.css";
import { Suspense } from "react";
import styles from "../styles/layout.module.css";
import Header from "../components/Header";
import Footer from "../components/Footer";
import AuthSync from "../components/AuthSync";
import CatalogNavigationState from "../components/CatalogNavigationState";
import PhoneNumberPatch from "../components/PhoneNumberPatch";
import ActivityTracker from "../components/ActivityTracker";

export const metadata = {
  title: {
    default: "H2 Hardware",
    template: "H2 Hardware | %s",
  },
  description:
    "H2 Hardware supplies door hardware components, accessories and installation parts for professionals and contractors.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={styles.body}>
        <Header />
        <AuthSync />
        <CatalogNavigationState />
        <PhoneNumberPatch />
        <Suspense fallback={null}>
          <ActivityTracker />
        </Suspense>
        <main className={styles.main}>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
