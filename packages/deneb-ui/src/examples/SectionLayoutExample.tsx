import React, { useState } from 'react';
import { EditableSection } from '../EditableSection';
import { EditableText } from '../EditableText';

/**
 * Example demonstrating how to use Deneb UI's `<EditableSection>`
 * with full visual-editing annotations, 1-click centering, and hiding/deletion controls.
 */
export function SectionLayoutExample() {
  const [isPromoHidden, setIsPromoHidden] = useState(false);
  const [heroAlign, setHeroAlign] = useState<'left' | 'center' | 'right'>('center');

  return (
    <div className="space-y-12 py-8">
      {/* 1. Hero Section — Centered with container */}
      <EditableSection
        name="hero"
        align={heroAlign}
        container={true}
        className="py-16 px-6 bg-gradient-to-b from-gray-50 to-white rounded-2xl"
      >
        <span className="text-xs uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
          Featured Collection 2026
        </span>
        <EditableText
          as="h1"
          fieldPath="hero.title"
          className="text-4xl md:text-5xl font-extrabold text-gray-900 mt-4 tracking-tight"
        >
          Curated Luxury & Tailored Aesthetics
        </EditableText>
        <EditableText
          as="p"
          fieldPath="hero.subtitle"
          className="text-lg text-gray-600 max-w-2xl mx-auto mt-3 leading-relaxed"
        >
          Experience handcrafted garments and jewelry engineered with organic textures,
          responsive layouts, and precision styling.
        </EditableText>
        <div className="mt-8 flex gap-4 justify-center">
          <button
            type="button"
            className="px-6 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition"
          >
            Explore Catalogue
          </button>
          <button
            type="button"
            onClick={() => setHeroAlign(current => current === 'center' ? 'left' : 'center')}
            className="px-4 py-3 bg-white text-gray-700 border border-gray-300 font-medium rounded-xl hover:bg-gray-50 transition text-sm"
          >
            Toggle Alignment ({heroAlign})
          </button>
        </div>
      </EditableSection>

      {/* 2. Promo Section — Demonstrating 1-Click Hide/Restore */}
      <EditableSection
        name="promotions"
        hidden={isPromoHidden}
        container={true}
        className="py-8 px-6 bg-amber-500 text-white rounded-2xl shadow-sm text-center"
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">Limited Seasonal Clearance</h3>
            <p className="text-amber-100 text-sm mt-1">
              Save up to 40% on selected cashmere and silk silhouettes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPromoHidden(true)}
            className="text-xs bg-white text-amber-900 font-semibold px-4 py-2 rounded-lg hover:bg-amber-100 transition"
            title="In visual editor, this sets display: 'none' via section blueprint"
          >
            Hide This Section (Test)
          </button>
        </div>
      </EditableSection>

      {isPromoHidden && (
        <div className="text-center py-4">
          <button
            type="button"
            onClick={() => setIsPromoHidden(false)}
            className="text-sm text-indigo-600 underline font-medium hover:text-indigo-800"
          >
            ↺ Restore Hidden Promotions Section
          </button>
        </div>
      )}

      {/* 3. Features Section — Standard Left-Aligned Section */}
      <EditableSection
        name="features"
        container={true}
        className="py-12 px-6"
      >
        <EditableText
          as="h2"
          fieldPath="features.heading"
          className="text-3xl font-bold text-gray-900 mb-8"
        >
          Why Choose Fivora Storefronts
        </EditableText>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 bg-gray-50 rounded-xl border border-gray-100">
            <h4 className="font-semibold text-lg text-gray-900">Live Visual Blueprint</h4>
            <p className="text-sm text-gray-600 mt-2">
              Every section is targetable by ID or section name for instant styling, reordering, and centering.
            </p>
          </div>
          <div className="p-6 bg-gray-50 rounded-xl border border-gray-100">
            <h4 className="font-semibold text-lg text-gray-900">Dual Pricing Engine</h4>
            <p className="text-sm text-gray-600 mt-2">
              Supports both fixed prices and dynamic variant-driven ranges with interactive color swatches.
            </p>
          </div>
          <div className="p-6 bg-gray-50 rounded-xl border border-gray-100">
            <h4 className="font-semibold text-lg text-gray-900">Zero-Config Static Export</h4>
            <p className="text-sm text-gray-600 mt-2">
              Pre-rendered HTML output with strict contract verification and blazing-fast mobile response.
            </p>
          </div>
        </div>
      </EditableSection>
    </div>
  );
}

export default SectionLayoutExample;
