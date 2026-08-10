import 'dotenv/config';
import { Project } from './src/models/Project';
import connectDB from './src/config/db';

async function runTest() {
  await connectDB();
  
  // 1. Assign Site Supervisor to a new mock project with a budget
  const { User } = await import('./src/models/User');
  const siteUser = await User.findOne({ email: 'site@crewly.com' });
  
  if (!siteUser) {
    console.error('Site Supervisor user not found');
    process.exit(1);
  }
  
  const project = new Project({
    name: 'Sync Test Project',
    location: 'Test Location',
    startDate: new Date().toISOString(),
    expectedEndDate: new Date(Date.now() + 86400000 * 30).toISOString(),
    budget: { labor: 50000, materials: 100000 },
    budgetHistory: [{ previousValue: {}, newValue: { labor: 50000, materials: 100000 }, changedBy: 'admin', changedAt: new Date().toISOString() }],
    siteSupervisorId: siteUser._id,
  });
  
  await project.save();
  
  // Update user's assigned sites
  siteUser.assignedSites.push(project._id as any);
  await siteUser.save();
  
  console.log('✅ Created test project with budget and assigned to Site Supervisor');

  // 2. Perform Login to get token
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'site@crewly.com', password: 'crewly2024' })
  });
  
  const loginData = await res.json();
  const token = loginData.data.token;
  console.log('✅ Got token for Site Supervisor');
  
  // 3. Hit the sync pull endpoint
  const syncRes = await fetch('http://localhost:3000/api/sync/pull?last_pulled_at=0', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const syncData = await syncRes.json();
  
  // 4. Inspect the projects returned
  const projects = syncData.changes?.projects?.created || [];
  const testProj = projects.find((p: any) => p._id === project._id.toString() || p.id === project._id.toString());
  
  if (!testProj) {
    console.error('❌ Test project not found in sync response!');
    console.log('Sync Response Changes:', JSON.stringify(syncData, null, 2));
    process.exit(1);
  }
  
  console.log('Project received in sync pull:');
  console.log(JSON.stringify(testProj, null, 2));
  
  if (testProj.budget || testProj.budgetHistory) {
    console.error('❌ FAILURE: Budget fields were NOT stripped!');
  } else {
    console.log('✅ SUCCESS: Budget fields were correctly stripped for Site Supervisor!');
  }
  
  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
