'use client';

import { useEffect, useState } from 'react';
import { getPageBySlug } from '@/lib/data';
import { getVisitorCountry } from '@/lib/supabase/client';
import type { Page as PageType } from '@/lib/supabase/types';
import { useParams } from 'next/navigation';

const POLICY_COPY = {
  BD: {
    title: 'Privacy Policy',
    market: 'Bangladesh',
    intro:
      'GAZI SEED Bangladesh (“GAZI SEED”, “we”, “our”, or “us”) respects your privacy. This Privacy Policy explains how we collect, use, store, and protect information when you use our Bangladesh website, place an order, create an account, contact us, or otherwise interact with our services.',
    currency: 'Bangladeshi Taka (BDT)',
    delivery: 'deliveries and services within Bangladesh',
    payment:
      'Payments may be processed through the payment methods made available for Bangladesh customers, including Cash on Delivery and other supported online payment options.',
  },
  IN: {
    title: 'Privacy Policy',
    market: 'India',
    intro:
      'GAZI SEED India (“GAZI SEED”, “we”, “our”, or “us”) respects your privacy. This Privacy Policy explains how we collect, use, store, and protect information when you use our India website, place an order, create an account, contact us, or otherwise interact with our services.',
    currency: 'Indian Rupees (INR)',
    delivery: 'deliveries and services within India',
    payment:
      'Payments may be processed through the payment methods made available for India customers, including UPI, supported wallets, cards, Cash on Delivery, and other available payment options.',
  },
} as const;

function PrivacyPolicy({ country }: { country: 'BD' | 'IN' }) {
  const copy = POLICY_COPY[country];
  const lastUpdated = 'September 9, 2026';

  return (
    <div className="container-custom py-8 sm:py-12">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-3xl border bg-background shadow-sm">
        <div className="border-b bg-muted/40 px-5 py-7 sm:px-10 sm:py-9">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">GAZI SEED • {copy.market} Branch</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{copy.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-8 px-5 py-7 text-[15px] leading-7 text-muted-foreground sm:px-10 sm:py-10">
          <p>{copy.intro}</p>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">1. Information We Collect</h2>
            <p>Depending on how you use GAZI SEED, we may collect information such as your name, phone number, email address, delivery address, account details, order history, payment-related information, and messages or support requests that you send to us.</p>
            <p className="mt-3">We may also collect technical information such as device type, browser type, approximate location, IP address, pages viewed, referring pages, and similar website activity data when needed for security, analytics, and site performance.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">2. How We Use Your Information</h2>
            <p>We use information to create and manage accounts, process and deliver orders, provide customer support, confirm transactions, maintain website security, prevent misuse or fraud, improve products and services, operate referral or loyalty features, and send service-related communications.</p>
            <p className="mt-3">Where permitted by applicable law, we may also use information for relevant marketing or promotional communications. You may contact us about marketing preferences.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">3. Orders, Payments and Delivery</h2>
            <p>When you place an order, we use the information necessary to verify the order, prepare the shipment, communicate with you, and complete {copy.delivery}. Prices and transactions for this branch are handled in {copy.currency}.</p>
            <p className="mt-3">{copy.payment}</p>
            <p className="mt-3">We do not need your full card credentials to process an order when a third-party payment provider handles the payment. Payment providers may process information under their own privacy terms.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">4. Cookies and Similar Technologies</h2>
            <p>We may use cookies, local storage, pixels, and similar technologies to remember preferences, maintain sessions, understand website usage, improve performance, support analytics, and operate relevant site features. Some technologies may be provided by third-party services used by the website.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">5. Sharing of Information</h2>
            <p>We may share information only as reasonably necessary to operate the service. This can include delivery and logistics partners, payment providers, hosting and technology providers, analytics or communication services, customer-support systems, professional advisers, or authorities where disclosure is required by law.</p>
            <p className="mt-3">We do not sell your personal information as a standalone product.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">6. Data Security</h2>
            <p>We use reasonable technical and organizational measures intended to protect information against unauthorized access, loss, misuse, alteration, or disclosure. No website or internet transmission can be guaranteed to be completely secure.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">7. Data Retention</h2>
            <p>We retain information for as long as reasonably necessary for the purposes described in this Policy, including fulfilling orders, maintaining business records, resolving disputes, preventing fraud, meeting legal obligations, and enforcing our agreements.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">8. Your Choices and Rights</h2>
            <p>Depending on applicable law and your circumstances, you may have rights concerning access, correction, deletion, restriction, objection, portability, withdrawal of consent, or other privacy choices. Requests may be subject to identity verification and legal limitations.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">9. Children’s Privacy</h2>
            <p>Our services are intended for general customers and are not designed to knowingly collect personal information from children without appropriate permission. Please contact us if you believe a child has provided personal information through the site.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">10. Third-Party Services and Links</h2>
            <p>Our website may use or link to third-party services. Their privacy practices are governed by their own policies, and we are not responsible for the privacy practices of independent third parties.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time to reflect changes in our services, technology, or applicable requirements. The latest version will be published on this page with an updated date.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">12. Contact Us</h2>
            <p>For privacy questions, account-data requests, or concerns about how your information is handled, please contact GAZI SEED through the contact and support channels provided on the website for the {copy.market} branch.</p>
          </section>

          <div className="rounded-2xl border bg-muted/30 p-5 text-sm text-foreground">
            <p className="font-semibold">Branch-specific note</p>
            <p className="mt-2 text-muted-foreground">This version is intended for customers using the GAZI SEED {copy.market} branch. Branch-specific pricing, delivery, payment, account, and operational processes may differ between Bangladesh and India.</p>
          </div>
        </div>
      </article>
    </div>
  );
}

export default function PageDetail() {
  const params = useParams();
  const slug = params.slug as string;
  const [page, setPage] = useState<PageType | null>(null);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState<'BD' | 'IN'>('BD');

  useEffect(() => {
    setCountry(getVisitorCountry());
    const onCountryChange = () => setCountry(getVisitorCountry());
    window.addEventListener('gazi-country-changed', onCountryChange);
    return () => window.removeEventListener('gazi-country-changed', onCountryChange);
  }, []);

  useEffect(() => {
    if (slug === 'privacy-policy') {
      setLoading(false);
      return;
    }
    setLoading(true);
    getPageBySlug(slug).then((p) => {
      setPage(p);
      setLoading(false);
    });
  }, [slug]);

  if (slug === 'privacy-policy') {
    return <PrivacyPolicy country={country} />;
  }

  if (loading) return <div className="container-custom py-12"><div className="h-64 animate-pulse rounded-2xl bg-secondary" /></div>;

  if (!page) {
    return (
      <div className="container-custom py-12 text-center">
        <h1 className="text-2xl font-bold">পেজ পাওয়া যায়নি</h1>
        <a href="/" className="mt-4 inline-block text-primary hover:underline">হোমে ফিরুন</a>
      </div>
    );
  }

  return (
    <div className="container-custom py-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{page.title}</h1>
        <div className="whitespace-pre-line text-muted-foreground">{page.content}</div>
      </div>
    </div>
  );
}
