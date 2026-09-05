import { OrderBranchHeader } from '@/components/admin/order-branch-header';

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <OrderBranchHeader />
      {children}
    </>
  );
}
