'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

export interface CartItem {
  id: string;
  name: string;
  brand?: string;
  price: number;
  originalPrice?: number;
  image?: string;
  size?: string;
  color?: string;
  quantity: number;
  sku?: string;
  metadata?: Record<string, unknown>;
}

export function formatCurrency(amount: number, currency = 'LKR'): string {
  const formatted = (amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (currency === 'LKR' || currency === 'Rs.' || currency === 'Rs') {
    return `LKR ${formatted}`;
  }
  if (currency === '$' || currency === 'USD') {
    return `$${formatted}`;
  }
  return `${currency} ${formatted}`;
}

export function getProductWhatsAppUrl(
  product: { name?: string; title?: string; brand?: string; price?: string | number; [key: string]: unknown },
  whatsappNumber: string,
  options?: { storeName?: string; currency?: string }
): string {
  const cleanNumber = (whatsappNumber || '').replace(/\D/g, '');
  const title = product.name || product.title || 'Product';
  const brand = product.brand ? ` (Brand: ${product.brand})` : '';
  const priceNum = typeof product.price === 'number' ? product.price : parseFloat(String(product.price || '').replace(/[^0-9.]/g, '')) || 0;
  const priceStr = priceNum > 0 ? `\nPrice: ${formatCurrency(priceNum, options?.currency || 'LKR')}` : '';
  const store = options?.storeName ? ` at ${options.storeName}` : '';

  const message = [
    `Hello${store}! 👋`,
    `I am interested in this product:`,
    `*${title}*${brand}${priceStr}`,
    '',
    `Could you please share more details, availability, and ordering instructions? Thank you!`,
  ].join('\n');

  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}

export interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  totalCount: number;
  subtotal: number;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (id: string, size?: string, color?: string) => void;
  updateQuantity: (id: string, quantity: number, size?: string, color?: string) => void;
  clearCart: () => void;
  getWhatsAppOrderUrl: (whatsappNumber: string, options?: { storeName?: string; currency?: string }) => string;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'deneb_cart_items_v1';

export function CartProvider({
  children,
  storageKey = STORAGE_KEY,
}: {
  children: React.ReactNode;
  storageKey?: string;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Safely hydrate from localStorage after client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setItems(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors (e.g. private browsing)
    }
    setHasHydrated(true);
  }, [storageKey]);

  // Persist items to localStorage on change (after initial mount)
  useEffect(() => {
    if (!hasHydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Ignore quota exceeded
    }
  }, [items, hasHydrated, storageKey]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const toggleCart = useCallback(() => setIsOpen((prev) => !prev), []);

  const getItemKey = (id: string, size?: string, color?: string) =>
    `${id}-${size || ''}-${color || ''}`;

  const addItem = useCallback(
    (newItem: Omit<CartItem, 'quantity'> & { quantity?: number }) => {
      const qty = newItem.quantity && newItem.quantity > 0 ? newItem.quantity : 1;
      setItems((prevItems) => {
        const targetKey = getItemKey(newItem.id, newItem.size, newItem.color);
        const existingIndex = prevItems.findIndex(
          (item) => getItemKey(item.id, item.size, item.color) === targetKey,
        );

        if (existingIndex > -1) {
          const copy = [...prevItems];
          copy[existingIndex] = {
            ...copy[existingIndex],
            quantity: copy[existingIndex].quantity + qty,
          };
          return copy;
        }

        return [...prevItems, { ...newItem, quantity: qty }];
      });
      setIsOpen(true);
    },
    [],
  );

  const removeItem = useCallback((id: string, size?: string, color?: string) => {
    const targetKey = getItemKey(id, size, color);
    setItems((prev) =>
      prev.filter((item) => getItemKey(item.id, item.size, item.color) !== targetKey),
    );
  }, []);

  const updateQuantity = useCallback(
    (id: string, quantity: number, size?: string, color?: string) => {
      const targetKey = getItemKey(id, size, color);
      setItems((prev) => {
        if (quantity <= 0) {
          return prev.filter((item) => getItemKey(item.id, item.size, item.color) !== targetKey);
        }
        return prev.map((item) =>
          getItemKey(item.id, item.size, item.color) === targetKey
            ? { ...item, quantity }
            : item,
        );
      });
    },
    [],
  );

  const clearCart = useCallback(() => setItems([]), []);

  const totalCount = useMemo(
    () => items.reduce((acc, item) => acc + item.quantity, 0),
    [items],
  );

  const subtotal = useMemo(
    () => items.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [items],
  );

  const getWhatsAppOrderUrl = useCallback(
    (whatsappNumber: string, options?: { storeName?: string; currency?: string }) => {
      const cleanNumber = (whatsappNumber || '').replace(/\D/g, '');
      const currency = options?.currency || 'LKR';
      const store = options?.storeName ? ` at *${options.storeName}*` : '';

      const lines: string[] = [
        `🛒 *New Order Request${store}*`,
        `📅 Date: ${new Date().toLocaleDateString()}`,
        '',
        '📦 *Order Items:*',
      ];

      items.forEach((item, index) => {
        const brandStr = item.brand ? ` (Brand: *${item.brand}*)` : '';
        const variantParts: string[] = [];
        if (item.size) variantParts.push(`Size: ${item.size}`);
        if (item.color) variantParts.push(`Color: ${item.color}`);
        const variantStr = variantParts.length > 0 ? ` [${variantParts.join(', ')}]` : '';

        lines.push(
          `${index + 1}. *${item.name}*${brandStr}${variantStr}`,
        );
        lines.push(
          `   Qty: ${item.quantity} x ${formatCurrency(item.price, currency)} = *${formatCurrency(item.price * item.quantity, currency)}*`,
        );
      });

      lines.push('');
      lines.push('──────────────────────────────');
      lines.push(`💰 *Grand Total: ${formatCurrency(subtotal, currency)}*`);
      lines.push(`📊 Total Items: ${totalCount}`);
      lines.push('');
      lines.push('Please confirm availability and delivery details. Thank you! 🙏');

      return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(lines.join('\n'))}`;
    },
    [items, subtotal, totalCount],
  );

  const value = useMemo(
    () => ({
      items,
      isOpen,
      totalCount,
      subtotal,
      openCart,
      closeCart,
      toggleCart,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getWhatsAppOrderUrl,
    }),
    [
      items,
      isOpen,
      totalCount,
      subtotal,
      openCart,
      closeCart,
      toggleCart,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getWhatsAppOrderUrl,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useOptionalCart(): CartContextValue | null {
  return useContext(CartContext);
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a <CartProvider>');
  }
  return context;
}

