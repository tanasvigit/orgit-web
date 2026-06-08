import type { OrganizationStructureNode, OrganizationStructureTree } from '../services/settingsService';

type OrgProfile = {
  name: string;
  address: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  pinCode: string;
  gst: string;
  pan: string;
  cin: string;
  email: string;
  mobile: string;
  phoneNumber: string;
  logoUrl: string;
};

const stringValue = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const firstNonEmpty = (obj: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = stringValue(obj[key]);
    if (value) return value;
  }
  return '';
};

const getRootNode = (tree: OrganizationStructureTree | null | undefined): OrganizationStructureNode | null => {
  if (!tree) return null;
  if (tree.rootNode) return tree.rootNode;
  return tree.nodes.find((n) => n.levelNumber === 1) ?? null;
};

export function buildOrgProfileFromStructure(
  tree: OrganizationStructureTree | null | undefined
): OrgProfile | null {
  const root = getRootNode(tree);
  if (!root) return null;

  const fieldValues = (root.fieldValues ?? {}) as Record<string, unknown>;
  const meta = (root.metaJson ?? {}) as Record<string, unknown>;
  const merged = { ...meta, ...fieldValues };

  const addressLine1 = firstNonEmpty(merged, ['registered_address_line_1', 'address_line_1', 'addressLine1']);
  const addressLine2 = firstNonEmpty(merged, ['registered_address_line_2', 'address_line_2', 'addressLine2']);
  const city = firstNonEmpty(merged, ['city']);
  const state = firstNonEmpty(merged, ['state']);
  const country = firstNonEmpty(merged, ['country']);
  const pinCode = firstNonEmpty(merged, ['postal_code', 'pincode', 'pin_code', 'pinCode']);

  const assembledAddress = [addressLine1, addressLine2, city, state, country, pinCode].filter(Boolean).join(', ');
  const fallbackAddress = firstNonEmpty(merged, ['registered_address', 'address']);

  return {
    name:
      firstNonEmpty(merged, ['letterhead_name', 'display_name', 'registered_name', 'name', 'short_name']) ||
      root.name ||
      '',
    address: assembledAddress || fallbackAddress,
    addressLine1,
    addressLine2,
    city,
    state,
    country,
    pinCode,
    gst: firstNonEmpty(merged, ['gstin', 'gst']),
    pan: firstNonEmpty(merged, ['pan', 'pan_number', 'pan_of_the_entity']),
    cin: firstNonEmpty(merged, ['cin', 'cin_number', 'registration_number_of_the_entity']),
    email: firstNonEmpty(merged, ['official_email', 'email']),
    mobile: firstNonEmpty(merged, ['contact_number', 'mobile']),
    phoneNumber: firstNonEmpty(merged, ['contact_number', 'phone_number', 'phone']),
    logoUrl: firstNonEmpty(merged, ['logo_url', 'logoUrl', 'seal_stamp_image']),
  };
}

