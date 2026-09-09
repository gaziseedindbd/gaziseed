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
    intro: 'GAZI SEED Bangladesh (“GAZI SEED”, “we”, “our”, or “us”) respects your privacy. This Privacy Policy explains how we collect, use, store, and protect information when you use our Bangladesh website, place an order, create an account, contact us, or otherwise interact with our services.',
    currency: 'Bangladeshi Taka (BDT)',
    delivery: 'deliveries and services within Bangladesh',
    payment: 'Payments may be processed through the payment methods made available for Bangladesh customers, including Cash on Delivery and other supported online payment options.',
  },
  IN: {
    title: 'Privacy Policy',
    market: 'India',
    intro: 'GAZI SEED India (“GAZI SEED”, “we”, “our”, or “us”) respects your privacy. This Privacy Policy explains how we collect, use, store, and protect information when you use our India website, place an order, create an account, contact us, or otherwise interact with our services.',
    currency: 'Indian Rupees (INR)',
    delivery: 'deliveries and services within India',
    payment: 'Payments may be processed through the payment methods made available for India customers, including UPI, supported wallets, cards, Cash on Delivery, and other available payment options.',
  },
} as const;

const TERMS_COPY = {
  BD: { market: 'Bangladesh', intro: 'These Terms & Conditions govern your use of the GAZI SEED Bangladesh website, account, purchases, and related services. By using the website or placing an order, you agree to these terms.', currency: 'Bangladeshi Taka (BDT)', delivery: 'within Bangladesh', payment: 'Cash on Delivery and other payment methods made available to Bangladesh customers' },
  IN: { market: 'India', intro: 'These Terms & Conditions govern your use of the GAZI SEED India website, account, purchases, and related services. By using the website or placing an order, you agree to these terms.', currency: 'Indian Rupees (INR)', delivery: 'within India', payment: 'UPI, supported wallets, cards, Cash on Delivery, and other payment methods made available to India customers' },
} as const;

const SHIPPING_COPY = {
  BD: {
    market: 'Bangladesh', currency: 'Bangladeshi Taka (BDT)', territory: 'Bangladesh',
    intro: 'This Shipping Policy explains how GAZI SEED Bangladesh prepares, dispatches, and delivers orders placed through the Bangladesh branch of our website. By placing an order, you agree to the shipping terms described below.',
    timing: 'Delivery times are estimates and normally depend on the destination, courier capacity, weather, holidays, and other operational conditions. The delivery estimate shown during checkout or communicated by GAZI SEED is the applicable estimate for your order.',
    note: 'Some remote, hard-to-reach, restricted, or exceptional delivery locations may require additional time or a different delivery arrangement. If a special delivery charge applies, it will be communicated before fulfillment where reasonably possible.',
  },
  IN: {
    market: 'India', currency: 'Indian Rupees (INR)', territory: 'India',
    intro: 'This Shipping Policy explains how GAZI SEED India prepares, dispatches, and delivers orders placed through the India branch of our website. By placing an order, you agree to the shipping terms described below.',
    timing: 'For general guidance, Metro and City destinations may take approximately 2–4 business days, while other serviceable areas may take approximately 4–7 business days. Actual delivery can vary based on the destination, courier capacity, weather, holidays, public events, and other operational conditions.',
    note: 'Some remote, hard-to-reach, restricted, or exceptional delivery locations may require additional time or a different delivery arrangement. If a special delivery charge applies, it will be communicated before fulfillment where reasonably possible.',
  },
} as const;

function PageShell({ market, title, lastUpdated, children }: { market: string; title: string; lastUpdated: string; children: React.ReactNode }) {
  return (
    <div className="container-custom py-8 sm:py-12">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-3xl border bg-background shadow-sm">
        <div className="border-b bg-muted/40 px-5 py-7 sm:px-10 sm:py-9">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">GAZI SEED • {market} Branch</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>
        <div className="space-y-8 px-5 py-7 text-[15px] leading-7 text-muted-foreground sm:px-10 sm:py-10">{children}</div>
      </article>
    </div>
  );
}

