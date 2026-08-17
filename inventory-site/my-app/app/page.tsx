import { InventoryClient } from "./inventory-client";

const SITE_URL = "https://www.packaging.team";

export const metadata = {
  title: "Aluminium Foil Stock — Live Inventory | Packaging Team EU",
  description:
    "Browse our live aluminium foil inventory. Thicknesses from 6.35µ to 50µ, widths from 565mm to 1250mm. In stock at our Hungary warehouse with EU-wide delivery. Contact stock@packaging.team for quotes.",
  alternates: {
    canonical: SITE_URL,
  },
};

// Pre-render the latest stock data for SEO (server-side, no JS needed)
async function getLatestStock() {
  try {
    // During build, read the static JSON from public/
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : SITE_URL;
    return null; // We use the public/latest-stock.json at runtime via client fetch
  } catch {
    return null;
  }
}

export default function HomePage() {
  return (
    <>
      {/* SEO-visible semantic content — rendered server-side for crawlers and AI engines */}
      <div className="sr-only" aria-hidden="false">
        <h1>Aluminium Foil Supplier — Wholesale Across the EU</h1>
        <p>
          Packaging Team supplies wholesale aluminium foil from 6.35 to 50 microns
          across all European Union countries. Our warehouse in Hungary enables fast
          EU-wide delivery of aluminium foil rolls in multiple thicknesses and widths.
        </p>

        <section>
          <h2>Available Aluminium Foil Thicknesses</h2>
          <ul>
            <li><strong>6.35 micron aluminium foil</strong> — ultra-thin converter foil for lamination and flexible packaging</li>
            <li><strong>7 micron aluminium foil</strong> — thin foil for flexible packaging and wrapping applications</li>
            <li><strong>8 micron aluminium foil</strong> — standard thin foil for food packaging and lamination</li>
            <li><strong>9 micron aluminium foil</strong> — medium-thin foil for general packaging applications</li>
            <li><strong>12 micron aluminium foil</strong> — medium foil for food containers and household foil</li>
            <li><strong>37 micron aluminium foil</strong> — heavy-duty foil for insulation and industrial applications</li>
            <li><strong>40 micron aluminium foil</strong> — extra heavy-duty foil for demanding industrial uses</li>
            <li><strong>50 micron aluminium foil</strong> — maximum thickness for specialized industrial applications</li>
          </ul>
        </section>

        <section>
          <h2>Available Widths</h2>
          <p>
            Aluminium foil rolls available in widths from 565mm to 1250mm,
            including 700mm, 850mm, 1000mm, 1010mm, and 1116mm.
          </p>
        </section>

        <section>
          <h2>About Packaging Team</h2>
          <p>
            Packaging Team is a wholesale aluminium foil distributor based in Hungary,
            serving customers across all 27 EU member states. We stock a wide range
            of aluminium foil thicknesses (6.35µ, 7µ, 8µ, 9µ, 12µ, 37µ, 40µ, 50µ)
            and widths (565mm–1250mm) at our Hungary warehouse, ready for immediate
            dispatch. Our real-time inventory system ensures accurate stock information
            for all customers.
          </p>
        </section>

        <section>
          <h2>Applications</h2>
          <p>
            Our aluminium foil is used across multiple industries:
          </p>
          <ul>
            <li>Food packaging and wrapping</li>
            <li>Pharmaceutical packaging (blister foil, strip packs)</li>
            <li>Insulation and building materials</li>
            <li>Lamination with paper, film, and other substrates</li>
            <li>Converter foil for flexible packaging</li>
            <li>Industrial applications and manufacturing</li>
            <li>Food containers and trays</li>
          </ul>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            For orders, quotes, and inquiries: <a href="mailto:stock@packaging.team">stock@packaging.team</a>
          </p>
          <p>
            Visit our live stock inventory at <a href="https://www.packaging.team">www.packaging.team</a>
          </p>
        </section>
      </div>

      {/* Interactive inventory client component */}
      <InventoryClient />
    </>
  );
}