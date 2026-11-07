/** `03-endpoints-and-business-rules.md` §reviews: `listPublished` per tutor, 5 minute TTL, invalidated on `moderate`. */
export const REVIEWS_CACHE_TTL_SECONDS = 300;

export const reviewsCacheKeys = {
  listPublished: (tutorId: string) => `skolopals:reviews:listPublished:${tutorId}`,
};
