'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { getCart, saveCart, type CartItem } from '@/lib/cart';
import { getVisitorCountry, supabase } from '@/lib/supabase/client';

type CartContextType = {
  items: CartItem[];
  count: number;
  total: number;
  refresh: () => void;
};

const CartContext = createContext<CartContextType>({
  items: [],
  count: 0,
  total: 0,
  refresh: () => {},
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const pathname = usePathname();

  const refresh = useCallback(() => {
    const cart = getCart();
    setItems(cart);
    setCount(cart.reduce((sum, item) => sum + item.quantity, 0));
    setTotal(cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0));

    // Checkout performs its own authoritative product/country validation.
    // Skip the same network validation here to avoid a duplicate Supabase query.
    if (cart.length === 0 || pathname === '/checkout') return;
    const country = getVisitorCountry();
    const productIds = Array.from(new Set(cart.map((item) => item.product_id).filter(Boolean)));
    void supabase
      .from('products')
      .select('id')
      .eq('country_code', country)
      .eq('is_active', true)
      .in('id', productIds)
      .then(({ data, error }) => {
        if (error) return;
        const activeIds = new Set((data || []).map((row) => row.id));
        const validCart = cart.filter((item) => activeIds.has(item.product_id));
        if (validCart.length === cart.length) return;
        saveCart(validCart);
        setItems(validCart);
        setCount(validCart.reduce((sum, item) => sum + item.quantity, 0));
        setTotal(validCart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0));
      });
  }, [pathname]);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('cart-updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('cart-updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, [refresh]);

  return (
    <CartContext.Provider value={{ items, count, total, refresh }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
