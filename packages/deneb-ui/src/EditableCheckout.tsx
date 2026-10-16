'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCart, CartItem, formatCurrency, parseNumericPrice } from './cart/useCart';
import { useSiteData } from './SiteDataProvider';
import { withBasePath } from './utils/urls';
import { EditableOrderSuccess } from './EditableOrderSuccess';

export interface EditableCheckoutProps {
  basePath?: string;
  apiEndpoint?: string;
  configEndpoint?: string;
  successUrl?: string;
  shopSlug?: string;
  whatsappNumber?: string;
  storeName?: string;
  currency?: string;
  defaultDeliveryFee?: number;
  freeDeliveryThreshold?: number;
  checkoutMode?: 'WHATSAPP_ONLY' | 'FULL_ECOMMERCE';
  ecommerceEnabled?: boolean;
  className?: string;
  onOrderPlaced?: (orderResult: any) => void;
  inlineSuccess?: boolean;
}

interface ShopPaymentConfig {
  shopId: string;
  shopName: string;
  slug: string;
  ecommerceEnabled: boolean;
  checkoutMode: 'WHATSAPP_ONLY' | 'FULL_ECOMMERCE';
  payHereEnabled: boolean;
  codEnabled: boolean;
  bankDepositEnabled: boolean;
  currency: string;
  defaultDeliveryFee: number;
  freeDeliveryThreshold: number | null;
  minimumOrderAmount: number;
  whatsappNumber: string | null;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
}

/**
 * Universal Editable Checkout Component for DENEB UI & Fivora
 * 
 * Works seamlessly in both:
 * 1. Showcase / WhatsApp Mode (instant order compilation into direct WhatsApp chat)
 * 2. Full E-Commerce Mode (online card payments via PayHere, Cash on Delivery, Bank Transfer, inventory sync)
 * 
 * Compliant with Fivora Visual Editing contract and Next.js static exports.
 * Created by Chamika Gayashan & Induranga Kawishwara.
 */