function PrivacyPolicy({ country }: { country: 'BD' | 'IN' }) {
  const copy = POLICY_COPY[country];
  return (
    <PageShell market={copy.market} title={copy.title} lastUpdated="September 9, 2026">
      <p>{copy.intro}</p>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">1. Information We Collect</h2><p>Depending on how you use GAZI SEED, we may collect information such as your name, phone number, email address, delivery address, account details, order history, payment-related information, and messages or support requests that you send to us.</p><p className="mt-3">We may also collect technical information such as device type, browser type, approximate location, IP address, pages viewed, referring pages, and similar website activity data when needed for security, analytics, and site performance.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">2. How We Use Your Information</h2><p>We use information to create and manage accounts, process and deliver orders, provide customer support, confirm transactions, maintain website security, prevent misuse or fraud, improve products and services, operate referral or loyalty features, and send service-related communications.</p><p className="mt-3">Where permitted by applicable law, we may also use information for relevant marketing or promotional communications. You may contact us about marketing preferences.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">3. Orders, Payments and Delivery</h2><p>When you place an order, we use the information necessary to verify the order, prepare the shipment, communicate with you, and complete {copy.delivery}. Prices and transactions for this branch are handled in {copy.currency}.</p><p className="mt-3">{copy.payment}</p><p className="mt-3">We do not need your full card credentials to process an order when a third-party payment provider handles the payment. Payment providers may process information under their own privacy terms.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">4. Cookies and Similar Technologies</h2><p>We may use cookies, local storage, pixels, and similar technologies to remember preferences, maintain sessions, understand website usage, improve performance, support analytics, and operate relevant site features. Some technologies may be provided by third-party services used by the website.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">5. Sharing of Information</h2><p>We may share information only as reasonably necessary to operate the service. This can include delivery and logistics partners, payment providers, hosting and technology providers, analytics or communication services, customer-support systems, professional advisers, or authorities where disclosure is required by law.</p><p className="mt-3">We do not sell your personal information as a standalone product.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">6. Data Security</h2><p>We use reasonable technical and organizational measures intended to protect information against unauthorized access, loss, misuse, alteration, or disclosure. No website or internet transmission can be guaranteed to be completely secure.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">7. Data Retention</h2><p>We retain information for as long as reasonably necessary for the purposes described in this Policy, including fulfilling orders, maintaining business records, resolving disputes, preventing fraud, meeting legal obligations, and enforcing our agreements.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">8. Your Choices and Rights</h2><p>Depending on applicable law and your circumstances, you may have rights concerning access, correction, deletion, restriction, objection, portability, withdrawal of consent, or other privacy choices. Requests may be subject to identity verification and legal limitations.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">9. Children’s Privacy</h2><p>Our services are intended for general customers and are not designed to knowingly collect personal information from children without appropriate permission. Please contact us if you believe a child has provided personal information through the site.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">10. Third-Party Services and Links</h2><p>Our website may use or link to third-party services. Their privacy practices are governed by their own policies, and we are not responsible for the privacy practices of independent third parties.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">11. Changes to This Policy</h2><p>We may update this Privacy Policy from time to time to reflect changes in our services, technology, or applicable requirements. The latest version will be published on this page with an updated date.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">12. Contact Us</h2><p>For privacy questions, account-data requests, or concerns about how your information is handled, please contact GAZI SEED through the contact and support channels provided on the website for the {copy.market} branch.</p></section>
      <div className="rounded-2xl border bg-muted/30 p-5 text-sm text-foreground"><p className="font-semibold">Branch-specific note</p><p className="mt-2 text-muted-foreground">This version is intended for customers using the GAZI SEED {copy.market} branch. Branch-specific pricing, delivery, payment, account, and operational processes may differ between Bangladesh and India.</p></div>
    </PageShell>
  );
}

