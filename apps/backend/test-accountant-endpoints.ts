import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './src/config/db';
import { Project } from './src/models/Project';
import { Team } from './src/models/Team';
import { TeamSiteAssignment } from './src/models/TeamSiteAssignment';
import { User } from './src/models/User';
import { Payment } from './src/models/Payment';
import { MaterialPurchase } from './src/models/MaterialPurchase';
import { PettyCash } from './src/models/PettyCash';
import { DailyReport } from './src/models/DailyReport';
import { TaskVerification } from './src/models/TaskVerification';
import { AttendanceStatus, PaymentType, PaymentRecordType, Trade } from '@crewly/shared';

/**
 * Integration check for the Phase 7 Accountant endpoints.
 *
 * Seeds a project with known payment terms and financials, then asserts that
 * the payment queue, purchases, reconciliation, and cost-report endpoints all
 * report the expected figures — and that Site Supervisors are refused and
 * never see dailyRate.
 *
 * Requires the API to be running. Override the target with API_BASE_URL.
 */
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api';

const BUDGET = { labor: 500_000, materials: 300_000, overhead: 50_000 };
const DAILY_RATE = 2_000;
const WAGE_HEADCOUNT = 5;
const EXPECTED_WAGE = DAILY_RATE * WAGE_HEADCOUNT; // 10,000
const AGREED_TOTAL = 300_000;
const FIRST_INSTALLMENT = 100_000;
const PURCHASE_WITH_RECEIPT = 90_000;
const PURCHASE_NO_RECEIPT = 10_000;
const FLOAT_AMOUNT = 60_000;
const PETTY_SPENT = 25_000;

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

  const siteUser = await User.findOne({ email: 'site@crewly.com' });
  if (!siteUser) throw new Error('Seed data missing — run `npm run backend:seed` first.');

  const today = new Date().toISOString().split('T')[0];
  const created: mongoose.Document[] = [];

  // ---- Seed a project with all three payment terms ----
  const project = await new Project({
    name: 'Accountant Endpoint Verification Site',
    location: 'Verification Block, Karachi',
    startDate: today,
    expectedEndDate: today,
    budget: BUDGET,
    siteSupervisorId: siteUser._id,
  }).save();
  created.push(project);

  const wageTeam = await new Team({ name: 'AC Wage Crew', trade: Trade.ELECTRIC }).save();
  const milestoneTeam = await new Team({
    name: 'AC Milestone Crew',
    trade: Trade.PLUMBING,
    defaultPaymentType: PaymentType.MILESTONE,
  }).save();
  const lumpTeam = await new Team({
    name: 'AC Lump Crew',
    trade: Trade.MASONRY,
    defaultPaymentType: PaymentType.LUMP_SUM,
  }).save();
  created.push(wageTeam, milestoneTeam, lumpTeam);

  const lumpAssignment = await new TeamSiteAssignment({
    projectId: project._id,
    teamId: lumpTeam._id,
    paymentType: PaymentType.LUMP_SUM,
    assignedDate: today,
    agreedTotal: AGREED_TOTAL,
  }).save();
  created.push(
    await new TeamSiteAssignment({
      projectId: project._id,
      teamId: wageTeam._id,
      paymentType: PaymentType.DAILY_WAGE,
      assignedDate: today,
    }).save(),
    await new TeamSiteAssignment({
      projectId: project._id,
      teamId: milestoneTeam._id,
      paymentType: PaymentType.MILESTONE,
      assignedDate: today,
    }).save(),
    lumpAssignment
  );

  const report = await new DailyReport({
    projectId: project._id,
    date: today,
    submittedBy: siteUser._id,
    teamEntries: [
      {
        teamId: wageTeam._id,
        headcountPresent: WAGE_HEADCOUNT,
        attendanceStatus: AttendanceStatus.ON_TIME,
        taskWorkedOn: 'Wiring first floor',
      },
      {
        teamId: milestoneTeam._id,
        headcountPresent: 4,
        attendanceStatus: AttendanceStatus.ON_TIME,
        taskWorkedOn: 'Bathroom rough-in',
        taskCompleted: true,
      },
    ],
  }).save();
  created.push(report);

  // Verify the milestone task so it qualifies for payment.
  created.push(
    await new TaskVerification({
      dailyReportId: report._id,
      teamEntryIndex: 1,
      verifiedBy: siteUser._id,
      verifiedAt: Date.now(),
    }).save()
  );

  created.push(
    await new MaterialPurchase({
      projectId: project._id,
      purchasedBy: siteUser._id,
      material: 'Cement (AC test)',
      amount: PURCHASE_WITH_RECEIPT,
      date: today,
      loggedAt: Date.now(),
      receiptPhotoUrl: 'https://example.com/receipt.jpg',
    }).save(),
    await new MaterialPurchase({
      projectId: project._id,
      purchasedBy: siteUser._id,
      material: 'Rebar (AC test)',
      amount: PURCHASE_NO_RECEIPT,
      date: today,
      loggedAt: Date.now(),
    }).save()
  );

  const pettyBatch = await new PettyCash({
    siteSupervisorId: siteUser._id,
    projectId: project._id,
    floatIssued: [{ amount: FLOAT_AMOUNT, issuedDate: today, issuedBy: siteUser._id }],
    expenses: [
      { amount: 15_000, date: today, description: 'Fuel', receiptPhoto: 'r.jpg' },
      { amount: 10_000, date: today, description: 'Snacks' },
    ],
    reconciled: false,
  }).save();
  created.push(pettyBatch);

  const projectId = String(project._id);
  const accountantToken = await login('accountant@crewly.com');
  const siteToken = await login('site@crewly.com');

  try {
    // ---- Team daily rate (Accountant may set it) ----
    const rateRes = await request('PATCH', `/teams/${wageTeam._id}`, accountantToken, {
      dailyRate: DAILY_RATE,
    });
    check('accountant can set team dailyRate', rateRes.status === 200 && rateRes.body.data.dailyRate === DAILY_RATE, rateRes.body);

    // ---- Payment queue ----
    let queue = await request('GET', '/accountant/payment-queue', accountantToken);
    let wages = queue.body.data.dailyWages.filter((w: any) => w.projectId === projectId);
    let milestones = queue.body.data.milestones.filter((m: any) => m.projectId === projectId);
    let lumps = queue.body.data.lumpSums.filter((l: any) => l.projectId === projectId);

    check('queue lists the unpaid wage entry', wages.length === 1, wages);
    check(
      `wage suggestion = headcount × rate (${EXPECTED_WAGE})`,
      wages[0]?.suggestedAmount === EXPECTED_WAGE,
      wages[0]
    );
    check('queue lists the verified milestone', milestones.length === 1, milestones);
    check(
      'queue lists the lump-sum with full remaining',
      lumps.length === 1 && lumps[0].remaining === AGREED_TOTAL,
      lumps
    );

    // ---- Record a wage payment; duplicate must be refused ----
    const wagePayment = await request('POST', '/payments', accountantToken, {
      projectId,
      teamId: String(wageTeam._id),
      type: PaymentRecordType.DAILY_WAGE,
      amount: EXPECTED_WAGE,
      date: today,
      linkedDailyReportId: String(report._id),
    });
    check('wage payment recorded', wagePayment.status === 201, wagePayment.body);

    const duplicate = await request('POST', '/payments', accountantToken, {
      projectId,
      teamId: String(wageTeam._id),
      type: PaymentRecordType.DAILY_WAGE,
      amount: EXPECTED_WAGE,
      date: today,
      linkedDailyReportId: String(report._id),
    });
    check('duplicate wage payment refused with 409', duplicate.status === 409, duplicate.body);

    // ---- Lump-sum installments respect the agreed total ----
    const installment = await request('POST', '/payments', accountantToken, {
      projectId,
      teamId: String(lumpTeam._id),
      type: PaymentRecordType.LUMP_SUM_INSTALLMENT,
      amount: FIRST_INSTALLMENT,
      date: today,
      linkedTeamSiteAssignmentId: String(lumpAssignment._id),
    });
    check('lump-sum installment recorded', installment.status === 201, installment.body);

    const overpay = await request('POST', '/payments', accountantToken, {
      projectId,
      teamId: String(lumpTeam._id),
      type: PaymentRecordType.LUMP_SUM_INSTALLMENT,
      amount: AGREED_TOTAL, // would exceed the remaining 200k
      date: today,
      linkedTeamSiteAssignmentId: String(lumpAssignment._id),
    });
    check('overpaying the agreed total refused', overpay.status === 400, overpay.body);

    queue = await request('GET', '/accountant/payment-queue', accountantToken);
    wages = queue.body.data.dailyWages.filter((w: any) => w.projectId === projectId);
    lumps = queue.body.data.lumpSums.filter((l: any) => l.projectId === projectId);
    check('paid wage entry left the queue', wages.length === 0, wages);
    check(
      'lump-sum remaining reflects the installment',
      lumps[0]?.paidSoFar === FIRST_INSTALLMENT && lumps[0]?.remaining === AGREED_TOTAL - FIRST_INSTALLMENT,
      lumps[0]
    );

    // ---- Purchases ----
    const purchases = await request('GET', '/accountant/purchases', accountantToken);
    const ourPurchases = purchases.body.data.purchases.filter((p: any) => p.projectId === projectId);
    check('both purchases listed with names resolved', ourPurchases.length === 2 && ourPurchases.every((p: any) => p.projectName && p.purchasedByName), ourPurchases);
    check('missing receipt flagged', ourPurchases.some((p: any) => !p.hasReceipt), ourPurchases);

    const toVerify = ourPurchases.find((p: any) => !p.verified);
    const verifyRes = await request('PATCH', `/material-purchases/${toVerify.purchaseId}/verify`, accountantToken);
    check('accountant can verify a purchase', verifyRes.status === 200 && verifyRes.body.data.verified === true, verifyRes.body);

    // ---- Reconciliation ----
    const recon = await request('GET', '/accountant/reconciliation', accountantToken);
    const batch = recon.body.data.batches.find((b: any) => b.pettyCashId === String(pettyBatch._id));
    check(
      'batch shows float/spent/balance with names',
      batch &&
        batch.floatTotal === FLOAT_AMOUNT &&
        batch.spentTotal === PETTY_SPENT &&
        batch.currentBalance === FLOAT_AMOUNT - PETTY_SPENT &&
        batch.supervisorName &&
        !batch.reconciled,
      batch
    );
    check('batch flags the expense missing a receipt', batch?.expensesMissingReceipt === 1, batch);
    check('supervisor options provided for the float form', recon.body.data.supervisors.length > 0, recon.body.data.supervisors);

    const blockedFloat = await request('POST', '/petty-cash/issue-float', accountantToken, {
      siteSupervisorId: String(siteUser._id),
      projectId,
      amount: 10_000,
    });
    check('new float blocked while batch is open', blockedFloat.status === 409, blockedFloat.body);

    const reconcileRes = await request('POST', `/petty-cash/${pettyBatch._id}/reconcile`, accountantToken);
    check('accountant reconciles the batch', reconcileRes.status === 200 && reconcileRes.body.data.reconciled === true, reconcileRes.body);

    const newFloat = await request('POST', '/petty-cash/issue-float', accountantToken, {
      siteSupervisorId: String(siteUser._id),
      projectId,
      amount: 10_000,
    });
    check('float allowed after reconciliation', newFloat.status === 201, newFloat.body);

    // ---- Cost reports ----
    const reports = await request('GET', '/accountant/cost-reports', accountantToken);
    const ourReport = reports.body.data.projects.find((p: any) => p.projectId === projectId);
    const expectedLabor = EXPECTED_WAGE + FIRST_INSTALLMENT;
    const expectedMaterials = PURCHASE_WITH_RECEIPT + PURCHASE_NO_RECEIPT;
    check(
      'cost report totals match the seeded figures',
      ourReport &&
        ourReport.budgetTotal === 850_000 &&
        ourReport.breakdown.labor.spent === expectedLabor &&
        ourReport.breakdown.materials.spent === expectedMaterials &&
        ourReport.breakdown.pettyCash.spent === PETTY_SPENT &&
        ourReport.spentTotal === expectedLabor + expectedMaterials + PETTY_SPENT,
      ourReport
    );

    // ---- Role guards + money stripping ----
    const siteQueue = await request('GET', '/accountant/payment-queue', siteToken);
    check('site supervisor refused from accountant routes', siteQueue.status === 403, siteQueue.body);

    const sitePayments = await request('GET', '/payments', siteToken);
    check('site supervisor refused from payments', sitePayments.status === 403, sitePayments.body);

    const siteTeams = await request('GET', '/teams', siteToken);
    const leaked = (siteTeams.body.data || []).some((t: any) => 'dailyRate' in t);
    check('dailyRate stripped from /teams for site supervisor', siteTeams.status === 200 && !leaked, siteTeams.body.data?.[0]);

    const accountantTeams = await request('GET', '/teams', accountantToken);
    const visible = (accountantTeams.body.data || []).find((t: any) => String(t._id) === String(wageTeam._id));
    check('dailyRate visible to accountant', visible?.dailyRate === DAILY_RATE, visible);
  } finally {
    // ---- Cleanup: everything this test created, incl. API-created records ----
    await Payment.deleteMany({ projectId: project._id });
    await PettyCash.deleteMany({ projectId: project._id });
    for (const doc of created) {
      await doc.deleteOne();
    }
    await mongoose.disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Test run crashed:', err);
  process.exit(1);
});
