import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import connectDB from './src/config/db';
import { authConfig } from './src/config/auth';
import { Project } from './src/models/Project';
import { Team } from './src/models/Team';
import { User } from './src/models/User';
import { Payment } from './src/models/Payment';
import { MaterialPurchase } from './src/models/MaterialPurchase';
import { PettyCash } from './src/models/PettyCash';
import { DailyReport } from './src/models/DailyReport';
import {
  AttendanceStatus,
  IdleReason,
  PaymentRecordType,
  NotificationType,
  Role,
} from '@crewly/shared';

/**
 * Integration check for the Phase 6 Owner endpoints.
 *
 * Seeds a project with known financials, then asserts that
 * /owner/dashboard and /owner/projects/:id/cost-breakdown report the
 * expected figures — and that non-Owner roles are still refused.
 *
 * Requires the API to be running. Override the target with API_BASE_URL.
 */
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

// Known figures so every total below can be asserted exactly.
const BUDGET = { labor: 500_000, materials: 300_000, overhead: 50_000 };
const BUDGET_TOTAL = 850_000;
const LABOR_SPENT = 200_000; // 120k daily wage + 80k milestone
const MATERIALS_SPENT = 100_000; // 90k with receipt + 10k without
const PETTY_CASH_ISSUED = 60_000;
const PETTY_CASH_SPENT = 25_000;
const EXPECTED_SPEND = LABOR_SPENT + MATERIALS_SPENT + PETTY_CASH_SPENT;

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

async function login(email: string): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'crewly2024' }),
  });
  const body = (await res.json()) as any;
  if (!body.success) throw new Error(`Login failed for ${email}: ${body.error?.message}`);
  return body.data.token;
}

async function get(path: string, token: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, body: await res.json() };
}

