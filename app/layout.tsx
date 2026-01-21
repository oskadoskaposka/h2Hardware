import "./globals.css";
import styles from "../styles/layout.module.css";
import Header from "../components/Header";
import Footer from "../components/Footer";
import AuthSync from "../components/AuthSync";

export const metadata = {
  title: "StarPro",
  description: "Gate catalog and custom solutions",
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
        <main className={styles.main}>{children}</main>
        <Footer />
      </body>
    </html>
  );
}