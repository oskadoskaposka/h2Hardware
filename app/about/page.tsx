export const dynamic = "force-static";

export default function AboutPage() {
  const hero: React.CSSProperties = {
    background: "linear-gradient(135deg,#111,#000)",
    color: "#fff",
    padding: "36px 28px",
    borderRadius: 20,
    boxShadow: "0 20px 46px rgba(0,0,0,0.18)",
  };

  const heroTitle: React.CSSProperties = {
    fontSize: 42,
    fontWeight: 900,
    margin: 0,
    letterSpacing: "-0.02em",
  };

  const heroText: React.CSSProperties = {
    marginTop: 12,
    fontSize: 16,
    lineHeight: 1.7,
    maxWidth: 720,
    opacity: 0.9,
  };

  const grid: React.CSSProperties = {
    marginTop: 26,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 22,
  };

  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 22,
    boxShadow: "0 12px 30px rgba(0,0,0,0.08)",
  };

  const title: React.CSSProperties = {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
  };

  const text: React.CSSProperties = {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 1.7,
    color: "#4b5563",
  };

  const list: React.CSSProperties = {
    marginTop: 12,
    paddingLeft: 18,
    color: "#4b5563",
    lineHeight: 1.7,
  };

  return (
    <div className="container" style={{ paddingTop: 30, paddingBottom: 50 }}>
      
      {/* HERO */}
      <section style={hero}>
        <h1 style={heroTitle}>About H2 Hardware</h1>

        <p style={heroText}>
          H2 Hardware is a supplier of door hardware, components and related
          products for residential and commercial installations. Our goal is to
          provide reliable products, practical solutions and a straightforward
          purchasing experience for professionals and businesses.
        </p>

        <p style={heroText}>
          We focus on supplying quality hardware and accessories that help
          installers, contractors and distributors complete their projects with
          confidence.
        </p>
      </section>

      {/* GRID */}
      <section style={grid}>
        <div style={card}>
          <h2 style={title}>What we do</h2>

          <p style={text}>
            H2 Hardware specializes in providing hardware parts and accessories
            used in door systems and related installations. Our catalog includes
            a range of components designed to support professional installation,
            maintenance and repair.
          </p>

          <ul style={list}>
            <li>Door hardware components</li>
            <li>Installation accessories</li>
            <li>Replacement parts</li>
            <li>Hardware solutions for contractors and installers</li>
          </ul>
        </div>

        <div style={card}>
          <h2 style={title}>Who we work with</h2>

          <p style={text}>
            Our products are designed to support professionals working in the
            construction, installation and maintenance industries. We supply
            hardware that helps businesses complete projects efficiently and
            reliably.
          </p>

          <ul style={list}>
            <li>Door installers</li>
            <li>Contractors</li>
            <li>Service technicians</li>
            <li>Resellers and distributors</li>
          </ul>
        </div>

        <div style={card}>
          <h2 style={title}>Our approach</h2>

          <p style={text}>
            At H2 Hardware we believe that access to the right components should
            be simple and efficient. Our goal is to make it easy for customers to
            find the parts they need, compare options and request quotes or
            orders quickly.
          </p>

          <p style={text}>
            We aim to build long-term relationships with our customers by
            providing dependable products and responsive service.
          </p>
        </div>

        <div style={card}>
          <h2 style={title}>Looking for specific hardware?</h2>

          <p style={text}>
            If you are searching for specific door hardware, replacement parts
            or installation accessories, our team is available to help.
          </p>

          <p style={text}>
            Contact us to request information about product availability,
            pricing or larger quantity orders.
          </p>
        </div>
      </section>
    </div>
  );
}