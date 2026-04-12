import { X } from "lucide-react";
import { GrainBackground } from "@/components/GrainBackground";

export type LegalKind = "privacy" | "terms" | "about";

interface LegalSheetProps {
  kind: LegalKind | null;
  onClose: () => void;
}

/**
 * Full-height bottom sheet that renders either the Privacy Policy or the
 * Terms & Conditions. Content lives in-file so it ships with the bundle
 * (no network fetch, works offline). Styled to match the same cream-on-navy
 * brand identity used across SignUpFlow / SignInSheet / CommentSheet.
 *
 * Open by setting `kind` to "privacy" or "terms"; close by setting to null.
 */
export function LegalSheet({ kind, onClose }: LegalSheetProps) {
  const isOpen = kind !== null;
  const doc = kind === "terms" ? TERMS : kind === "privacy" ? PRIVACY : kind === "about" ? ABOUT : null;
  const docLabel = kind === "about" ? "Popcorn · About" : "Popcorn · Legal";

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();
  const handleClose = (e: React.MouseEvent) => { e.stopPropagation(); onClose(); };

  return (
    <>
      <div
        className="fixed inset-0 z-[230] transition-opacity duration-300"
        style={{ background: 'rgba(0,0,0,0.72)', opacity: isOpen ? 1 : 0, pointerEvents: isOpen ? 'auto' : 'none' }}
        onClick={handleClose}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[230] flex flex-col overflow-hidden mx-auto"
        style={{
          height: '94dvh',
          maxWidth: '480px',
          background: '#053980',
          borderRadius: '20px 20px 0 0',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.38s cubic-bezier(0.32,0.72,0,1)',
          boxShadow: '0 -24px 64px rgba(0,0,0,0.45)',
        }}
        onClick={stopProp}
      >
        <GrainBackground />

        {/* Handle */}
        <div className="relative z-10 flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,241,205,0.30)' }} />
        </div>

        {/* Close */}
        <button
          onClick={handleClose}
          className="absolute right-5 z-20 p-2 rounded-full transition-opacity hover:opacity-60 active:opacity-50"
          style={{ background: 'rgba(255,241,205,0.10)', top: 'calc(14px + env(safe-area-inset-top))' }}
          aria-label="Close"
        >
          <X className="w-4 h-4" style={{ color: 'rgba(255,241,205,0.80)' }} />
        </button>

        {doc && (
          <>
            {/* Header */}
            <div className="relative z-10 px-6 pt-6 pb-5 flex-shrink-0">
              <p style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                fontSize: '10px',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'rgba(255,241,205,0.38)',
                marginBottom: '10px',
              }}>
                {docLabel}
              </p>
              <h1 style={{
                fontFamily: "'Macabro', 'Anton', sans-serif",
                fontSize: 'clamp(16px, 4.5vw, 21px)',
                lineHeight: 0.94,
                color: '#fff1cd',
                letterSpacing: '0.015em',
                textTransform: 'uppercase',
              }}>
                {doc.title}
              </h1>
              <p className="font-['Inter']" style={{
                marginTop: '10px',
                fontSize: '12px',
                color: 'rgba(255,241,205,0.45)',
                letterSpacing: '0.02em',
              }}>
                Last updated {doc.lastUpdated}
              </p>
            </div>

            {/* Divider */}
            <div className="relative z-10 mx-6" style={{ height: '1px', background: 'rgba(255,241,205,0.14)' }} />

            {/* Scrollable body */}
            <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain scrollbar-hide">
              <div className="px-6 py-7 pb-20 max-w-2xl mx-auto">
                {doc.intro && (
                  <p
                    className="font-['Lora'] italic"
                    style={{
                      fontSize: '12px',
                      lineHeight: 1.7,
                      color: 'rgba(255,241,205,0.78)',
                      marginBottom: '28px',
                      borderLeft: '2px solid rgba(255,241,205,0.22)',
                      paddingLeft: '14px',
                    }}
                  >
                    {doc.intro}
                  </p>
                )}

                {doc.sections.map((s, i) => (
                  <section key={i} style={{ marginBottom: '26px' }}>
                    <h2
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: '10px',
                        fontFamily: "'Macabro', 'Anton', sans-serif",
                        fontSize: '11px',
                        letterSpacing: '0.10em',
                        color: '#fff1cd',
                        textTransform: 'uppercase',
                        marginBottom: '10px',
                      }}
                    >
                      <span
                        className="font-['Inter']"
                        style={{
                          fontSize: '8px',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          color: 'rgba(255,241,205,0.38)',
                          fontFamily: "'Inter', sans-serif",
                          width: '18px',
                        }}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {s.heading}
                    </h2>
                    {s.paragraphs.map((p, j) => (
                      <p
                        key={j}
                        className="font-['Lora']"
                        style={{
                          fontSize: '12px',
                          lineHeight: 1.75,
                          color: 'rgba(255,241,205,0.78)',
                          marginLeft: '28px',
                          marginBottom: j === s.paragraphs.length - 1 ? 0 : '12px',
                        }}
                      >
                        {p}
                      </p>
                    ))}
                  </section>
                ))}

                <div
                  style={{
                    marginTop: '36px',
                    paddingTop: '20px',
                    borderTop: '1px solid rgba(255,241,205,0.10)',
                    textAlign: 'center',
                  }}
                >
                  <p
                    className="font-['Inter']"
                    style={{
                      fontSize: '10px',
                      color: 'rgba(255,241,205,0.38)',
                      letterSpacing: '0.04em',
                      lineHeight: 1.6,
                    }}
                  >
                    Questions? Write to us at{" "}
                    <span style={{ color: '#fff1cd' }}>hello@popcornmedia.org</span>
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ─── Legal content ──────────────────────────────────────────────────────────

