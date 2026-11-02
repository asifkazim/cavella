import { placeholder } from './placeholder';
import type { BusinessInfo } from './types';

/** ✏️ OWNER: replace every `placeholder(...)` before launch (AC-REL-01). */
export const business: BusinessInfo = {
  name: 'Cavella',
  legalName: placeholder('company legal name'),
  taxId: placeholder('NIP'),
  email: placeholder('contact email'),
  phone: placeholder('contact phone'),
  social: [
    { network: 'instagram', url: placeholder('Instagram URL') },
    { network: 'facebook', url: placeholder('Facebook URL') },
  ],
};
