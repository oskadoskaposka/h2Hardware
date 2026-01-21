// app/contact/page.tsx
export const dynamic = "force-static";

export default function ContactPage() {
  const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 14px 34px rgba(0, 0, 0, 0.12)",
    width: "100%",
    maxWidth: 520,
  };

  const headerStyle: React.CSSProperties = {
    background: "linear-gradient(180deg, #121212, #000)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 13,
    padding: "12px 14px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    borderBottom: "3px solid #b91c1c",
  };

  const bodyStyle: React.CSSProperties = {
    padding: 18,
    color: "#111",
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 900,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    color: "#111",
    marginBottom: 3,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: "#111",
    lineHeight: 1.35,
  };

  const linkStyle: React.CSSProperties = {
    display: "inline-block",
    marginTop: 2,
    fontSize: 13,
    fontWeight: 900,
    color: "#b91c1c",
    textDecoration: "none",
  };

  const plainLinkStyle: React.CSSProperties = {
    color: "#111",
    textDecoration: "none",
    fontWeight: 700,
  };

  const blockStyle: React.CSSProperties = { marginTop: 14 };

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <h1 style={{ fontSize: 44, fontWeight: 900, margin: "0 0 8px 0" }}>
        Contact
      </h1>
      <p style={{ margin: 0, opacity: 0.75, fontSize: 16 }}>
        Reach out to StarPro Doors using the information below.
      </p>

      <div style={{ marginTop: 18, display: "grid", placeItems: "center" }}>
        <div style={cardStyle}>
          <div style={headerStyle}>CONTACT US</div>

          <div style={bodyStyle}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>
              StarPro Doors
            </div>

            <div style={blockStyle}>
              <div style={labelStyle}>Phone</div>
              <div style={valueStyle}>
                <a style={plainLinkStyle} href="tel:+14038138890">
                  403.813.8890
                </a>
              </div>
              <div style={valueStyle}>
                <a style={plainLinkStyle} href="tel:+17807103826">
                  780.710.3826
                </a>
              </div>
            </div>

            <div style={blockStyle}>
              <div style={labelStyle}>Email</div>
              <a style={linkStyle} href="mailto:sales@starprodoors.ca">
                sales@starprodoors.ca
              </a>
            </div>

            <div style={blockStyle}>
              <div style={labelStyle}>Edmonton</div>
              <div style={valueStyle}>3820 97 ST Edmonton</div>
              <div style={valueStyle}>T6E 5S8</div>
            </div>

            <div style={blockStyle}>
              <div style={labelStyle}>Calgary</div>
              <div style={valueStyle}>4510 10th Street NE, Calgary</div>
              <div style={valueStyle}>AB T2E 6K3</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
