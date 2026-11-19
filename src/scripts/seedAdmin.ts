import { auth } from '../lib/auth.js';
import { db, client } from '../lib/db.js';
import { env } from '../config/env.js';

const seedAdmin = async () => {
  try {
    const userCol = db.collection('user');
    const normalizedEmail = env.ADMIN_EMAIL.toLowerCase();

    const existingUser = await userCol.findOne({ email: normalizedEmail });

    if (existingUser) {
      if (existingUser.role !== 'admin') {
        await userCol.updateOne(
          { _id: existingUser._id },
          { $set: { role: 'admin', updatedAt: new Date() } }
        );
        console.log(`Admin user role updated to 'admin': ${env.ADMIN_EMAIL}`);
      } else {
        console.log(`Admin user already exists: ${env.ADMIN_EMAIL}`);
      }
      process.exit(0);
    }

    await auth.api.signUpEmail({
      body: {
        email: normalizedEmail,
        password: env.ADMIN_PASSWORD,
        name: env.ADMIN_NAME,
      },
    });

    await userCol.updateOne(
      { email: normalizedEmail },
      { $set: { role: 'admin', updatedAt: new Date() } }
    );

    console.log(`Admin user created with role 'admin': ${env.ADMIN_EMAIL}`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding admin user:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
};

seedAdmin();
