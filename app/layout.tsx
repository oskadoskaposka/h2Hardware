import "./globals.css";
import styles from "../styles/layout.module.css";
import Header from "../components/Header";
import Footer from "../components/Footer";
import AuthSync from "../components/AuthSync";

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
        <main className={styles.main}>{children}</main>
        <Footer />
      </body>
    </html>
  );
}