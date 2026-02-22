// Countries and cities for accommodation locations
// Focused on pilgrimage destinations

export interface City {
  value: string;
  label: string;
  label_ar: string;
  label_fr: string;
}

export interface Country {
  value: string;
  label: string;
  label_ar: string;
  label_fr: string;
  cities: City[];
}

export const countries: Country[] = [
  {
    value: 'SA',
    label: 'Saudi Arabia',
    label_ar: 'المملكة العربية السعودية',
    label_fr: 'Arabie Saoudite',
    cities: [
      { value: 'makkah', label: 'Makkah', label_ar: 'مكة المكرمة', label_fr: 'La Mecque' },
      { value: 'madinah', label: 'Madinah', label_ar: 'المدينة المنورة', label_fr: 'Médine' },
      { value: 'jeddah', label: 'Jeddah', label_ar: 'جدة', label_fr: 'Djeddah' },
      { value: 'taif', label: 'Taif', label_ar: 'الطائف', label_fr: 'Taïf' },
      { value: 'riyadh', label: 'Riyadh', label_ar: 'الرياض', label_fr: 'Riyad' },
    ]
  },
  {
    value: 'MA',
    label: 'Morocco',
    label_ar: 'المغرب',
    label_fr: 'Maroc',
    cities: [
      { value: 'casablanca', label: 'Casablanca', label_ar: 'الدار البيضاء', label_fr: 'Casablanca' },
      { value: 'rabat', label: 'Rabat', label_ar: 'الرباط', label_fr: 'Rabat' },
      { value: 'marrakech', label: 'Marrakech', label_ar: 'مراكش', label_fr: 'Marrakech' },
      { value: 'fes', label: 'Fes', label_ar: 'فاس', label_fr: 'Fès' },
      { value: 'tangier', label: 'Tangier', label_ar: 'طنجة', label_fr: 'Tanger' },
      { value: 'agadir', label: 'Agadir', label_ar: 'أكادير', label_fr: 'Agadir' },
      { value: 'oujda', label: 'Oujda', label_ar: 'وجدة', label_fr: 'Oujda' },
      { value: 'nador', label: 'Nador', label_ar: 'الناظور', label_fr: 'Nador' },
    ]
  },
  {
    value: 'AE',
    label: 'United Arab Emirates',
    label_ar: 'الإمارات العربية المتحدة',
    label_fr: 'Émirats Arabes Unis',
    cities: [
      { value: 'dubai', label: 'Dubai', label_ar: 'دبي', label_fr: 'Dubaï' },
      { value: 'abudhabi', label: 'Abu Dhabi', label_ar: 'أبو ظبي', label_fr: 'Abou Dabi' },
      { value: 'sharjah', label: 'Sharjah', label_ar: 'الشارقة', label_fr: 'Charjah' },
    ]
  },
  {
    value: 'EG',
    label: 'Egypt',
    label_ar: 'مصر',
    label_fr: 'Égypte',
    cities: [
      { value: 'cairo', label: 'Cairo', label_ar: 'القاهرة', label_fr: 'Le Caire' },
      { value: 'alexandria', label: 'Alexandria', label_ar: 'الإسكندرية', label_fr: 'Alexandrie' },
      { value: 'giza', label: 'Giza', label_ar: 'الجيزة', label_fr: 'Gizeh' },
    ]
  },
  {
    value: 'TR',
    label: 'Turkey',
    label_ar: 'تركيا',
    label_fr: 'Turquie',
    cities: [
      { value: 'istanbul', label: 'Istanbul', label_ar: 'إسطنبول', label_fr: 'Istanbul' },
      { value: 'ankara', label: 'Ankara', label_ar: 'أنقرة', label_fr: 'Ankara' },
      { value: 'antalya', label: 'Antalya', label_ar: 'أنطاليا', label_fr: 'Antalya' },
    ]
  },
  {
    value: 'JO',
    label: 'Jordan',
    label_ar: 'الأردن',
    label_fr: 'Jordanie',
    cities: [
      { value: 'amman', label: 'Amman', label_ar: 'عمّان', label_fr: 'Amman' },
      { value: 'aqaba', label: 'Aqaba', label_ar: 'العقبة', label_fr: 'Aqaba' },
    ]
  },
];

// Helper function to get cities by country
export function getCitiesByCountry(countryCode: string): City[] {
  const country = countries.find(c => c.value === countryCode);
  return country?.cities || [];
}

// Helper function to get country by code
export function getCountryByCode(countryCode: string): Country | undefined {
  return countries.find(c => c.value === countryCode);
}

// Helper function to get city by value in a country
export function getCityByValue(countryCode: string, cityValue: string): City | undefined {
  const country = countries.find(c => c.value === countryCode);
  return country?.cities.find(city => city.value === cityValue);
}

// Get localized label
export function getLocalizedLabel(item: { label: string; label_ar: string; label_fr: string }, language: string): string {
  switch (language) {
    case 'ar':
      return item.label_ar || item.label;
    case 'fr':
      return item.label_fr || item.label;
    default:
      return item.label;
  }
}
