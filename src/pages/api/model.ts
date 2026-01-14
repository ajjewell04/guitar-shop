import type { NextApiRequest, NextApiResponse } from "next";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { rows } = await pool.query(
      "SELECT s3_base_url FROM models ORDER BY created_at DESC LIMIT 1",
    );

    if (process.env.NODE_ENV === "production") {
      return res.status(200).json({ url: process.env.DEMO_MODEL_URL });
    }

    if (!rows.length) {
      return res.status(404).json({ error: "No model found" });
    }

    const { s3_base_url } = rows[0];

    return res.status(200).json({
      url: s3_base_url,
    });
  } catch (err) {
    console.error(err);
    return res.status(200).json({ error: "DB error" });
  }
}
