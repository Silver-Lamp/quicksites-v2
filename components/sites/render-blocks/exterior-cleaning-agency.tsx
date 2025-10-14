// apps/web/components/templates/ExteriorCleaningAgency.tsx
// QuickSites "PNW Prestige" — a dark, high-end agency template for exterior cleaning brands
// Goal: visually parallel the client's fancy site while staying conversion-focused for services
// Drop-in: import and render inside your block renderer or a dedicated landing route
// Tailwind + (optional) lucide-react icons. No runtime deps.

import * as React from "react";
// import { Phone, Mail, MapPin, CheckCircle2, Sparkles, Shield, Droplet, Leaf } from "lucide-react";
import TypewriterGlow from "@/components/ui/typewriter-glow";

export type ExteriorCleaningContent = {
  brand: string;
  tagline: string;
  subTagline?: string;
  ctaLabel?: string;
  phone?: string;
  email?: string;
  address?: string;
  heroImage?: string; // optional background photo
  social?: { label: string; href: string }[];
  badges?: string[]; // e.g. ["Licensed", "Insured", "Eco-Safe", "5★ Rated"]
  services: { title: string; blurb: string; bullets?: string[]; icon?: string }[];
  packages?: { name: string; price?: string; description?: string; bullets?: string[]; featured?: boolean }[];
  portfolio?: { title: string; subtitle?: string; before?: string; after?: string }[];
  testimonials?: { quote: string; author: string; role?: string }[];
  serviceAreas?: string[];
  footerNote?: string;
};

const DEFAULT_CONTENT: ExteriorCleaningContent = {
  brand: "PNW On Demand Services",
  tagline: "Exterior Cleaning • Roof & Gutter • Pressure & Soft Wash",
  subTagline: "Premium care for homes & businesses across the Pacific Northwest.",
  ctaLabel: "Get a Free Quote",
  phone: "(253) 204-1960",
  email: "team@nweliteconsultants.com", // placeholder — swap to owner email
  address: "Puget Sound, WA",
  heroImage:
    "https://images.unsplash.com/photo-1600585154526-990dced4db0d?q=80&w=2400&auto=format&fit=crop", // fallback stock
  social: [
    { label: "Instagram", href: "#" },
    { label: "Facebook", href: "#" },
  ],
  badges: ["Licensed", "Insured", "Eco-Safe", "5★ Rated"],
  services: [
    {
      title: "Roof & Gutter Cleaning",
      blurb:
        "Clear debris, prevent leaks, and extend roof life with gentle, effective care.",
      bullets: ["Moss treatment", "Downspout flush", "Preventative maintenance"],
    },
    {
      title: "Exterior House Washing",
      blurb:
        "Restore curb appeal with low-pressure soft washing that’s safe for siding.",
      bullets: ["Soft-wash safe", "Mildew & algae removal", "Rinse-to-shine finish"],
    },
    {
      title: "Pressure Washing",
      blurb:
        "Deep clean driveways, sidewalks, decks, and patios for a like-new look.",
      bullets: ["Oil & rust reduction", "Stripe lines revealed", "Slip-safe clean"],
    },
    {
      title: "Commercial & Residential",
      blurb:
        "Reliable scheduling and professional results for properties of any size.",
      bullets: ["After-hours options", "Multi-site capable", "Maintenance plans"],
    },
  ],
  packages: [
    {
      name: "Refresh",
      price: "$349+",
      description: "Entry package for small homes — siding soft-wash + front walk.",
      bullets: ["Soft-wash siding", "Front walk & entry", "Spot rinse windows"],
    },
    {
      name: "Signature",
      price: "$799+",
      description: "Most popular — roof & gutter clean + house wash + driveway.",
      bullets: ["Roof & gutters", "Full exterior soft-wash", "Driveway/sidewalks"],
      featured: true,
    },
    {
      name: "Pro Care",
      price: "Custom",
      description: "Commercial or estates — scheduled maintenance with custom scope.",
      bullets: ["Multi-site plans", "Night/Weekend windows", "Dedicated PM"],
    },
  ],
  portfolio: [
    {
      title: "Driveway • Before/After",
      subtitle: "Concrete pressure wash",
      before:
        "https://images.unsplash.com/photo-1555982102-d756b7443c5d?q=80&w=1200&auto=format&fit=crop",
      after:
        "https://images.unsplash.com/photo-1494949360228-4e9bde560065?q=80&w=1200&auto=format&fit=crop",
    },
    {
      title: "Siding • Before/After",
      subtitle: "Low-pressure soft-wash",
      before:
        "https://images.unsplash.com/photo-1580584128409-11b92d71f28b?q=80&w=1200&auto=format&fit=crop",
      after:
        "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?q=80&w=1200&auto=format&fit=crop",
    },
  ],
  testimonials: [
    {
      quote:
        "They brought the whole property back to life. Professional, on time, and meticulous.",
      author: "Marissa T.",
      role: "Homeowner, Maple Valley",
    },
    {
      quote: "Night-and-day difference on our storefront. Booking quarterly from now on.",
      author: "Evan D.",
      role: "Retail Manager",
    },
  ],
  serviceAreas: ["Auburn", "Kent", "Renton", "Maple Valley", "Federal Way", "Tacoma"],
  footerNote: "© " + new Date().getFullYear() + " PNW On Demand Services. All rights reserved.",
};

