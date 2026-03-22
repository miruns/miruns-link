import mongoose, { Schema, type Document } from "mongoose";

export interface ISession extends Document {
  /** Short unique code for sharing (e.g. "a3Xk9m") */
  code: string;
  /** Device ID that created this session — acts as owner */
  deviceId: string;
  /** Size of the data payload in bytes (stored in S3) */
  dataSize: number;
  /** Optional TTL — session auto-deletes after this date */
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    dataSize: {
      type: Number,
      required: true,
      default: 0,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// TTL index — MongoDB automatically deletes docs when expiresAt is reached
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model<ISession>("Session", sessionSchema);
