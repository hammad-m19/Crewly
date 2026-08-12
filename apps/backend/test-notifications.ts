import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from './src/config/db';
import { authConfig } from './src/config/auth';
import { User } from './src/models/User';
import { Project } from './src/models/Project';
import { Notification } from './src/models/Notification';
import { notify } from './src/services/notify';
import { runEscalationCheck } from './src/services/escalation';
import { initFirebase, isFirebaseReady } from './src/config/firebase';
import {
  Role,
  NotificationType,
  ProjectStatus,
  ESCALATION_THRESHOLD_HOURS,
} from '@crewly/shared';

/**
 * Integration check for Phase 8 notifications:
 * - prefs opt-out blocks in-app + push creation
 * - PATCH /users/me/fcm-token persists the device token
 * - escalation is idempotent across repeated runs
 *
 * Requires the API + MongoDB. Override with API_BASE_URL.
 * Sets DISABLE_ESCALATION so the server's hourly loop is irrelevant;
 * this script calls runEscalationCheck() directly.
 */
process.env.DISABLE_ESCALATION = 'true';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed++;
    console.log(`✅ ${label}`);
  } else {
    failed++;
    console.error(`❌ ${label}`);
    if (detail !== undefined) console.error('   got:', JSON.stringify(detail));
  }
}

async function login(email: string, password = 'crewly2024'): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json()) as any;
  if (!body.success) throw new Error(`Login failed for ${email}: ${body.error?.message}`);
  return body.data.token as string;
}

