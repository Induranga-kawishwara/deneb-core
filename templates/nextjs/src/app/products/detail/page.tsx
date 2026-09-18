'use client';

import { PlatformProductDetail } from '@deneb-ui/ui';

export default function ProductDetailPage() {
  return (
    <PlatformProductDetail
      backHref="/"
      loadingFallback={
        <div
          role="status"
          className="mx-auto flex min-h-[40vh] max-w-7xl items-center justify-center px-4 py-16 text-sm text-slate-400"
        >
          <span data-preview-static="product-detail-loading">Loading product…</span>
        </div>
      }
    />
  );
}
