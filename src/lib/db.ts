import { MongoClient, type Db, type Collection } from 'mongodb';
import { env } from '../config/env.js';
import type { Service, Booking, Transaction } from '../types/index.js';

interface GlobalMongo {
  _mongoClient?: MongoClient;
  _mongoDb?: Db;
  _indexesCreated?: boolean;
}

const globalWithMongo = globalThis as typeof globalThis & GlobalMongo;

const client = globalWithMongo._mongoClient ?? new MongoClient(env.MONGODB_URI);
const db = globalWithMongo._mongoDb ?? client.db(env.DB_NAME);

if (env.NODE_ENV !== 'production') {
  globalWithMongo._mongoClient = client;
  globalWithMongo._mongoDb = db;
}

export { client, db };

export const getDb = (): Db => db;

export const connectToDatabase = async (): Promise<{ client: MongoClient; db: Db }> => {
  await client.connect();
  return { client, db };
};

export const getServicesCollection = (): Collection<Service> => {
  return db.collection<Service>('services');
};

export const getBookingsCollection = (): Collection<Booking> => {
  return db.collection<Booking>('bookings');
};

export const getTransactionsCollection = (): Collection<Transaction> => {
  return db.collection<Transaction>('transactions');
};

export const getUsersCollection = (): Collection<any> => {
  return db.collection('user');
};

export const ensureIndexes = async (): Promise<void> => {
  if (globalWithMongo._indexesCreated) return;
  try {
    const users = getUsersCollection();
    await users.createIndex({ role: 1 });
    await users.createIndex({ email: 1 });
    await users.createIndex({ stripeCustomerId: 1 });

    const services = getServicesCollection();
    await services.createIndex({ status: 1 });
    await services.createIndex({ category: 1 });
    await services.createIndex({ location: 1 });
    await services.createIndex({ vendorId: 1 });
    await services.createIndex({ serviceName: 'text' });
    await services.createIndex({ status: 1, isActive: 1 });

    const bookings = getBookingsCollection();
    await bookings.createIndex(
      { customerId: 1, serviceId: 1, eventDate: 1 },
      {
        unique: true,
        partialFilterExpression: {
          status: { $in: ['pending', 'accepted'] },
        },
      }
    );
    await bookings.createIndex({ customerId: 1, createdAt: -1 });
    await bookings.createIndex({ vendorId: 1, createdAt: -1 });
    await bookings.createIndex({ serviceId: 1 });
    await bookings.createIndex({ status: 1 });

    const transactions = getTransactionsCollection();
    try {
      const existingIndexes = await transactions.indexes();
      const hasOldSessionIndex = existingIndexes.some(
        (idx) => idx.name === 'stripeSessionId_1' && !idx.unique
      );
      if (hasOldSessionIndex) {
        await transactions.dropIndex('stripeSessionId_1');
      }
    } catch {}

    await transactions.createIndex(
      { stripeSessionId: 1 },
      { unique: true, partialFilterExpression: { stripeSessionId: { $type: 'string' } } }
    );
    await transactions.createIndex(
      { stripeEventId: 1 },
      { unique: true, partialFilterExpression: { stripeEventId: { $type: 'string' } } }
    );
    await transactions.createIndex({ vendorId: 1 });
    await transactions.createIndex({ userId: 1 });
    await transactions.createIndex({ status: 1 });
    await transactions.createIndex({ createdAt: -1 });

    globalWithMongo._indexesCreated = true;
  } catch (error) {
    console.error('Failed to initialize database indexes:', error);
  }
};

export const initDbIndexes = ensureIndexes;
