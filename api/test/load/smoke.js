// Smoke load test for the Skolopals API. Run with the standalone k6 binary
// (not an npm package — see ../../docs/load-test.md for install/run
// instructions and every environment variable this script reads).
//
// Exercises the two weight classes that actually matter for this app's real
// traffic shape, per docs/nestjs-api-plan/13-phase4-hardening-docs.md task 4:
// - a representative cacheable public read (`GET /class-groups`) — this is
//   what every portal page loads on first paint, and is Redis-cached, so a
//   real deployment's p95 for it should stay low even under load.
// - the actual highest-frequency write during a real school day, which is
//   NOT a billing write (admin-rare, a handful of calls a month) but a tutor
//   marking attendance once per learner per class session — potentially
//   dozens of calls within the same few minutes every afternoon.
//
// Two separately-authenticated actors, because the two calls above need two
// different roles: `GET /class-groups` is readable by a parent (any
// authenticated role, really); `POST /class-sessions/:id/attendance` is
// `@Roles('admin', 'tutor')`-gated and 403s for a parent. A single "log in
// as a seeded parent" actor, as a literal reading of the task would have it,
// cannot exercise both endpoints — this script logs in as a seeded parent
// AND a seeded tutor instead, in `setup()`, once, and reuses both tokens
// across every VU/iteration.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;
const PARENT_EMAIL = __ENV.PARENT_EMAIL;
const PARENT_PASSWORD = __ENV.PARENT_PASSWORD;
const TUTOR_EMAIL = __ENV.TUTOR_EMAIL;
const TUTOR_PASSWORD = __ENV.TUTOR_PASSWORD;
const CLASS_SESSION_ID = __ENV.CLASS_SESSION_ID;
const LEARNER_ID = __ENV.LEARNER_ID;

export const options = {
  scenarios: {
    read: {
      executor: 'constant-vus',
      exec: 'readClassGroups',
      vus: Number(__ENV.READ_VUS || 20),
      duration: __ENV.DURATION || '2m',
    },
    write: {
      executor: 'constant-arrival-rate',
      exec: 'markAttendance',
      // The real traffic shape: a handful of attendance marks a minute, not
      // a sustained stream — constant-arrival-rate models that far better
      // than piling on VUs the way the read scenario above does.
      rate: Number(__ENV.WRITE_RATE_PER_MINUTE || 10),
      timeUnit: '1m',
      duration: __ENV.DURATION || '2m',
      preAllocatedVUs: 5,
    },
  },
  thresholds: {
    http_req_duration: ['p(95) < 300'],
    http_req_failed: ['rate < 0.01'],
  },
};

function requireEnv(name, value) {
  if (!value) {
    throw new Error(
      `${name} is required — see docs/load-test.md for the full list of environment variables this script needs.`,
    );
  }
  return value;
}

function login(email, password) {
  const res = http.post(
    `${requireEnv('SUPABASE_URL', SUPABASE_URL)}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    {
      headers: {
        'Content-Type': 'application/json',
        apikey: requireEnv('SUPABASE_ANON_KEY', SUPABASE_ANON_KEY),
      },
    },
  );
  check(res, { 'login succeeded': (r) => r.status === 200 });
  return res.json('access_token');
}

// Runs once before any VU starts; the two tokens are handed to every
// iteration of every scenario via the return value.
export function setup() {
  const parentToken = login(requireEnv('PARENT_EMAIL', PARENT_EMAIL), requireEnv('PARENT_PASSWORD', PARENT_PASSWORD));
  const tutorToken = login(requireEnv('TUTOR_EMAIL', TUTOR_EMAIL), requireEnv('TUTOR_PASSWORD', TUTOR_PASSWORD));
  return { parentToken, tutorToken };
}

export function readClassGroups(data) {
  const res = http.get(`${BASE_URL}/api/v1/class-groups`, {
    headers: { Authorization: `Bearer ${data.parentToken}` },
  });
  check(res, { 'GET /class-groups is 200': (r) => r.status === 200 });
  sleep(1);
}

export function markAttendance(data) {
  const sessionId = requireEnv('CLASS_SESSION_ID', CLASS_SESSION_ID);
  const learnerId = requireEnv('LEARNER_ID', LEARNER_ID);
  const res = http.post(
    `${BASE_URL}/api/v1/class-sessions/${sessionId}/attendance`,
    JSON.stringify({ learnerId, status: 'present' }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.tutorToken}`,
      },
    },
  );
  // A real tutor marks each learner once per session; repeated runs against
  // the same fixture will correctly 409 (CONFLICT, the attendance_records
  // unique constraint) after the first success — both are a healthy
  // response for this endpoint, so check for "not a 5xx", not a bare 201.
  check(res, { 'POST attendance did not 5xx': (r) => r.status < 500 });
}
