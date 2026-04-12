import * as React from "react";
import {
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface WelcomeEmailProps {
  name?: string;
  appLink?: string;
}

export const WelcomeEmail = ({
  name = "Reader",
  appLink = "https://popcornmedia.org",
}: WelcomeEmailProps) => (
  <Html>
    <Head>
      <Preview>Welcome to Popcorn — Culture news curated for you</Preview>
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
        {/* Header Section - Dark Blue */}
        <Section style={headerStyle}>
          <Text style={logoStyle}>🍿 POPCORN</Text>

          <Text style={mainHeadingStyle}>
            WELCOME,<br />
            {name.split(" ")[0].toUpperCase()}.
          </Text>

          <Text style={taglineStyle}>
            Your curated culture feed is ready.
          </Text>
        </Section>

        {/* Mission Section */}
        <Section style={missionSectionStyle}>
          <Text style={sectionTitleStyle}>THE POPCORN DIFFERENCE</Text>

          <Text style={missionTextStyle}>
            In an age of hyper-personalisation, most news feeds trap you in a loop. Select politics? You're buried in political news—much of it noise you never asked for.
          </Text>

          <Text style={missionTextStyle}>
            <span style={{ fontWeight: "bold", color: "#053980" }}>Popcorn takes the opposite approach.</span> We hand-curate the culture stories that matter: music, film, gaming, fashion, tech, internet culture. The surprising. The fascinating. The things you didn't know you wanted to know.
          </Text>

          <Text style={benefitStyle}>
            ✨ No algorithmic rabbit holes<br />
            ✨ No outrage bait<br />
            ✨ Just the good stuff, delivered fresh
          </Text>
        </Section>

        {/* What's Next Section */}
        <Section style={nextSectionStyle}>
          <Text style={nextTitleStyle}>What's Waiting For You</Text>

          <Section style={featureBoxStyle}>
            <Text style={featureHeading}>📰 YOUR PERSONALIZED FEED</Text>
            <Text style={featureText}>
              Articles curated around the topics you love, from sources we trust.
            </Text>
          </Section>

          <Section style={featureBoxStyle}>
            <Text style={featureHeading}>💬 ENGAGE & DISCUSS</Text>
            <Text style={featureText}>
              Jump into comments, share your thoughts, connect with other culture enthusiasts.
            </Text>
          </Section>

          <Section style={featureBoxStyle}>
            <Text style={featureHeading}>📚 SAVE & COME BACK</Text>
            <Text style={featureText}>
              Bookmark stories you love. Your reading list syncs across all your devices.
            </Text>
          </Section>
        </Section>

        {/* CTA Section */}
        <Section style={ctaSectionStyle}>
          <Button href={appLink} style={ctaButtonStyle}>
            START READING
          </Button>

          <Text style={ctaSubtextStyle}>
            Your personalized feed is waiting. Explore culture news on your terms.
          </Text>
        </Section>

        {/* Footer */}
        <Section style={footerStyle}>
          <Text style={footerHeadingStyle}>Questions or feedback?</Text>
          <Text style={footerTextStyle}>
            We'd love to hear from you at{" "}
            <span style={{ color: "#053980", fontWeight: "bold" }}>
              hello@popcornmedia.org
            </span>
          </Text>
          <Text style={copyrightStyle}>
            © 2026 Popcorn Media. All rights reserved.<br />
            Enjoy the good stuff.
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
  maxWidth: "520px",
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
  padding: "48px 32px 40px",
  textAlign: "center" as const,
};

const logoStyle = {
  fontSize: "13px",
  fontWeight: "bold" as const,
  color: "#fff1cd",
  letterSpacing: "0.12em",
  margin: "0 0 20px 0",
  textTransform: "uppercase" as const,
  fontFamily: "'Manrope', sans-serif",
};

const mainHeadingStyle = {
  fontSize: "36px",
  fontWeight: "bold" as const,
  color: "#fff1cd",
  letterSpacing: "0.02em",
  margin: "0 0 12px 0",
  lineHeight: "1.15",
  fontFamily: "'Macabro', 'Anton', sans-serif",
  textTransform: "uppercase" as const,
};

const taglineStyle = {
  fontSize: "16px",
  color: "rgba(255,241,205,0.70)",
  margin: "0",
  fontStyle: "italic",
  fontFamily: "'Lora', serif",
};

const missionSectionStyle = {
  padding: "40px 32px",
  backgroundColor: "#ffffff",
  borderBottom: "1px solid #f0f0f0",
};

const sectionTitleStyle = {
  fontSize: "12px",
  fontWeight: "bold" as const,
  color: "#053980",
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  margin: "0 0 16px 0",
  fontFamily: "'Macabro', 'Anton', sans-serif",
};

const missionTextStyle = {
  fontSize: "15px",
  color: "#333333",
  lineHeight: "1.7",
  margin: "0 0 14px 0",
  fontFamily: "'Lora', serif",
};

const benefitStyle = {
  fontSize: "14px",
  color: "#053980",
  lineHeight: "1.8",
  margin: "24px 0 0 0",
  fontWeight: "500" as const,
};

const nextSectionStyle = {
  padding: "40px 32px",
  backgroundColor: "#ffffff",
};

const nextTitleStyle = {
  fontSize: "12px",
  fontWeight: "bold" as const,
  color: "#053980",
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  margin: "0 0 20px 0",
  fontFamily: "'Macabro', 'Anton', sans-serif",
};

const featureBoxStyle = {
  backgroundColor: "#f9f9f9",
  border: "1px solid #e8e8e8",
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "12px",
};

const featureHeading = {
  fontSize: "13px",
  fontWeight: "bold" as const,
  color: "#053980",
  margin: "0 0 8px 0",
  fontFamily: "'Manrope', sans-serif",
};

const featureText = {
  fontSize: "13px",
  color: "#666666",
  margin: "0",
  lineHeight: "1.6",
};

const ctaSectionStyle = {
  padding: "40px 32px",
  backgroundColor: "rgba(5,57,128,0.04)",
  textAlign: "center" as const,
};

const ctaButtonStyle = {
  backgroundColor: "#053980",
  color: "#fff1cd",
  padding: "16px 48px",
  borderRadius: "12px",
  fontSize: "13px",
  fontWeight: "bold" as const,
  textDecoration: "none",
  display: "inline-block",
  marginBottom: "16px",
  letterSpacing: "0.08em",
  fontFamily: "'Macabro', 'Anton', sans-serif",
  textTransform: "uppercase" as const,
};

const ctaSubtextStyle = {
  fontSize: "13px",
  color: "#666666",
  margin: "0",
  lineHeight: "1.6",
};

const footerStyle = {
  backgroundColor: "#f5f5f5",
  padding: "32px",
  textAlign: "center" as const,
  borderTop: "1px solid #e8e8e8",
};

const footerHeadingStyle = {
  fontSize: "12px",
  fontWeight: "bold" as const,
  color: "#053980",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  margin: "0 0 8px 0",
  fontFamily: "'Macabro', 'Anton', sans-serif",
};

const footerTextStyle = {
  fontSize: "13px",
  color: "#333333",
  margin: "0 0 16px 0",
  lineHeight: "1.6",
};

const copyrightStyle = {
  fontSize: "11px",
  color: "#999999",
  margin: "0",
  lineHeight: "1.6",
};

export default WelcomeEmail;
