import express from "express";
import cors from "cors";
import emailsRouter from "./routes/emails";
import tagsRouter from "./routes/tags";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/emails", emailsRouter);
app.use("/api/tags", tagsRouter);

app.listen(PORT, () => {
  console.log(`reclear-email backend running on http://localhost:${PORT}`);
});
