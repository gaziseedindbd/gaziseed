'use client';

import { Toaster } from 'sonner';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}

export function toast(message: string, type?: 'success' | 'error' | 'info') {
  import('sonner').then(({ toast: sonnerToast }) => {
    if (type === 'error') sonnerToast.error(message);
    else if (type === 'info') sonnerToast.info(message);
    else sonnerToast.success(message);
  });
}
