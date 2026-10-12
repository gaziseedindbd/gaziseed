export type MessengerHandoffDbStatus =
  | 'open'
  | 'assigned'
  | 'resolved'
  | 'cancelled';

export type MessengerHumanSupportQueueState = 'pending' | 'open' | 'closed';

export function getMessengerHumanSupportQueueState(
  status: MessengerHandoffDbStatus | string,
): MessengerHumanSupportQueueState {
  if (status === 'assigned') return 'open';
  if (status === 'resolved' || status === 'cancelled') return 'closed';
  return 'pending';
}

export function getBangladeshHumanSupportAcknowledgement(): string {
  return [
    'ঠিক আছে। আপনার অনুরোধটি আমাদের Bangladesh customer support team-এর কাছে পাঠানো হয়েছে।',
    '',
    '👤 একজন support agent আপনার Messenger conversation-এর আগের কথোপকথন দেখে এখান থেকেই বিষয়টি handle করবেন।',
    '⏳ Support team reply না দেওয়া পর্যন্ত AI আর উত্তর দেবে না।',
  ].join('\n');
}

export function getBangladeshHumanSupportWaitingReply(): string {
  return [
    'আপনার support request টি এখনো active আছে।',
    '',
    '👤 একজন human support agent আপনার conversation দেখছেন/দেখবেন।',
    '⏳ Human support শেষ না হওয়া পর্যন্ত AI থেকে নতুন automated reply দেওয়া হবে না।',
  ].join('\n');
}

export function getHumanSupportClosedMetadata() {
  return {
    human_takeover: false,
    human_support_state: 'closed',
  };
}

export type MessengerSupportCountry = 'BD' | 'IN';
export type MessengerSupportLanguage = 'English' | 'Bengali' | 'Hindi';
export type MessengerSupportReplyMode = 'contact' | 'unverified';

export function getMessengerSupportContactDetails(country: MessengerSupportCountry) {
  return country === 'IN'
    ? {
        countryName: 'India',
        whatsappUrl: 'https://wa.me/916002786881',
        directPhone: '+91 6002786881',
      }
    : {
        countryName: 'Bangladesh',
        whatsappUrl: 'https://wa.me/8801811332293',
        directPhone: '01811332293',
      };
}

export function getMessengerHumanSupportContactReply(
  country: MessengerSupportCountry,
  language: MessengerSupportLanguage,
  mode: MessengerSupportReplyMode = 'contact',
): string {
  const contact = getMessengerSupportContactDetails(country);
  const intro = mode === 'unverified'
    ? language === 'English'
      ? 'Sorry, I could not find a verified answer in our available information, so I will not guess.'
      : language === 'Hindi'
        ? 'माफ़ कीजिए, उपलब्ध जानकारी में सत्यापित उत्तर नहीं मिला, इसलिए मैं अनुमान लगाकर गलत जानकारी नहीं दूँगा।'
        : 'দুঃখিত, আমাদের কাছে থাকা তথ্য থেকে নিশ্চিত উত্তর পেলাম না—তাই অনুমান করে ভুল তথ্য দিচ্ছি না।'
    : language === 'English'
      ? 'Please contact our customer support team for help with this question.'
      : language === 'Hindi'
        ? 'इस विषय में सहायता के लिए हमारी customer support team से संपर्क करें।'
        : 'এই বিষয়ে সাহায্যের জন্য আমাদের customer support team-এর সঙ্গে যোগাযোগ করুন।';

  const channelLabel = language === 'Hindi'
    ? 'WhatsApp'
    : language === 'English'
      ? 'WhatsApp'
      : 'WhatsApp';
  const phoneLabel = language === 'Hindi'
    ? 'सीधा कॉल'
    : language === 'English'
      ? 'Direct call'
      : 'সরাসরি কল';

  return [
    intro,
    '',
    `🌍 ${contact.countryName} customer support`,
    `📱 ${channelLabel}: ${contact.whatsappUrl}`,
    `📞 ${phoneLabel}: ${contact.directPhone}`,
  ].join('\n');
}
