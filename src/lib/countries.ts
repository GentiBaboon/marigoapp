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

/**
 * Countries MarigoApp ships to.
 *
 * Deliberately just Albania and Kosovo — the markets the platform actually
 * serves. Delivery is priced per origin city, so this list doubles as the
 * vocabulary for that: a free-text city would let "Tirana", "Tirane" and
 * "tirana" bill as three separate courier runs.
 *
 * This is also the source for the phone-code picker on the address form.
 */
export const countries: Country[] = [
  {
    name: 'Albania',
    code: 'AL',
    phone: '+355',
    flag: '🇦🇱',
    // The 12 county seats plus the larger municipalities people ship from.
    cities: [
      { name: 'Tirana' },
      { name: 'Durrës' },
      { name: 'Vlorë' },
      { name: 'Shkodër' },
      { name: 'Elbasan' },
      { name: 'Fier' },
      { name: 'Korçë' },
      { name: 'Berat' },
      { name: 'Lushnjë' },
      { name: 'Pogradec' },
      { name: 'Kavajë' },
      { name: 'Gjirokastër' },
      { name: 'Sarandë' },
      { name: 'Laç' },
      { name: 'Kukës' },
      { name: 'Lezhë' },
      { name: 'Peshkopi' },
      { name: 'Kuçovë' },
      { name: 'Krujë' },
      { name: 'Burrel' },
      { name: 'Patos' },
      { name: 'Përmet' },
      { name: 'Ballsh' },
      { name: 'Bulqizë' },
      { name: 'Gramsh' },
      { name: 'Librazhd' },
      { name: 'Mamurras' },
      { name: 'Rrëshen' },
      { name: 'Shijak' },
      { name: 'Tepelenë' },
      { name: 'Divjakë' },
      { name: 'Fushë-Krujë' },
    ],
  },
  {
    name: 'Kosovo',
    // 'KS' is what Kosovo is shown as locally. XK is the ISO 3166 user-assigned
    // code, but this value is only ever a React key and the label on the phone
    // picker — nothing stores or matches on it.
    code: 'KS',
    phone: '+383',
    flag: '🇽🇰',
    // The seven main cities first, then the remaining municipalities.
    cities: [
      { name: 'Prishtinë' },
      { name: 'Prizren' },
      { name: 'Ferizaj' },
      { name: 'Pejë' },
      { name: 'Gjakovë' },
      { name: 'Gjilan' },
      { name: 'Mitrovicë' },
      { name: 'Podujevë' },
      { name: 'Vushtrri' },
      { name: 'Suharekë' },
      { name: 'Rahovec' },
      { name: 'Drenas' },
      { name: 'Lipjan' },
      { name: 'Malishevë' },
      { name: 'Kamenicë' },
      { name: 'Viti' },
      { name: 'Deçan' },
      { name: 'Istog' },
      { name: 'Klinë' },
      { name: 'Skenderaj' },
      { name: 'Dragash' },
      { name: 'Fushë Kosovë' },
      { name: 'Kaçanik' },
      { name: 'Shtime' },
      { name: 'Obiliq' },
      { name: 'Graçanicë' },
      { name: 'Shtërpcë' },
      { name: 'Junik' },
      { name: 'Mamushë' },
      { name: 'Novobërdë' },
      { name: 'Hani i Elezit' },
      { name: 'Kllokot' },
      { name: 'Partesh' },
      { name: 'Ranillug' },
      { name: 'Leposaviq' },
      { name: 'Zubin Potok' },
      { name: 'Zveçan' },
    ],
  },
];
