'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCart, saveCart, type CartItem } from '@/lib/cart';

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

  const refresh = useCallback(() => {
    const cart = getCart();
    setItems(cart);
    setCount(cart.reduce((sum, item) => sum + item.quantity, 0));
    setTotal(cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0));
  }, []);

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
