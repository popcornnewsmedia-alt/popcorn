import * as React from "react";
import {
  Button,
  Container,
  Head,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";

interface VerifyEmailProps {
  name?: string;
  confirmLink: string;
}

export const VerifyEmail = ({ name = "Reader", confirmLink }: VerifyEmailProps) => (
  <Html>
    <Head>
      <Preview>Confirm your Popcorn account</Preview>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital@0;1&family=Manrope:wght@400;700&display=swap');
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: #f5f5f5;
        }
      `}</style>
    </Head>
    <Body style={bodyStyle}>
      <Container style={containerStyle}>
        {/* Dark blue background section */}
        <Section style={headerStyle}>
          {/* Popcorn logo/branding */}
          <Text style={logoStyle}>🍿 POPCORN</Text>

          {/* Main heading */}
          <Text style={headingStyle}>
            CONFIRM YOUR<br />
            ACCOUNT.
          </Text>

          {/* Subheading */}
          <Text style={subtitleStyle}>
            Hi {name.split(" ")[0]}, click the button below to activate your Popcorn account.
          </Text>

          {/* Confirmation button */}
          <Button
            href={confirmLink}
            style={buttonStyle}
          >
            CONFIRM EMAIL
          </Button>

          {/* Alternative link text */}
          <Text style={altLinkStyle}>
            Or copy this link:{" "}
            <span style={{ color: "#fff1cd", wordBreak: "break-all" }}>
              {confirmLink}
            </span>
          </Text>
        </Section>

        {/* Footer */}
        <Section style={footerStyle}>
          <Text style={footerTextStyle}>
            Questions? Reach out to us at{" "}
            <span style={{ color: "#053980", fontWeight: "bold" }}>
              hello@popcornmedia.org
            </span>
          </Text>
          <Text style={footerSmallStyle}>
            © 2026 Popcorn Media. All rights reserved.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

const bodyStyle = {
  backgroundColor: "#f5f5f5",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
  padding: "20px 0",
};

const containerStyle = {
  maxWidth: "480px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  overflow: "hidden" as const,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
};

const headerStyle = {
  backgroundColor: "#053980",
  backgroundImage:
    "radial-gradient(circle at 20% 50%, rgba(255,241,205,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,241,205,0.08) 0%, transparent 50%)",
  padding: "48px 32px",
  textAlign: "center" as const,
};

const logoStyle = {
  fontSize: "14px",
  fontWeight: "bold" as const,
  color: "#fff1cd",
  letterSpacing: "0.12em",
  margin: "0 0 24px 0",
  textTransform: "uppercase" as const,
  fontFamily: "'Manrope', sans-serif",
};

const headingStyle = {
  fontSize: "32px",
  fontWeight: "bold" as const,
  color: "#fff1cd",
  letterSpacing: "0.02em",
  margin: "0 0 16px 0",
  lineHeight: "1.2",
  fontFamily: "'Macabro', 'Anton', sans-serif",
  textTransform: "uppercase" as const,
};

const subtitleStyle = {
  fontSize: "16px",
  color: "rgba(255,241,205,0.75)",
  margin: "0 0 32px 0",
  lineHeight: "1.6",
  fontFamily: "'Manrope', sans-serif",
};

const buttonStyle = {
  backgroundColor: "#fff1cd",
  color: "#053980",
  padding: "16px 48px",
  borderRadius: "12px",
  fontSize: "13px",
  fontWeight: "bold" as const,
  textDecoration: "none",
  display: "inline-block",
  marginBottom: "24px",
  letterSpacing: "0.08em",
  fontFamily: "'Macabro', 'Anton', sans-serif",
  textTransform: "uppercase" as const,
};

const altLinkStyle = {
  fontSize: "12px",
  color: "rgba(255,241,205,0.55)",
  margin: "16px 0 0 0",
  lineHeight: "1.6",
};

const footerStyle = {
  backgroundColor: "#f9f9f9",
  padding: "28px 32px",
  textAlign: "center" as const,
  borderTop: "1px solid #e8e8e8",
};

const footerTextStyle = {
  fontSize: "13px",
  color: "#333333",
  margin: "0 0 12px 0",
  lineHeight: "1.6",
};

const footerSmallStyle = {
  fontSize: "11px",
  color: "#999999",
  margin: "0",
  lineHeight: "1.6",
};

export default VerifyEmail;