function TermsConditions({ country }: { country: 'BD' | 'IN' }) {
  const copy = TERMS_COPY[country];
  return (
    <PageShell market={copy.market} title="Terms & Conditions" lastUpdated="September 9, 2026">
      <p>{copy.intro}</p>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">1. About GAZI SEED</h2><p>GAZI SEED provides seeds, plants, gardening, and agricultural products through its online services. Product information, photographs, prices, stock availability, and other details may be updated from time to time.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">2. Accounts</h2><p>You are responsible for providing accurate information and keeping your account credentials secure. You should promptly update information that is no longer accurate and notify us if you believe your account has been used without authorization.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">3. Products and Availability</h2><p>We aim to keep product descriptions, images, specifications, prices, and stock information accurate. However, minor differences may occur, and availability can change without prior notice. We may limit quantities, refuse an order, or cancel an order where necessary, including in cases of stock errors, pricing errors, suspected misuse, or operational limitations.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">4. Orders and Acceptance</h2><p>Submitting an order is a request to purchase. An order becomes accepted when GAZI SEED confirms it through the available communication or order-processing system. We may contact you to verify order details before fulfillment.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">5. Pricing and Payment</h2><p>Prices for the {copy.market} branch are displayed in {copy.currency}. Available payment methods may include {copy.payment}. Any applicable delivery fees, discounts, offers, or charges will be shown during the order process where supported.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">6. Delivery</h2><p>We arrange delivery to eligible addresses {copy.delivery}. Delivery times are estimates and may be affected by courier capacity, weather, holidays, public events, address issues, or other circumstances outside our reasonable control. Customers should provide a complete and reachable delivery address and contact number.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">7. Returns, Refunds and Cancellations</h2><p>Returns, refunds, exchanges, and cancellations are subject to the applicable GAZI SEED policies for the relevant branch, product type, order status, and applicable law. Certain products may have special conditions for hygiene, perishability, planting suitability, or other operational reasons. Please review the relevant policy before requesting a return or refund.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">8. Seeds, Plants and Growing Results</h2><p>Seed germination, plant growth, yield, color, size, harvest time, and other natural outcomes can vary due to climate, soil, cultivation practices, storage, season, and other conditions. Product information is provided as guidance and does not guarantee a specific growing result.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">9. Referral, Rewards and Promotions</h2><p>Referral programs, rewards, coupons, promotions, gifts, and special offers may have separate eligibility rules, limits, expiry dates, or anti-abuse conditions. GAZI SEED may suspend or refuse benefits where activity appears fraudulent, abusive, duplicated, or inconsistent with the applicable offer terms.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">10. Prohibited Use</h2><p>You must not use the website for unlawful activity, fraud, abuse, automated misuse, interference with site security, unauthorized access, copying of protected material, or any activity that harms customers, GAZI SEED, or its service providers.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">11. Intellectual Property</h2><p>Website content, branding, logos, designs, text, images, videos, software, and other materials are owned by or used with permission by GAZI SEED and may not be reproduced, modified, distributed, or commercially reused without appropriate authorization.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">12. Third-Party Services</h2><p>The website may rely on independent providers for payment, hosting, analytics, delivery, communication, authentication, or other services. Those providers may operate under their own terms and privacy policies.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">13. Limitation of Liability</h2><p>To the extent permitted by applicable law, GAZI SEED is not responsible for indirect or consequential losses arising from use of the website, temporary unavailability, third-party service interruptions, courier delays, or natural variations in agricultural products and growing results.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">14. Changes to These Terms</h2><p>We may update these Terms & Conditions from time to time. The latest version will be published on this page with an updated date. Continued use of the service after an update may constitute acceptance of the revised terms to the extent permitted by law.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">15. Contact Us</h2><p>For questions about orders, accounts, delivery, cancellations, refunds, or these terms, please use the contact and support channels provided on the GAZI SEED website for the {copy.market} branch.</p></section>
      <div className="rounded-2xl border bg-muted/30 p-5 text-sm text-foreground"><p className="font-semibold">Branch-specific note</p><p className="mt-2 text-muted-foreground">This version is intended for customers using the GAZI SEED {copy.market} branch. Branch-specific pricing, delivery, payment, account, and operational processes may differ between Bangladesh and India.</p></div>
    </PageShell>
  );
}

