import React from 'react';
import { EditableSection } from '../EditableSection';
import { EditableText } from '../EditableText';
import { EditableProductGrid } from '../EditableProductGrid';
import { EditableCustomerReviews } from '../EditableCustomerReviews';
import { EditableFAQAccordion } from '../EditableFAQAccordion';
import { TrustBadges } from '../TrustBadges';

/**
 * Complete Storefront Page Template Example.
 *
 * Demonstrates a fully modular, production-ready Fivora storefront layout where:
 * 1. Every top-level block is wrapped in an `<EditableSection>` with `name`, `data-design-section`, and `data-section-id`.
 * 2. Visual layout controls (center alignment, hide/delete section, background styling) work natively.
 * 3. Products seamlessly handle both single fixed pricing and dynamic variant ranges with interactive apparel swatches.
 */
export function CompleteStorefrontExample() {
  const sampleProducts = [
    {
      id: 'prod-1',
      name: 'Structured Linen Overshirt',
      minPrice: 3200,
      maxPrice: 4600,
      priceRange: 'LKR 3,200 – LKR 4,600',
      isPriceRange: true,
      currency: 'LKR',
      imageUrl: '/images/linen-shirt.jpg',
      badge: 'Bestseller',
      colors: [
        { name: 'Oatmeal', hex: '#e2d9cc', imageUrl: '/images/linen-shirt.jpg' },
        { name: 'Forest Green', hex: '#2d4739', imageUrl: '/images/linen-shirt-green.jpg' },
      ],
      sizes: ['S', 'M', 'L', 'XL'],
    },
    {
      id: 'prod-2',
      name: 'Minimalist Silver Bangle',
      price: 5200,
      compareAtPrice: 6500,
      currency: 'LKR',
      imageUrl: '/images/silver-bangle.jpg',
      badge: '925 Sterling',
    },
    {
      id: 'prod-3',
      name: 'Pleated Silk Scarf',
      minPrice: 1900,
      maxPrice: 2800,
      priceRange: 'LKR 1,900 – LKR 2,800',
      isPriceRange: true,
      currency: 'LKR',
      imageUrl: '/images/silk-scarf.jpg',
      colors: [
        { name: 'Crimson', hex: '#991b1b', imageUrl: '/images/silk-scarf.jpg' },
        { name: 'Goldenrod', hex: '#d97706', imageUrl: '/images/silk-scarf-gold.jpg' },
      ],
      sizes: ['Standard', 'Oversized'],
    },
  ];

  const sampleReviews = [
    {
      id: 'rev-1',
      author: 'Dilshan Perera',
      rating: 5,
      comment: 'Exceptional linen quality and fast delivery. The color swatch matched reality perfectly.',
      date: '2 days ago',
    },
    {
      id: 'rev-2',
      author: 'Ananya Sharma',
      rating: 5,
      comment: 'Super easy WhatsApp ordering process! Customer support replied within minutes.',
      date: '1 week ago',
    },
  ];

  const sampleFaqs = [
    {
      id: 'faq-1',
      question: 'How do clothing size options and price ranges work?',
      answer: 'Items with multiple materials or sizes display our transparent price range. Selecting your color swatch and size chip will immediately resolve the exact checkout price.',
    },
    {
      id: 'faq-2',
      question: 'Can I hide or reorder sections in the visual editor?',
      answer: 'Yes! Every section in this template is annotated with data-design-section. Shop owners can center content, change colors, or hide unwanted sections with 1-click in the visual editor.',
    },
    {
      id: 'faq-3',
      question: 'What delivery options are supported?',
      answer: 'We support island-wide tracked door-to-door courier delivery and prompt Cash-on-Delivery payment options.',
    },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* ─── 1. Announcement Bar ─── */}
      <EditableSection
        name="announcement-bar"
        container={true}
        className="bg-indigo-900 text-white text-xs py-2 px-4 text-center font-medium"
      >
        <span>Complimentary islandwide delivery on all orders above LKR 10,000</span>
      </EditableSection>

      {/* ─── 2. Hero Section ─── */}
      <EditableSection
        name="hero"
        align="center"
        container={true}
        className="py-20 px-6 bg-gradient-to-b from-indigo-50/50 via-white to-white"
      >
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-xs uppercase font-bold tracking-widest text-indigo-600 bg-indigo-100/80 px-3 py-1 rounded-full">
            Modern Ceylon Atelier
          </span>
          <EditableText
            as="h1"
            fieldPath="hero.title"
            className="text-4xl sm:text-6xl font-extrabold text-gray-950 mt-5 tracking-tight leading-tight"
          >
            Timeless Apparel & Handcrafted Essentials
          </EditableText>
          <EditableText
            as="p"
            fieldPath="hero.subtitle"
            className="text-base sm:text-lg text-gray-600 mt-4 max-w-xl mx-auto leading-relaxed"
          >
            Designed with natural fibers, organic silhouettes, and responsive interactive previewing.
          </EditableText>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="#products"
              className="px-6 py-3.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 shadow-sm transition"
            >
              Shop New Arrivals
            </a>
            <a
              href="#reviews"
              className="px-6 py-3.5 bg-white text-gray-700 border border-gray-200 font-semibold rounded-xl hover:bg-gray-50 transition"
            >
              Read Customer Stories
            </a>
          </div>
        </div>
      </EditableSection>

      {/* ─── 3. Trust Badges ─── */}
      <EditableSection
        name="trust-badges"
        container={true}
        className="border-y border-gray-100 bg-gray-50/60 py-6 px-6"
      >
        <TrustBadges />
      </EditableSection>

      {/* ─── 4. Featured Products (Dual Pricing + Swatches) ─── */}
      <EditableSection
        name="products"
        id="products"
        container={true}
        className="py-20 px-6"
      >
        <EditableProductGrid
          products={sampleProducts}
          title="Curated Seasonal Essentials"
          subtitle="Explore garments with dynamic variant pricing, interactive color swatches, and instant WhatsApp checkout."
          listPath="products"
          whatsappPhone="+94771234567"
          currency="LKR"
        />
      </EditableSection>

      {/* ─── 5. Customer Reviews ─── */}
      <EditableSection
        name="customer-reviews"
        id="reviews"
        container={true}
        className="py-16 px-6 bg-gray-50/70 rounded-3xl my-8 mx-auto max-w-7xl"
      >
        <EditableCustomerReviews
          reviews={sampleReviews}
          title="Loved by Discerning Shoppers"
          subtitle="Verified feedback from boutique buyers across Colombo, Kandy, and Galle."
          listPath="reviews"
        />
      </EditableSection>

      {/* ─── 6. Frequently Asked Questions ─── */}
      <EditableSection
        name="faq"
        container={true}
        className="py-16 px-6 max-w-4xl mx-auto"
      >
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900">Frequently Asked Questions</h2>
          <p className="text-gray-500 text-sm mt-2">Everything you need to know about our products and order process.</p>
        </div>
        <EditableFAQAccordion
          faqs={sampleFaqs}
          listPath="faqs"
        />
      </EditableSection>

      {/* ─── 7. Footer ─── */}
      <EditableSection
        name="footer"
        container={true}
        className="border-t border-gray-200 bg-gray-950 text-gray-400 py-12 px-6"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-sm">
          <p>© 2026 Fivora Atelier Storefront. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition">Privacy Policy</a>
            <a href="#" className="hover:text-white transition">Terms of Service</a>
            <a href="#products" className="hover:text-white transition">Shop All</a>
          </div>
        </div>
      </EditableSection>
    </div>
  );
}

export default CompleteStorefrontExample;
