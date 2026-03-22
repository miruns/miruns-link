import cors from "cors";
import "dotenv/config";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { connectDB } from "./config/database.js";
import sessionRoutes from "./routes/session.routes.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Security & parsing
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// Routes
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/sessions", sessionRoutes);

// Start
async function main() {
  await connectDB();
  app.listen(PORT, () => console.log(`miruns-link listening on :${PORT}`));
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
