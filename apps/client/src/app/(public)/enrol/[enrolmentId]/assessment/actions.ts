"use server";

import { api, ApiError } from "@skolopals/shared/api";

export type AptitudeQuestion = {
  seq: number;
  total: number;
  itemId: string;
  section: "literacy" | "logic";
  stem: string;
  options: { id: string; text: string }[];
  passage?: { id: string; title: string; text: string };
};

export type AptitudeStep = { done: boolean; question?: AptitudeQuestion; error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The API's 422 messages come from the database functions and are written for the parent. */
function failed(err: unknown): AptitudeStep {
  if (err instanceof ApiError && err.status < 500) return { done: false, error: err.message };
  return { done: false, error: "We could not reach the centre. Check your connection and try again." };
}

export async function nextQuestion(attemptId: string): Promise<AptitudeStep> {
  if (!UUID.test(attemptId)) return { done: false, error: "This test link is not valid." };
  try {
    return await api.get<AptitudeStep>(`/aptitude/attempts/${attemptId}/next`);
  } catch (err) {
    return failed(err);
  }
}

/** Saves one answer and returns the next question, so a closed tab resumes where it left off. */
export async function answerQuestion(
  attemptId: string,
  itemId: string,
  optionId: string,
  msTaken: number,
): Promise<AptitudeStep> {
  if (!UUID.test(attemptId)) return { done: false, error: "This test link is not valid." };
  try {
    return await api.post<AptitudeStep>(`/aptitude/attempts/${attemptId}/answers`, {
      itemId,
      optionId,
      msTaken: Math.max(0, Math.round(msTaken)),
    });
  } catch (err) {
    return failed(err);
  }
}
