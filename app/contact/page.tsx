// app/contact/page.tsx
export const dynamic = "force-static";

export default function ContactPage() {
  const pageWrap: React.CSSProperties = {
    paddingTop: 32,
    paddingBottom: 56,
  };

  const heroStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, #111111 0%, #000000 100%)",
    color: "#fff",
    borderRadius: 20,
    padding: "28px 24px",
    boxShadow: "0 18px 44px rgba(0, 0, 0, 0.18)",
    border: "1px solid rgba(255,255,255,0.06)",
  };

  const eyebrowStyle: React.CSSProperties = {
    display: "inline-block",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#f87171",
    marginBottom: 10,
  };

  const heroTitle: React.CSSProperties = {
    margin: 0,
    fontSize: 40,
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  };

  const heroText: React.CSSProperties = {
    marginTop: 12,
    marginBottom: 0,
    maxWidth: 700,
    color: "rgba(255,255,255,0.82)",
    fontSize: 16,
    lineHeight: 1.6,
  };

  const actionsWrap: React.CSSProperties = {
    marginTop: 20,
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  };

  const primaryBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "0 18px",
    borderRadius: 12,
    background: "#b91c1c",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 14,
    border: "1px solid #b91c1c",
  };

  const secondaryBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    padding: "0 18px",
    borderRadius: 12,
    background: "transparent",
    color: "#fff",
    textDecoration: "none",
    fontWeight: 900,
    fontSize: 14,
    border: "1px solid rgba(255,255,255,0.18)",
  };

  const sectionGrid: React.CSSProperties = {
    marginTop: 24,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
    gap: 18,
  };

  const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 20,
    boxShadow: "0 14px 34px rgba(0, 0, 0, 0.08)",
  };

  const sectionTitle: React.CSSProperties = {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
    color: "#111827",
    letterSpacing: "-0.02em",
  };

  const sectionText: React.CSSProperties = {
    marginTop: 10,
    marginBottom: 0,
    color: "#4b5563",
    fontSize: 15,
    lineHeight: 1.7,
  };

  const infoGrid: React.CSSProperties = {
    marginTop: 18,
    display: "grid",
    gap: 14,
  };

  const infoBlock: React.CSSProperties = {
    padding: 14,
    borderRadius: 14,
    background: "#f9fafb",
    border: "1px solid #eef2f7",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#6b7280",
    marginBottom: 6,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 900,
    color: "#111827",
    lineHeight: 1.35,
  };

  const valueLinkStyle: React.CSSProperties = {
    color: "#111827",
    textDecoration: "none",
  };

  const sideTitle: React.CSSProperties = {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#111827",
  };

  const noteStyle: React.CSSProperties = {
    marginTop: 12,
    color: "#6b7280",
    fontSize: 14,
    lineHeight: 1.6,
  };

  const miniCard: React.CSSProperties = {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    background: "#111111",
    color: "#fff",
  };

  const miniCardTitle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#fca5a5",
    marginBottom: 6,
  };

  return (
    <div className="container" style={pageWrap}>
      <section style={heroStyle}>
        <div style={eyebrowStyle}>H2 Hardware</div>

        <h1 style={heroTitle}>Contact our team</h1>

        <p style={heroText}>
          Need product information, pricing, or help with your order? Reach out
          to H2 Hardware directly using the contact details below.
        </p>

        <div style={actionsWrap}>
          <a href="tel:+12267881924" style={primaryBtn}>
            Call +1 (226) 788-1924
          </a>

          <a href="mailto:info@h2hardwareltd.com" style={secondaryBtn}>
            Email info@h2hardwareltd.com
          </a>
        </div>
      </section>

      <section style={sectionGrid}>
        <div style={cardStyle}>
          <h2 style={sectionTitle}>Get in touch</h2>
          <p style={sectionText}>
            We currently list our main direct contact details here so you can
            quickly reach the team for sales or general inquiries.
          </p>

          <div style={infoGrid}>
            <div style={infoBlock}>
              <div style={labelStyle}>Phone</div>
              <div style={valueStyle}>
                <a href="tel:+12267881924" style={valueLinkStyle}>
                  +1 (226) 788-1924
                </a>
              </div>
            </div>

            <div style={infoBlock}>
              <div style={labelStyle}>Email</div>
              <div style={valueStyle}>
                <a
                  href="mailto:info@h2hardwareltd.com"
                  style={valueLinkStyle}
                >
                  info@h2hardwareltd.com
                </a>
              </div>
            </div>
          </div>
        </div>

        <div style={cardStyle}>
          <h2 style={sideTitle}>Before you contact us</h2>

          <p style={noteStyle}>
            To help the team answer faster, include your name, the product or
            model you are asking about, and any quantity or quote details you
            already have.
          </p>

          <div style={miniCard}>
            <div style={miniCardTitle}>Best for quick requests</div>
            <div style={{ fontSize: 15, lineHeight: 1.6 }}>
              Phone is ideal for urgent questions.
              <br />
              Email is best for quotes, details, and follow-ups.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
