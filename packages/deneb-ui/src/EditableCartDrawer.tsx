'use client';

import React, { useEffect } from 'react';
import { useCart, CartItem, formatCurrency } from './cart/useCart';
import { useSiteData } from './SiteDataProvider';
import { withBasePath } from './utils/urls';

export interface EditableCartDrawerProps {
  basePath?: string;
  whatsappNumber?: string;
  storeName?: string;
  currency?: string;
  checkoutUrl?: string;
  freeShippingThreshold?: number;
  onCheckout?: (items: CartItem[], total: number) => void;
  className?: string;
}

export function EditableCartDrawer({
  basePath = 'cart',
  whatsappNumber = '94770000000',
  storeName,
  currency = 'LKR',
  checkoutUrl,
  freeShippingThreshold,
  onCheckout,
  className = '',
}: EditableCartDrawerProps) {
  const {
    items,
    isOpen,
    closeCart,
    removeItem,
    updateQuantity,
    clearCart,
    totalCount,
    subtotal,
    getWhatsAppOrderUrl,
  } = useCart();

  const { siteData } = useSiteData();

  // Helper to read content from siteData
  const getContent = (key: string, fallback: string) => {
    const section = (siteData as Record<string, any>)?.content?.[basePath];
    return (section?.[key] as string) || fallback;
  };

  const fieldPath = (key: string) => `${basePath}.${key}`;

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeCart]);

  // If closed, return null so hidden markers do not fail static compliance
  if (!isOpen) return null;

  const title = getContent('title', 'Shopping Cart');
  const subtitle = getContent('subtitle', `${totalCount} item${totalCount !== 1 ? 's' : ''} in your cart`);
  const emptyTitle = getContent('emptyTitle', 'Your cart is empty');
  const emptyMessage = getContent('emptyMessage', 'Discover our latest arrivals and add items to your bag.');
  const subtotalLabel = getContent('subtotalLabel', 'Subtotal');
  const shippingNote = getContent('shippingNote', 'Taxes and shipping calculated at checkout');
  const checkoutButtonText = getContent('checkoutButtonText', 'Proceed to Checkout');
  const whatsappButtonText = getContent('whatsappButtonText', 'Purchase through WhatsApp');
  const clearCartText = getContent('clearCartText', 'Clear all');

  const whatsappHref = getWhatsAppOrderUrl(whatsappNumber, {
    storeName,
    currency,
  });

  const progressPercent = freeShippingThreshold
    ? Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100))
    : 100;

  return (
    <div className={`deneb-cart-drawer-root fixed inset-0 z-50 flex justify-end ${className}`}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={closeCart}
        data-preview-static="cart-backdrop"
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <aside
        className="relative z-10 flex h-full w-full max-w-md flex-col bg-neutral-900 text-white shadow-2xl transition-transform duration-300 ease-out border-l border-neutral-800"
        aria-label="Shopping Cart Drawer"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-5">
          <div>
            <h2
              className="text-xl font-bold tracking-tight text-white"
              data-preview-field-path={fieldPath('title')}
            >
              {title}
            </h2>
            <p
              className="text-xs text-neutral-400 mt-0.5"
              data-preview-field-path={fieldPath('subtitle')}
            >
              {subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs text-neutral-400 hover:text-red-400 transition-colors px-2 py-1 rounded"
                data-preview-static="cart-clear-btn"
              >
                <span data-preview-field-path={fieldPath('clearCartText')}>
                  {clearCartText}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={closeCart}
              className="rounded-full p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
              data-preview-static="cart-close-btn"
              aria-label="Close cart"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Free Shipping Progress Bar (Optional) */}
        {freeShippingThreshold && (
          <div className="border-b border-neutral-800 bg-neutral-950/50 px-6 py-3">
            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
              <span>
                {subtotal >= freeShippingThreshold ? (
                  <span className="font-semibold text-emerald-400">🎉 You unlocked free shipping!</span>
                ) : (
                  <span>
                    Add <strong className="text-white">{currency}{(freeShippingThreshold - subtotal).toFixed(2)}</strong> more for free shipping
                  </span>
                )}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Items List / Empty State */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center py-12">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800 text-neutral-400">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3
                className="text-base font-semibold text-white"
                data-preview-field-path={fieldPath('emptyTitle')}
              >
                {emptyTitle}
              </h3>
              <p
                className="mt-1 text-sm text-neutral-400 max-w-xs"
                data-preview-field-path={fieldPath('emptyMessage')}
              >
                {emptyMessage}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-800" data-preview-list-path={fieldPath('items')}>
              {items.map((item, idx) => (
                <li
                  key={`${item.id}-${item.size || ''}-${item.color || ''}`}
                  className="flex gap-4 py-4"
                  data-preview-item-path={`${fieldPath('items')}[${idx}]`}
                >
                  {/* Thumbnail */}
                  {item.image ? (
                    <img
                      src={withBasePath(item.image)}
                      alt={item.name}
                      className="h-20 w-20 flex-shrink-0 rounded-lg object-cover bg-neutral-800 border border-neutral-700"
                      data-preview-static="cart-item-image"
                    />
                  ) : (
                    <div
                      className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-500 border border-neutral-700"
                      data-preview-static="cart-item-placeholder"
                    >
                      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <div className="flex justify-between">
                        <h4 className="text-sm font-medium text-white line-clamp-1">{item.name}</h4>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id, item.size, item.color)}
                          className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                          data-preview-static="cart-item-remove"
                          aria-label={`Remove ${item.name}`}
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      {/* Variant metadata */}
                      {(item.brand || item.size || item.color) && (
                        <p className="mt-0.5 text-xs text-neutral-400">
                          {item.brand && <span className="text-emerald-400 font-semibold">{item.brand}</span>}
                          {item.brand && (item.size || item.color) && ' · '}
                          {item.size && `Size: ${item.size}`}
                          {item.size && item.color && ' · '}
                          {item.color && `Color: ${item.color}`}
                        </p>
                      )}

                      <p className="mt-1 text-sm font-semibold text-emerald-400">
                        {formatCurrency(item.price * item.quantity, currency)}
                      </p>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="inline-flex items-center rounded-lg border border-neutral-700 bg-neutral-800">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1, item.size, item.color)}
                          className="h-7 w-7 flex items-center justify-center text-neutral-300 hover:text-white transition-colors"
                          data-preview-static="cart-item-decrement"
                          aria-label="Decrease quantity"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-xs font-semibold text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1, item.size, item.color)}
                          className="h-7 w-7 flex items-center justify-center text-neutral-300 hover:text-white transition-colors"
                          data-preview-static="cart-item-increment"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer with Checkout Actions */}
        {items.length > 0 && (
          <div className="border-t border-neutral-800 bg-neutral-950 px-6 py-5">
            <div className="flex justify-between items-baseline mb-2">
              <span
                className="text-sm text-neutral-400"
                data-preview-field-path={fieldPath('subtotalLabel')}
              >
                {subtotalLabel}
              </span>
              <span className="text-xl font-bold text-white">
                {formatCurrency(subtotal, currency)}
              </span>
            </div>

            <p
              className="text-xs text-neutral-500 mb-4"
              data-preview-field-path={fieldPath('shippingNote')}
            >
              {shippingNote}
            </p>

            <div className="space-y-2.5">
              {/* Primary WhatsApp Order Link */}
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                data-preview-static="cart-whatsapp-cta"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 hover:bg-emerald-500 transition-all active:scale-[0.98]"
              >
                <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.531 1.769.813 2.796.813h.001c3.182 0 5.768-2.586 5.768-5.766 0-3.18-2.586-5.766-5.769-5.766zm9.969 5.766c0 5.518-4.482 10-10 10-1.745 0-3.415-.453-4.887-1.258l-5.113 1.341 1.365-4.989c-.931-1.537-1.465-3.327-1.465-5.094 0-5.518 4.482-10 10-10 5.518 0 10 4.482 10 10z" />
                </svg>
                <span data-preview-field-path={fieldPath('whatsappButtonText')}>
                  {whatsappButtonText}
                </span>
              </a>

              {/* Optional Custom Checkout Trigger / Link */}
              {(checkoutUrl || onCheckout) && (
                <button
                  type="button"
                  onClick={() => {
                    if (onCheckout) onCheckout(items, subtotal);
                    if (checkoutUrl) window.location.href = checkoutUrl;
                  }}
                  data-preview-static="cart-checkout-btn"
                  className="flex w-full items-center justify-center rounded-xl bg-neutral-800 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-700 transition-colors"
                >
                  <span data-preview-field-path={fieldPath('checkoutButtonText')}>
                    {checkoutButtonText}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

export const CartDrawer = EditableCartDrawer;
