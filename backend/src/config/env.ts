import dotenv from "dotenv";

dotenv.config();

const parsedFee = Number(process.env.PLATFORM_FEE_PERCENTAGE);

export const ENV = {
  PORT: Number(process.env.PORT) || 3001,
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL || "",
  JWT_SECRET: process.env.JWT_SECRET || "kuara_super_jwt_secret_key_mvp_2026",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "",
  PLATFORM_FEE_PERCENTAGE:
    process.env.PLATFORM_FEE_PERCENTAGE !== undefined && !Number.isNaN(parsedFee)
      ? parsedFee
      : 5,
  AUTO_RELEASE_HOURS: 72,
};