export default function ExteriorCleaningAgency({
  content = DEFAULT_CONTENT,
}: { content?: ExteriorCleaningContent }) {
  const c = { ...DEFAULT_CONTENT, ...content };
  return (
    <main className="bg-[#0b0f14] text-white">
      <Header brand={c.brand} ctaLabel={c.ctaLabel!} phone={c.phone} />
      <Hero content={c} />
      <Badges items={c.badges || []} />
      <Section id="services" title="Services" subtitle="High-quality, safe, and reliable">
        <Services items={c.services} />
      </Section>
      <Section id="packages" title="Packages" subtitle="Clear options. Honest pricing.">
        <Pricing items={c.packages || []} cta={c.ctaLabel!} />
      </Section>
      <Section id="portfolio" title="Results" subtitle="Before & After">
        <Portfolio items={c.portfolio || []} />
      </Section>
      <Section id="testimonials" title="What Clients Say" subtitle="Real words. Real shine.">
        <Testimonials items={c.testimonials || []} />
      </Section>
      <CtaStrip phone={c.phone} label={c.ctaLabel!} />
      <Section id="contact" title="Get a Free Quote" subtitle="Tell us about your project.">
        <ContactCard content={c} />
      </Section>
      <Footer content={c} />
    </main>
  );
}

/* ---------------------------- sub components ---------------------------- */

function Container({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
  );
}

function Header({ brand, ctaLabel, phone }: { brand: string; ctaLabel: string; phone?: string }) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-black/40 bg-black/30 border-b border-white/10">
      <Container className="flex items-center justify-between py-4">
        <a href="#" className="text-xl font-semibold tracking-tight">
          <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-sky-300 bg-clip-text text-transparent">
            {brand}
          </span>
        </a>
        <nav className="hidden md:flex items-center gap-6 text-sm text-white/80">
          <a href="#services" className="hover:text-white">Services</a>
          <a href="#packages" className="hover:text-white">Packages</a>
          <a href="#portfolio" className="hover:text-white">Results</a>
          <a href="#contact" className="hover:text-white">Contact</a>
        </nav>
        <div className="flex items-center gap-3">
          {phone && (
            <a href={`tel:${phone.replace(/[^\d]/g, "")}`} className="hidden sm:block text-sm text-white/70 hover:text-white">
              {phone}
            </a>
          )}
          <a
            href="#contact"
            className="inline-flex items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-emerald-400/20"
          >
            {ctaLabel}
          </a>
        </div>
      </Container>
    </header>
  );
}