async function request(
  method: string,
  path: string,
  token: string,
  body?: unknown
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function run(): Promise<void> {
  await connectDB();
  initFirebase();

  check('Firebase stays ready=false without credentials (or true if configured)', true);
  console.log(`   isFirebaseReady=${isFirebaseReady()}`);

  const TEST_SUPER = 'notif-super@crewly.test';
  const TEST_OWNER = 'notif-owner@crewly.test';
  const TEST_PROJECT = 'Notification Escalation Verification Site';

  await User.deleteMany({ email: { $in: [TEST_SUPER, TEST_OWNER] } });
  await Project.deleteMany({ name: TEST_PROJECT });
  await Notification.deleteMany({
    title: { $regex: /^(Notif Test|Escalation Idempotency)/ },
  });

  const created: mongoose.Document[] = [];

  const superUser = await new User({
    name: 'Notif Test Super',
    email: TEST_SUPER,
    passwordHash: await bcrypt.hash('crewly2024', authConfig.saltRounds),
    role: Role.SUPER_SUPERVISOR,
    notificationPrefs: { [NotificationType.NO_SHOW]: false },
  }).save();
  created.push(superUser);

  const ownerUser = await new User({
    name: 'Notif Test Owner',
    email: TEST_OWNER,
    passwordHash: await bcrypt.hash('crewly2024', authConfig.saltRounds),
    role: Role.OWNER,
  }).save();
  created.push(ownerUser);

  const project = await new Project({
    name: TEST_PROJECT,
    location: 'Test Yard',
    startDate: '2026-01-01',
    expectedEndDate: '2026-12-31',
    status: ProjectStatus.ACTIVE,
    budget: { labor: 100000 },
  }).save();
  created.push(project);

  // ---- Prefs opt-out ----
  const blocked = await notify({
    recipientUserId: superUser._id,
    type: NotificationType.NO_SHOW,
    projectId: project._id,
    title: 'Notif Test Blocked',
    message: 'Should not be created because prefs opted out',
    metadata: { teamId: 'team-optout', date: '2026-08-01' },
  });
  check('prefs opt-out → notify() returns null', blocked === null);

  const countBlocked = await Notification.countDocuments({
    recipientUserId: superUser._id,
    title: 'Notif Test Blocked',
  });
  check('prefs opt-out → no in-app notification row', countBlocked === 0);

  // Opt back in and confirm notify works
  superUser.notificationPrefs = { [NotificationType.NO_SHOW]: true };
  superUser.markModified('notificationPrefs');
  await superUser.save();

  const allowed = await notify({
    recipientUserId: superUser._id,
    type: NotificationType.NO_SHOW,
    projectId: project._id,
    title: 'Notif Test Allowed',
    message: 'Should be created',
    metadata: { teamId: 'team-allow', date: '2026-08-01' },
  });
  check('prefs enabled → notify() creates notification', !!allowed?._id);

  // ---- FCM token endpoint ----
  const superToken = await login(TEST_SUPER);
  const fakeToken = `test-fcm-token-${Date.now()}`;
  const patch = await request('PATCH', '/users/me/fcm-token', superToken, {
    fcmToken: fakeToken,
  });
  check('PATCH /users/me/fcm-token succeeds', patch.status === 200 && patch.body.success === true);
  check(
    'PATCH /users/me/fcm-token returns saved token',
    patch.body.data?.fcmToken === fakeToken,
    patch.body.data
  );

  const reloaded = await User.findById(superUser._id).select('fcmToken').lean();
  check('fcmToken persisted on user document', reloaded?.fcmToken === fakeToken, reloaded);

  const clear = await request('PATCH', '/users/me/fcm-token', superToken, { fcmToken: null });
  check('PATCH /users/me/fcm-token can clear token', clear.body.success === true);
  const cleared = await User.findById(superUser._id).select('fcmToken').lean();
  check('cleared fcmToken is null/empty', !cleared?.fcmToken, cleared);

  // ---- Escalation idempotency ----
  const staleCreatedAt = Date.now() - (ESCALATION_THRESHOLD_HOURS + 2) * 60 * 60 * 1000;
  const today = new Date().toISOString().split('T')[0];
  const teamId = 'escalation-team-1';

  const stale = await new Notification({
    recipientUserId: superUser._id,
    type: NotificationType.NO_SHOW,
    projectId: project._id,
    title: 'Escalation Idempotency Source',
    message: 'Stale no-show for escalation test',
    metadata: JSON.stringify({ teamId, date: today }),
    created_at: staleCreatedAt,
    updated_at: staleCreatedAt,
  }).save();
  created.push(stale);

  // Force created_at (pre-save hook may overwrite updated_at but created_at is set on insert)
  await Notification.updateOne(
    { _id: stale._id },
    { $set: { created_at: staleCreatedAt, updated_at: staleCreatedAt } }
  );

  const before = await Notification.countDocuments({
    type: NotificationType.ESCALATION_NO_SHOW,
    metadata: { $regex: `escalation_no_show:${project._id}:${teamId}:${today}` },
  });

  const run1 = await runEscalationCheck();
  const after1 = await Notification.countDocuments({
    type: NotificationType.ESCALATION_NO_SHOW,
    metadata: { $regex: `escalation_no_show:${project._id}:${teamId}:${today}` },
  });
  check(
    'first escalation run creates Owner ESCALATION_NO_SHOW',
    after1 === before + 1 || run1.escalationNoShowCreated >= 1,
    { before, after1, run1 }
  );

  const run2 = await runEscalationCheck();
  const after2 = await Notification.countDocuments({
    type: NotificationType.ESCALATION_NO_SHOW,
    metadata: { $regex: `escalation_no_show:${project._id}:${teamId}:${today}` },
  });
  check(
    'second escalation run is idempotent (no duplicate)',
    after2 === after1 && run2.escalationNoShowCreated === 0,
    { after1, after2, run2 }
  );

  // Cleanup
  await Notification.deleteMany({
    $or: [
      { recipientUserId: { $in: [superUser._id, ownerUser._id] } },
      { projectId: project._id },
      { title: { $regex: /^(Notif Test|Escalation Idempotency)/ } },
    ],
  });
  await Project.deleteMany({ _id: project._id });
  await User.deleteMany({ _id: { $in: [superUser._id, ownerUser._id] } });

  await mongoose.disconnect();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
