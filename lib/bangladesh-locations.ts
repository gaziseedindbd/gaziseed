export type District = {
  name: string;
  bn: string;
  thanas: string[];
};

export type Division = {
  name: string;
  bn: string;
  districts: District[];
};

export const bangladeshLocations: Division[] = [
  {
    name: 'Dhaka',
    bn: 'ঢাকা',
    districts: [
      {
        name: 'Dhaka',
        bn: 'ঢাকা',
        thanas: ['Dhanmondi', 'Gulshan', 'Banani', 'Mirpur', 'Mohammadpur', 'Uttara', 'Bashundhara', 'Jatrabari', 'Motijheel', 'Ramna', 'Tejgaon', 'Khilgaon', 'Cantonment', 'Keraniganj', 'Savar', 'Nawabganj', 'Dohar'],
      },
      {
        name: 'Gazipur',
        bn: 'গাজীপুর',
        thanas: ['Gazipur Sadar', 'Kaliakair', 'Kaliganj', 'Sreepur', 'Kapasia', 'Joydebpur'],
      },
      {
        name: 'Narayanganj',
        bn: 'নারায়ণগঞ্জ',
        thanas: ['Narayanganj Sadar', 'Bandar', 'Araihazar', 'Sonargaon', 'Rupganj', 'Siddhirganj'],
      },
      {
        name: 'Narsingdi',
        bn: 'নরসিংদী',
        thanas: ['Narsingdi Sadar', 'Belabo', 'Monohardi', 'Polash', 'Raipura', 'Shibpur'],
      },
      {
        name: 'Manikganj',
        bn: 'মানিকগঞ্জ',
        thanas: ['Manikganj Sadar', 'Daulatpur', 'Harirampur', 'Saturia', 'Shivalaya', 'Singair', 'Ghior'],
      },
      {
        name: 'Munshiganj',
        bn: 'মুন্সিগঞ্জ',
        thanas: ['Munshiganj Sadar', 'Lohajang', 'Sirajdikhan', 'Tongibari', 'Gazaria', 'Sreenagar'],
      },
      {
        name: 'Faridpur',
        bn: 'ফরিদপুর',
        thanas: ['Faridpur Sadar', 'Boalmari', 'Alfadanga', 'Madhukhali', 'Bhanga', 'Nagarkanda', 'Charbhadrasan', 'Sadarpur', 'Saltha'],
      },
      {
        name: 'Rajbari',
        bn: 'রাজবাড়ী',
        thanas: ['Rajbari Sadar', 'Pangsha', 'Baliakandi', 'Goalandaghat', 'Kalukhali'],
      },
      {
        name: 'Madaripur',
        bn: 'মাদারীপুর',
        thanas: ['Madaripur Sadar', 'Shibchar', 'Kalkini', 'Rajoir', 'Dasar'],
      },
      {
        name: 'Gopalganj',
        bn: 'গোপালগঞ্জ',
        thanas: ['Gopalganj Sadar', 'Kashiani', 'Tungipara', 'Muksudpur', 'Chitalmari', 'Kotalipara'],
      },
      {
        name: 'Tangail',
        bn: 'টাঙ্গাইল',
        thanas: ['Tangail Sadar', 'Tangail', 'Basail', 'Bhuapur', 'Delduar', 'Dhanbari', 'Ghatail', 'Gopalpur', 'Kalihati', 'Madhupur', 'Mirzapur', 'Nagarpur', 'Sakhipur'],
      },
      {
        name: 'Kishoreganj',
        bn: 'কিশোরগঞ্জ',
        thanas: ['Kishoreganj Sadar', 'Ajmiriganj', 'Austagram', 'Bajitpur', 'Bhairab', 'Hossainpur', 'Itna', 'Karimganj', 'Katiadi', 'Kuliarchar', 'Mithamain', 'Nikli', 'Pakundia', 'Tarail'],
      },
      {
        name: 'Shariatpur',
        bn: 'শরীয়তপুর',
        thanas: ['Shariatpur Sadar', 'Naria', 'Zanjira', 'Bhedarganj', 'Gosairhat', 'Damudya', 'Palong'],
      },
    ],
  },
  {
    name: 'Chattogram',
    bn: 'চট্টগ্রাম',
    districts: [
      {
        name: 'Chattogram',
        bn: 'চট্টগ্রাম',
        thanas: ['Chandgaon', 'Panchlaish', 'Double Mooring', 'Kotwali', 'Halishahar', 'Patenga', 'Bandar', 'Rauzan', 'Boalkhali', 'Sitakunda', 'Mirsharai', 'Satkania', 'Lohagara', 'Hathazari', 'Fatikchhari', 'Anwara', 'Chandanaish', 'Banshkhali', 'Sandwip', 'Karnaphuli', 'Patia', 'Rangunia'],
      },
      {
        name: 'Cox\'s Bazar',
        bn: 'কক্সবাজার',
        thanas: ['Cox\'s Bazar Sadar', 'Chakaria', 'Kutubdia', 'Maheshkhali', 'Pekua', 'Ramu', 'Teknaf', 'Ukhia'],
      },
      {
        name: 'Comilla',
        bn: 'কুমিল্লা',
        thanas: ['Comilla Sadar', 'Comilla Adarsha Sadar', 'Barura', 'Brahmanpara', 'Burichang', 'Chandina', 'Chauddagram', 'Daudkandi', 'Debidwar', 'Homna', 'Laksam', 'Meghna', 'Monohorganj', 'Muradnagar', 'Nangalkot', 'Titas'],
      },
      {
        name: 'Chandpur',
        bn: 'চাঁদপুর',
        thanas: ['Chandpur Sadar', 'Faridganj', 'Haimchar', 'Haziganj', 'Kachua', 'Matlab North', 'Matlab South', 'Shahrasti'],
      },
      {
        name: 'Lakshmipur',
        bn: 'লক্ষ্মীপুর',
        thanas: ['Lakshmipur Sadar', 'Raipur', 'Ramganj', 'Ramgati', 'Kamalnagar'],
      },
      {
        name: 'Noakhali',
        bn: 'নোয়াখালী',
        thanas: ['Noakhali Sadar', 'Subarnachar', 'Begumganj', 'Chatkhil', 'Companiganj', 'Hatiya', 'Senbagh', 'Sonaimuri', 'Kabirhat'],
      },
      {
        name: 'Feni',
        bn: 'ফেনী',
        thanas: ['Feni Sadar', 'Chhagalnaiya', 'Daganbhuiyan', 'Fulgazi', 'Parshuram', 'Sonagazi'],
      },
      {
        name: 'Brahmanbaria',
        bn: 'ব্রাহ্মণবাড়িয়া',
        thanas: ['Brahmanbaria Sadar', 'Ashuganj', 'Banchharampur', 'Bijoynagar', 'Kasba', 'Nabinagar', 'Nasirnagar', 'Sarail', 'Akhaura', 'Bancharampur'],
      },
      {
        name: 'Rangamati',
        bn: 'রাঙ্গামাটি',
        thanas: ['Rangamati Sadar', 'Belaichhari', 'Bagaichhari', 'Barkal', 'Juraichhari', 'Kaptai', 'Kaukhali', 'Langadu', 'Naniarchar', 'Rajasthali'],
      },
      {
        name: 'Khagrachhari',
        bn: 'খাগড়াছড়ি',
        thanas: ['Khagrachhari Sadar', 'Dighinala', 'Lakshmichhari', 'Mahalchhari', 'Manikchhari', 'Matiranga', 'Panchhari', 'Ramgarh', 'Gujyachhari'],
      },
      {
        name: 'Bandarban',
        bn: 'বান্দরবান',
        thanas: ['Bandarban Sadar', 'Ali kadam', 'Lama', 'Naikhongchhari', 'Rowangchhari', 'Ruma', 'Thanchi'],
      },
    ],
  },
  {
    name: 'Rajshahi',
    bn: 'রাজশাহী',
    districts: [
      {
        name: 'Rajshahi',
        bn: 'রাজশাহী',
        thanas: ['Boalia', 'Rajpara', 'Chandrima', 'Khandan', 'Motihar', 'Paba', 'Padma', 'Shah Makdam', 'Bagha', 'Bagmara', 'Charghat', 'Durgapur', 'Godagari', 'Mohanpur', 'Puthia', 'Tanore'],
      },
      {
        name: 'Natore',
        bn: 'নাটোর',
        thanas: ['Natore Sadar', 'Bagatipara', 'Baraigram', 'Gurudaspur', 'Lalpur', 'Singra'],
      },
      {
        name: 'Nawabganj',
        bn: 'নবাবগঞ্জ',
        thanas: ['Shibganj', 'Nawabganj Sadar', 'Bholahat', 'Gomastapur', 'Nachole', 'Volahat'],
      },
      {
        name: 'Naogaon',
        bn: 'নওগাঁ',
        thanas: ['Naogaon Sadar', 'Atrai', 'Badalgachhi', 'Dhamoirhat', 'Manda', 'Mahadebpur', 'Niamatpur', 'Patnitala', 'Porsha', 'Raninagar', 'Sapahar'],
      },
      {
        name: 'Pabna',
        bn: 'পাবনা',
        thanas: ['Pabna Sadar', 'Atgharia', 'Bera', 'Bhangura', 'Chatmohar', 'Faridpur', 'Ishwardi', 'Santhia', 'Sujanagar'],
      },
      {
        name: 'Sirajganj',
        bn: 'সিরাজগঞ্জ',
        thanas: ['Sirajganj Sadar', 'Belkuchi', 'Chauhali', 'Kamarkhanda', 'Kazipur', 'Raiganj', 'Salanga', 'Shahjadpur', 'Tarash', 'Ullahpara'],
      },
      {
        name: 'Bogura',
        bn: 'বগুড়া',
        thanas: ['Bogura Sadar', 'Adamdighi', 'Dhunat', 'Dhupchanchia', 'Gabtali', 'Kahaloo', 'Nandigram', 'Sariakandi', 'Shajahanpur', 'Sherpur', 'Shibganj', 'Sonatala'],
      },
      {
        name: 'Joypurhat',
        bn: 'জয়পুরহাট',
        thanas: ['Joypurhat Sadar', 'Akkelpur', 'Kalai', 'Khetlal', 'Panchbibi'],
      },
    ],
  },
  {
    name: 'Khulna',
    bn: 'খুলনা',
    districts: [
      {
        name: 'Khulna',
        bn: 'খুলনা',
        thanas: ['Khulna Sadar', 'Dighalia', 'Dumuria', 'Koyra', 'Paikgachha', 'Phultala', 'Batiaghata', 'Rupsa', 'Terokhada', 'Dacope'],
      },
      {
        name: 'Jessore',
        bn: 'যশোর',
        thanas: ['Jessore Sadar', 'Abhaynagar', 'Bagherpara', 'Chaugachha', 'Jhikargachha', 'Keshabpur', 'Manirampur', 'Sharsha'],
      },
      {
        name: 'Satkhira',
        bn: 'সাতক্ষীরা',
        thanas: ['Satkhira Sadar', 'Assasuni', 'Debhata', 'Kalaroa', 'Kaliganj', 'Shyamnagar', 'Tala'],
      },
      {
        name: 'Bagerhat',
        bn: 'বাগেরহাট',
        thanas: ['Bagerhat Sadar', 'Chitalmari', 'Fakirhat', 'Kachua', 'Mollahat', 'Mongla', 'Morrelganj', 'Rampal', 'Sarankhola'],
      },
      {
        name: 'Magura',
        bn: 'মাগুরা',
        thanas: ['Magura Sadar', 'Mohammadpur', 'Shalikha', 'Sreepur'],
      },
      {
        name: 'Narail',
        bn: 'নড়াইল',
        thanas: ['Narail Sadar', 'Kalia', 'Lohagara'],
      },
      {
        name: 'Jhenaidah',
        bn: 'ঝিনাইদহ',
        thanas: ['Jhenaidah Sadar', 'Harinakunda', 'Kaliganj', 'Kotchandpur', 'Maheshpur', 'Shailkupa'],
      },
      {
        name: 'Chuadanga',
        bn: 'চুয়াডাঙ্গা',
        thanas: ['Chuadanga Sadar', 'Alamdanga', 'Damurhuda', 'Jibannagar'],
      },
      {
        name: 'Kushtia',
        bn: 'কুষ্টিয়া',
        thanas: ['Kushtia Sadar', 'Bheramara', 'Daulatpur', 'Khoksa', 'Kumarkhali', 'Mirpur'],
      },
      {
        name: 'Meherpur',
        bn: 'মেহেরপুর',
        thanas: ['Meherpur Sadar', 'Gangni', 'Mujibnagar'],
      },
    ],
  },
  {
    name: 'Barishal',
    bn: 'বরিশাল',
    districts: [
      {
        name: 'Barishal',
        bn: 'বরিশাল',
        thanas: ['Barishal Sadar', 'Agailjhara', 'Babuganj', 'Bakerganj', 'Banaripara', 'Gaurnadi', 'Mehendiganj', 'Muladi', 'Wazirpur', 'Uzirpur'],
      },
      {
        name: 'Barguna',
        bn: 'বরগুনা',
        thanas: ['Barguna Sadar', 'Amtali', 'Bamna', 'Betagi', 'Patharghata', 'Taltali'],
      },
      {
        name: 'Jhalokati',
        bn: 'ঝালকাঠি',
        thanas: ['Jhalokati Sadar', 'Kathalia', 'Nalchity', 'Rajapur'],
      },
      {
        name: 'Patuakhali',
        bn: 'পটুয়াখালী',
        thanas: ['Patuakhali Sadar', 'Bauphal', 'Dumki', 'Dashmina', 'Galachipa', 'Kalapara', 'Mirzaganj', 'Rangabali'],
      },
      {
        name: 'Pirojpur',
        bn: 'পিরোজপুর',
        thanas: ['Pirojpur Sadar', 'Bhandaria', 'Kaukhali', 'Mathbaria', 'Nazirpur', 'Nesarabad', 'Zianagar'],
      },
      {
        name: 'Bhola',
        bn: 'ভোলা',
        thanas: ['Bhola Sadar', 'Burhanuddin', 'Char Fasson', 'Daulatkhan', 'Lalmohan', 'Manpura', 'Tazumuddin'],
      },
    ],
  },
  {
    name: 'Sylhet',
    bn: 'সিলেট',
    districts: [
      {
        name: 'Sylhet',
        bn: 'সিলেট',
        thanas: ['Sylhet Sadar', 'Balaganj', 'Beanibazar', 'Bishwanath', 'Companiganj', 'Dakshin Surma', 'Fenchuganj', 'Golapganj', 'Gowainghat', 'Jaintiapur', 'Kanaighat', 'Osmani Nagar', 'South Surma', 'Zakiganj'],
      },
      {
        name: 'Moulvibazar',
        bn: 'মৌলভীবাজার',
        thanas: ['Moulvibazar Sadar', 'Barlekha', 'Juri', 'Kamalganj', 'Kulaura', 'Rajnagar', 'Sreemangal'],
      },
      {
        name: 'Habiganj',
        bn: 'হবিগঞ্জ',
        thanas: ['Habiganj Sadar', 'Ajmiriganj', 'Bahubal', 'Baniachong', 'Chunarughat', 'Lakhai', 'Madhabpur', 'Nabiganj', 'Shaistaganj'],
      },
      {
        name: 'Sunamganj',
        bn: 'সুনামগঞ্জ',
        thanas: ['Sunamganj Sadar', 'Bishwamvarpur', 'Chhatak', 'Dakshin Sunamganj', 'Derai', 'Dharampasha', 'Dowarabazar', 'Jagannathpur', 'Jamalganj', 'Sulla', 'Tahirpur'],
      },
    ],
  },
  {
    name: 'Rangpur',
    bn: 'রংপুর',
    districts: [
      {
        name: 'Rangpur',
        bn: 'রংপুর',
        thanas: ['Rangpur Sadar', 'Badarganj', 'Gangachara', 'Kaunia', 'Mithapukur', 'Pirgacha', 'Pirganj', 'Rajarhat', 'Taraganj'],
      },
      {
        name: 'Dinajpur',
        bn: 'দিনাজপুর',
        thanas: ['Dinajpur Sadar', 'Birampur', 'Birganj', 'Biral', 'Bochaganj', 'Chirirbandar', 'Fulbari', 'Ghoraghat', 'Hakimpur', 'Kaharole', 'Khansama', 'Nawabganj', 'Parbatipur'],
      },
      {
        name: 'Kurigram',
        bn: 'কুড়িগ্রাম',
        thanas: ['Kurigram Sadar', 'Bhurungamari', 'Char Rajibpur', 'Chilmari', 'Phulbari', 'Nageshwari', 'Rajarhat', 'Raomari', 'Ulipur'],
      },
      {
        name: 'Lalmonirhat',
        bn: 'লালমনিরহাট',
        thanas: ['Lalmonirhat Sadar', 'Aditmari', 'Hatibandha', 'Kaliganj', 'Patgram'],
      },
      {
        name: 'Nilphamari',
        bn: 'নীলফামারী',
        thanas: ['Nilphamari Sadar', 'Dimla', 'Domar', 'Jaldhaka', 'Kishoreganj', 'Saidpur'],
      },
      {
        name: 'Panchagarh',
        bn: 'পঞ্চগড়',
        thanas: ['Panchagarh Sadar', 'Atwari', 'Boda', 'Debiganj', 'Tetulia'],
      },
      {
        name: 'Thakurgaon',
        bn: 'ঠাকুরগাঁ',
        thanas: ['Thakurgaon Sadar', 'Baliadangi', 'Haripur', 'Pirganj', 'Ranisankail'],
      },
      {
        name: 'Gaibandha',
        bn: 'গাইবান্ধা',
        thanas: ['Gaibandha Sadar', 'Fulchhari', 'Gobindaganj', 'Palashbari', 'Sadullapur', 'Saghata', 'Sundarganj'],
      },
    ],
  },
  {
    name: 'Mymensingh',
    bn: 'ময়মনসিংহ',
    districts: [
      {
        name: 'Mymensingh',
        bn: 'ময়মনসিংহ',
        thanas: ['Mymensingh Sadar', 'Bhaluka', 'Dhobaura', 'Dhulla', 'Fulbaria', 'Gaffargaon', 'Gauripur', 'Haluaghat', 'Ishwarganj', 'Muktagachha', 'Nandail', 'Phulpur', 'Trishal', 'Tarakanda'],
      },
      {
        name: 'Jamalpur',
        bn: 'জামালপুর',
        thanas: ['Jamalpur Sadar', 'Bakshiganj', 'Dewanganj', 'Islampur', 'Madarganj', 'Melandaha', 'Sarishabari'],
      },
      {
        name: 'Sherpur',
        bn: 'শেরপুর',
        thanas: ['Sherpur Sadar', 'Jhenaigati', 'Nalitabari', 'Nakla', 'Sreebardi'],
      },
      {
        name: 'Netrokona',
        bn: 'নেত্রকোণা',
        thanas: ['Netrokona Sadar', 'Atpara', 'Barhatta', 'Durgapur', 'Kalmakanda', 'Kendua', 'Khaliajuri', 'Madan', 'Mohanganj', 'Purbadhala'],
      },
    ],
  },
];

export function getDistricts(divisionName: string): District[] {
  const division = bangladeshLocations.find((d) => d.name === divisionName);
  return division ? division.districts : [];
}

export function getThanas(divisionName: string, districtName: string): string[] {
  const division = bangladeshLocations.find((d) => d.name === divisionName);
  if (!division) return [];
  const district = division.districts.find((d) => d.name === districtName);
  return district ? district.thanas : [];
}
