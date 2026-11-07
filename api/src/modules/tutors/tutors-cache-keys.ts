/** `03-endpoints-and-business-rules.md` §tutors: 5 minute TTL, invalidated on create/update/setCompetency/addQualification for that tutor. */
export const TUTORS_CACHE_TTL_SECONDS = 300;

export const tutorsCacheKeys = {
  bySlug: (slug: string) => `skolopals:tutors:bySlug:${slug}`,
  competencies: (tutorId: string) => `skolopals:tutors:competencies:${tutorId}`,
  qualifications: (tutorId: string) =>
    `skolopals:tutors:qualifications:${tutorId}`,
};
