'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { formatCurrency } from './cart/useCart';
import { useSiteData } from './SiteDataProvider';

export interface EditableOrderSuccessProps {
  basePath?: string;
  className?: string;
  storeName?: string;
  whatsappNumber?: string;
  currency?: string;
  orderNumber?: string;
  trackingToken?: string;
  status?: string;
  method?: string;
  total?: number;
}

/**
 * Universal Order Confirmation / Success View for DENEB UI & Fivora
 * Reads order details from URL search params and displays a rich confirmation receipt.
 * Created by Chamika Gayashan & Induranga Kawishwara.
 */
export function EditableOrderSuccess({
  basePath = 'orderSuccess',
  className = '',
  storeName: customStoreName,
  whatsappNumber: customWhatsapp,
  currency: customCurrency = 'LKR',
  orderNumber: propOrderNumber,
  trackingToken: propTrackingToken,
  status: propStatus,
  method: propMethod,
  total: propTotal,
}: EditableOrderSuccessProps) {
  const siteData = useSiteData() as Record<string, any>;
  const [mounted, setMounted] = useState(false);

  // Order fields (either from props or URL query params)
  const [orderNumber, setOrderNumber] = useState(propOrderNumber || '');
  const [trackingToken, setTrackingToken] = useState(propTrackingToken || '');
  const [status, setStatus] = useState(propStatus || 'PENDING_PAYMENT');
  const [method, setMethod] = useState(propMethod || 'COD');
  const [total, setTotal] = useState<number>(propTotal || 0);

  useEffect(() => {
    setMounted(true);
    if (propOrderNumber) {
      setOrderNumber(propOrderNumber);
      if (propStatus) setStatus(propStatus);
      if (propMethod) setMethod(propMethod);
      if (propTotal !== undefined) setTotal(propTotal);
      if (propTrackingToken) setTrackingToken(propTrackingToken);
      return;
    }
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setOrderNumber(params.get('orderNumber') || params.get('order_id') || 'ORD-CONFIRMED');
      setTrackingToken(params.get('trackingToken') || '');
      setStatus(params.get('status') || 'PROCESSING');
      setMethod(params.get('method') || (params.get('order_id') ? 'PAYHERE' : 'COD'));
      const parsedTotal = parseFloat(params.get('total') || params.get('amount') || '0');
      setTotal(Number.isFinite(parsedTotal) ? parsedTotal : 0);
    }
  }, [propOrderNumber, propStatus, propMethod, propTotal, propTrackingToken]);

  const resolvedStoreName = useMemo(() => {
    return (
      customStoreName ||
      siteData?.content?.common?.websiteTitle ||
      siteData?.shop?.businessName ||
      siteData?.site?.name ||
      'Our Store'
    );
  }, [customStoreName, siteData]);

  const resolvedWhatsapp = useMemo(() => {
    return (
      customWhatsapp ||
      siteData?.shop?.businessWhatsapp ||
      siteData?.shop?.whatsapp ||
      siteData?.shop?.phone ||
      '94770000000'
    );
  }, [customWhatsapp, siteData]);

  const isPaid = status === 'PROCESSING' || status === 'PAID' || method === 'PAYHERE';

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const cleanPhone = (resolvedWhatsapp || '').replace(/\D/g, '');
  const whatsappSupportUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `Hi ${resolvedStoreName}, I placed an order (#${orderNumber}). Could you please update me on delivery status? Thank you!`,
  )}`;

  if (!mounted) {
    return (
      <div className={`mx-auto max-w-2xl px-4 py-20 text-center ${className}`}>
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className={`mx-auto max-w-3xl px-4 py-12 sm:px-6 ${className}`}>
      <div className="rounded-3xl border border-neutral-800 bg-neutral-900/90 p-8 sm:p-12 shadow-2xl text-center">
        {/* Animated Success Badge */}
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-6 shadow-lg shadow-emerald-950/40">
          <svg className="h-10 w-10 fill-none stroke-current" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-black text-white sm:text-4xl tracking-tight">
          {isPaid ? 'Payment Confirmed!' : 'Order Placed Successfully!'}
        </h1>

        <p className="mt-3 text-sm text-neutral-400 max-w-md mx-auto">
          Thank you for shopping with <strong className="text-white">{resolvedStoreName}</strong>. Your order has been registered in our system and is now being prepared for fulfillment.
        </p>

        {/* Order Reference Number Card */}
        <div className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-950 p-6 max-w-md mx-auto text-left space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Order Number</span>
            <span className="font-mono text-base font-bold text-white tracking-wide">{orderNumber}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Payment Status</span>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${
              isPaid
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : method === 'COD'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
            }`}>
              {isPaid ? 'PAID / ONLINE CONFIRMED' : method === 'COD' ? 'CASH ON DELIVERY' : 'BANK TRANSFER PENDING'}
            </span>
          </div>

          {total > 0 && (
            <div className="flex justify-between items-center border-t border-neutral-800/80 pt-3">
              <span className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Total Amount</span>
              <span className="text-lg font-black text-emerald-400">{formatCurrency(total, customCurrency)}</span>
            </div>
          )}
        </div>

        {/* Payment-specific Instructions */}
        {method === 'COD' && (
          <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-950/20 p-4 max-w-md mx-auto text-xs text-blue-300 text-left flex items-start gap-3">
            <svg className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Please have the exact cash ready when the delivery rider arrives at your doorstep. You will receive an SMS/WhatsApp update upon dispatch.</span>
          </div>
        )}

        {method === 'BANK_TRANSFER' && (
          <div className="mt-6 rounded-xl border border-purple-500/20 bg-purple-950/20 p-4 max-w-md mx-auto text-xs text-purple-300 text-left flex items-start gap-3">
            <svg className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Please transfer the order total to our bank account and send the payment slip/screenshot to our WhatsApp with your order number.</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
          <a
            href={whatsappSupportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-500 transition-all cursor-pointer"
          >
            <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.531 1.769.813 2.796.813h.001c3.182 0 5.768-2.586 5.768-5.766 0-3.18-2.586-5.766-5.769-5.766zm9.969 5.766c0 5.518-4.482 10-10 10-1.745 0-3.415-.453-4.887-1.258l-5.113 1.341 1.365-4.989c-.931-1.537-1.465-3.327-1.465-5.094 0-5.518 4.482-10 10-10 5.518 0 10 4.482 10 10z" />
            </svg>
            <span>WhatsApp Support</span>
          </a>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-3.5 text-sm font-semibold text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print Receipt</span>
          </button>
        </div>

        <div className="mt-8 border-t border-neutral-800 pt-6">
          <a
            href="/"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors inline-flex items-center gap-1.5"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Return to Storefront Homepage</span>
          </a>
        </div>
      </div>
    </div>
  );
}
