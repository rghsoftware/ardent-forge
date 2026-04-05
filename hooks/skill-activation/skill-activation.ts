import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

interface SkillTriggers {
  keywords?: string[];
  intentPatterns?: string[];
}

interface SkillConfig {
  promptTriggers?: SkillTriggers;
  priority?: "critical" | "high" | "medium" | "low";
}

interface RulesFile {
  skills?: Record<string, SkillConfig>;
  agents?: Record<string, SkillConfig>;
}

interface SessionState {
  skills: string[];
  agents: string[];
  lastUpdated: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function main(): void {
  const input = readFileSync(0, "utf-8");
  const data = JSON.parse(input) as { prompt: string; session_id: string };
  const prompt = data.prompt.toLowerCase();
  const sessionId = data.session_id;

  // Load rules
  const skillRulesPath = join(__dirname, "skill-rules.json");
  const agentRulesPath = join(__dirname, "agent-rules.json");

  const skillRules: RulesFile = existsSync(skillRulesPath)
    ? JSON.parse(readFileSync(skillRulesPath, "utf-8"))
    : { skills: {} };

  const agentRules: RulesFile = existsSync(agentRulesPath)
    ? JSON.parse(readFileSync(agentRulesPath, "utf-8"))
    : { agents: {} };

  // State tracking per session
  const stateDir = join(__dirname, ".state");
  mkdirSync(stateDir, { recursive: true });
  const stateFilePath = join(stateDir, "recommendations.json");

  let state: Record<string, SessionState> = {};
  if (existsSync(stateFilePath)) {
    try {
      state = JSON.parse(readFileSync(stateFilePath, "utf-8"));
    } catch {
      state = {};
    }
  }

  // Cleanup sessions older than 7 days
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  for (const [sid, sessionData] of Object.entries(state)) {
    if (sessionData.lastUpdated < cutoff) delete state[sid];
  }

  const alreadySkills = state[sessionId]?.skills ?? [];
  const alreadyAgents = state[sessionId]?.agents ?? [];

  type Match = { name: string; config: SkillConfig };
  const matchedSkills: Match[] = [];
  const matchedAgents: Match[] = [];

  // Match skills
  for (const [name, config] of Object.entries(skillRules.skills ?? {})) {
    const triggers = config.promptTriggers;
    if (!triggers || alreadySkills.includes(name)) continue;

    const kwMatch = triggers.keywords?.some((kw) => prompt.includes(kw.toLowerCase()));
    if (kwMatch) { matchedSkills.push({ name, config }); continue; }

    const intentMatch = triggers.intentPatterns?.some((p) => new RegExp(p, "i").test(prompt));
    if (intentMatch) matchedSkills.push({ name, config });
  }

  // Match agents
  for (const [name, config] of Object.entries(agentRules.agents ?? {})) {
    const triggers = config.promptTriggers;
    if (!triggers || alreadyAgents.includes(name)) continue;

    const kwMatch = triggers.keywords?.some((kw) => prompt.includes(kw.toLowerCase()));
    if (kwMatch) { matchedAgents.push({ name, config }); continue; }

    const intentMatch = triggers.intentPatterns?.some((p) => new RegExp(p, "i").test(prompt));
    if (intentMatch) matchedAgents.push({ name, config });
  }

  // Generate output
  if (matchedSkills.length > 0 || matchedAgents.length > 0) {
    const lines: string[] = [];
    const groupByPriority = (items: Match[]) => ({
      critical: items.filter((s) => s.config.priority === "critical"),
      high: items.filter((s) => s.config.priority === "high"),
      medium: items.filter((s) => s.config.priority === "medium"),
      low: items.filter((s) => s.config.priority === "low"),
    });

    if (matchedSkills.length > 0) {
      lines.push("SKILL ACTIVATION CHECK\n");
      const g = groupByPriority(matchedSkills);
      if (g.critical.length) { lines.push("CRITICAL SKILLS (REQUIRED):"); g.critical.forEach((s) => lines.push("  -> " + s.name)); lines.push(""); }
      if (g.high.length) { lines.push("RECOMMENDED SKILLS:"); g.high.forEach((s) => lines.push("  -> " + s.name)); lines.push(""); }
      if (g.medium.length) { lines.push("SUGGESTED SKILLS:"); g.medium.forEach((s) => lines.push("  -> " + s.name)); lines.push(""); }
      if (g.low.length) { lines.push("OPTIONAL SKILLS:"); g.low.forEach((s) => lines.push("  -> " + s.name)); lines.push(""); }
      lines.push("ACTION: Use Skill tool BEFORE responding\n");
    }

    if (matchedAgents.length > 0) {
      lines.push("AGENT ACTIVATION CHECK\n");
      const g = groupByPriority(matchedAgents);
      if (g.critical.length) { lines.push("CRITICAL AGENTS (REQUIRED):"); g.critical.forEach((a) => lines.push("  -> " + a.name)); lines.push(""); }
      if (g.high.length) { lines.push("RECOMMENDED AGENTS:"); g.high.forEach((a) => lines.push("  -> " + a.name)); lines.push(""); }
      if (g.medium.length) { lines.push("SUGGESTED AGENTS:"); g.medium.forEach((a) => lines.push("  -> " + a.name)); lines.push(""); }
      if (g.low.length) { lines.push("OPTIONAL AGENTS:"); g.low.forEach((a) => lines.push("  -> " + a.name)); lines.push(""); }
      lines.push("ACTION: Use Task tool with appropriate subagent_type\n");
    }

    console.log(lines.join("\n"));

    // Update state
    state[sessionId] = {
      skills: [...alreadySkills, ...matchedSkills.map((s) => s.name)],
      agents: [...alreadyAgents, ...matchedAgents.map((a) => a.name)],
      lastUpdated: new Date().toISOString(),
    };
    writeFileSync(stateFilePath, JSON.stringify(state, null, 2), "utf-8");
  }

  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error("Skill activation error:", err);
  process.exit(1);
}
