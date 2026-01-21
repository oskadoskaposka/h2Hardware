 "use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Home page built to match the look and feel of the StarPro Doors marketing site.
 * This version replaces the previous catalog‑style home page with a marketing
 * landing page that introduces the company, highlights key benefits of high
 * quality garage doors, and presents the main service categories offered.
 */
export default function HomePage() {
  // Simple form state; no actual submission logic is implemented.
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // In a real implementation you would send this data to your backend.
    // For now we simply clear the form and optionally show a toast or alert.
    setForm({
      name: "",
      email: "",
      phone: "",
      message: "",
    });
    alert("Thank you! We will get back to you shortly.");
  }

  return (
    <main className="home">
      {/* Features Section */}
      <section className="features">
        <h2 className="sectionTitle">
          Why Do You Need A High‑Quality Garage Door?
        </h2>
        <div className="featuresGrid">
          <div className="featureItem">
            <h3>Security</h3>
            <p>
              A high‑quality garage door provides better security for your home
              and belongings. It protects your vehicles and other valuables
              stored in the garage from theft or damage.
            </p>
          </div>
          <div className="featureItem">
            <h3>Safety</h3>
            <p>
              A well‑designed garage door operates safely, reducing the risk of
              injury to you or your family. Built‑in sensors detect
              obstructions and prevent accidents.
            </p>
          </div>
          <div className="featureItem">
            <h3>Durability</h3>
            <p>
              Quality construction lasts longer and requires fewer repairs over
              time. It withstands the elements and heavy use, saving money in
              the long run.
            </p>
          </div>
          <div className="featureItem">
            <h3>Energy Efficiency</h3>
            <p>
              A well‑insulated door helps regulate garage temperature and
              prevent energy loss. This reduces heating and cooling costs.
            </p>
          </div>
        </div>
      </section>

      {/* Trusted Section */}
      <section className="trusted">
        <h2 className="sectionTitle">
          Trusted for Garage Doors in Alberta, British Columbia &amp;
          Saskatchewan
        </h2>
        <p className="trustedText">
          We design and manufacture garage doors specially suited for the cold
          winters and warm summers of Western Canada. Whether you are a home
          owner looking to upgrade or a builder seeking a reliable supplier,
          you can count on StarPro to meet your needs.
        </p>
      </section>

      {/* Categories Section */}
      <section className="categories">
        <h2 className="sectionTitle">Our Garage Doors</h2>
        <p className="categoriesSubtitle">
          We make a great door, and you get a better product at a better price.
        </p>
        <div className="categoriesGrid">
          <div className="categoryCard">
            <div className="categoryOverlay">
              <h3>Residential</h3>
              <p>
                Dependable and attractive doors for homes. Many homeowners use
                their garage doors several times per day—choose one that’s made
                to last.
              </p>
              <Link href="https://www.starprodoors.ca/">
                <button type="button">View More</button>
              </Link>
            </div>
          </div>
          <div className="categoryCard">
            <div className="categoryOverlay">
              <h3>Commercial</h3>
              <p>
                Our commercial doors provide security and curb appeal for your
                business. A dependable door allows safe and convenient entry.
              </p>
              <Link href="https://www.starprodoors.ca/">
                <button type="button">View More</button>
              </Link>
            </div>
          </div>
          <div className="categoryCard">
            <div className="categoryOverlay">
              <h3>Maintenance &amp; Support</h3>
              <p>
                We service all makes and models. Most repairs are quick and
                relatively inexpensive when caught in time.
              </p>
              <Link href="https://www.starprodoors.ca/">
                <button type="button">Call Us</button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .home {
          background: #f5f6f8;
          padding-top: 0;
          color: #111827;
          font-family: inherit;
        }

        /* Hero */
        .hero {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          max-width: 1200px;
          margin: 0 auto;
          padding: 60px 20px;
          align-items: stretch;
        }
        @media (max-width: 900px) {
          .hero {
            grid-template-columns: 1fr;
          }
        }
        .heroContent {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .heroTitle {
          font-size: 48px;
          font-weight: 900;
          margin: 0 0 12px;
          letter-spacing: -0.01em;
        }
        .heroSubtitle {
          font-size: 20px;
          color: #6b7280;
          margin: 0 0 24px;
        }
        .quoteForm {
          background: #b91c1c;
          color: #fff;
          border-radius: 12px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .quoteForm .formTitle {
          margin: 0 0 6px;
          font-size: 18px;
          font-weight: 700;
        }
        .quoteForm input,
        .quoteForm textarea {
          border: none;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 14px;
          width: 100%;
          color: #111827;
        }
        .quoteForm textarea {
          resize: vertical;
        }
        .quoteForm button {
          background: #111827;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        .quoteForm button:hover {
          background: #15171a;
        }

        /* Section titles */
        .sectionTitle {
          font-size: 32px;
          font-weight: 900;
          color: #111827;
          margin: 0 0 24px;
          text-align: center;
          letter-spacing: -0.01em;
        }

        /* Features */
        .features {
          background: #ffffff;
          padding: 60px 20px;
        }
        .featuresGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }
        @media (max-width: 960px) {
          .featuresGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 600px) {
          .featuresGrid {
            grid-template-columns: 1fr;
          }
        }
        .featureItem {
          background: #f5f6f8;
          border-radius: 12px;
          padding: 20px;
          text-align: center;
        }
        .featureItem h3 {
          color: #b91c1c;
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 10px;
        }
        .featureItem p {
          color: #6b7280;
          font-size: 14px;
          line-height: 1.5;
          margin: 0;
        }

        /* Trusted */
        .trusted {
          background: #f5f6f8;
          padding: 60px 20px;
        }
        .trustedText {
          max-width: 800px;
          margin: 0 auto;
          font-size: 16px;
          line-height: 1.6;
          color: #6b7280;
          text-align: center;
        }

        /* Categories */
        .categories {
          background: #ffffff;
          padding: 60px 20px;
        }
        .categoriesSubtitle {
          text-align: center;
          font-size: 16px;
          color: #6b7280;
          margin: -12px 0 32px;
        }
        .categoriesGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }
        @media (max-width: 960px) {
          .categoriesGrid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 600px) {
          .categoriesGrid {
            grid-template-columns: 1fr;
          }
        }
        .categoryCard {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          min-height: 280px;
          background: #cbd5e1; /* light placeholder color until images are added */
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .categoryOverlay {
          background: rgba(185, 28, 28, 0.7);
          color: #fff;
          padding: 20px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          height: 100%;
        }
        .categoryOverlay h3 {
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 8px;
        }
        .categoryOverlay p {
          font-size: 14px;
          line-height: 1.5;
          margin: 0 0 16px;
          color: #f3f4f6;
        }
        .categoryOverlay button {
          align-self: flex-start;
          background: #ffffff;
          color: #b91c1c;
          border: none;
          border-radius: 6px;
          padding: 8px 14px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
        }
        .categoryOverlay button:hover {
          background: #f5f6f8;
        }
      `}</style>
    </main>
  );
}