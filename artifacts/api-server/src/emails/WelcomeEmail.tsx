import * as React from "react";
import {
  Body,
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
        @import url('https://fonts.googleapis.com/css2?family=Anton:wght@400;700&family=Lora:ital@0;1&display=swap');
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: #053980;
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
            Your culture feed is ready.
          </Text>
        </Section>

        {/* Mission Section */}
        <Section style={missionSectionStyle}>
          <Text style={sectionTitleStyle}>THE POPCORN DIFFERENCE</Text>

          <Text style={missionTextStyle}>
            Most feeds today promise personalization. What they actually deliver is repetition. You click one thing, and suddenly you are drowning in more of the same. More noise. More filler. Less signal.
          </Text>

          <Text style={missionTextStyle}>
            Because here is the truth. <span style={{ fontWeight: "bold" }}>You do not know what you do not know.</span> And that is exactly what makes culture interesting.
          </Text>

          <Text style={missionTextStyle}>
            <span style={{ fontWeight: "bold" }}>Popcorn takes a different approach. We do the work for you.</span>
          </Text>

          <Text style={missionTextStyle}>
            Every day, we hand pick the stories that are actually worth your attention. Across music, film, gaming, fashion, tech, and internet culture. The unexpected. The interesting. The ones that cut through.
          </Text>

          <Text style={benefitStyle}>
            🎬 No endless loops<br />
            🎬 No noise dressed as news<br />
            🎬 No endless scrolling. See the headlines for the day, dive into what interests you, and you are done
          </Text>
        </Section>

        {/* What's Next Section */}
        <Section style={nextSectionStyle}>
          <Text style={nextTitleStyle}>WHAT IS WAITING FOR YOU</Text>

          <Section style={featureBoxStyle}>
            <Text style={featureHeading}>📰 A CURATED FEED</Text>
            <Text style={featureText}>
              A tight selection of stories that matter. No clutter. No filler.
            </Text>
          </Section>

          <Section style={featureBoxStyle}>
            <Text style={featureHeading}>💬 JOIN THE CONVERSATION</Text>
            <Text style={featureText}>
              React, comment, and see what others are saying.
            </Text>
          </Section>

          <Section style={featureBoxStyle}>
            <Text style={featureHeading}>📚 SAVE WHAT STICKS</Text>
            <Text style={featureText}>
              Bookmark anything worth coming back to.
            </Text>
          </Section>
        </Section>

        {/* Closing Section */}
        <Section style={closingSectionStyle}>
          <Text style={closingTextStyle}>
            That is it.
          </Text>
          <Text style={closingTextStyle}>
            Simple. Sharp. Worth your time.
          </Text>
          <Text style={welcomeTextStyle}>
            Welcome to Popcorn.
          </Text>
        </Section>

        {/* CTA Section */}
        <Section style={ctaSectionStyle}>
          <Button href={appLink} style={ctaButtonStyle}>
            START READING
          </Button>
        </Section>

        {/* Footer */}
        <Section style={footerStyle}>
          <Text style={footerTextStyle}>
            Questions or feedback? Reach out at{" "}
            <span style={{ color: "#fff1cd", fontWeight: "bold" }}>
              hello@popcornmedia.org
            </span>
          </Text>
          <Text style={copyrightStyle}>
            © 2026 Popcorn Media. All rights reserved.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

const bodyStyle = {
  backgroundColor: "#053980",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
  padding: "20px 0",
};

const containerStyle = {
  maxWidth: "520px",
  margin: "0 auto",
  backgroundColor: "#053980",
  backgroundImage:
    "radial-gradient(circle at 10% 20%, rgba(255,241,205,0.05) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(255,241,205,0.05) 0%, transparent 40%)",
  borderRadius: "0",
  overflow: "hidden" as const,
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
  fontFamily: "'Anton', sans-serif",
};

const mainHeadingStyle = {
  fontSize: "36px",
  fontWeight: "bold" as const,
  color: "#fff1cd",
  letterSpacing: "0.02em",
  margin: "0 0 12px 0",
  lineHeight: "1.15",
  fontFamily: "'Anton', sans-serif",
  textTransform: "uppercase" as const,
};

const taglineStyle = {
  fontSize: "16px",
  color: "rgba(255,241,205,0.80)",
  margin: "0",
  fontStyle: "italic",
  fontFamily: "'Lora', serif",
};

const missionSectionStyle = {
  padding: "40px 32px",
  backgroundColor: "#053980",
  borderBottom: "1px solid rgba(255,241,205,0.10)",
};

const sectionTitleStyle = {
  fontSize: "12px",
  fontWeight: "bold" as const,
  color: "#fff1cd",
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  margin: "0 0 20px 0",
  fontFamily: "'Anton', sans-serif",
};

const missionTextStyle = {
  fontSize: "15px",
  color: "rgba(255,241,205,0.90)",
  lineHeight: "1.7",
  margin: "0 0 14px 0",
  fontFamily: "'Lora', serif",
};

const benefitStyle = {
  fontSize: "14px",
  color: "#fff1cd",
  lineHeight: "1.8",
  margin: "24px 0 0 0",
  fontWeight: "500" as const,
};

const nextSectionStyle = {
  padding: "40px 32px",
  backgroundColor: "#053980",
};

const nextTitleStyle = {
  fontSize: "12px",
  fontWeight: "bold" as const,
  color: "#fff1cd",
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  margin: "0 0 20px 0",
  fontFamily: "'Anton', sans-serif",
};

const featureBoxStyle = {
  backgroundColor: "rgba(255,241,205,0.08)",
  border: "1px solid rgba(255,241,205,0.15)",
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "12px",
};

const featureHeading = {
  fontSize: "13px",
  fontWeight: "bold" as const,
  color: "#fff1cd",
  margin: "0 0 8px 0",
  fontFamily: "'Anton', sans-serif",
};

const featureText = {
  fontSize: "13px",
  color: "rgba(255,241,205,0.80)",
  margin: "0",
  lineHeight: "1.6",
};

const closingSectionStyle = {
  padding: "40px 32px",
  backgroundColor: "#053980",
  textAlign: "center" as const,
  borderTop: "1px solid rgba(255,241,205,0.10)",
};

const closingTextStyle = {
  fontSize: "15px",
  color: "rgba(255,241,205,0.90)",
  margin: "0 0 12px 0",
  lineHeight: "1.6",
  fontFamily: "'Lora', serif",
};

const welcomeTextStyle = {
  fontSize: "20px",
  fontWeight: "bold" as const,
  color: "#fff1cd",
  margin: "16px 0 0 0",
  lineHeight: "1.4",
  fontFamily: "'Anton', sans-serif",
};

const ctaSectionStyle = {
  padding: "40px 32px",
  backgroundColor: "#053980",
  textAlign: "center" as const,
};

const ctaButtonStyle = {
  backgroundColor: "#fff1cd",
  color: "#053980",
  padding: "16px 48px",
  borderRadius: "12px",
  fontSize: "13px",
  fontWeight: "bold" as const,
  textDecoration: "none",
  display: "inline-block",
  marginBottom: "16px",
  letterSpacing: "0.08em",
  fontFamily: "'Anton', sans-serif",
  textTransform: "uppercase" as const,
};

const footerStyle = {
  backgroundColor: "#053980",
  padding: "32px",
  textAlign: "center" as const,
  borderTop: "1px solid rgba(255,241,205,0.10)",
};

const footerTextStyle = {
  fontSize: "13px",
  color: "rgba(255,241,205,0.70)",
  margin: "0 0 12px 0",
  lineHeight: "1.6",
};

const copyrightStyle = {
  fontSize: "11px",
  color: "rgba(255,241,205,0.50)",
  margin: "0",
  lineHeight: "1.6",
};

export default WelcomeEmail;
