import "server-only";
import { api } from "./api/client";

export type Phase = { code: string; name: string; sortOrder: number };
export type Grade = { code: string; name: string; phaseCode: string; sortOrder: number };
export type Subject = { code: string; name: string; description: string; isLanguage: boolean; sortOrder: number };
export type Language = { code: string; name: string; sortOrder: number };
export type SubjectOffering = { subjectCode: string; gradeCode: string };
export type Room = { id: string; name: string; capacity: number; isActive: boolean };

/** CAPS phases, in curriculum order. Loaded from the API's `reference` module, never hard-coded. */
export async function getPhases() {
  return api.public.get<Phase[]>("/reference/phases", "reference");
}

export async function getGrades() {
  return api.public.get<Grade[]>("/reference/grades", "reference");
}

export async function getSubjects() {
  return api.public.get<Subject[]>("/reference/subjects", "reference");
}

export async function getLanguages() {
  return api.public.get<Language[]>("/reference/languages", "reference");
}

export async function getRooms() {
  return api.get<Room[]>("/reference/rooms");
}
