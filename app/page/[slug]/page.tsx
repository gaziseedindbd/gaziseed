'use client';

import { useEffect, useState } from 'react';
import { getPageBySlug } from '@/lib/data';
import { getVisitorCountry } from '@/lib/supabase/client';
import type { Page as PageType } from '@/lib/supabase/types';
import { useParams } from 'next/navigation';

const POLICY_COPY = {
  BD: {
    market: 'Bangladesh',
    currency: 'Bangladeshi Taka (BDT)',
    contact: 'Bangladesh branch',
    deliveryWindow: 'the delivery address provided for Bangladesh orders',
  },
  IN: {
    market: 'India',
    currency: 'Indian Rupees (INR)',
    contact: 'India branch',
    deliveryWindow: 'the delivery address provided for India orders',
  },
} as const;

function ReturnRefundPolicy({ country }: { country: 'BD' | 'IN' }) {
  const copy = POLICY_COPY[country];
  const lastUpdated = 'September 9, 2026';

  return (
    <div className="container-custom py-8 sm:py-12">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-3xl border bg-background shadow-sm">
        <div className="border-b bg-muted/40 px-5 py-7 sm:px-10 sm:py-9">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">GAZI SEED • {copy.market} Branch</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Return & Refund Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-8 px-5 py-7 text-[15px] leading-7 text-muted-foreground sm:px-10 sm:py-10">
          <p>GAZI SEED aims to make every order accurate, safe, and satisfactory. This Return & Refund Policy explains how returns, exchanges, cancellations, and refunds are handled for customers using the GAZI SEED {copy.market} branch.</p>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">1. Order Cancellation</h2>
            <p>You may request cancellation before an order has been dispatched. Once an order has been handed to a delivery or logistics partner, cancellation may no longer be possible and the applicable return or refusal process may apply.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">2. Eligible Returns</h2>
            <p>We generally consider returns where an item is delivered damaged, materially different from what was ordered, incorrect, defective, or otherwise eligible under applicable law and our operational review.</p>
            <p className="mt-3">Because seeds and plants are agricultural products, returns may be subject to additional conditions based on product type, condition, storage, planting, perishability, and the time elapsed after delivery.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">3. Non-Returnable or Restricted Items</h2>
            <p>Items may be non-returnable where return handling could affect product safety, hygiene, quality, viability, or resale condition. Used, opened, planted, mishandled, altered, or improperly stored products may not qualify for return unless the issue is covered by an applicable defect, damage, or consumer protection requirement.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">4. Damaged or Incorrect Delivery</h2>
            <p>Please inspect your package as soon as reasonably possible after delivery. For a damaged, missing, or incorrect item, contact the {copy.contact} promptly and provide the order number plus clear photos or other evidence when requested.</p>
            <p className="mt-3">We may review delivery records, package condition, product details, and supporting evidence before approving a replacement or refund.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">5. Return Request Process</h2>
            <p>To request a return or refund, provide your order number, the product concerned, the reason for the request, and any requested photos or supporting information. Approved returns must be sent or handed over using the method and timeframe communicated by GAZI SEED.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">6. Refunds</h2>
            <p>Where a refund is approved, the refund amount may cover the eligible product amount and other amounts that are required to be refunded under the circumstances and applicable law. Delivery or return charges may be treated separately depending on the reason for the return.</p>
            <p className="mt-3">Refunds are generally processed using the original or an appropriate supported payment method. The timing may vary depending on the payment provider, bank, wallet, or other financial service used.</p>
            <p className="mt-3">Transactions for the {copy.market} branch are handled in {copy.currency} unless otherwise stated.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">7. Cash on Delivery Orders</h2>
            <p>For Cash on Delivery orders that have not yet been paid, an approved return may be handled without a refund transfer where no payment was collected. Where payment has already been collected through a supported method, the applicable refund process will be followed.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">8. Product Quality, Seeds and Germination</h2>
            <p>Seeds and plants are living or agricultural products, and performance can be affected by storage, temperature, moisture, soil, climate, cultivation methods, pests, disease, season, and other environmental factors. A lower-than-expected germination or growth result does not automatically establish that a product was defective.</p>
            <p className="mt-3">Where a quality concern is reported, GAZI SEED may request batch details, photos, cultivation information, storage information, or other evidence needed for assessment.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">9. Replacement</h2>
            <p>Where appropriate, GAZI SEED may offer a replacement instead of a refund, especially for an incorrect, damaged, or defective item. Replacement availability depends on current stock and operational feasibility.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">10. Return Shipping</h2>
            <p>Where the return is approved because of an error or qualifying issue attributable to GAZI SEED or a delivery process, we may arrange or cover the applicable return cost. For other approved returns, return shipping may be the customer’s responsibility where permitted by applicable law and the specific return terms.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">11. Fraud and Abuse</h2>
            <p>We may decline or review requests that appear fraudulent, abusive, repetitive without a valid basis, inconsistent with order records, or intended to misuse refunds, replacements, promotions, or other customer benefits.</p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold text-foreground">12. Contact Us</h2>
            <p>For a return, refund, cancellation, or replacement request, contact the GAZI SEED {copy.contact} through the support channels provided on the website. Please keep your order number and relevant evidence available so the request can be reviewed efficiently.</p>
          </section>

          <div className="rounded-2xl border bg-muted/30 p-5 text-sm text-foreground">
            <p className="font-semibold">Branch-specific note</p>
            <p className="mt-2 text-muted-foreground">This version is intended for the GAZI SEED {copy.market} branch. Return eligibility, refund timing, delivery charges, payment methods, and related procedures may differ between Bangladesh and India and remain subject to applicable law.</p>
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
    if (slug === 'privacy-policy' || slug === 'terms-conditions' || slug === 'return-refund-policy') {
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
  if (slug === 'return-refund-policy') return <ReturnRefundPolicy country={country} />;

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

function PrivacyPolicy({ country }: { country: 'BD' | 'IN' }) {
  const copy = {
    BD: { market: 'Bangladesh', title: 'Privacy Policy', intro: 'GAZI SEED Bangladesh (“GAZI SEED”, “we”, “our”, or “us”) respects your privacy. This Privacy Policy explains how we collect, use, store, and protect information when you use our Bangladesh website, place an order, create an account, contact us, or otherwise interact with our services.', currency: 'Bangladeshi Taka (BDT)', delivery: 'deliveries and services within Bangladesh', payment: 'Payments may be processed through the payment methods made available for Bangladesh customers, including Cash on Delivery and other supported online payment options.' },
    IN: { market: 'India', title: 'Privacy Policy', intro: 'GAZI SEED India (“GAZI SEED”, “we”, “our”, or “us”) respects your privacy. This Privacy Policy explains how we collect, use, store, and protect information when you use our India website, place an order, create an account, contact us, or otherwise interact with our services.', currency: 'Indian Rupees (INR)', delivery: 'deliveries and services within India', payment: 'Payments may be processed through the payment methods made available for India customers, including UPI, supported wallets, cards, Cash on Delivery, and other available payment options.' },
  } as const;
  const c = copy[country];
  const lastUpdated = 'September 9, 2026';
  return <div className="container-custom py-8 sm:py-12"><article className="mx-auto max-w-4xl overflow-hidden rounded-3xl border bg-background shadow-sm"><div className="border-b bg-muted/40 px-5 py-7 sm:px-10 sm:py-9"><p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">GAZI SEED • {c.market} Branch</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{c.title}</h1><p className="mt-3 text-sm text-muted-foreground">Last updated: {lastUpdated}</p></div><div className="space-y-8 px-5 py-7 text-[15px] leading-7 text-muted-foreground sm:px-10 sm:py-10"><p>{c.intro}</p><section><h2 className="mb-3 text-xl font-semibold text-foreground">1. Information We Collect</h2><p>Depending on how you use GAZI SEED, we may collect information such as your name, phone number, email address, delivery address, account details, order history, payment-related information, and messages or support requests that you send to us.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">2. How We Use Your Information</h2><p>We use information to create and manage accounts, process and deliver orders, provide customer support, confirm transactions, maintain website security, prevent misuse or fraud, improve products and services, operate referral or loyalty features, and send service-related communications.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">3. Orders, Payments and Delivery</h2><p>When you place an order, we use information necessary to verify the order, prepare the shipment, communicate with you, and complete {c.delivery}. Prices and transactions for this branch are handled in {c.currency}.</p><p className="mt-3">{c.payment}</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">4. Cookies and Similar Technologies</h2><p>We may use cookies, local storage, pixels, and similar technologies to remember preferences, maintain sessions, understand website usage, improve performance, support analytics, and operate relevant site features.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">5. Sharing of Information</h2><p>We may share information only as reasonably necessary to operate the service, including with delivery and logistics partners, payment providers, hosting and technology providers, analytics or communication services, customer-support systems, professional advisers, or authorities where disclosure is required by law.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">6. Data Security</h2><p>We use reasonable technical and organizational measures intended to protect information against unauthorized access, loss, misuse, alteration, or disclosure.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">7. Data Retention</h2><p>We retain information for as long as reasonably necessary for the purposes described in this Policy, including fulfilling orders, maintaining records, resolving disputes, preventing fraud, meeting legal obligations, and enforcing agreements.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">8. Your Choices and Rights</h2><p>Depending on applicable law and your circumstances, you may have rights concerning access, correction, deletion, restriction, objection, portability, withdrawal of consent, or other privacy choices.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">9. Children’s Privacy</h2><p>Our services are not designed to knowingly collect personal information from children without appropriate permission.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">10. Third-Party Services and Links</h2><p>Our website may use or link to third-party services. Their privacy practices are governed by their own policies.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">11. Changes to This Policy</h2><p>We may update this Privacy Policy from time to time. The latest version will be published on this page with an updated date.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">12. Contact Us</h2><p>For privacy questions or data requests, please contact GAZI SEED through the contact and support channels provided on the website for the {c.market} branch.</p></section></div></article></div>;
}

function TermsConditions({ country }: { country: 'BD' | 'IN' }) {
  const copy = {
    BD: { market: 'Bangladesh', intro: 'These Terms & Conditions govern your use of the GAZI SEED Bangladesh website, account, purchases, and related services. By using the website or placing an order, you agree to these terms.', currency: 'Bangladeshi Taka (BDT)', delivery: 'within Bangladesh', payment: 'Cash on Delivery and other payment methods made available to Bangladesh customers' },
    IN: { market: 'India', intro: 'These Terms & Conditions govern your use of the GAZI SEED India website, account, purchases, and related services. By using the website or placing an order, you agree to these terms.', currency: 'Indian Rupees (INR)', delivery: 'within India', payment: 'UPI, supported wallets, cards, Cash on Delivery, and other payment methods made available to India customers' },
  } as const;
  const c = copy[country];
  const lastUpdated = 'September 9, 2026';
  return <div className="container-custom py-8 sm:py-12"><article className="mx-auto max-w-4xl overflow-hidden rounded-3xl border bg-background shadow-sm"><div className="border-b bg-muted/40 px-5 py-7 sm:px-10 sm:py-9"><p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-primary">GAZI SEED • {c.market} Branch</p><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Terms & Conditions</h1><p className="mt-3 text-sm text-muted-foreground">Last updated: {lastUpdated}</p></div><div className="space-y-8 px-5 py-7 text-[15px] leading-7 text-muted-foreground sm:px-10 sm:py-10"><p>{c.intro}</p><section><h2 className="mb-3 text-xl font-semibold text-foreground">1. About GAZI SEED</h2><p>GAZI SEED provides seeds, plants, gardening, and agricultural products through its online services. Product information, photographs, prices, stock availability, and other details may be updated from time to time.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">2. Accounts</h2><p>You are responsible for providing accurate information and keeping your account credentials secure.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">3. Products and Availability</h2><p>We aim to keep product descriptions, images, specifications, prices, and stock information accurate. Availability can change without prior notice.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">4. Orders and Acceptance</h2><p>Submitting an order is a request to purchase. An order becomes accepted when GAZI SEED confirms it through the available order-processing system.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">5. Pricing and Payment</h2><p>Prices for the {c.market} branch are displayed in {c.currency}. Available payment methods may include {c.payment}.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">6. Delivery</h2><p>We arrange delivery to eligible addresses {c.delivery}. Delivery times are estimates and may be affected by courier capacity, weather, holidays, address issues, or other circumstances.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">7. Returns, Refunds and Cancellations</h2><p>Returns, refunds, exchanges, and cancellations are subject to the applicable GAZI SEED Return & Refund Policy for the relevant branch, product type, order status, and applicable law.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">8. Seeds, Plants and Growing Results</h2><p>Seed germination, plant growth, yield, color, size, harvest time, and other natural outcomes can vary due to climate, soil, cultivation practices, storage, season, and other conditions.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">9. Referral, Rewards and Promotions</h2><p>Referral programs, rewards, coupons, promotions, gifts, and special offers may have separate eligibility rules, limits, expiry dates, or anti-abuse conditions.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">10. Prohibited Use</h2><p>You must not use the website for unlawful activity, fraud, abuse, automated misuse, interference with site security, or unauthorized access.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">11. Intellectual Property</h2><p>Website content, branding, logos, designs, text, images, videos, software, and other materials are owned by or used with permission by GAZI SEED.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">12. Third-Party Services</h2><p>The website may rely on independent providers for payment, hosting, analytics, delivery, communication, authentication, or other services.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">13. Limitation of Liability</h2><p>To the extent permitted by applicable law, GAZI SEED is not responsible for indirect or consequential losses arising from website use, third-party service interruptions, courier delays, or natural variations in agricultural products.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">14. Changes to These Terms</h2><p>We may update these Terms & Conditions from time to time. The latest version will be published on this page with an updated date.</p></section><section><h2 className="mb-3 text-xl font-semibold text-foreground">15. Contact Us</h2><p>For questions about orders, accounts, delivery, cancellations, refunds, or these terms, please use the contact and support channels provided on the GAZI SEED website for the {c.market} branch.</p></section></div></article></div>;
}
