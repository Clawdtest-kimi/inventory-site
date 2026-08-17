import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Providers } from "./providers";
import { Header } from "./components/header";
import VisitorTracker from "./components/visitor-tracker";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const SITE_URL = "https://www.packaging.team";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Packaging Team — Aluminium Foil Supplier EU | 6.35µ to 50µ",
    template: "%s | Packaging Team",
  },
  description:
    "Packaging Team supplies aluminium foil from 6.35 to 50 microns across the EU. Stock available in multiple widths and thicknesses (6.35µ, 7µ, 8µ, 9µ, 12µ, 37µ, 40µ). Warehouse in Hungary, fast EU-wide delivery.",
  keywords: [
    "aluminium foil",
    "aluminum foil",
    "aluminium foil supplier EU",
    "aluminium foil Europe",
    "aluminium foil Hungary",
    "aluminium foil rolls",
    "aluminium foil 6.35 micron",
    "aluminium foil 7 micron",
    "aluminium foil 8 micron",
    "aluminium foil 9 micron",
    "aluminium foil 12 micron",
    "aluminium foil 37 micron",
    "aluminium foil 40 micron",
    "aluminium foil 50 micron",
    "thin aluminium foil",
    "heavy duty aluminium foil",
    "aluminium foil wholesale",
    "aluminium foil distributor",
    "foil packaging materials",
    "aluminium foil stock",
    "alufoil",
    "aluminum foil Europe supplier",
  ],
  authors: [{ name: "Packaging Team" }],
  creator: "Packaging Team",
  publisher: "Packaging Team",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "en": SITE_URL,
      "en-US": SITE_URL,
      "de": SITE_URL,
      "fr": SITE_URL,
      "hu": SITE_URL,
      "ro": SITE_URL,
      "pl": SITE_URL,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: ["de_DE", "fr_FR", "hu_HU", "ro_RO", "pl_PL"],
    url: SITE_URL,
    siteName: "Packaging Team",
    title: "Packaging Team — Aluminium Foil Supplier EU | 6.35µ to 50µ",
    description:
      "Wholesale aluminium foil from 6.35 to 50 microns. Multiple widths and thicknesses in stock. Warehouse in Hungary with fast EU-wide delivery.",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Packaging Team — Aluminium Foil Supplier EU",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Packaging Team — Aluminium Foil Supplier EU",
    description:
      "Wholesale aluminium foil 6.35µ to 50µ. Multiple widths in stock. Hungary warehouse, EU-wide delivery.",
    images: ["/logo.png"],
  },
  category: "Packaging Materials",
  other: {
    "geo.region": "EU",
    "geo.placename": "Hungary",
    "ICBM": "47.1625, 19.5033",
    "theme-color": "#1a1a2e",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* JSON-LD: Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Packaging Team",
              url: SITE_URL,
              logo: `${SITE_URL}/logo.png`,
              description:
                "Wholesale supplier of aluminium foil from 6.35 to 50 microns across the European Union. Warehouse in Hungary.",
              telephone: "+40733721425",
              address: {
                "@type": "PostalAddress",
                addressCountry: "HU",
                addressRegion: "Hungary",
              },
              areaServed: [
                "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
                "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
                "PL", "PT", "RO", "SK", "SI", "ES", "SE",
              ],
              knowsAbout: [
                "aluminium foil",
                "aluminum foil",
                "foil packaging",
                "alufoil",
                "aluminium foil rolls",
                "thin aluminium foil",
                "heavy duty aluminium foil",
              ],
            }),
          }}
        />
        {/* JSON-LD: Product */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              name: "Aluminium Foil Rolls — 6.35µ to 50µ",
              description:
                "Aluminium foil rolls available in thicknesses from 6.35 to 50 microns. Multiple widths in stock: 565mm to 1250mm. Suitable for packaging, insulation, food industry, and industrial applications.",
              brand: {
                "@type": "Brand",
                name: "Packaging Team",
              },
              category: "Packaging Materials",
              offers: {
                "@type": "AggregateOffer",
                priceCurrency: "EUR",
                availability: "https://schema.org/InStock",
                seller: {
                  "@type": "Organization",
                  name: "Packaging Team",
                },
              },
              additionalProperty: [
                { "@type": "PropertyValue", name: "Material", value: "Aluminium" },
                { "@type": "PropertyValue", name: "Min Thickness", value: "6.35 microns" },
                { "@type": "PropertyValue", name: "Max Thickness", value: "50 microns" },
                { "@type": "PropertyValue", name: "Width Range", value: "565mm - 1250mm" },
                { "@type": "PropertyValue", name: "Available Thicknesses", value: "6.35µ, 7µ, 8µ, 9µ, 12µ, 37µ, 40µ" },
                { "@type": "PropertyValue", name: "Warehouse Location", value: "Hungary" },
                { "@type": "PropertyValue", name: "Delivery Area", value: "European Union" },
              ],
            }),
          }}
        />
        {/* JSON-LD: LocalBusiness / Place */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WholesaleStore",
              name: "Packaging Team",
              url: SITE_URL,
              image: `${SITE_URL}/logo.png`,
              telephone: "+40733721425",
              priceRange: "€€",
              address: {
                "@type": "PostalAddress",
                addressCountry: "HU",
                addressRegion: "Hungary",
              },
              geo: {
                "@type": "GeoCoordinates",
                latitude: 47.1625,
                longitude: 19.5033,
              },
              openingHoursSpecification: {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                opens: "08:00",
                closes: "17:00",
              },
            }),
          }}
        />
        {/* JSON-LD: FAQPage for AI Engine Optimization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "What thicknesses of aluminium foil does Packaging Team supply?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Packaging Team supplies aluminium foil in thicknesses from 6.35 microns to 50 microns. Available thicknesses include 6.35µ, 7µ, 8µ, 9µ, 12µ, 37µ, and 40µ. Other thicknesses may be available on request.",
                  },
                },
                {
                  "@type": "Question",
                  name: "What widths are available for aluminium foil rolls?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Aluminium foil rolls are available in widths from 565mm to 1250mm. Common widths include 700mm, 850mm, 1000mm, 1010mm, and 1116mm. Custom widths may be available upon request.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Where is Packaging Team's warehouse located?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Packaging Team's warehouse is located in Hungary, enabling fast and cost-effective delivery across the entire European Union.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Does Packaging Team deliver across the EU?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes, Packaging Team delivers aluminium foil across all 27 EU member states from our warehouse in Hungary. We offer competitive freight rates and fast transit times throughout Europe.",
                  },
                },
                {
                  "@type": "Question",
                  name: "How can I check current aluminium foil stock availability?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Current stock availability is displayed on our website at www.packaging.team. You can filter by thickness and width to see real-time inventory. To place an order, call +40733721425.",
                  },
                },
                {
                  "@type": "Question",
                  name: "What is aluminium foil used for?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Aluminium foil is used in food packaging, pharmaceutical packaging, insulation, industrial applications, lamination, and converter foils. Thinner foils (6-12µ) are typically used for flexible packaging and lamination, while thicker foils (37-50µ) are used for heavier duty applications like insulation and food containers.",
                  },
                },
              ],
            }),
          }}
        />
        {/* JSON-LD: WebSite + SearchAction */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Packaging Team",
              url: SITE_URL,
              publisher: {
                "@type": "Organization",
                name: "Packaging Team",
              },
              potentialAction: {
                "@type": "SearchAction",
                target: `${SITE_URL}/?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-slate-50`}>
        <Providers>
          <Header />
          <main className="min-h-screen">
            {children}
          </main>
          <VisitorTracker />
        </Providers>
      </body>
    </html>
  );
}