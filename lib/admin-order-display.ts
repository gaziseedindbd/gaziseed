export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'অর্ডার গৃহীত', confirmed: 'কনফার্মড', processing: 'প্রসেসিং', packed: 'প্যাকড',
  shipped: 'শিপড', delivered: 'ডেলিভারড', cancelled: 'বাতিল', returned: 'ফেরত',
};
export const ORDER_SOURCE_LABELS: Record<string, string> = {
  website: 'Website', ads: 'Ads', animated_landing: 'Animated Landing',
  facebook_messenger_ai: 'AI Messenger', facebook: 'Facebook', instagram: 'Instagram', google: 'Google', tiktok: 'TikTok',
};
export function adminPrice(value: number, country: string) {
  return (country === 'IN' ? '₹ ' : '৳ ') + Number(value || 0).toLocaleString(country === 'IN' ? 'en-IN' : 'bn-BD');
}