interface LegalDoc {
  title: string;
  lastUpdated: string;
  intro?: string;
  sections: { heading: string; paragraphs: string[] }[];
}

const LAST_UPDATED = "April 12, 2026";

const ABOUT: LegalDoc = {
  title: "About\nPopcorn",
  lastUpdated: LAST_UPDATED,
  intro: "We built Popcorn because we were tired of doomscrolling feeds that only gave us more of what we already knew about. Here's what makes us different.",
  sections: [
    {
      heading: "What we are",
      paragraphs: [
        "In an age of hyper-personalisation, most news feeds give you more of what you already follow — select politics and you're buried in political news, much of it noise you never asked for. Popcorn takes the opposite approach.",
        "We hand-curate culture stories from around the globe — the surprising, the fascinating, the things you didn't know you wanted to know. Music, film, gaming, fashion, tech, internet culture, and everything in between.",
      ],
    },
    {
      heading: "Our editorial philosophy",
      paragraphs: [
        "No algorithmic rabbit holes. No outrage bait. No headlines engineered to make you anxious. Just the good stuff, delivered fresh every morning.",
        "Every story in your feed has been reviewed by a human editor before it reaches you. We care more about quality and breadth than volume.",
      ],
    },
    {
      heading: "Who we are",
      paragraphs: [
        "Popcorn is an independent product. We're a small team who care deeply about media, culture, and building things that don't make people feel worse after using them.",
        "Questions or thoughts? We'd love to hear from you at hello@popcornmedia.org.",
      ],
    },
  ],
};

const PRIVACY: LegalDoc = {
  title: "Privacy\nPolicy",
  lastUpdated: LAST_UPDATED,
  intro:
    "Popcorn is a culture-and-news reader. We collect the minimum amount of information required to run the service, and we never sell your data. This policy explains what we collect, why, and what you can do about it.",
  sections: [
    {
      heading: "Information we collect",
      paragraphs: [
        "When you create an account we collect your name, email address, and a hashed password (or, if you use Google sign-in, an authentication token issued by Google). We also store the topics you select during onboarding and the notification preferences you choose.",
        "As you use the app we automatically record basic usage information such as which articles you open, save, or like. We keep short-lived technical logs (IP address, device type, browser version, crash reports) for up to 30 days to diagnose issues and defend against abuse.",
      ],
    },
    {
      heading: "How we use your information",
      paragraphs: [
        "We use your information to operate Popcorn, personalise your feed, sync your bookmarks across devices, send the notifications you opt into, respond to support requests, prevent fraud and abuse, and comply with our legal obligations.",
        "We do not use your personal information to train machine-learning models, and we do not build advertising profiles of you.",
      ],
    },
    {
      heading: "How we share it",
      paragraphs: [
        "We share personal information only with a small set of infrastructure providers that help us run the service — our hosting provider, our database (Supabase), our email delivery service, and our error-tracking provider. Each of them is bound by a data-processing agreement and may only use the data to provide services to us.",
        "We will disclose information if required by a valid legal request, or if disclosure is necessary to protect the rights, property, or safety of Popcorn, our users, or the public.",
      ],
    },
    {
      heading: "Your choices and rights",
      paragraphs: [
        "You can update your profile, change the topics that shape your feed, and manage notifications at any time from the Profile tab. You can delete your account by contacting us at the address below, and we will erase your personal information within 30 days (except where we are legally required to retain it).",
        "If you are in the EEA, the UK, or California, you have additional rights under the GDPR, UK GDPR, and CCPA respectively — including the right to access, correct, port, and delete the data we hold about you, and the right to object to processing. To exercise these rights, email hello@popcornmedia.org.",
      ],
    },
    {
      heading: "Cookies and local storage",
      paragraphs: [
        "Popcorn uses cookies and browser local storage to keep you signed in and to remember your preferences. We do not use advertising cookies or cross-site tracking pixels. You can clear cookies from your browser at any time, but doing so will sign you out.",
      ],
    },
    {
      heading: "Data retention and security",
      paragraphs: [
        "We retain account data for as long as your account is active. Usage logs are automatically purged after 30 days. We protect your information using TLS in transit and industry-standard encryption at rest, and we regularly review our access controls.",
        "No system is perfectly secure. If we ever discover a breach that affects your information, we will notify you and the relevant authorities as required by law.",
      ],
    },
    {
      heading: "Children",
      paragraphs: [
        "Popcorn is not directed to children under 13 (or under 16 in the EEA/UK). We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will delete it.",
      ],
    },
    {
      heading: "Changes to this policy",
      paragraphs: [
        "We may update this policy from time to time. When we make material changes we will revise the \"last updated\" date above and, where appropriate, notify you in-app or by email before the changes take effect.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        "Questions, concerns, or requests? Email hello@popcornmedia.org and we will respond within a reasonable time.",
      ],
    },
  ],
};

