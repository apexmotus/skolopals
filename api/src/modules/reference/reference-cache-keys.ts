/** `03-endpoints-and-business-rules.md` §reference: TTL 1 hour, invalidated on the matching create in the same Manager. */
export const REFERENCE_CACHE_TTL_SECONDS = 3600;

export const referenceCacheKeys = {
  phases: 'skolopals:reference:phases',
  grades: 'skolopals:reference:grades',
  subjects: 'skolopals:reference:subjects',
  subjectOfferings: (gradeCode: string | null) =>
    `skolopals:reference:subjectOfferings:${gradeCode ?? 'all'}`,
  languages: 'skolopals:reference:languages',
  achievementLevels: 'skolopals:reference:achievementLevels',
  terms: 'skolopals:reference:terms',
  operatingHours: 'skolopals:reference:operatingHours',
  rooms: 'skolopals:reference:rooms',
};
