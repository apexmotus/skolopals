/** `03-endpoints-and-business-rules.md` §timetable: 5 minute TTL, invalidated on any admin write to the touched class group. */
export const TIMETABLE_CACHE_TTL_SECONDS = 300;

export const timetableCacheKeys = {
  publicTimetable: 'skolopals:timetable:public',
  listActive: 'skolopals:timetable:classGroups:listActive',
  classGroupById: (id: string) => `skolopals:timetable:classGroups:byId:${id}`,
};
