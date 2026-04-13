"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.initDB = initDB;
const pg_1 = __importDefault(require("pg"));
const config_1 = require("../config");
const { Pool } = pg_1.default;
const connectionOptions = config_1.config.db.connectionString
    ? { connectionString: config_1.config.db.connectionString }
    : {
        user: config_1.config.db.user,
        host: config_1.config.db.host,
        database: config_1.config.db.database,
        password: config_1.config.db.password,
        port: config_1.config.db.port,
    };
exports.pool = new Pool(connectionOptions);
// DB Table setup
async function initDB() {
    // Ensure UUID generation is available (needed for Prisma User table)
    await exports.pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
    // Ensure Prisma enums exist before creating the User table
    await exports.pool.query(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
        CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LoginType') THEN
        CREATE TYPE "LoginType" AS ENUM ('EMAIL_PASSWORD', 'GOOGLE', 'GITHUB');
      END IF;
    END $$;
  `);
    // Create User table to match Prisma schema (used by auth controller)
    await exports.pool.query(`
    CREATE TABLE IF NOT EXISTS "User" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role "UserRole" NOT NULL DEFAULT 'USER',
      "loginType" "LoginType" NOT NULL DEFAULT 'EMAIL_PASSWORD',
      "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
      "refreshToken" TEXT,
      "emailVerificationToken" TEXT,
      "emailVerificationExpiry" TIMESTAMPTZ,
      "forgotPasswordToken" TEXT,
      "forgotPasswordExpiry" TIMESTAMPTZ,
      "avatarUrl" TEXT,
      "avatarLocalPath" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
    // Keep updatedAt in sync for User rows
    await exports.pool.query(`
    CREATE OR REPLACE FUNCTION update_user_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW."updatedAt" = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);
    await exports.pool.query(`
    DROP TRIGGER IF EXISTS update_user_updated_at ON "User";
    CREATE TRIGGER update_user_updated_at
      BEFORE UPDATE ON "User"
      FOR EACH ROW
      EXECUTE FUNCTION update_user_updated_at();
  `);
    await exports.pool.query(`
    CREATE TABLE IF NOT EXISTS sensor_device (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
    // Add created_at column to existing tables if it doesn't exist
    await exports.pool.query(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sensor_device' AND column_name = 'created_at'
      ) THEN
        ALTER TABLE sensor_device ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        -- Update existing rows to have a created_at timestamp
        UPDATE sensor_device SET created_at = NOW() WHERE created_at IS NULL;
      END IF;
    END $$;
  `);
    // Add updated_at column to existing tables if it doesn't exist
    await exports.pool.query(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sensor_device' AND column_name = 'updated_at'
      ) THEN
        ALTER TABLE sensor_device ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        -- Update existing rows to have an updated_at timestamp
        UPDATE sensor_device SET updated_at = NOW() WHERE updated_at IS NULL;
      END IF;
    END $$;
  `);
    // Create trigger to automatically update updated_at on row update
    await exports.pool.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);
    await exports.pool.query(`
    DROP TRIGGER IF EXISTS update_sensor_device_updated_at ON sensor_device;
    CREATE TRIGGER update_sensor_device_updated_at
      BEFORE UPDATE ON sensor_device
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  `);
    await exports.pool.query(`
    CREATE TABLE IF NOT EXISTS sensor_parameter (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT,
      value DOUBLE PRECISION,
      status TEXT,
      device_id INTEGER REFERENCES sensor_device(id),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
    console.log("✅ Tables ready");
}
