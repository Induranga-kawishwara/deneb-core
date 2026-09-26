import React from 'react';
import { EditableSection } from '../EditableSection';
import { EditableProductCard } from '../EditableProductCard';

/**
 * Example demonstrating Deneb UI's Dual Product Pricing & Apparel Variants:
 * 1. Single Fixed Price products (e.g. Handcrafted Leather Wallet).
 * 2. Dynamic Price Range products (e.g. Linen Shirt with multiple tier options).
 * 3. Interactive Color Swatches with instant photo-switching and size chips.
 */
export function ProductPricingExample() {
  const sampleProducts = [
    {
      id: 'prod-fixed-1',
      name: 'Artisan Leather Cardholder',
      description: 'Hand-stitched full-grain Italian leather with RFID protection.',
      price: 3800,
      compareAtPrice: 4500,
      currency: 'LKR',
      imageUrl: '/images/leather-cardholder.jpg',
      badge: 'Best Seller',
      stock: 15,
    },
    {
      id: 'prod-apparel-range-2',
      name: 'Relaxed Linen Resort Shirt',
      description: 'Pure organic French linen with pearl buttons. Available in 3 earth tones.',
      minPrice: 2800,
      maxPrice: 4800,
      priceRange: 'LKR 2,800 – LKR 4,800',
      isPriceRange: true,
      currency: 'LKR',
      imageUrl: '/images/linen-navy.jpg',
      badge: 'New Season',
      colors: [
        {
          name: 'Midnight Navy',
          hex: '#0f2942',
          imageUrl: '/images/linen-navy.jpg',
        },
        {
          name: 'Olive Sage',
          hex: '#4d6840',
          imageUrl: '/images/linen-olive.jpg',
        },
        {
          name: 'Terracotta Sand',
          hex: '#c26d4f',
          imageUrl: '/images/linen-terracotta.jpg',
        },
      ],
      sizes: ['S', 'M', 'L', 'XL'],
      variants: [
        { color: 'Midnight Navy', size: 'S', price: 2800 },
        { color: 'Midnight Navy', size: 'M', price: 2800 },
        { color: 'Midnight Navy', size: 'L', price: 3200 },
        { color: 'Midnight Navy', size: 'XL', price: 3500 },
        { color: 'Olive Sage', size: 'S', price: 3800 },
        { color: 'Olive Sage', size: 'M', price: 3800 },
        { color: 'Olive Sage', size: 'L', price: 4200 },
        { color: 'Terracotta Sand', size: 'M', price: 4500 },
        { color: 'Terracotta Sand', size: 'XL', price: 4800 },
      ],
    },
    {
      id: 'prod-apparel-range-3',
      name: 'Merino Wool Knit Cardigan',
      description: 'Ultra-soft extrafine Australian merino wool with ribbed cuffs.',
      minPrice: 6500,
      maxPrice: 8500,
      priceRange: 'LKR 6,500 – LKR 8,500',
      isPriceRange: true,
      currency: 'LKR',
      imageUrl: '/images/knit-charcoal.jpg',
      colors: [
        {
          name: 'Charcoal Grey',
          hex: '#334155',
          imageUrl: '/images/knit-charcoal.jpg',
        },
        {
          name: 'Cream Oatmeal',
          hex: '#f1f5f9',
          imageUrl: '/images/knit-cream.jpg',
        },
      ],
      sizes: ['M', 'L', 'XL'],
      variants: [
        { color: 'Charcoal Grey', size: 'M', price: 6500 },
        { color: 'Charcoal Grey', size: 'L', price: 7200 },
        { color: 'Cream Oatmeal', size: 'L', price: 8500 },
      ],
    },
  ];

  return (
    <EditableSection
      name="products"
      container={true}
      className="py-16 px-6"
    >
      <div className="text-center max-w-xl mx-auto mb-12">
        <span className="text-xs uppercase font-bold tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
          Live Storefront Products
        </span>
        <h2 className="text-3xl font-extrabold text-gray-900 mt-3 tracking-tight">
          Crafted For Longevity & Style
        </h2>
        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
          Select apparel colors to dynamically update product photos, view variant prices,
          or configure orders via direct WhatsApp checkout.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {sampleProducts.map((product, index) => (
          <EditableProductCard
            key={product.id}
            item={product}
            itemPath={`products[${index}]`}
            whatsappPhone="+94771234567"
            currency="LKR"
            showOptions={true}
            allowInteractiveSwatches={true}
          />
        ))}
      </div>
    </EditableSection>
  );
}

export default ProductPricingExample;
