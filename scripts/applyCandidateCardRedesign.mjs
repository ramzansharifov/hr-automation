import fs from "node:fs";

function replaceExact(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing exact block: ${label}`);
  return source.replace(from, to);
}

function replaceRegex(source, pattern, to, label) {
  const matches = source.match(pattern);
  if (!matches) throw new Error(`Missing regex block: ${label}`);
  return source.replace(pattern, to);
}

const candidatesPath = "src/pages/recruitment/CandidatesPage.tsx";
let candidates = fs.readFileSync(candidatesPath, "utf8");

candidates = replaceExact(
  candidates,
  '  FiMail,\n  FiPhone,\n',
  '',
  'candidate card icon imports',
);
candidates = replaceExact(
  candidates,
  'import { useAuth } from "../../features/auth/AuthContext";\n',
  'import { useAuth } from "../../features/auth/AuthContext";\nimport { CandidateSummaryCard } from "../../features/recruitment/CandidateSummaryCard";\n',
  'CandidateSummaryCard import',
);
candidates = replaceExact(
  candidates,
  `              <CandidateCard\n                canManage={canManage}\n                candidate={candidate}\n                key={String(candidate.id)}\n                onDelete={() => setDeleteTarget(candidate)}\n                onOpen={() => void openCandidate(candidate)}\n              />`,
  `              <CandidateSummaryCard\n                canManage={canManage}\n                candidate={candidate}\n                key={String(candidate.id)}\n                onDelete={() => setDeleteTarget(candidate)}\n                onEdit={() => void openCandidate(candidate)}\n                onOpen={() => void openCandidate(candidate)}\n              />`,
  'CandidatesPage card usage',
);
candidates = replaceRegex(
  candidates,
  /function CandidateCard\(\{[\s\S]*?\n}\n\nfunction candidateFullName/,
  'function candidateFullName',
  'old CandidateCard implementation',
);
fs.writeFileSync(candidatesPath, candidates);

const vacancyPath = "src/pages/recruitment/VacancyDetailsPage.tsx";
let vacancy = fs.readFileSync(vacancyPath, "utf8");
vacancy = replaceExact(vacancy, '  FiMail,\n  FiPhone,\n', '', 'vacancy candidate icon imports');
vacancy = replaceExact(
  vacancy,
  'import { useAuth } from "../../features/auth/AuthContext";\n',
  'import { useAuth } from "../../features/auth/AuthContext";\nimport { CandidateSummaryCard } from "../../features/recruitment/CandidateSummaryCard";\n',
  'VacancyDetails CandidateSummaryCard import',
);
vacancy = replaceExact(vacancy, '  MatchBar,\n', '', 'obsolete MatchBar import');
vacancy = replaceRegex(
  vacancy,
  /              <CandidateRankCard\n[\s\S]*?              \/>/,
  `              <CandidateSummaryCard\n                candidate={candidate}\n                isBest={index === 0 && Number(candidate.match_percentage ?? 0) > 0}\n                key={String(candidate.id)}\n                onOpen={() => navigate(\`/candidates?candidate=\${String(candidate.id)}\`)}\n                rank={index + 1}\n                showStructure={false}\n              />`,
  'VacancyDetails candidate card usage',
);
vacancy = replaceRegex(
  vacancy,
  /function CandidateRankCard\(\{[\s\S]*?\n}\n\nconst vacancyStatusOptions/,
  'const vacancyStatusOptions',
  'old CandidateRankCard implementation',
);
fs.writeFileSync(vacancyPath, vacancy);

for (const path of [
  "scripts/applyCandidateCardRedesign.mjs",
  ".github/workflows/candidate-card-redesign.yml",
]) {
  if (fs.existsSync(path)) fs.unlinkSync(path);
}
