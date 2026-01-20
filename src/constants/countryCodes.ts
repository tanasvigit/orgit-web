export interface CountryCode {
  isoCode: string;
  name: string;
  dialCode: string;
}

// Minimal, but can be extended to full list of international dialing codes
export const COUNTRY_CODES: CountryCode[] = [
  { isoCode: 'IN', name: 'India', dialCode: '+91' },
  { isoCode: 'US', name: 'United States', dialCode: '+1' },
  { isoCode: 'GB', name: 'United Kingdom', dialCode: '+44' },
  { isoCode: 'AE', name: 'United Arab Emirates', dialCode: '+971' },
  { isoCode: 'AU', name: 'Australia', dialCode: '+61' },
  { isoCode: 'CA', name: 'Canada', dialCode: '+1' },
  { isoCode: 'DE', name: 'Germany', dialCode: '+49' },
  { isoCode: 'FR', name: 'France', dialCode: '+33' },
  { isoCode: 'SG', name: 'Singapore', dialCode: '+65' },
  { isoCode: 'ZA', name: 'South Africa', dialCode: '+27' },
];


