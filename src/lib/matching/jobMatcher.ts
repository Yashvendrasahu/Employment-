import { Job, WorkerProfile } from '../../types/database.ts';

export interface JobMatchResult {
  job: Job;
  score: number;
  matchedSkills: string[];
  locationMatched: boolean;
  experienceEligible: boolean;
}

/**
 * Modular rule-based job matching engine.
 * Calculates relevance score (0-100) using worker's skills, preferred location/city,
 * experience years, employment type, and expected salary.
 * Kept modular so AI-based vector/LLM matching can be plugged in later.
 */
export function computeJobMatch(
  job: Job,
  workerProfile: WorkerProfile | null,
  workerCity?: string,
  workerState?: string
): JobMatchResult {
  if (!workerProfile) {
    return {
      job,
      score: 0,
      matchedSkills: [],
      locationMatched: false,
      experienceEligible: true,
    };
  }

  const workerSkillsNorm = (workerProfile.skills || []).map((s) => s.toLowerCase().trim());
  const jobSkills = job.skills_required || [];

  const matchedSkills: string[] = [];
  for (const reqSkill of jobSkills) {
    const normReq = reqSkill.toLowerCase().trim();
    if (
      workerSkillsNorm.some(
        (ws) => ws === normReq || ws.includes(normReq) || normReq.includes(ws)
      )
    ) {
      matchedSkills.push(reqSkill);
    }
  }

  // 1. Skills weight: up to 55 points
  const skillScore =
    jobSkills.length > 0
      ? Math.round((matchedSkills.length / jobSkills.length) * 55)
      : workerSkillsNorm.length > 0
      ? 25
      : 0;

  // 2. Location weight: up to 25 points
  const prefLoc = (workerProfile.preferred_location || '').toLowerCase().trim();
  const wCity = (workerCity || '').toLowerCase().trim();
  const wState = (workerState || '').toLowerCase().trim();
  const jCity = (job.city || '').toLowerCase().trim();
  const jState = (job.state || '').toLowerCase().trim();

  let locationScore = 0;
  let locationMatched = false;
  if (jCity && (jCity === wCity || (prefLoc && prefLoc.includes(jCity)))) {
    locationScore = 25;
    locationMatched = true;
  } else if (jState && (jState === wState || (prefLoc && prefLoc.includes(jState)))) {
    locationScore = 15;
    locationMatched = true;
  }

  // 3. Experience eligibility weight: up to 12 points
  const expEligible = (workerProfile.experience_years || 0) >= (job.experience_required || 0);
  const expScore = expEligible ? 12 : 4;

  // 4. Employment type & salary alignment: up to 8 points
  let typeScore = 0;
  if (workerProfile.employment_type === job.employment_type) {
    typeScore += 4;
  }
  if (
    !workerProfile.expected_salary ||
    job.salary_max >= workerProfile.expected_salary * 0.85
  ) {
    typeScore += 4;
  }

  const totalScore = Math.min(100, skillScore + locationScore + expScore + typeScore);

  return {
    job: {
      ...job,
      match_score: totalScore,
      matched_skills: matchedSkills,
    },
    score: totalScore,
    matchedSkills,
    locationMatched,
    experienceEligible: expEligible,
  };
}
