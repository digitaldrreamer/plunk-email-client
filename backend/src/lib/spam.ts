// Two-layer spam filtering — mirrors tranche's approach:
// 1. Plunk inbound verdicts (spamVerdict, virusVerdict) — FAIL = drop
// 2. Postmark SpamAssassin secondary check — score ≥ 5.0 = drop
//    On any network/parse error we return score 0 so bad checks never silently drop mail.

const POSTMARK_SPAM_URL = "https://spamcheck.postmarkapp.com/filter";
const SPAM_SCORE_THRESHOLD = 5.0;

export type Verdict = "PASS" | "FAIL" | "GRAY" | "PROCESSING_FAILED";

export function isHardFail(verdict: Verdict | undefined): boolean {
  return verdict === "FAIL";
}

export async function postmarkSpamScore(rawEmailBody: string): Promise<number> {
  try {
    const res = await fetch(POSTMARK_SPAM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: rawEmailBody, options: "short" }),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { success: boolean; score: number };
    if (!json.success) return 0;
    return json.score;
  } catch {
    return 0;
  }
}

export function isSpam(score: number): boolean {
  return score >= SPAM_SCORE_THRESHOLD;
}
