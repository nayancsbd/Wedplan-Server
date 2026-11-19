import { MongoClient, type Db, type Collection } from 'mongodb';
import { env } from '../config/env.js';
import type { Service, Booking, Transaction } from '../types/index.js';

interface GlobalMongo {
  _mongoClient?: MongoClient;
  _mongoDb?: Db;
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
