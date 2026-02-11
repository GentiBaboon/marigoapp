export interface City {
  name: string;
}

export interface Country {
  name: string;
  code: string;
  phone: string;
  flag: string;
  cities: City[];
}

export const countries: Country[] = [
  {
    name: 'Albania',
    code: 'AL',
    phone: '+355',
    flag: '🇦🇱',
    cities: [
      { name: 'Tirana' },
      { name: 'Durrës' },
      { name: 'Vlorë' },
      { name: 'Shkodër' },
      { name: 'Elbasan' },
    ],
  },
  {
    name: 'Italy',
    code: 'IT',
    phone: '+39',
    flag: '🇮🇹',
    cities: [
      { name: 'Rome' },
      { name: 'Milan' },
      { name: 'Naples' },
      { name: 'Turin' },
      { name: 'Palermo' },
    ],
  },
  {
    name: 'United States',
    code: 'US',
    phone: '+1',
    flag: '🇺🇸',
    cities: [
      { name: 'New York' },
      { name: 'Los Angeles' },
      { name: 'Chicago' },
      { name: 'Houston' },
      { name: 'Phoenix' },
    ],
  },
    {
    name: 'United Kingdom',
    code: 'GB',
    phone: '+44',
    flag: '🇬🇧',
    cities: [
      { name: 'London' },
      { name: 'Manchester' },
      { name: 'Birmingham' },
      { name: 'Glasgow' },
      { name: 'Liverpool' },
    ],
  },
  {
    name: 'Germany',
    code: 'DE',
    phone: '+49',
    flag: '🇩🇪',
    cities: [
        { name: 'Berlin' },
        { name: 'Hamburg' },
        { name: 'Munich' },
        { name: 'Cologne' },
    ],
  },
  {
    name: 'France',
    code: 'FR',
    phone: '+33',
    flag: '🇫🇷',
    cities: [
        { name: 'Paris' },
        { name: 'Marseille' },
        { name: 'Lyon' },
        { name: 'Toulouse' },
    ],
  },
];