const TERMS: LegalDoc = {
  title: "Terms &\nConditions",
  lastUpdated: LAST_UPDATED,
  intro:
    "These terms form a legal agreement between you and Popcorn. By creating an account or using the service you agree to them. Please read them carefully — they are written to be as plain as possible.",
  sections: [
    {
      heading: "The service",
      paragraphs: [
        "Popcorn is a curated pop-culture news reader. Articles, summaries, and category pills are generated by combining content licensed from or published by third-party sources with editorial processing performed on our servers. We may change, add, or remove features at any time.",
      ],
    },
    {
      heading: "Eligibility",
      paragraphs: [
        "You must be at least 13 years old (16 in the EEA and UK) to use Popcorn. By creating an account you confirm that you meet this requirement and that you are legally able to enter into these terms.",
      ],
    },
    {
      heading: "Your account",
      paragraphs: [
        "You are responsible for the accuracy of the information you provide, for keeping your password secure, and for everything that happens under your account. Let us know immediately if you suspect someone else is using your account.",
      ],
    },
    {
      heading: "Acceptable use",
      paragraphs: [
        "You agree not to use Popcorn to break the law, infringe anyone's rights, harass other users, scrape or bulk-download the feed, attempt to reverse-engineer the service, or interfere with how Popcorn runs. We may suspend or terminate accounts that violate these rules.",
      ],
    },
    {
      heading: "Content and intellectual property",
      paragraphs: [
        "The Popcorn brand, app, design, and code are owned by us and protected by copyright and trademark law. Articles, images, and other materials that appear inside Popcorn belong to their respective publishers and are shown under fair-use, licensed, or press-summary principles. Image sources are credited beneath each photo where available.",
        "Nothing in these terms transfers ownership of third-party content to you. You may read, save, and share articles for personal, non-commercial use. You may not republish, resell, or create derivative works from them without permission from the rights holder.",
      ],
    },
    {
      heading: "Third-party links",
      paragraphs: [
        "Popcorn links to articles, videos, and other material hosted elsewhere on the internet. We do not control those sites and we are not responsible for their content, privacy practices, or availability. Use them at your own risk.",
      ],
    },
    {
      heading: "Disclaimers",
      paragraphs: [
        "Popcorn is provided \"as is\" and \"as available\". We do our best to publish accurate and timely summaries, but we do not guarantee that the service will always be correct, complete, uninterrupted, or free from errors. Nothing in Popcorn is intended as professional, financial, medical, or legal advice.",
      ],
    },
    {
      heading: "Limitation of liability",
      paragraphs: [
        "To the maximum extent permitted by law, Popcorn and its team will not be liable for indirect, incidental, consequential, special, or punitive damages arising from your use of the service. Our total liability for any claim arising from these terms or your use of Popcorn is limited to one hundred US dollars (USD 100).",
      ],
    },
    {
      heading: "Termination",
      paragraphs: [
        "You may stop using Popcorn at any time by deleting your account from the Profile tab or by emailing us. We may suspend or terminate access to the service if you violate these terms or if we are required to do so by law. Sections that by their nature should survive termination (such as intellectual property, disclaimers, and limitation of liability) will continue to apply.",
      ],
    },
    {
      heading: "Changes to these terms",
      paragraphs: [
        "We may update these terms from time to time. When we make material changes we will revise the \"last updated\" date and, where appropriate, notify you in-app or by email. Continued use of Popcorn after changes take effect means you accept the updated terms.",
      ],
    },
    {
      heading: "Governing law",
      paragraphs: [
        "These terms are governed by the laws of the jurisdiction in which Popcorn is incorporated, without regard to conflict-of-law rules. Disputes that cannot be resolved informally will be brought in the courts of that jurisdiction.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        "Reach out to hello@popcornmedia.org with any questions about these terms.",
      ],
    },
  ],
};
