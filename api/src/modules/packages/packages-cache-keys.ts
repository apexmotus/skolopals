/** `03-endpoints-and-business-rules.md` §packages: 5 minute TTL, invalidated on create/setPrice. */
export const PACKAGES_CACHE_TTL_SECONDS = 300;

export const packagesCacheKeys = {
  listActive: 'skolopals:packages:listActive',
  priceOn: (code: string, on: string) =>
    `skolopals:packages:priceOn:${code}:${on}`,
};
