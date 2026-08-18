from pathlib import Path


def replace_exact(path: str, old: str, new: str, expected: int = 1) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f'{path}: expected {expected} matches, found {count}')
    file.write_text(text.replace(old, new), encoding='utf-8')
    print(f'updated {path}: {count} replacement(s)')


# Vacancy form: hide the hero/header when creating a vacancy.
replace_exact(
    'src/pages/recruitment/VacancyFormPage.tsx',
    '      <section className="app-surface app-border rounded-[30px] border p-6 sm:p-8">\n',
    '      {isEdit && (\n      <section className="app-surface app-border rounded-[30px] border p-6 sm:p-8">\n',
)
replace_exact(
    'src/pages/recruitment/VacancyFormPage.tsx',
    '      </section>\n\n      <form onSubmit={saveVacancy}>',
    '      </section>\n      )}\n\n      <form onSubmit={saveVacancy}>',
)

# Vacancy form: remove skill importance from state, payload and UI.
replace_exact(
    'src/pages/recruitment/VacancyFormPage.tsx',
    '        requiredLevel: Number(skill.required_level ?? 5),\n        weight: Number(skill.weight ?? 3),\n',
    '        requiredLevel: Number(skill.required_level ?? 5),\n',
)
replace_exact(
    'src/pages/recruitment/VacancyFormPage.tsx',
    '        skills: allSkills.map(({ id: skillId, type, name, requiredLevel, weight }) => ({\n          id: skillId,\n          type,\n          name,\n          requiredLevel,\n          weight,\n        })),',
    '        skills: allSkills.map(({ id: skillId, type, name, requiredLevel }) => ({\n          id: skillId,\n          type,\n          name,\n          requiredLevel,\n        })),',
)
replace_exact(
    'src/pages/recruitment/VacancyFormPage.tsx',
    '      <div className="app-surface-muted app-border mt-4 rounded-2xl border px-4 py-3">\n        <p className="app-text-soft text-xs font-semibold leading-5">\n          <strong className="app-text">Уровень</strong> — ожидаемое владение навыком по шкале 1–10. <strong className="app-text">Важность</strong> — насколько этот навык влияет на оценку кандидата, по шкале 1–5.\n        </p>\n      </div>',
    '      <div className="app-surface-muted app-border mt-4 rounded-2xl border px-4 py-3">\n        <p className="app-text-soft text-xs font-semibold leading-5">\n          <strong className="app-text">Уровень</strong> — ожидаемое владение навыком по шкале 1–10.\n        </p>\n      </div>',
)
replace_exact(
    'src/pages/recruitment/VacancyFormPage.tsx',
    '            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_150px]">',
    '            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px]">',
)
replace_exact(
    'src/pages/recruitment/VacancyFormPage.tsx',
    '''              <SkillInputField hint="1–5" label="Важность">\n                <Input\n                  aria-label="Важность навыка от 1 до 5"\n                  max="5"\n                  min="1"\n                  onChange={(event) => onUpdate(skill.key, { weight: Number(event.target.value) })}\n                  required\n                  type="number"\n                  value={skill.weight}\n                />\n              </SkillInputField>\n''',
    '',
)
replace_exact(
    'src/pages/recruitment/VacancyFormPage.tsx',
    '    requiredLevel: 5,\n    weight: 3,\n',
    '    requiredLevel: 5,\n',
)

# Shared recruitment types: weight is no longer part of a vacancy skill.
replace_exact(
    'src/shared/types/hr.ts',
    '  requiredLevel: number;\n  weight: number;\n',
    '  requiredLevel: number;\n',
)

# Service validation: only required level remains.
replace_exact(
    'electron/services/recruitmentService.ts',
    '      assertRange(skill.requiredLevel, 1, 10, "Требуемый уровень навыка");\n      assertRange(skill.weight, 1, 5, "Вес навыка");\n',
    '      assertRange(skill.requiredLevel, 1, 10, "Требуемый уровень навыка");\n',
)