async function run(): Promise<void> {
  await connectDB();

  const owner = await User.findOne({ email: 'owner@crewly.com' });
  const team = await Team.findOne({ trade: 'electric' });

  if (!owner || !team) {
    throw new Error('Seed data missing — run `npm run backend:seed` first.');
  }

  // A dedicated supervisor so the test never depends on the shared seed
  // account, whose password may have been changed via the users screen.
  const SITE_EMAIL = 'owner-test-site@crewly.test';
  await User.deleteMany({ email: SITE_EMAIL });
  const siteUser = await new User({
    name: 'Owner Test Supervisor',
    email: SITE_EMAIL,
    passwordHash: await bcrypt.hash('crewly2024', authConfig.saltRounds),
    role: Role.SITE_SUPERVISOR,
  }).save();

  const today = new Date().toISOString().split('T')[0];

  const project = await new Project({
    name: 'Owner Endpoint Verification Site',
    location: 'Verification Block, Lahore',
    startDate: today,
    expectedEndDate: today,
    budget: BUDGET,
    siteSupervisorId: siteUser._id,
  }).save();

  const created: mongoose.Document[] = [siteUser, project];

  created.push(
    await new Payment({
      projectId: project._id,
      teamId: team._id,
      type: PaymentRecordType.DAILY_WAGE,
      amount: 120_000,
      date: today,
      paidBy: owner._id,
    }).save(),
    await new Payment({
      projectId: project._id,
      teamId: team._id,
      type: PaymentRecordType.MILESTONE,
      amount: 80_000,
      date: today,
      paidBy: owner._id,
    }).save(),
    // Petty cash top-ups must not be double-counted as labor.
    await new Payment({
      projectId: project._id,
      teamId: null,
      type: PaymentRecordType.PETTY_CASH_TOPUP,
      amount: PETTY_CASH_ISSUED,
      date: today,
      paidBy: owner._id,
    }).save(),
    await new MaterialPurchase({
      projectId: project._id,
      purchasedBy: siteUser._id,
      material: 'Cement (verification)',
      amount: 90_000,
      date: today,
      receiptPhotoUrl: 'https://example.test/receipt.jpg',
    }).save(),
    await new MaterialPurchase({
      projectId: project._id,
      purchasedBy: siteUser._id,
      material: 'Sand (verification, no receipt)',
      amount: 10_000,
      date: today,
      receiptPhotoUrl: null,
    }).save(),
    await new PettyCash({
      siteSupervisorId: siteUser._id,
      projectId: project._id,
      floatIssued: [
        { amount: PETTY_CASH_ISSUED, issuedDate: today, issuedBy: owner._id.toString() },
      ],
      expenses: [{ amount: PETTY_CASH_SPENT, date: today, description: 'Site transport' }],
      reconciled: false,
    }).save(),
    await new DailyReport({
      projectId: project._id,
      date: today,
      submittedBy: siteUser._id,
      teamEntries: [
        {
          teamId: team._id,
          isLocalLabor: false,
          headcountPresent: 6,
          attendanceStatus: AttendanceStatus.ON_TIME,
          taskWorkedOn: 'Conduit routing, 3rd floor',
          taskCompleted: true,
          photos: [],
        },
        {
          teamId: null,
          isLocalLabor: true,
          headcountPresent: 4,
          attendanceStatus: AttendanceStatus.ON_TIME,
          idleReason: IdleReason.MATERIAL_NOT_THERE,
          taskWorkedOn: 'Plaster prep',
          taskCompleted: false,
          photos: [],
        },
      ],
    }).save()
  );

  console.log('\n— Seeded verification project —\n');

  const ownerToken = await login('owner@crewly.com');
  const projectId = project._id.toString();

  // ---- Dashboard ----
  const dashboard = await get('/owner/dashboard', ownerToken);
  check('GET /owner/dashboard returns success', dashboard.body.success === true, dashboard.body);

  const row = dashboard.body.data?.projects?.find((p: any) => p.projectId === projectId);
  check('Dashboard includes the new project', !!row);
  check('Project budget total is summed from categories', row?.budgetTotal === BUDGET_TOTAL, row?.budgetTotal);
  check('Labor spend excludes petty cash top-ups', row?.spent?.labor === LABOR_SPENT, row?.spent);
  check('Material spend is totalled', row?.spent?.materials === MATERIALS_SPENT, row?.spent);
  check('Petty cash spend comes from expenses', row?.spent?.pettyCash === PETTY_CASH_SPENT, row?.spent);
  check('Total spend adds the three buckets', row?.spent?.total === EXPECTED_SPEND, row?.spent);
  check(
    'Percent used is spend over budget',
    row?.percentUsed === Math.round((EXPECTED_SPEND / BUDGET_TOTAL) * 100),
    row?.percentUsed
  );
  check('Working and idle crews are counted', row?.flags?.working === 1 && row?.flags?.idle === 1, row?.flags);
  check('Completed-but-unverified task is flagged', row?.flags?.unverified === 1, row?.flags);

  const pending = dashboard.body.data?.pendingActions;
  check('Missing receipt raises a pending action', (pending?.missingReceipts ?? 0) >= 1, pending);
  check('Unreconciled float raises a pending action', (pending?.unreconciledFloats ?? 0) >= 1, pending);

  // ---- Cost breakdown ----
  const breakdown = await get(`/owner/projects/${projectId}/cost-breakdown`, ownerToken);
  check('GET cost-breakdown returns success', breakdown.body.success === true, breakdown.body);

  const totals = breakdown.body.data?.totals;
  check('Breakdown budget matches', totals?.budgetTotal === BUDGET_TOTAL, totals);
  check('Breakdown spend matches', totals?.spentTotal === EXPECTED_SPEND, totals);
  check('Remaining is budget minus spend', totals?.remaining === BUDGET_TOTAL - EXPECTED_SPEND, totals);
  check(
    'Petty cash on hand is issued minus spent',
    totals?.pettyCashOnHand === PETTY_CASH_ISSUED - PETTY_CASH_SPENT,
    totals
  );

  const categories = breakdown.body.data?.categories || [];
  const laborLine = categories.find((c: any) => c.category === 'labor');
  const materialsLine = categories.find((c: any) => c.category === 'materials');
  const equipmentLine = categories.find((c: any) => c.category === 'equipment');
  check('Labor category maps payments to its budget', laborLine?.spent === LABOR_SPENT && laborLine?.budgeted === BUDGET.labor, laborLine);
  check('Materials category maps purchases', materialsLine?.spent === MATERIALS_SPENT, materialsLine);
  check('Untracked category is marked as such', equipmentLine?.tracked === false, equipmentLine);

  const electricTrade = (breakdown.body.data?.trades || []).find((t: any) => t.trade === 'electric');
  check('Labor is grouped by team trade', electricTrade?.spent === LABOR_SPENT, electricTrade);

  const flaggedTx = (breakdown.body.data?.transactions || []).find((t: any) =>
    t.label.includes('Sand (verification')
  );
  check('Receipt-less purchase is flagged in transactions', flaggedTx?.flagged === true, flaggedTx);

  // ---- User management ----
  const users = await get('/users', ownerToken);
  check('GET /users lists accounts', users.body.success === true && users.body.data.length >= 4, users.body?.data?.length);
  check(
    'Passwords are never returned',
    !JSON.stringify(users.body.data).includes('passwordHash'),
  );

  const selfRoleChange = await fetch(`${API_BASE_URL}/users/${owner._id.toString()}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ role: 'accountant' }),
  });
  check('Owner cannot demote themselves', selfRoleChange.status === 400, selfRoleChange.status);

  // ---- Notification preferences ----
  const prefsBefore = await get('/users/me/notification-prefs', ownerToken);
  check(
    'Preferences default to enabled',
    prefsBefore.body.data?.[NotificationType.NO_SHOW] === true,
    prefsBefore.body?.data
  );

  const prefsPatch = await fetch(`${API_BASE_URL}/users/me/notification-prefs`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ preferences: { [NotificationType.NO_SHOW]: false } }),
  });
  const prefsPatchBody = (await prefsPatch.json()) as any;
  check(
    'Preference opt-out is saved',
    prefsPatchBody.data?.[NotificationType.NO_SHOW] === false,
    prefsPatchBody.data
  );

  const badPatch = await fetch(`${API_BASE_URL}/users/me/notification-prefs`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ preferences: { not_a_real_type: true } }),
  });
  check('Unknown notification types are rejected', badPatch.status === 400, badPatch.status);

  // Restore the preference we flipped.
  await fetch(`${API_BASE_URL}/users/me/notification-prefs`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
    body: JSON.stringify({ preferences: { [NotificationType.NO_SHOW]: true } }),
  });

  // ---- Role gating ----
  const siteToken = await login(SITE_EMAIL);
  const siteDashboard = await get('/owner/dashboard', siteToken);
  check('Site Supervisor is refused the owner dashboard', siteDashboard.status === 403, siteDashboard.status);
  const siteUsers = await get('/users', siteToken);
  check('Site Supervisor is refused the user list', siteUsers.status === 403, siteUsers.status);
  const sitePrefs = await get('/users/me/notification-prefs', siteToken);
  check('Any role can read their own preferences', sitePrefs.body.success === true, sitePrefs.body);

  // ---- Cleanup ----
  for (const doc of created) {
    await (doc.constructor as mongoose.Model<any>).deleteOne({ _id: doc._id });
  }
  console.log('\n— Verification data removed —');

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await mongoose.disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
