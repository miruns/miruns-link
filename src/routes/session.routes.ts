import { Router } from "express";
import {
    createSession,
    deleteSession,
    getSession,
    listDeviceSessions,
    updateSession,
} from "../controllers/session.controller.js";

const router = Router();

// Device-scoped listing (before :code param to avoid clash)
router.get("/device/me", listDeviceSessions);

// CRUD
router.post("/", createSession);
router.get("/:code", getSession);
router.patch("/:code", updateSession);
router.delete("/:code", deleteSession);

export default router;
