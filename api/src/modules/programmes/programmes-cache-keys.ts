/** `03-endpoints-and-business-rules.md` §programmes: 5 minute TTL, invalidated on create/update. */
export const PROGRAMMES_CACHE_TTL_SECONDS = 300;

export const programmesCacheKeys = {
  listPublished: 'skolopals:programmes:listPublished',
  byId: (id: string) => `skolopals:programmes:byId:${id}`,
};