export function EditableCheckout({
  basePath = 'checkout',
  apiEndpoint = '/site-orders/create',
  configEndpoint = '/site-orders/config',
  successUrl = '/order-success',
  shopSlug: customSlug,
  whatsappNumber: customWhatsapp,
  storeName: customStoreName,
  currency: customCurrency = 'LKR',
  defaultDeliveryFee: customDeliveryFee,
  freeDeliveryThreshold: customFreeDeliveryThreshold,
  checkoutMode: propCheckoutMode,
  ecommerceEnabled: propEcommerceEnabled,
  className = '',
  onOrderPlaced,
  inlineSuccess = true,
}: EditableCheckoutProps) {
  const [placedOrder, setPlacedOrder] = useState<{
    orderNumber: string;
    trackingToken?: string;
    status: string;
    method: string;
    total: number;
  } | null>(null);
  const { items, subtotal, totalCount, updateQuantity, removeItem, clearCart, getWhatsAppOrderUrl } = useCart();
  const siteData = useSiteData() as Record<string, any>;

  const [mounted, setMounted] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryType, setDeliveryType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingPostalCode, setShippingPostalCode] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'PAYHERE' | 'COD' | 'BANK_TRANSFER'>('COD');
  const [honeypot, setHoneypot] = useState('');

  // Server Payment Config
  const [remoteConfig, setRemoteConfig] = useState<ShopPaymentConfig | null>(null);

  useEffect(() => {
    setMounted(true);
    // Dynamically inject PayHere SDK script for seamless on-page checkout popup
    if (typeof window !== 'undefined' && !document.getElementById('payhere-sdk')) {
      const script = document.createElement('script');
      script.id = 'payhere-sdk';
      script.src = 'https://www.payhere.lk/lib/payhere.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  // Determine Shop Slug
  const resolvedSlug = useMemo(() => {
    if (customSlug) return customSlug;
    if (siteData?.shop?.slug) return siteData.shop.slug;
    if (siteData?.site?.slug) return siteData.site.slug;
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      return hostname.split('.')[0] || 'default';
    }
    return 'default';
  }, [customSlug, siteData]);

  // Fetch Store Payment & Checkout Configuration
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;

    async function loadConfig() {
      try {
        const res = await fetch(configEndpoint);
        if (res.ok) {
          const data: ShopPaymentConfig = await res.json();
          if (!cancelled) {
            setRemoteConfig(data);
            if (data.payHereEnabled) {
              setPaymentMethod('PAYHERE');
            } else if (data.codEnabled) {
              setPaymentMethod('COD');
            } else if (data.bankDepositEnabled) {
              setPaymentMethod('BANK_TRANSFER');
            }
          }
        }
      } catch {
        // Fallback to static siteData defaults
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    }

    loadConfig();
    return () => {
      cancelled = true;
    };
  }, [mounted, configEndpoint]);

  // Resolve Store Capabilities
  const isEcommerceActive = useMemo(() => {
    if (propEcommerceEnabled !== undefined) return propEcommerceEnabled;
    if (propCheckoutMode !== undefined) return propCheckoutMode === 'FULL_ECOMMERCE';
    if (remoteConfig) return remoteConfig.ecommerceEnabled && remoteConfig.checkoutMode === 'FULL_ECOMMERCE';
    if (siteData?.ecommerceEnabled !== undefined) return Boolean(siteData.ecommerceEnabled);
    if (siteData?.checkoutMode !== undefined) return siteData.checkoutMode === 'FULL_ECOMMERCE';
    return false;
  }, [propEcommerceEnabled, propCheckoutMode, remoteConfig, siteData]);

  const resolvedWhatsapp = useMemo(() => {
    return (
      customWhatsapp ||
      remoteConfig?.whatsappNumber ||
      siteData?.shop?.businessWhatsapp ||
      siteData?.shop?.whatsapp ||
      siteData?.shop?.phone ||
      '94770000000'
    );
  }, [customWhatsapp, remoteConfig, siteData]);

  const resolvedStoreName = useMemo(() => {
    return (
      customStoreName ||
      remoteConfig?.shopName ||
      siteData?.content?.common?.websiteTitle ||
      siteData?.shop?.businessName ||
      siteData?.site?.name ||
      'Online Store'
    );
  }, [customStoreName, remoteConfig, siteData]);

  const resolvedCurrency = remoteConfig?.currency || customCurrency || 'LKR';

  // Delivery Fee Calculation
  const deliveryFee = useMemo(() => {
    if (deliveryType === 'PICKUP') return 0;
    const baseFee = customDeliveryFee ?? remoteConfig?.defaultDeliveryFee ?? 0;
    const threshold = customFreeDeliveryThreshold ?? remoteConfig?.freeDeliveryThreshold;
    if (threshold !== null && threshold !== undefined && subtotal >= threshold) {
      return 0;
    }
    return baseFee;
  }, [deliveryType, customDeliveryFee, remoteConfig, subtotal, customFreeDeliveryThreshold]);

  const grandTotal = subtotal + deliveryFee;

  // Visual Editing Field Helper
  const getContent = (key: string, fallback: string) => {
    const section = siteData?.content?.[basePath];
    return (section?.[key] as string) || fallback;
  };
  const fieldPath = (key: string) => `${basePath}.${key}`;

  // Direct WhatsApp Order URL
  const whatsappOrderHref = useMemo(() => {
    return getWhatsAppOrderUrl(resolvedWhatsapp, {
      storeName: resolvedStoreName,
      currency: resolvedCurrency,
    });
  }, [getWhatsAppOrderUrl, resolvedWhatsapp, resolvedStoreName, resolvedCurrency]);

  // Order Submission Handler
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!customerName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!customerPhone.trim()) {
      setErrorMessage('Please enter your phone number.');
      return;
    }
    if (deliveryType === 'DELIVERY') {
      if (!shippingAddress.trim()) {
        setErrorMessage('Please enter your delivery street address.');
        return;
      }
      if (!shippingCity.trim()) {
        setErrorMessage('Please enter your city.');
        return;
      }
    }
    if (items.length === 0) {
      setErrorMessage('Your cart is empty.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim() || undefined,
        shippingAddress: deliveryType === 'DELIVERY' ? shippingAddress.trim() : 'In-Store Pickup',
        shippingCity: deliveryType === 'DELIVERY' ? shippingCity.trim() : 'Pickup',
        shippingPostalCode: shippingPostalCode.trim() || undefined,
        customerNotes: customerNotes.trim() || undefined,
        paymentMethod,
        items: items.map((item) => ({
          productId: String(item.id),
          quantity: item.quantity,
          variantName: [item.size, item.color].filter(Boolean).join(' / ') || undefined,
        })),
        honeypot: honeypot || undefined,
      };

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to place order. Please try again.');
      }

      if (onOrderPlaced) {
        onOrderPlaced(data);
      }

      // 1. PayHere Online Card Payment
      if (paymentMethod === 'PAYHERE' && data.payHerePayload) {
        const payHere = data.payHerePayload;
        const anyWin = window as any;

        // If PayHere on-page modal popup is available, open popup on SAME page
        if (anyWin?.payhere && typeof anyWin.payhere.startPayment === 'function') {
          anyWin.payhere.onCompleted = function onCompleted() {
            clearCart();
            setPlacedOrder({
              orderNumber: data.orderNumber || 'ORD-PAID',
              trackingToken: data.trackingToken,
              status: 'PROCESSING',
              method: 'PAYHERE',
              total: Number(data.totalAmount || grandTotal),
            });
            setSubmitting(false);
          };
          anyWin.payhere.onDismissed = function onDismissed() {
            setErrorMessage('Payment modal was closed before completion. You can try again.');
            setSubmitting(false);
          };
          anyWin.payhere.onError = function onError(error: any) {
            setErrorMessage('PayHere payment error: ' + (error?.message || error || 'Unknown'));
            setSubmitting(false);
          };

          anyWin.payhere.startPayment(payHere);
          return;
        }

        // Fallback: Submit hidden form to PayHere checkout
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = payHere.checkoutUrl;
        form.style.display = 'none';

        Object.entries(payHere).forEach(([k, v]) => {
          if (k !== 'checkoutUrl' && v !== null && v !== undefined) {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = k;
            input.value = String(v);
            form.appendChild(input);
          }
        });

        document.body.appendChild(form);
        clearCart();
        form.submit();
        return;
      }

      // 2. Cash on Delivery or Bank Transfer
      clearCart();

      if (inlineSuccess) {
        // Display order confirmation on the EXACT SAME page without navigation!
        setPlacedOrder({
          orderNumber: data.orderNumber || '',
          trackingToken: data.trackingToken || '',
          status: data.status || 'PENDING_PAYMENT',
          method: paymentMethod,
          total: Number(data.totalAmount || grandTotal),
        });
        setSubmitting(false);
        return;
      }

      // Fallback: Redirect to dedicated success URL
      const redirectParams = new URLSearchParams({
        orderNumber: data.orderNumber || '',
        trackingToken: data.trackingToken || '',
        status: data.status || 'PENDING_PAYMENT',
        method: paymentMethod,
        total: String(data.totalAmount || grandTotal),
      });

      window.location.href = `${successUrl}?${redirectParams.toString()}`;
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred while placing your order.');
      setSubmitting(false);
    }
  };

  if (!mounted) {
    return (
      <div className={`mx-auto max-w-5xl px-4 py-16 text-center ${className}`}>
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        <p className="mt-4 text-sm text-neutral-400">Loading checkout...</p>
      </div>
    );
  }

  // Same-Page Inline Order Confirmation View
  if (placedOrder) {
    return (
      <EditableOrderSuccess
        basePath={basePath}
        className={className}
        storeName={resolvedStoreName}
        whatsappNumber={resolvedWhatsapp}
        currency={resolvedCurrency}
        orderNumber={placedOrder.orderNumber}
        trackingToken={placedOrder.trackingToken}
        status={placedOrder.status}
        method={placedOrder.method}
        total={placedOrder.total}
      />
    );
  }

  // MODE 1: WhatsApp Ordering Active
  if (!isEcommerceActive) {
    return (
      <div className={`mx-auto max-w-4xl px-4 py-12 ${className}`}>
        <div className="mb-6">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Store</span>
          </a>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-8 shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 mb-4">
            <svg className="h-8 w-8 fill-current" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.531 1.769.813 2.796.813h.001c3.182 0 5.768-2.586 5.768-5.766 0-3.18-2.586-5.766-5.769-5.766zm9.969 5.766c0 5.518-4.482 10-10 10-1.745 0-3.415-.453-4.887-1.258l-5.113 1.341 1.365-4.989c-.931-1.537-1.465-3.327-1.465-5.094 0-5.518 4.482-10 10-10 5.518 0 10 4.482 10 10z" />
            </svg>
          </div>

          <h1
            className="text-2xl font-bold text-center text-white sm:text-3xl"
            data-preview-field-path={fieldPath('whatsappTitle')}
          >
            {getContent('whatsappTitle', 'Direct WhatsApp Ordering Active')}
          </h1>

          <p
            className="mt-2 text-center text-sm text-neutral-400 max-w-lg mx-auto"
            data-preview-field-path={fieldPath('whatsappSubtitle')}
          >
            {getContent(
              'whatsappSubtitle',
              'This store accepts orders directly via WhatsApp. Review your selected items and click below to chat with the merchant to confirm delivery.',
            )}
          </p>

          {items.length === 0 ? (
            <div className="mt-8 rounded-xl border border-neutral-800 bg-neutral-950 p-6 text-center">
              <p className="text-sm text-neutral-400">Your cart is currently empty.</p>
              <a
                href="/"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-neutral-700 transition-colors"
              >
                Browse Catalog
              </a>
            </div>
          ) : (
            <div className="mt-8 space-y-6">
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 divide-y divide-neutral-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 pb-3">Selected Items ({totalCount})</h3>
                <div className="divide-y divide-neutral-800/60 max-h-80 overflow-y-auto">
                  {items.map((item) => (
                    <div key={`${item.id}-${item.size || ''}-${item.color || ''}`} className="flex justify-between items-center py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{item.name}</p>
                        <p className="text-xs text-neutral-400">
                          Qty: {item.quantity} {item.size ? `· Size: ${item.size}` : ''} {item.color ? `· Color: ${item.color}` : ''}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-emerald-400">
                        {item.showPrice === false ? 'Price on Request' : formatCurrency(item.price * item.quantity, resolvedCurrency)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex justify-between items-baseline">
                  <span className="text-sm text-neutral-400">Estimated Total:</span>
                  <span className="text-xl font-bold text-white">{formatCurrency(subtotal, resolvedCurrency)}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={whatsappOrderHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2.5 rounded-xl bg-emerald-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-500 transition-all active:scale-[0.99]"
                >
                  <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.531 1.769.813 2.796.813h.001c3.182 0 5.768-2.586 5.768-5.766 0-3.18-2.586-5.766-5.769-5.766zm9.969 5.766c0 5.518-4.482 10-10 10-1.745 0-3.415-.453-4.887-1.258l-5.113 1.341 1.365-4.989c-.931-1.537-1.465-3.327-1.465-5.094 0-5.518 4.482-10 10-10 5.518 0 10 4.482 10 10z" />
                  </svg>
                  <span>Send Order via WhatsApp</span>
                </a>
                <a
                  href="/"
                  className="flex items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 px-6 py-4 text-sm font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors"
                >
                  Continue Shopping
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // MODE 2: Full E-Commerce Checkout
  if (items.length === 0) {
    return (
      <div className={`mx-auto max-w-xl px-4 py-20 text-center ${className}`}>
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-neutral-900 border border-neutral-800 text-neutral-400 mb-6">
          <svg className="h-10 w-10 fill-none stroke-current" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white">Your Cart is Empty</h1>
        <p className="mt-2 text-sm text-neutral-400">You do not have any items in your cart to checkout yet.</p>
        <a
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-950/30"
        >
          Explore Catalog
        </a>
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-6xl px-4 py-10 sm:px-6 ${className}`}>
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center justify-between">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Continue Shopping</span>
        </a>
        <span className="text-xs text-neutral-500">Secure 256-bit Encrypted Checkout</span>
      </div>

      <h1
        className="text-2xl font-bold text-white sm:text-3xl mb-8"
        data-preview-field-path={fieldPath('pageTitle')}
      >
        {getContent('pageTitle', 'Checkout & Payment')}
      </h1>

      {errorMessage && (
        <div className="mb-8 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-sm text-red-300 flex items-center gap-3">
          <svg className="h-5 w-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid gap-8 lg:grid-cols-[1fr_420px]">
        {/* Left Column: Customer & Delivery Details */}
        <div className="space-y-8">
          {/* Section 1: Customer Contact Info */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">1</span>
              <span>Customer Information</span>
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Kamal Perera"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Phone / WhatsApp Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. 077 123 4567"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Email Address <span className="text-neutral-500 text-[11px] font-normal">(Optional for receipt)</span>
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="kamal@example.com"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Delivery & Shipping */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">2</span>
              <span>Delivery Details</span>
            </h2>

            {/* Delivery vs Pickup Toggle */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => setDeliveryType('DELIVERY')}
                className={`flex items-center justify-center gap-2 rounded-xl p-3 text-xs font-bold transition-all border ${
                  deliveryType === 'DELIVERY'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <span>Doorstep Delivery</span>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryType('PICKUP')}
                className={`flex items-center justify-center gap-2 rounded-xl p-3 text-xs font-bold transition-all border ${
                  deliveryType === 'PICKUP'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white'
                }`}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>Store Pickup (Free)</span>
              </button>
            </div>

            {deliveryType === 'DELIVERY' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Street Delivery Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="No. 45, Temple Road, Colombo"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    City / Town <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={shippingCity}
                    onChange={(e) => setShippingCity(e.target.value)}
                    placeholder="e.g. Colombo, Kandy, Galle"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Postal Code <span className="text-neutral-500 text-[11px] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={shippingPostalCode}
                    onChange={(e) => setShippingPostalCode(e.target.value)}
                    placeholder="e.g. 00500"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Delivery Instructions / Landmark <span className="text-neutral-500 text-[11px] font-normal">(Optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="Near water tank, gate code, ring bell twice..."
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2 text-sm text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Payment Method */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">3</span>
              <span>Payment Method</span>
            </h2>

            <div className="space-y-3">
              {/* PayHere Card / Mobile Wallet */}
              {(remoteConfig?.payHereEnabled ?? true) && (
                <label
                  className={`flex items-start gap-4 rounded-xl border p-4 cursor-pointer transition-all ${
                    paymentMethod === 'PAYHERE'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="PAYHERE"
                    checked={paymentMethod === 'PAYHERE'}
                    onChange={() => setPaymentMethod('PAYHERE')}
                    className="mt-1 text-emerald-500 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">Online Payment (PayHere)</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                        Instant Confirmation
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">
                      Credit / Debit Card (Visa, MasterCard), Genie, Frimi, eZ Cash, mCash.
                    </p>
                  </div>
                </label>
              )}

              {/* Cash on Delivery (COD) */}
              {(remoteConfig?.codEnabled ?? true) && (
                <label
                  className={`flex items-start gap-4 rounded-xl border p-4 cursor-pointer transition-all ${
                    paymentMethod === 'COD'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="COD"
                    checked={paymentMethod === 'COD'}
                    onChange={() => setPaymentMethod('COD')}
                    className="mt-1 text-emerald-500 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">Cash on Delivery (COD)</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                        Pay at Doorstep
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">
                      Pay with cash when your items are delivered to your door.
                    </p>
                  </div>
                </label>
              )}

              {/* Bank Transfer */}
              {(remoteConfig?.bankDepositEnabled ?? false) && (
                <label
                  className={`flex items-start gap-4 rounded-xl border p-4 cursor-pointer transition-all ${
                    paymentMethod === 'BANK_TRANSFER'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-neutral-800 bg-neutral-950 hover:border-neutral-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="BANK_TRANSFER"
                    checked={paymentMethod === 'BANK_TRANSFER'}
                    onChange={() => setPaymentMethod('BANK_TRANSFER')}
                    className="mt-1 text-emerald-500 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-bold text-white">Direct Bank Deposit / Transfer</span>
                    <p className="mt-1 text-xs text-neutral-400">
                      Transfer directly to our store bank account and share the receipt via WhatsApp.
                    </p>
                    {paymentMethod === 'BANK_TRANSFER' && remoteConfig?.bankAccountNumber && (
                      <div className="mt-3 rounded-lg bg-neutral-900 border border-neutral-800 p-3 text-xs text-neutral-300 space-y-1">
                        <p><span className="text-neutral-500">Bank:</span> {remoteConfig.bankName || 'Commercial Bank'}</p>
                        <p><span className="text-neutral-500">Account Name:</span> {remoteConfig.bankAccountName || resolvedStoreName}</p>
                        <p><span className="text-neutral-500">Account No:</span> <strong className="font-mono text-emerald-400">{remoteConfig.bankAccountNumber}</strong></p>
                        {remoteConfig.bankBranch && <p><span className="text-neutral-500">Branch:</span> {remoteConfig.bankBranch}</p>}
                      </div>
                    )}
                  </div>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Order Summary & Place Order */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/90 p-6 shadow-xl sticky top-24">
            <h2 className="text-lg font-bold text-white mb-4">Order Summary ({totalCount})</h2>

            {/* Items List */}
            <div className="divide-y divide-neutral-800/80 max-h-72 overflow-y-auto mb-6 pr-1">
              {items.map((item) => (
                <div key={`${item.id}-${item.size || ''}-${item.color || ''}`} className="py-3.5 flex gap-3.5 items-center">
                  {item.image ? (
                    <img
                      src={withBasePath(item.image)}
                      alt={item.name}
                      className="h-14 w-14 rounded-lg object-cover bg-neutral-800 border border-neutral-700 flex-shrink-0"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-500 flex-shrink-0">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                    <p className="text-[11px] text-neutral-400">
                      {item.size ? `Size: ${item.size} ` : ''}
                      {item.color ? `Color: ${item.color}` : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1, item.size, item.color)}
                        className="h-5 w-5 rounded bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center text-xs"
                      >
                        -
                      </button>
                      <span className="text-xs font-mono font-bold text-white">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1, item.size, item.color)}
                        className="h-5 w-5 rounded bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-bold text-emerald-400">
                      {item.showPrice === false ? 'On Request' : formatCurrency(item.price * item.quantity, resolvedCurrency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id, item.size, item.color)}
                      className="block mt-1 text-[10px] text-neutral-500 hover:text-red-400 ml-auto"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Cost Breakdown */}
            <div className="border-t border-neutral-800 pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-neutral-400">
                <span>Subtotal</span>
                <span className="text-white font-medium">{formatCurrency(subtotal, resolvedCurrency)}</span>
              </div>

              <div className="flex justify-between text-neutral-400">
                <span>Delivery Fee</span>
                <span className={deliveryFee === 0 ? 'text-emerald-400 font-semibold' : 'text-white font-medium'}>
                  {deliveryFee === 0 ? 'FREE' : formatCurrency(deliveryFee, resolvedCurrency)}
                </span>
              </div>

              <div className="border-t border-neutral-800 pt-3 flex justify-between items-baseline">
                <span className="text-base font-bold text-white">Grand Total</span>
                <span className="text-2xl font-black text-emerald-400">{formatCurrency(grandTotal, resolvedCurrency)}</span>
              </div>
            </div>

            {/* Anti-bot honeypot field (hidden from real users) */}
            <input
              type="text"
              name="honeypot"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              style={{ display: 'none' }}
              tabIndex={-1}
              autoComplete="off"
            />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full rounded-xl bg-emerald-600 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Processing Order...</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 fill-none stroke-current" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Place Order ({formatCurrency(grandTotal, resolvedCurrency)})</span>
                </>
              )}
            </button>

            {/* Guarantee */}
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-neutral-500">
              <svg className="h-3.5 w-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>100% Satisfaction Guarantee · Fast Local Delivery</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