function ShippingPolicy({ country }: { country: 'BD' | 'IN' }) {
  const copy = SHIPPING_COPY[country];
  return (
    <PageShell market={copy.market} title="Shipping Policy" lastUpdated="September 9, 2026">
      <p>{copy.intro}</p>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">1. Delivery Coverage</h2><p>We deliver to serviceable addresses within {copy.territory}. Delivery availability depends on courier coverage, the destination address, product availability, and any branch-specific operational restrictions.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">2. Processing Time</h2><p>Orders are normally reviewed and prepared after confirmation. Processing time may vary depending on stock availability, order verification, product type, holidays, and operational conditions.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">3. Estimated Delivery Time</h2><p>{copy.timing}</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">4. Shipping Charges</h2><p>Shipping charges are calculated according to the applicable delivery rules for your branch, order value, destination, and offer eligibility. Any applicable charge is shown during checkout or communicated with the order. Charges are handled in {copy.currency}.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">5. Order Tracking</h2><p>Where tracking is available, GAZI SEED may provide an order or tracking reference through the website, account area, SMS, email, WhatsApp, phone, or other available communication channel.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">6. Delivery Requirements</h2><p>Customers should provide a complete delivery address, reachable phone number, and any useful landmark or location information. Someone authorized should be available to receive the order when required by the courier or delivery partner.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">7. Delays and Exceptional Circumstances</h2><p>{copy.note} Delivery may also be delayed by severe weather, natural events, public disruptions, courier issues, incomplete addresses, failed delivery attempts, security restrictions, or events outside GAZI SEED’s reasonable control.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">8. Failed Delivery</h2><p>If delivery cannot be completed because the address is incomplete or unreachable, the customer is unavailable, or repeated delivery attempts fail, the order may be returned, rescheduled, or cancelled according to the applicable operational policy. Additional charges may apply where permitted and communicated.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">9. Damaged or Incorrect Delivery</h2><p>Please inspect the package when reasonably possible. If an order arrives damaged, incomplete, or materially different from what was ordered, contact GAZI SEED through the available support channels as soon as possible and provide the order reference and relevant details or photographs where requested.</p></section>
      <section><h2 className="mb-3 text-xl font-semibold text-foreground">10. Contact Us</h2><p>For shipping questions, delivery updates, or issues with an order, please use the contact and support channels provided on the GAZI SEED website for the {copy.market} branch.</p></section>
      <div className="rounded-2xl border bg-muted/30 p-5 text-sm text-foreground"><p className="font-semibold">Branch-specific note</p><p className="mt-2 text-muted-foreground">Shipping charges, delivery windows, courier availability, and service areas may differ between the Bangladesh and India branches.</p></div>
    </PageShell>
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
    if (slug === 'privacy-policy' || slug === 'terms-conditions' || slug === 'shipping-policy') {
      setLoading(false);
      return;
    }
    setLoading(true);
    getPageBySlug(slug).then((p) => {
      setPage(p);
      setLoading(false);
    });
  }, [slug]);

  if (slug === 'privacy-policy') return <PrivacyPolicy country={country} />;
  if (slug === 'terms-conditions') return <TermsConditions country={country} />;
  if (slug === 'shipping-policy') return <ShippingPolicy country={country} />;

  if (loading) return <div className="container-custom py-12"><div className="h-64 animate-pulse rounded-2xl bg-secondary" /></div>;
  if (!page) return <div className="container-custom py-12 text-center"><h1 className="text-2xl font-bold">পেজ পাওয়া যায়নি</h1><a href="/" className="mt-4 inline-block text-primary hover:underline">হোমে ফিরুন</a></div>;

  return <div className="container-custom py-6"><div className="mx-auto max-w-3xl"><h1 className="mb-6 text-2xl font-bold sm:text-3xl">{page.title}</h1><div className="whitespace-pre-line text-muted-foreground">{page.content}</div></div></div>;
}
