import type { Request, Response } from "express";
import { nanoid } from "nanoid";
import { Session } from "../models/session.model.js";
import {
    deleteSessionData,
    getSessionData,
    putSessionData,
} from "../services/storage.service.js";

const CODE_LENGTH = 8;
const DEFAULT_TTL_HOURS = 72;

/** POST /sessions — create a new shared session */
export async function createSession(req: Request, res: Response) {
  const deviceId = req.header("X-Device-Id");
  if (!deviceId) {
    res.status(400).json({ error: "X-Device-Id header is required" });
    return;
  }

  const { data, ttlHours } = req.body as {
    data?: Record<string, unknown>;
    ttlHours?: number;
  };

  if (!data || typeof data !== "object") {
    res.status(400).json({ error: "Body must include a `data` object" });
    return;
  }

  const code = nanoid(CODE_LENGTH);
  const hours = ttlHours ?? DEFAULT_TTL_HOURS;
  const expiresAt = new Date(Date.now() + hours * 3600_000);
  const dataSize = Buffer.byteLength(JSON.stringify(data), "utf8");

  // Upload payload to S3, then save metadata in MongoDB
  await putSessionData(code, data, expiresAt);
  const session = await Session.create({ code, deviceId, dataSize, expiresAt });

  res.status(201).json({
    code: session.code,
    dataSize: session.dataSize,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
  });
}

/** GET /sessions/:code — retrieve session data (anyone with the code) */
export async function getSession(req: Request, res: Response) {
  const session = await Session.findOne({ code: req.params.code }).lean();
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }

  const data = await getSessionData(session.code);

  res.json({
    code: session.code,
    data,
    dataSize: session.dataSize,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
  });
}

/** PATCH /sessions/:code — update session data (owner only) */
export async function updateSession(req: Request, res: Response) {
  const deviceId = req.header("X-Device-Id");
  if (!deviceId) {
    res.status(400).json({ error: "X-Device-Id header is required" });
    return;
  }

  const session = await Session.findOne({ code: req.params.code });
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }

  if (session.deviceId !== deviceId) {
    res.status(403).json({ error: "Not the session owner" });
    return;
  }

  const { data, ttlHours } = req.body as {
    data?: Record<string, unknown>;
    ttlHours?: number;
  };

  if (data && typeof data === "object") {
    // Fetch existing data from S3, merge, re-upload
    const existing = (await getSessionData(session.code)) ?? {};
    const merged = { ...existing, ...data };
    const newExpires =
      ttlHours !== undefined
        ? new Date(Date.now() + ttlHours * 3600_000)
        : session.expiresAt;
    await putSessionData(session.code, merged, newExpires);
    session.dataSize = Buffer.byteLength(JSON.stringify(merged), "utf8");
  }

  if (ttlHours !== undefined) {
    session.expiresAt = new Date(Date.now() + ttlHours * 3600_000);
  }

  await session.save();

  res.json({
    code: session.code,
    dataSize: session.dataSize,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
  });
}

/** DELETE /sessions/:code — delete session (owner only) */
export async function deleteSession(req: Request, res: Response) {
  const deviceId = req.header("X-Device-Id");
  if (!deviceId) {
    res.status(400).json({ error: "X-Device-Id header is required" });
    return;
  }

  const session = await Session.findOne({ code: req.params.code });
  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }

  if (session.deviceId !== deviceId) {
    res.status(403).json({ error: "Not the session owner" });
    return;
  }

  await deleteSessionData(session.code);
  await session.deleteOne();
  res.status(204).send();
}

/** GET /sessions/device/me — list all sessions for the calling device */
export async function listDeviceSessions(req: Request, res: Response) {
  const deviceId = req.header("X-Device-Id");
  if (!deviceId) {
    res.status(400).json({ error: "X-Device-Id header is required" });
    return;
  }

  const sessions = await Session.find({ deviceId })
    .select("code dataSize createdAt updatedAt expiresAt")
    .sort({ createdAt: -1 })
    .lean();

  res.json(sessions);
}
