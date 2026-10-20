import { useMemo } from 'react';
export function useSearchParams() { return useMemo(() => new URLSearchParams(window.location.search), []); }