# Repository: remove weight ordering/storage and calculate an equal-weight match.
replace_exact(
    'electron/repositories/recruitmentRepository.ts',
    '''         ORDER BY\n           CASE skill_type WHEN 'hard' THEN 1 ELSE 2 END,\n           weight DESC,\n           required_level DESC,\n           name ASC`,''',
    '''         ORDER BY\n           CASE skill_type WHEN 'hard' THEN 1 ELSE 2 END,\n           required_level DESC,\n           name ASC`,''',
)
replace_exact(
    'electron/repositories/recruitmentRepository.ts',
    '''             (SELECT ROUND(\n               100.0 * SUM(\n                 MIN(\n                   CAST(COALESCE(candidate_score.score, 0) AS REAL) /\n                     vacancy_skill.required_level,\n                   1.0\n                 ) * vacancy_skill.weight\n               ) / NULLIF(SUM(vacancy_skill.weight), 0),\n               0\n             )''',
    '''             (SELECT ROUND(\n               100.0 * AVG(\n                 MIN(\n                   CAST(COALESCE(candidate_score.score, 0) AS REAL) /\n                     vacancy_skill.required_level,\n                   1.0\n                 )\n               ),\n               0\n             )''',
)
replace_exact(
    'electron/repositories/recruitmentRepository.ts',
    '''        `SELECT * FROM vacancy_skills\n         WHERE vacancy_id = ?\n         ORDER BY CASE skill_type WHEN 'hard' THEN 1 ELSE 2 END,\n                  weight DESC, required_level DESC, name ASC`,''',
    '''        `SELECT * FROM vacancy_skills\n         WHERE vacancy_id = ?\n         ORDER BY CASE skill_type WHEN 'hard' THEN 1 ELSE 2 END,\n                  required_level DESC, name ASC`,''',
)
replace_exact(
    'electron/repositories/recruitmentRepository.ts',
    '''    const updateSkill = this.database.prepare(\n      `UPDATE vacancy_skills\n       SET skill_type = ?, name = ?, required_level = ?, weight = ?,\n           updated_at = CURRENT_TIMESTAMP\n       WHERE id = ? AND vacancy_id = ?`,\n    );\n    const insertSkill = this.database.prepare(\n      `INSERT INTO vacancy_skills (\n         vacancy_id, skill_type, name, required_level, weight\n       ) VALUES (?, ?, ?, ?, ?)`,\n    );''',
    '''    const updateSkill = this.database.prepare(\n      `UPDATE vacancy_skills\n       SET skill_type = ?, name = ?, required_level = ?,\n           updated_at = CURRENT_TIMESTAMP\n       WHERE id = ? AND vacancy_id = ?`,\n    );\n    const insertSkill = this.database.prepare(\n      `INSERT INTO vacancy_skills (\n         vacancy_id, skill_type, name, required_level\n       ) VALUES (?, ?, ?, ?)`,\n    );''',
)
replace_exact(
    'electron/repositories/recruitmentRepository.ts',
    '''      const values = [\n        skill.type,\n        skill.name.trim(),\n        skill.requiredLevel,\n        skill.weight,\n      ] as const;''',
    '''      const values = [\n        skill.type,\n        skill.name.trim(),\n        skill.requiredLevel,\n      ] as const;''',
)

# Candidate form and preview: all vacancy skills are equally important.
replace_exact(
    'src/pages/recruitment/CandidatesPage.tsx',
    '  requiredLevel: number;\n  weight: number;\n  score: number;\n',
    '  requiredLevel: number;\n  score: number;\n',
)
replace_exact(
    'src/pages/recruitment/CandidatesPage.tsx',
    '          requiredLevel: Number(skill.required_level ?? 5),\n          weight: Number(skill.weight ?? 3),\n          score: 0,\n',
    '          requiredLevel: Number(skill.required_level ?? 5),\n          score: 0,\n',
)
replace_exact(
    'src/pages/recruitment/CandidatesPage.tsx',
    '<p className="app-muted mt-1 text-xs font-semibold">Требуется: {skill.requiredLevel}/10 · Важность: {skill.weight}/5</p>',
    '<p className="app-muted mt-1 text-xs font-semibold">Требуется: {skill.requiredLevel}/10</p>',
)
replace_exact(
    'src/pages/recruitment/CandidatesPage.tsx',
    '        requiredLevel: Number(skill.required_level),\n        weight: Number(skill.weight),\n        score: Number(score?.score ?? 0),\n',
    '        requiredLevel: Number(skill.required_level),\n        score: Number(score?.score ?? 0),\n',
)
replace_exact(
    'src/pages/recruitment/CandidatesPage.tsx',
    '''function calculateMatch(skills: CandidateSkillState[]): number {\n  const totalWeight = skills.reduce((sum, skill) => sum + skill.weight, 0);\n  if (totalWeight === 0) return 0;\n  const points = skills.reduce(\n    (sum, skill) => sum + Math.min(skill.score / Math.max(skill.requiredLevel, 1), 1) * skill.weight,\n    0,\n  );\n  return Math.round((points / totalWeight) * 100);\n}''',
    '''function calculateMatch(skills: CandidateSkillState[]): number {\n  if (skills.length === 0) return 0;\n  const points = skills.reduce(\n    (sum, skill) => sum + Math.min(skill.score / Math.max(skill.requiredLevel, 1), 1),\n    0,\n  );\n  return Math.round((points / skills.length) * 100);\n}''',
)

# Database migration: remove the obsolete importance/weight column from existing databases.
migration = Path('electron/migrations/013_remove_vacancy_skill_weight.sql')
if migration.exists():
    raise RuntimeError('Migration 013 already exists')
migration.write_text('ALTER TABLE vacancy_skills DROP COLUMN weight;\n', encoding='utf-8')
print('created', migration)

# Guard against active-code regressions. Historical SQL migration 007 intentionally still contains the old column.
for path in [
    Path('src/pages/recruitment/VacancyFormPage.tsx'),
    Path('src/pages/recruitment/CandidatesPage.tsx'),
    Path('src/shared/types/hr.ts'),
    Path('electron/services/recruitmentService.ts'),
    Path('electron/repositories/recruitmentRepository.ts'),
]:
    text = path.read_text(encoding='utf-8')
    if 'skill.weight' in text or 'vacancy_skill.weight' in text or 'Важность' in text or 'Вес навыка' in text:
        raise RuntimeError(f'Remaining skill importance reference in {path}')

print('Vacancy skill importance removed successfully')
