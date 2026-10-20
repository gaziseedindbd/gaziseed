export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'returned'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];
export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'অর্ডার গৃহীত', confirmed: 'কনফার্মড', processing: 'প্রসেসিং', packed: 'প্যাকড',
  shipped: 'শিপড', delivered: 'ডেলিভারড', cancelled: 'বাতিল', returned: 'ফেরত',
};
const transitions: Record<string, readonly OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'], confirmed: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'], packed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'returned'], delivered: ['returned'], cancelled: [], returned: [],
};
export function nextOrderStatuses(status: string): readonly OrderStatus[] { return transitions[status] ?? []; }
export const STATUS_ACTION_LABELS: Record<string, string> = {
  confirmed: 'অর্ডার নিশ্চিত করুন', processing: 'প্যাকিং শুরু করুন', packed: 'প্যাকিং সম্পন্ন করুন',
  shipped: 'কুরিয়ারে হস্তান্তর রেকর্ড করুন', delivered: 'ডেলিভারি সম্পন্ন রেকর্ড করুন',
  cancelled: 'অর্ডার বাতিল করুন', returned: 'ফেরত আসা রেকর্ড করুন',
};
export const STATUS_CONFIRMATIONS: Record<string, string> = {
  packed: 'পণ্য, পরিমাণ ও প্যাকিং যাচাই করেছি', shipped: 'পার্সেল কুরিয়ারের কাছে হস্তান্তর হয়েছে',
  delivered: 'ক্রেতার কাছে ডেলিভারি সম্পন্ন হয়েছে নিশ্চিত করেছি', returned: 'ফেরত পার্সেল হাতে পাওয়া নিশ্চিত করেছি',
};
export function statusReasonRequired(status: string) { return ['cancelled', 'returned', 'delivered'].includes(status); }
export function statusActionValid(current: string, next: OrderStatus, reason: string, confirmed: boolean) {
  return nextOrderStatuses(current).includes(next) && reason.trim().length <= 2000 &&
    (!statusReasonRequired(next) || reason.trim().length >= 3) && (!STATUS_CONFIRMATIONS[next] || confirmed);
}