function Hero({ content }: { content: ExteriorCleaningContent }) {
  // Use service titles as animated words (fallback if empty)
  const animatedWords = React.useMemo(
    () =>
      (content.services?.map((s) => s.title) ?? []).length
        ? content.services.map((s) => s.title)
        : [
            "Roof & Gutter Cleaning",
            "Soft-Wash Exterior",
            "Pressure Washing",
            "Driveways & Sidewalks",
            "Decks & Patios",
          ],
    [content.services]
  );

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url(${content.heroImage})` }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-black/60 to-black" aria-hidden />
      <Container className="relative py-20 sm:py-28 lg:py-36">
        <div className="max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
            <span>Exterior Cleaning Professionals</span>
            <span className="h-1 w-1 rounded-full bg-emerald-300" />
            <span>Puget Sound</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
            High-End{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-sky-300 bg-clip-text text-transparent">
              Exterior Cleaning
            </span>
            <br className="hidden sm:block" /> for Homes & Businesses
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-white/80">
            {content.subTagline}
          </p>

          {/* CTA row with animated typewriter to the right on larger screens */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex gap-3">
              <a
                href="#contact"
                className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-black shadow-lg shadow-emerald-400/30 hover:bg-emerald-300"
              >
                {content.ctaLabel || "Get a Quote"}
              </a>
              <a
                href="#portfolio"
                className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                See Results
              </a>
            </div>

            <TypewriterGlow
                words={animatedWords}
                pauseAfterWordMs={2000}   // 2s hold after finishing
                mode="clear"              // jump to next word instead of backspacing
                className="text-lg sm:ml-2"
                gradientClassName="bg-gradient-to-r from-emerald-300 via-teal-300 to-sky-300 bg-clip-text text-transparent"
                glowClassName="drop-shadow-[0_0_16px_rgba(16,185,129,0.35)]"
            />          
          </div>
        </div>
      </Container>
      {/* soft grid effect */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:36px_36px]"
        aria-hidden
      />
    </section>
  );
}

function Badges({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="border-y border-white/10 bg-black/30">
      <Container className="flex flex-wrap items-center justify-center gap-6 py-4 text-sm text-white/70">
        {items.map((b, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            {b}
          </span>
        ))}
      </Container>
    </div>
  );
}

function Section({ id, title, subtitle, children }: React.PropsWithChildren<{ id?: string; title?: string; subtitle?: string }>) {
  return (
    <section id={id} className="py-16 sm:py-20 lg:py-24">
      <Container>
        {(title || subtitle) && (
          <div className="mb-10 max-w-3xl">
            {title && (
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-2 text-white/70">{subtitle}</p>}
          </div>
        )}
        {children}
      </Container>
    </section>
  );
}

function Services({ items }: { items: ExteriorCleaningContent["services"] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {items.map((s, i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-white/[0.05] transition">
          <div className="mb-3 text-lg font-medium">{s.title}</div>
          <p className="text-sm text-white/70">{s.blurb}</p>
          {s.bullets && (
            <ul className="mt-4 space-y-2 text-sm text-white/80">
              {s.bullets.map((b, j) => (
                <li key={j} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

function Pricing({ items, cta }: { items: NonNullable<ExteriorCleaningContent["packages"]>; cta: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {items.map((p, i) => (
        <div
          key={i}
          className={`rounded-2xl border bg-white/[0.03] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
            p.featured ? "border-emerald-300/40 ring-1 ring-emerald-300/30" : "border-white/10"
          }`}
        >
          <div className="mb-1 text-sm uppercase tracking-wider text-white/60">{p.name}</div>
          {p.price && <div className="text-3xl font-bold">{p.price}</div>}
          <p className="mt-2 text-sm text-white/70">{p.description}</p>
          {p.bullets && (
            <ul className="mt-4 space-y-2 text-sm text-white/80">
              {p.bullets.map((b, j) => (
                <li key={j} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
          <a href="#contact" className="mt-5 inline-flex w-full justify-center rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-300">
            {cta}
          </a>
        </div>
      ))}
    </div>
  );
}

function Portfolio({ items }: { items: NonNullable<ExteriorCleaningContent["portfolio"]> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {items.map((it, i) => (
        <article key={i} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="grid grid-cols-2">
            <figure className="relative aspect-[4/3]">
              <img src={it.before} alt={`${it.title} before`} className="absolute inset-0 h-full w-full object-cover" />
              <figcaption className="absolute left-3 top-3 rounded bg-black/60 px-2 py-1 text-xs">Before</figcaption>
            </figure>
            <figure className="relative aspect-[4/3]">
              <img src={it.after} alt={`${it.title} after`} className="absolute inset-0 h-full w-full object-cover" />
              <figcaption className="absolute left-3 top-3 rounded bg-emerald-500/80 px-2 py-1 text-xs text-black font-semibold">After</figcaption>
            </figure>
          </div>
          <div className="border-t border-white/10 p-4">
            <div className="text-sm text-white/60">{it.subtitle}</div>
            <div className="text-lg font-medium">{it.title}</div>
          </div>
        </article>
      ))}
    </div>
  );
}

function Testimonials({ items }: { items: NonNullable<ExteriorCleaningContent["testimonials"]> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {items.map((t, i) => (
        <blockquote key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-white/90">“{t.quote}”</p>
          <footer className="mt-4 text-sm text-white/60">— {t.author}{t.role ? ` · ${t.role}` : ""}</footer>
        </blockquote>
      ))}
    </div>
  );
}

function CtaStrip({ phone, label }: { phone?: string; label: string }) {
  return (
    <div className="relative border-y border-white/10 bg-gradient-to-r from-emerald-400/10 via-teal-400/10 to-sky-400/10">
      <Container className="flex flex-col items-start justify-between gap-4 py-8 sm:flex-row sm:items-center">
        <div>
          <div className="text-xl font-semibold">Ready to make it shine?</div>
          <div className="text-white/70">Fast quotes, honest pricing, professional results.</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {phone && (
            <a href={`tel:${phone.replace(/[^\d]/g, "")}`} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10">
              Call {phone}
            </a>
          )}
          <a href="#contact" className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-300">
            {label}
          </a>
        </div>
      </Container>
    </div>
  );
}

function ContactCard({ content }: { content: ExteriorCleaningContent }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <form
          method="post"
          action="/api/leads" // hook to QuickSites leads endpoint
          className="space-y-4"
        >
          <input type="hidden" name="brand" value={content.brand} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input name="name" placeholder="Your name" required />
            <Input name="email" type="email" placeholder="you@example.com" required />
          </div>
          <Input name="phone" placeholder="Your phone (optional)" />
          <Textarea name="message" placeholder="Tell us about your project…" rows={5} />
          <button className="w-full rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-300">
            Send Message
          </button>
          <p className="text-xs text-white/50">By submitting, you agree to be contacted about your request.</p>
        </form>
      </div>
      <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="text-lg font-medium">Contact</div>
        <dl className="mt-4 space-y-3 text-sm">
          {content.phone && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/60">Phone</dt>
              <dd><a className="text-emerald-300 hover:underline" href={`tel:${content.phone.replace(/[^\d]/g, "")}`}>{content.phone}</a></dd>
            </div>
          )}
          {content.email && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/60">Email</dt>
              <dd><a className="text-emerald-300 hover:underline" href={`mailto:${content.email}`}>{content.email}</a></dd>
            </div>
          )}
          {content.address && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-white/60">Area</dt>
              <dd className="text-white/80">{content.address}</dd>
            </div>
          )}
        </dl>
        {content.serviceAreas?.length ? (
          <div className="mt-5">
            <div className="text-sm text-white/60">Service Areas</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {content.serviceAreas.map((s, i) => (
                <span key={i} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">{s}</span>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function Footer({ content }: { content: ExteriorCleaningContent }) {
  return (
    <footer className="mt-10 border-t border-white/10 bg-black/40">
      <Container className="flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
        <div className="text-sm text-white/60">{content.footerNote}</div>
        {content.social?.length ? (
          <div className="flex items-center gap-4 text-sm">
            {content.social.map((s, i) => (
              <a key={i} href={s.href} className="text-white/70 hover:text-white">{s.label}</a>
            ))}
          </div>
        ) : null}
      </Container>
    </footer>
  );
}

/* ------------------------------ UI Primitives ------------------------------ */
function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={
        "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-emerald-300/50 " +
        className
      }
      {...props}
    />
  );
}

function Textarea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={
        "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-emerald-300/50 " +
        className
      }
      {...props}
    />
  );
}

/* ------------------------------ Template JSON ------------------------------ */
// If you want to register this as a QuickSites template, you can export a config stub.
// Adjust keys to your internal schema.
export const PNW_PRESTIGE_TEMPLATE_CONFIG = {
  slug: "pnw-prestige-cleaning",
  name: "PNW Prestige – Exterior Cleaning",
  theme: {
    mode: "dark",
    colors: {
      background: "#0b0f14",
      accent: "emerald",
    },
  },
  pages: [
    {
      path: "/",
      blocks: [
        { kind: "custom", component: "ExteriorCleaningAgency", props: { content: DEFAULT_CONTENT } },
      ],
    },
  ],
};
