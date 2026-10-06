export type IndiaProductNameEntry = {
  source_name_bn: string;
  name_bn: string;
  name_en: string;
  name_hi: string;
  packet_quantity: number;
};

/**
 * India product-name catalog prepared from the supplied ORDER LIST PDF.
 * The source contains one duplicated Portulaca/Time Flower row; this catalog
 * keeps one canonical product entry for that duplicate.
 *
 * Promotional phrases in the source order list are normalized out of the
 * canonical product name. Promotions/free-gift wording should be stored in
 * the product offer/promotion fields, not in the core product name.
 */
export const INDIA_PRODUCT_NAME_CATALOG: IndiaProductNameEntry[] = [
  { source_name_bn: 'মাত্র ২৯০ টাকায় পদ্মফুল চাষ করুন!', name_bn: 'পদ্মফুলের বীজ', name_en: 'Lotus Flower Seeds', name_hi: 'कमल के फूल के बीज', packet_quantity: 200 },
  { source_name_bn: 'মিক্স কালার পর্তুলিকা বা টাইম ফুলের বীজ', name_bn: 'মিক্স কালার পর্তুলিকা / টাইম ফুলের বীজ', name_en: 'Mix Color Portulaca / Time Flower Seeds', name_hi: 'मिक्स कलर पोर्टुलाका / टाइम फ्लावर के बीज', packet_quantity: 200 },
  { source_name_bn: 'কার্নেশনর্নে ফুলের বীজ', name_bn: 'কার্নেশন ফুলের বীজ', name_en: 'Carnation Flower Seeds', name_hi: 'कार्नेशन फूल के बीज', packet_quantity: 200 },
  { source_name_bn: 'মিক্স কালার কসমস ফুলের বীজ', name_bn: 'মিক্স কালার কসমস ফুলের বীজ', name_en: 'Mix Color Cosmos Flower Seeds', name_hi: 'मिक्स कलर कॉसमॉस फूल के बीज', packet_quantity: 200 },
  { source_name_bn: '৮ কালার মিক্স জিনিয়া ফুলের বীজ', name_bn: '৮ কালার মিক্স জিনিয়া ফুলের বীজ', name_en: '8-Color Mix Zinnia Flower Seeds', name_hi: '8 कलर मिक्स ज़िनिया फूल के बीज', packet_quantity: 200 },
  { source_name_bn: 'বড় ডাহলিয়া ফুলের বীজ', name_bn: 'বড় ডালিয়া ফুলের বীজ', name_en: 'Large Dahlia Flower Seeds', name_hi: 'बड़े डहलिया फूल के बीज', packet_quantity: 100 },
  { source_name_bn: 'পিঙ্ক ডেইজি- Pink Daisy ফুলের বীজ', name_bn: 'পিঙ্ক ডেইজি ফুলের বীজ', name_en: 'Pink Daisy Flower Seeds', name_hi: 'पिंक डेज़ी फूल के बीज', packet_quantity: 100 },
  { source_name_bn: 'ওয়াল কারপেট বীজ', name_bn: 'ওয়াল কার্পেট বীজ', name_en: 'Wall Carpet Seeds', name_hi: 'वॉल कार्पेट के बीज', packet_quantity: 100 },
  { source_name_bn: 'লাল গোলাপ ফুলের বীজ', name_bn: 'লাল গোলাপ ফুলের বীজ', name_en: 'Red Rose Flower Seeds', name_hi: 'लाल गुलाब के फूल के बीज', packet_quantity: 100 },
  { source_name_bn: 'হলুদলু গোলাপ ফুলের বীজ', name_bn: 'হলুদ গোলাপ ফুলের বীজ', name_en: 'Yellow Rose Flower Seeds', name_hi: 'पीले गुलाब के फूल के बीज', packet_quantity: 100 },
  { source_name_bn: 'বেড়ালের ঘাস', name_bn: 'বেড়ালের ঘাসের বীজ', name_en: 'Cat Grass Seeds', name_hi: 'कैट ग्रास के बीज', packet_quantity: 150 },
  { source_name_bn: 'বীজবিহীন তরমুজমু', name_bn: 'বীজবিহীন তরমুজের বীজ', name_en: 'Seedless Watermelon Seeds', name_hi: 'बीजरहित तरबूज के बीज', packet_quantity: 100 },
  { source_name_bn: '১২ মাস ফলনশীল বিদেশি স্ট্রবেরি বীজ', name_bn: '১২ মাস ফলনশীল বিদেশি স্ট্রবেরি বীজ', name_en: '12-Month Fruiting Foreign Strawberry Seeds', name_hi: '12 महीने फल देने वाले विदेशी स्ट्रॉबेरी के बीज', packet_quantity: 200 },
  { source_name_bn: 'চেরি টমেটো + স্ট্রবেরি কম্বো বীজ 12 mash', name_bn: 'চেরি টমেটো + স্ট্রবেরি কম্বো বীজ', name_en: 'Cherry Tomato + Strawberry Combo Seeds', name_hi: 'चेरी टमाटर + स्ट्रॉबेरी कॉम्बो बीज', packet_quantity: 200 },
  { source_name_bn: 'F1 হাইব্রিড তরমুজের বীজ 6-8 K গোলাকৃতি', name_bn: 'F1 হাইব্রিড গোলাকৃতি তরমুজের বীজ (৬–৮ কেজি)', name_en: 'F1 Hybrid Round Watermelon Seeds (6–8 kg)', name_hi: 'F1 हाइब्रिड गोल तरबूज के बीज (6–8 किग्रा)', packet_quantity: 100 },
  { source_name_bn: 'F1 হাইব্রিড কালো তরমুজের বীজ 8-10K', name_bn: 'F1 হাইব্রিড কালো তরমুজের বীজ (৮–১০ কেজি)', name_en: 'F1 Hybrid Black Watermelon Seeds (8–10 kg)', name_hi: 'F1 हाइब्रिड काले तरबूज के बीज (8–10 किग्रा)', packet_quantity: 100 },
  { source_name_bn: 'বিদেশি তরমুজের বীজ- 02 Lazy', name_bn: 'বিদেশি তরমুজের বীজ – 02 Lazy', name_en: 'Foreign Watermelon Seeds – 02 Lazy', name_hi: 'विदेशी तरबूज के बीज – 02 Lazy', packet_quantity: 100 },
  { source_name_bn: 'বিদেশি তরমুজের বীজ- সুগার কিরিন', name_bn: 'বিদেশি তরমুজের বীজ – সুগার কিরিন', name_en: 'Foreign Watermelon Seeds – Sugar Kirin', name_hi: 'विदेशी तरबूज के बीज – Sugar Kirin', packet_quantity: 100 },
  { source_name_bn: 'পেপিনো মেলনের বীজ', name_bn: 'পেপিনো মেলনের বীজ', name_en: 'Pepino Melon Seeds', name_hi: 'पेपिनो मेलन के बीज', packet_quantity: 100 },
  { source_name_bn: 'বিদেশি তরমুজের বীজ- গ্রিন টেক্সার', name_bn: 'বিদেশি তরমুজের বীজ – গ্রিন টেক্সার', name_en: 'Foreign Watermelon Seeds – Green Texar', name_hi: 'विदेशी तरबूज के बीज – Green Texar', packet_quantity: 100 },
  { source_name_bn: 'হাইব্রিড মরিচ, রানি লঙ্কা (বাণিজ্যিক চাষ) ...', name_bn: 'হাইব্রিড মরিচ – রানি লঙ্কা', name_en: 'Hybrid Chili – Rani Lanka', name_hi: 'हाइब्रिड मिर्च – रानी लंका', packet_quantity: 200 },
  { source_name_bn: 'বিদেশি লাল লম্বা মরিচের বীজ', name_bn: 'বিদেশি লাল লম্বা মরিচের বীজ', name_en: 'Foreign Long Red Chili Seeds', name_hi: 'विदेशी लंबी लाल मिर्च के बीज', packet_quantity: 200 },
  { source_name_bn: '১২ মাসি বানানা লম্বা মরিচের বীজ', name_bn: '১২ মাসি বানানা লম্বা মরিচের বীজ', name_en: '12-Month Banana Long Chili Seeds', name_hi: '12 महीने वाली Banana Long Chili के बीज', packet_quantity: 200 },
  { source_name_bn: 'বিদেশি ঝাঁঝালো সাদা মরিচ', name_bn: 'বিদেশি ঝাঁঝালো সাদা মরিচের বীজ', name_en: 'Foreign Spicy White Chili Seeds', name_hi: 'विदेशी तीखी सफेद मिर्च के बीज', packet_quantity: 100 },
  { source_name_bn: 'মিক্স কালার ক্যাপসিকাম বীজ', name_bn: 'মিক্স কালার ক্যাপসিকাম বীজ', name_en: 'Mixed Color Capsicum Seeds', name_hi: 'मिक्स कलर शिमला मिर्च के बीज', packet_quantity: 200 },
  { source_name_bn: 'উচ্চ ফলনশীল নাগা বোম্বাই মরিচের বীজ ...', name_bn: 'উচ্চ ফলনশীল নাগা বোম্বাই মরিচের বীজ', name_en: 'High-Yield Naga Bombay Chili Seeds', name_hi: 'हाई-यील्ड नागा बॉम्बे मिर्च के बीज', packet_quantity: 200 },
  { source_name_bn: "এক গাছেই ৫ রঙের মরিচে'র বীজ", name_bn: 'পাঁচরঙা মরিচের বীজ', name_en: 'Five-Color Chili Seeds', name_hi: 'पांच रंग वाली मिर्च के बीज', packet_quantity: 300 },
  { source_name_bn: 'বিদেশি কালো মরিচের বীজ', name_bn: 'বিদেশি কালো মরিচের বীজ', name_en: 'Foreign Black Chili Seeds', name_hi: 'विदेशी काली मिर्च के बीज', packet_quantity: 100 },
  { source_name_bn: 'বিদেশি হলুদলু স্কোয়াশের বীজ', name_bn: 'বিদেশি হলুদ স্কোয়াশের বীজ', name_en: 'Foreign Yellow Squash Seeds', name_hi: 'विदेशी पीली स्क्वैश के बीज', packet_quantity: 100 },
  { source_name_bn: 'Long Gourd - সবুজ লম্বা লাউ / বাঁশ লাউ ...', name_bn: 'লং গার্ড – সবুজ লম্বা লাউ / বাঁশ লাউ', name_en: 'Long Gourd – Green Long Gourd / Bamboo Gourd Seeds', name_hi: 'लॉन्ग गार्ड – हरी लंबी लौकी / बाँस लौकी के बीज', packet_quantity: 200 },
  { source_name_bn: 'হাইব্রিড কুমড়া বীজ- লন্ডন-২', name_bn: 'হাইব্রিড কুমড়ার বীজ – London-2', name_en: 'Hybrid Pumpkin Seeds – London-2', name_hi: 'हाइब्रिड कद्दू के बीज – London-2', packet_quantity: 200 },
  { source_name_bn: 'জায়েন্ট কুমড়ার বীজ- ওজন ২৫ ৩৫ – কেজি', name_bn: 'জায়ান্ট কুমড়ার বীজ – ২৫–৩৫ কেজি', name_en: 'Giant Pumpkin Seeds – 25–35 kg', name_hi: 'जायंट कद्दू के बीज – 25–35 किग्रा', packet_quantity: 200 },
  { source_name_bn: 'বিদেশি চালকুমড়ার বীজ', name_bn: 'বিদেশি চালকুমড়ার বীজ', name_en: 'Foreign Ash Gourd Seeds', name_hi: 'विदेशी पेठा / ऐश गॉर्ड के बीज', packet_quantity: 100 },
  { source_name_bn: 'হাইব্রিড চালকুমড়ার বীজ- সোহাগী ৪৫', name_bn: 'হাইব্রিড চালকুমড়ার বীজ – সোহাগী ৪৫', name_en: 'Hybrid Ash Gourd Seeds – Sohagi 45', name_hi: 'हाइब्रिड ऐश गॉर्ड के बीज – Sohagi 45', packet_quantity: 100 },
  { source_name_bn: 'বিদেশি হাইব্রিড সবুজ মিষ্টি কুমড়ার বীজ', name_bn: 'বিদেশি হাইব্রিড সবুজ মিষ্টি কুমড়ার বীজ', name_en: 'Foreign Hybrid Green Sweet Pumpkin Seeds', name_hi: 'विदेशी हाइब्रिड हरे मीठे कद्दू के बीज', packet_quantity: 100 },
  { source_name_bn: 'হাজারী লাউ- ৫ গ্রাম প্যাকেট', name_bn: 'হাজারী লাউ – ৫ গ্রাম প্যাকেট', name_en: 'Hazari Bottle Gourd – 5 g Packet', name_hi: 'हजारी लौकी – 5 ग्राम पैकेट', packet_quantity: 100 },
  { source_name_bn: 'বিদেশি হাইব্রিড কালো মিষ্টি কুমড়ার বীজ', name_bn: 'বিদেশি হাইব্রিড কালো মিষ্টি কুমড়ার বীজ', name_en: 'Foreign Hybrid Black Sweet Pumpkin Seeds', name_hi: 'विदेशी हाइब्रिड काले मीठे कद्दू के बीज', packet_quantity: 100 },
  { source_name_bn: 'উচ্চ ফলনশীল বারি - 12 ... বেগুনের বীজ ...', name_bn: 'উচ্চ ফলনশীল BARI-12 বেগুনের বীজ', name_en: 'High-Yield BARI-12 Eggplant Seeds', name_hi: 'हाई-यील्ड BARI-12 बैंगन के बीज', packet_quantity: 200 },
  { source_name_bn: 'বিদেশি চিকন লম্বা বেগুনের বীজ', name_bn: 'বিদেশি চিকন লম্বা বেগুনের বীজ', name_en: 'Foreign Thin Long Eggplant Seeds', name_hi: 'विदेशी पतले लंबे बैंगन के बीज', packet_quantity: 200 },
  { source_name_bn: 'বিদেশি সবুজ বেগুনের বীজ', name_bn: 'বিদেশি সবুজ বেগুনের বীজ', name_en: 'Foreign Green Eggplant Seeds', name_hi: 'विदेशी हरे बैंगन के बीज', packet_quantity: 200 },
  { source_name_bn: 'কালো তাল বেগুনের বীজ', name_bn: 'কালো তাল বেগুনের বীজ', name_en: 'Black Taal Eggplant Seeds', name_hi: 'काले ताल बैंगन के बीज', packet_quantity: 200 },
  { source_name_bn: 'সাদা ডিম বেগুনের বীজ', name_bn: 'সাদা ডিম বেগুনের বীজ', name_en: 'White Egg Eggplant Seeds', name_hi: 'सफेद अंडा बैंगन के बीज', packet_quantity: 200 },
  { source_name_bn: 'গাঢ় বেগুনি বিদেশি বেগুনের বীজ', name_bn: 'গাঢ় বেগুনি বিদেশি বেগুনের বীজ', name_en: 'Dark Purple Foreign Eggplant Seeds', name_hi: 'गहरे बैंगनी विदेशी बैंगन के बीज', packet_quantity: 200 },
  { source_name_bn: '১২ মাসি বরবটির বীজ', name_bn: '১২ মাসি বরবটির বীজ', name_en: '12-Month Yardlong Bean Seeds', name_hi: '12 महीने वाली बरबटी के बीज', packet_quantity: 200 },
  { source_name_bn: 'হাইব্রিড গ্রিন লেডি পেপে বীজ', name_bn: 'হাইব্রিড গ্রিন লেডি পেঁপে বীজ', name_en: 'Hybrid Green Lady Papaya Seeds', name_hi: 'हाइब्रिड ग्रीन लेडी पपीते के बीज', packet_quantity: 300 },
  { source_name_bn: '১২ মাসি কেরেলা শিমের বীজ', name_bn: '১২ মাসি Kerela Shim-এর বীজ', name_en: '12-Month Kerela Shim Seeds', name_hi: '12 महीने वाली Kerela Shim के बीज', packet_quantity: 100 },
  { source_name_bn: 'লাল স্ট্রবেরি বীজ (আনুমানিক ২০০ বীজ)', name_bn: 'লাল স্ট্রবেরি বীজ', name_en: 'Red Strawberry Seeds', name_hi: 'लाल स्ट्रॉबेरी के बीज', packet_quantity: 100 },
  { source_name_bn: 'বিলাতি ধনিয়া পাতার বীজ', name_bn: 'বিলাতি ধনিয়া পাতার বীজ', name_en: 'Foreign Coriander Leaf Seeds', name_hi: 'विदेशी धनिया पत्ती के बीज', packet_quantity: 100 },
  { source_name_bn: 'Green okra gm 5 (সবুজ ঢেঁড়সের বীজ- ৭০ +/- বীজ', name_bn: 'গ্রিন ওকরা – ৫ গ্রাম (প্রায় ৭০ ± বীজ)', name_en: 'Green Okra Seeds – 5 g (Approx. 70 ± Seeds)', name_hi: 'ग्रीन भिंडी के बीज – 5 ग्राम (लगभग 70 ± बीज)', packet_quantity: 100 },
  { source_name_bn: 'হাইব্রিড ঢেঁড়স, তিশা', name_bn: 'হাইব্রিড ঢেঁড়স – তিশা', name_en: 'Hybrid Okra – Tisha', name_hi: 'हाइब्रिड भिंडी – Tisha', packet_quantity: 100 },
  { source_name_bn: 'হাইব্রিড ঝিংগা, গ্রিন এরো', name_bn: 'হাইব্রিড ঝিঙা – Green Arrow', name_en: 'Hybrid Ridge Gourd – Green Arrow', name_hi: 'हाइब्रिड तुरई – Green Arrow', packet_quantity: 100 },
  { source_name_bn: 'দেশি ধনিয়া পাতার বীজ', name_bn: 'দেশি ধনিয়া পাতার বীজ', name_en: 'Local Coriander Leaf Seeds', name_hi: 'देशी धनिया पत्ती के बीज', packet_quantity: 100 },
  { source_name_bn: 'হাইব্রিড ১২ মাসি সজিনা বীজ- ওডিসি ৩', name_bn: 'হাইব্রিড ১২ মাসি সজিনা বীজ – Odyssey 3', name_en: 'Hybrid 12-Month Moringa Seeds – ODC-3', name_hi: 'हाइब्रिड 12 महीने वाली सहजन के बीज – ODC-3', packet_quantity: 100 },
  { source_name_bn: 'মোটাডগা লাল পুইশাকের বীজ', name_bn: 'মোটা ডাঁটা লাল পুঁইশাকের বীজ', name_en: 'Thick-Stem Red Malabar Spinach Seeds', name_hi: 'मोटी डंठल वाली लाल मालाबार पालक के बीज', packet_quantity: 100 },
  { source_name_bn: 'হাইব্রিড পেঁপের বীজ- রেড ল্যান্ড', name_bn: 'হাইব্রিড পেঁপের বীজ – Red Land', name_en: 'Hybrid Papaya Seeds – Red Land', name_hi: 'हाइब्रिड पपीते के बीज – Red Land', packet_quantity: 100 },
  { source_name_bn: 'বারোমাসি F1 তাল বেগুন বীজ', name_bn: 'বারোমাসি F1 তাল বেগুনের বীজ', name_en: 'Year-Round F1 Taal Eggplant Seeds', name_hi: 'सालभर वाली F1 ताल बैंगन के बीज', packet_quantity: 200 },
  { source_name_bn: 'এরাবিয়ান শসা বীজ + হাজারী লাউ বীজ ফ্রি', name_bn: 'এরাবিয়ান শসার বীজ + হাজারী লাউ বীজ কম্বো', name_en: 'Arabian Cucumber Seeds + Hazari Bottle Gourd Seeds Combo', name_hi: 'अरबियन खीरा बीज + हजारी लौकी बीज कॉम्बो', packet_quantity: 200 },
  { source_name_bn: 'হাইব্রিড F-1 হাজারী লাউ বীজ', name_bn: 'হাইব্রিড F1 হাজারী লাউ বীজ', name_en: 'Hybrid F1 Hazari Bottle Gourd Seeds', name_hi: 'हाइब्रिड F1 हजारी लौकी के बीज', packet_quantity: 200 },
  { source_name_bn: 'উচ্চ ফলনশীল এরাবিয়ান শসার বীজ ... লাউ ফ্রি', name_bn: 'উচ্চ ফলনশীল এরাবিয়ান শসার বীজ', name_en: 'High-Yield Arabian Cucumber Seeds', name_hi: 'हाई-यील्ड अरबियन खीरे के बीज', packet_quantity: 100 },
  { source_name_bn: 'হাইব্রিড করলা, নবাব', name_bn: 'হাইব্রিড করলা – নবাব', name_en: 'Hybrid Bitter Gourd – Nawab', name_hi: 'हाइब्रिड करेला – Nawab', packet_quantity: 200 },
  { source_name_bn: 'হাইব্রিড শসা, অসিম-৩৩', name_bn: 'হাইব্রিড শসা – অসিম-৩৩', name_en: 'Hybrid Cucumber – Asim-33', name_hi: 'हाइब्रिड खीरा – Asim-33', packet_quantity: 100 },
  { source_name_bn: 'ম্যাংগো টমেটোর বীজ', name_bn: 'ম্যাংগো টমেটোর বীজ', name_en: 'Mango Tomato Seeds', name_hi: 'मैंगो टोमैटो के बीज', packet_quantity: 100 },
  { source_name_bn: 'বিদেশি হাইব্রিড লাল টমেটোর বীজ', name_bn: 'বিদেশি হাইব্রিড লাল টমেটোর বীজ', name_en: 'Foreign Hybrid Red Tomato Seeds', name_hi: 'विदेशी हाइब्रिड लाल टमाटर के बीज', packet_quantity: 100 },
  { source_name_bn: 'মিনি হলুদ টব-চেরি টমেটোর বীজ', name_bn: 'মিনি হলুদ টব-চেরি টমেটোর বীজ', name_en: 'Mini Yellow Tub Cherry Tomato Seeds', name_hi: 'मिनी पीले टब-चेरी टमाटर के बीज', packet_quantity: 100 },
  { source_name_bn: 'মিনি কালো টব-চেরি টমেটোর বীজ', name_bn: 'মিনি কালো টব-চেরি টমেটোর বীজ', name_en: 'Mini Black Tub Cherry Tomato Seeds', name_hi: 'मिनी काले टब-चेरी टमाटर के बीज', packet_quantity: 100 },
  { source_name_bn: 'সালাদী টমেটোর বীজ', name_bn: 'সালাদ টমেটোর বীজ', name_en: 'Salad Tomato Seeds', name_hi: 'सलाद टमाटर के बीज', packet_quantity: 100 },
  { source_name_bn: 'হলুদলু চেরি টমেটোর বীজ', name_bn: 'হলুদ চেরি টমেটোর বীজ', name_en: 'Yellow Cherry Tomato Seeds', name_hi: 'पीले चेरी टमाटर के बीज', packet_quantity: 100 },
  { source_name_bn: 'বড়ো জাতের হলুদ টমেটোর বীজ', name_bn: 'বড় জাতের হলুদ টমেটোর বীজ', name_en: 'Large Yellow Tomato Seeds', name_hi: 'बड़े आकार वाले पीले टमाटर के बीज', packet_quantity: 100 },
  { source_name_bn: 'মিনি লাল টব-চেরি টমেটোর বীজ', name_bn: 'মিনি লাল টব-চেরি টমেটোর বীজ', name_en: 'Mini Red Tub Cherry Tomato Seeds', name_hi: 'मिनी लाल टब-चेरी टमाटर के बीज', packet_quantity: 100 },
  { source_name_bn: 'স্টেক টমেটোর বীজ', name_bn: 'স্টেক টমেটোর বীজ', name_en: 'Steak Tomato Seeds', name_hi: 'स्टेक टमाटर के बीज', packet_quantity: 100 },
  { source_name_bn: 'উচ্চফলনশীল দেশি মূলার বীজ (২০ গ্রাম প্যাকেট)', name_bn: 'উচ্চফলনশীল দেশি মূলার বীজ – ২০ গ্রাম', name_en: 'High-Yield Local Radish Seeds – 20 g', name_hi: 'हाई-यील्ड देसी मूली के बीज – 20 ग्राम', packet_quantity: 100 },
  { source_name_bn: 'F1 হাইব্রিড বিটরুটের বীজ', name_bn: 'F1 হাইব্রিড বিটরুটের বীজ', name_en: 'F1 Hybrid Beetroot Seeds', name_hi: 'F1 हाइब्रिड चुकंदर के बीज', packet_quantity: 100 },
  { source_name_bn: 'বিদেশি কিং মূলার বীজ', name_bn: 'বিদেশি কিং মূলার বীজ', name_en: 'Foreign King Radish Seeds', name_hi: 'विदेशी किंग मूली के बीज', packet_quantity: 100 },
  { source_name_bn: 'সবুজ শালগমের বীজ', name_bn: 'সবুজ শালগমের বীজ', name_en: 'Green Turnip Seeds', name_hi: 'हरी शलजम के बीज', packet_quantity: 100 },
  { source_name_bn: 'ফুলকপির বীজ', name_bn: 'ফুলকপির বীজ', name_en: 'Cauliflower Seeds', name_hi: 'फूलगोभी के बीज', packet_quantity: 100 },
  { source_name_bn: 'বাঁধাকপির বীজ', name_bn: 'বাঁধাকপির বীজ', name_en: 'Cabbage Seeds', name_hi: 'पत्तागोभी के बीज', packet_quantity: 100 },
  { source_name_bn: 'পরীক্ষিত ব্রোকলির বীজ', name_bn: 'পরীক্ষিত ব্রোকলির বীজ', name_en: 'Tested Broccoli Seeds', name_hi: 'परीक्षित ब्रोकली के बीज', packet_quantity: 200 },
  { source_name_bn: 'বিশ্ববিখ্যাত চাংবাই পর্বতের জিনসেং বীজ', name_bn: 'চাংবাই পর্বতের জিনসেং বীজ', name_en: 'Changbai Mountain Ginseng Seeds', name_hi: 'चांगबाई पर्वत जिनसेंग के बीज', packet_quantity: 200 },
  { source_name_bn: 'পুদিনা পাতার বীজ', name_bn: 'পুদিনা পাতার বীজ', name_en: 'Mint Leaf Seeds', name_hi: 'पुदीना के बीज', packet_quantity: 200 },
];

if (INDIA_PRODUCT_NAME_CATALOG.length !== 79) {
  throw new Error(`Expected 79 canonical India products, found ${INDIA_PRODUCT_NAME_CATALOG.length}`);
}
