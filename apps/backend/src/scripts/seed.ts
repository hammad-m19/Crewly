/**
 * Seed script — creates the initial Owner account.
 * Since POST /auth/register requires an existing Owner's JWT,
 * this script bypasses the API and creates the first Owner directly in MongoDB.
 *
 * Usage: npx tsx src/scripts/seed.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { Role } from '@crewly/shared';
import { User } from '../models/User';
import connectDB from '../config/db';
import { authConfig } from '../config/auth';

const SEED_OWNER = {
  name: 'Admin Owner',
  email: 'owner@crewly.com',
  password: 'crewly2024', // Change this immediately in production
  role: Role.OWNER,
  phone: '+920000000000',
};

async function seed() {
  await connectDB();

  console.log('🌱 Seeding database...\n');

  // Check if owner already exists
  const existing = await User.findOne({ email: SEED_OWNER.email });
  if (existing) {
    console.log(`⚠️  Owner account already exists: ${SEED_OWNER.email}`);
    console.log('   Skipping seed. Delete the user first if you want to re-seed.\n');
    await mongoose.disconnect();
    return;
  }

  // Create owner
  const passwordHash = await bcrypt.hash(SEED_OWNER.password, authConfig.saltRounds);
  const owner = new User({
    name: SEED_OWNER.name,
    email: SEED_OWNER.email,
    passwordHash,
    role: SEED_OWNER.role,
    phone: SEED_OWNER.phone,
    assignedSites: [],
    isActive: true,
  });

  await owner.save();

  console.log('✅ Owner account created:');
  console.log(`   Email:    ${SEED_OWNER.email}`);
  console.log(`   Password: ${SEED_OWNER.password}`);
  console.log(`   Role:     ${SEED_OWNER.role}`);
  console.log(`   ID:       ${owner._id}\n`);
  console.log('⚠️  Change the password immediately in production!\n');

  // Create some sample teams for testing
  const { Team } = await import('../models/Team');
  const { Trade, PaymentType } = await import('@crewly/shared');

  const sampleTeams = [
    { name: "Umair's Electric Team", trade: Trade.ELECTRIC, defaultPaymentType: PaymentType.DAILY_WAGE, contactPhone: '+921111111111' },
    { name: "Asif Wood Works", trade: Trade.WOOD, defaultPaymentType: PaymentType.LUMP_SUM, contactPhone: '+921222222222' },
    { name: "Kamran Plumbing", trade: Trade.PLUMBER, defaultPaymentType: PaymentType.MILESTONE, contactPhone: '+921333333333' },
    { name: "Shahid Masonry", trade: Trade.MASONRY, defaultPaymentType: PaymentType.DAILY_WAGE, contactPhone: '+921444444444' },
    { name: "Ali Painting Crew", trade: Trade.PAINTING, defaultPaymentType: PaymentType.LUMP_SUM, contactPhone: '+921555555555' },
  ];

  for (const teamData of sampleTeams) {
    const existingTeam = await Team.findOne({ name: teamData.name });
    if (!existingTeam) {
      const team = new Team(teamData);
      await team.save();
      console.log(`✅ Team created: ${teamData.name} (${teamData.trade})`);
    } else {
      console.log(`⚠️  Team already exists: ${teamData.name}`);
    }
  }

  // Create sample users for other roles
  const otherUsers = [
    { name: 'Ahmed Super', email: 'super@crewly.com', role: Role.SUPER_SUPERVISOR, phone: '+922111111111' },
    { name: 'Bilal Site', email: 'site@crewly.com', role: Role.SITE_SUPERVISOR, phone: '+922222222222' },
    { name: 'Kashif Accounts', email: 'accountant@crewly.com', role: Role.ACCOUNTANT, phone: '+922333333333' },
  ];

  console.log('');
  for (const userData of otherUsers) {
    const existingUser = await User.findOne({ email: userData.email });
    if (!existingUser) {
      const hash = await bcrypt.hash('crewly2024', authConfig.saltRounds);
      const user = new User({
        ...userData,
        passwordHash: hash,
        assignedSites: [],
        isActive: true,
      });
      await user.save();
      console.log(`✅ User created: ${userData.name} (${userData.role}) — ${userData.email}`);
    } else {
      console.log(`⚠️  User already exists: ${userData.email}`);
    }
  }

  console.log('\n🎉 Seed complete! All accounts use password: crewly2024\n');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
