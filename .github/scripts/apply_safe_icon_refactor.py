from pathlib import Path


def replace_exact(path: str, old: str, new: str, expected: int = 1) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    actual = text.count(old)
    if actual != expected:
        raise RuntimeError(f'{path}: expected {expected} exact matches, found {actual}')
    updated = text.replace(old, new)
    file.write_text(updated, encoding='utf-8')
    print(f'updated {path}: {expected} replacement(s)')


# Candidates
replace_exact(
    'src/pages/recruitment/CandidatesPage.tsx',
    '  Button,\n  ConfirmDialog,',
    '  Button,\n  ConfirmDialog,\n  IconButton,',
)
replace_exact(
    'src/pages/recruitment/CandidatesPage.tsx',
    '<Button aria-label={canManage ? "Редактировать кандидата" : "Открыть кандидата"} className="h-9 w-9 p-0" onClick={() => onOpen(candidate)} variant="ghost"><FiEdit2 className="h-4 w-4" /></Button>',
    '<IconButton icon={<FiEdit2 />} label={canManage ? "Редактировать кандидата" : "Открыть кандидата"} onClick={() => onOpen(candidate)} size="sm" />',
)
replace_exact(
    'src/pages/recruitment/CandidatesPage.tsx',
    '<Button aria-label="Удалить кандидата" className="h-9 w-9 p-0" onClick={() => onDelete(candidate)} variant="ghost"><FiTrash2 className="h-4 w-4" /></Button>',
    '<IconButton icon={<FiTrash2 />} label="Удалить кандидата" onClick={() => onDelete(candidate)} size="sm" tone="danger" />',
)
replace_exact(
    'src/pages/recruitment/CandidatesPage.tsx',
    '<Button className="h-10 w-10 p-0" onClick={onOpen} variant="ghost"><FiEdit2 className="h-4 w-4" /></Button>',
    '<IconButton icon={<FiEdit2 />} label={canManage ? "Редактировать кандидата" : "Открыть кандидата"} onClick={onOpen} />',
)
replace_exact(
    'src/pages/recruitment/CandidatesPage.tsx',
    '<Button className="h-10 w-10 p-0" onClick={onDelete} variant="ghost"><FiTrash2 className="h-4 w-4" /></Button>',
    '<IconButton icon={<FiTrash2 />} label="Удалить кандидата" onClick={onDelete} tone="danger" />',
)

# Vacancies
replace_exact(
    'src/pages/recruitment/VacanciesPage.tsx',
    '  Button,\n  ConfirmDialog,',
    '  Button,\n  ConfirmDialog,\n  IconButton,',
)
replace_exact(
    'src/pages/recruitment/VacanciesPage.tsx',
    '''<Button
                        aria-label="Редактировать вакансию"
                        className="h-9 w-9 p-0"
                        onClick={() => onEdit(vacancy)}
                        variant="ghost"
                      >
                        <FiEdit2 className="h-4 w-4" />
                      </Button>''',
    '<IconButton icon={<FiEdit2 />} label="Редактировать вакансию" onClick={() => onEdit(vacancy)} size="sm" />',
)
replace_exact(
    'src/pages/recruitment/VacanciesPage.tsx',
    '''<Button
                        aria-label="Удалить вакансию"
                        className="h-9 w-9 p-0"
                        onClick={() => onDelete(vacancy)}
                        variant="ghost"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </Button>''',
    '<IconButton icon={<FiTrash2 />} label="Удалить вакансию" onClick={() => onDelete(vacancy)} size="sm" tone="danger" />',
)
replace_exact(
    'src/pages/recruitment/VacanciesPage.tsx',
    '''<Button
              aria-label="Редактировать вакансию"
              className="h-10 w-10 p-0"
              onClick={onEdit}
              variant="ghost"
            >
              <FiEdit2 className="h-4 w-4" />
            </Button>''',
    '<IconButton icon={<FiEdit2 />} label="Редактировать вакансию" onClick={onEdit} />',
)
replace_exact(
    'src/pages/recruitment/VacanciesPage.tsx',
    '''<Button
              aria-label="Удалить вакансию"
              className="h-10 w-10 p-0"
              onClick={onDelete}
              variant="ghost"
            >
              <FiTrash2 className="h-4 w-4" />
            </Button>''',
    '<IconButton icon={<FiTrash2 />} label="Удалить вакансию" onClick={onDelete} tone="danger" />',
)

# Vacancy form: clarify fields and fix back/remove actions
replace_exact(
    'src/pages/recruitment/VacancyFormPage.tsx',
    '  FiChevronRight,\n',
    '',
)
replace_exact(
    'src/pages/recruitment/VacancyFormPage.tsx',
    '  Button,\n  Input,',
    '  Button,\n  IconButton,\n  Input,',
)
replace_exact(
    'src/pages/recruitment/VacancyFormPage.tsx',
    '''<Button
              aria-label="Вернуться к вакансиям"
              className="h-11 w-11 shrink-0 rounded-full p-0"
              onClick={() => navigate("/vacancies")}
              type="button"
              variant="ghost"
            >
              <FiArrowLeft className="h-5 w-5" />
            </Button>''',
    '<IconButton className="rounded-full" icon={<FiArrowLeft />} label="Вернуться к вакансиям" onClick={() => navigate("/vacancies")} size="lg" />',
)
replace_exact(
    'src/pages/recruitment/VacancyFormPage.tsx',
    '''      <div className="app-muted mt-4 flex items-center gap-2 text-xs font-bold">
        <span>Уровень 1–10</span><FiChevronRight className="h-3.5 w-3.5" /><span>вес 1–5</span>
      </div>''',
    '''      <div className="app-surface-muted app-border mt-4 rounded-2xl border px-4 py-3">
        <p className="app-text-soft text-xs font-semibold leading-5">
          <strong className="app-text">Уровень</strong> — ожидаемое владение навыком по шкале 1–10. <strong className="app-text">Важность</strong> — насколько этот навык влияет на оценку кандидата, по шкале 1–5.
        </p>
      </div>''',
)
replace_exact(
    'src/pages/recruitment/VacancyFormPage.tsx',
    '''<Button aria-label="Удалить навык" className="h-9 w-9 rounded-xl p-0" onClick={() => onRemove(skill.key)} type="button" variant="ghost">
                <FiX className="h-4 w-4" />
              </Button>''',
    '<IconButton icon={<FiX />} label="Удалить навык" onClick={() => onRemove(skill.key)} size="sm" tone="danger" />',
)
replace_exact(
    'src/pages/recruitment/VacancyFormPage.tsx',
    '''            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_110px_100px]">
              <Input
                aria-label={`${title}, навык ${index + 1}`}
                onChange={(event) => onUpdate(skill.key, { name: event.target.value })}
                placeholder={skill.type === "hard" ? "Например: SQL" : "Например: Командная работа"}
                required
                value={skill.name}
              />
              <Input
                aria-label="Требуемый уровень"
                max="10"
                min="1"
                onChange={(event) => onUpdate(skill.key, { requiredLevel: Number(event.target.value) })}
                required
                type="number"
                value={skill.requiredLevel}
              />
              <Input
                aria-label="Вес навыка"
                max="5"
                min="1"
                onChange={(event) => onUpdate(skill.key, { weight: Number(event.target.value) })}
                required
                type="number"
                value={skill.weight}
              />
            </div>''',
    '''            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_150px]">
              <SkillInputField label="Навык">
                <Input
                  aria-label={`${title}, навык ${index + 1}`}
                  onChange={(event) => onUpdate(skill.key, { name: event.target.value })}
                  placeholder={skill.type === "hard" ? "Например: SQL" : "Например: Командная работа"}
                  required
                  value={skill.name}
                />
              </SkillInputField>
              <SkillInputField hint="1–10" label="Уровень">
                <Input
                  aria-label="Требуемый уровень навыка от 1 до 10"
                  max="10"
                  min="1"
                  onChange={(event) => onUpdate(skill.key, { requiredLevel: Number(event.target.value) })}
                  required
                  type="number"
                  value={skill.requiredLevel}
                />
              </SkillInputField>
              <SkillInputField hint="1–5" label="Важность">
                <Input
                  aria-label="Важность навыка от 1 до 5"
                  max="5"
                  min="1"
                  onChange={(event) => onUpdate(skill.key, { weight: Number(event.target.value) })}
                  required
                  type="number"
                  value={skill.weight}
                />
              </SkillInputField>
            </div>''',
)
replace_exact(
    'src/pages/recruitment/VacancyFormPage.tsx',
    '\nfunction SummaryRow({ label, value }: { label: string; value: string }): JSX.Element {',
    '''
function SkillInputField({ children, hint, label }: { children: JSX.Element; hint?: string; label: string }): JSX.Element {
  return (
    <label className="grid gap-1.5">
      <span className="flex items-center justify-between gap-2 px-1 text-xs font-black">
        <span className="app-text-soft">{label}</span>
        {hint && <span className="app-muted font-bold">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }): JSX.Element {''',
)

# Vacations
replace_exact(
    'src/pages/VacationsPage.tsx',
    '  Button,\n  EmptyState,',
    '  Button,\n  EmptyState,\n  IconButton,',
)
replace_exact(
    'src/pages/VacationsPage.tsx',
    '''<Button
              aria-label="Редактировать отпуск"
              className="h-9 w-9 p-0"
              onClick={onEdit}
              variant="ghost"
            >
              <FiEdit2 className="h-4 w-4" />
            </Button>''',
    '<IconButton icon={<FiEdit2 />} label="Редактировать отпуск" onClick={onEdit} size="sm" />',
)
replace_exact(
    'src/pages/VacationsPage.tsx',
    '''<Button
                aria-label="Удалить отпуск"
                className="h-9 w-9 p-0"
                onClick={onDelete}
                variant="ghost"
              >
                <FiTrash2 className="h-4 w-4" />
              </Button>''',
    '<IconButton icon={<FiTrash2 />} label="Удалить отпуск" onClick={onDelete} size="sm" tone="danger" />',
)

# Employee related records
replace_exact(
    'src/features/employees/related-records/RelatedRecordCards.tsx',
    'import { Button, EmptyState, LoadingState } from "../../../shared/ui";',
    'import { Button, EmptyState, IconButton, LoadingState } from "../../../shared/ui";',
)
replace_exact(
    'src/features/employees/related-records/RelatedRecordCards.tsx',
    '''<Button aria-label={editLabel} className="app-table-action-button app-table-action-button--edit h-10 w-10 rounded-xl border p-0" onClick={onEdit} type="button" variant="ghost">
              <FiEdit2 className="h-4 w-4" />
            </Button>''',
    '<IconButton className="app-table-action-button app-table-action-button--edit" icon={<FiEdit2 />} label={editLabel} onClick={onEdit} />',
)
replace_exact(
    'src/features/employees/related-records/RelatedRecordCards.tsx',
    '''<Button aria-label={deleteLabel} className="app-table-action-button app-table-action-button--delete h-10 w-10 rounded-xl border p-0" onClick={onDelete} type="button" variant="ghost">
              <FiTrash2 className="h-4 w-4" />
            </Button>''',
    '<IconButton className="app-table-action-button app-table-action-button--delete" icon={<FiTrash2 />} label={deleteLabel} onClick={onDelete} tone="danger" />',
)

replace_exact(
    'src/features/employees/components/EmployeeOperationalRecords.tsx',
    'import { Button, EmptyState, LoadingState } from "../../../shared/ui";',
    'import { Button, EmptyState, IconButton, LoadingState } from "../../../shared/ui";',
)
replace_exact(
    'src/features/employees/components/EmployeeOperationalRecords.tsx',
    '''<Button aria-label="Редактировать отпуск" className="h-10 w-10 p-0" onClick={actions.onEdit} type="button" variant="ghost">
        <FiEdit2 className="h-4 w-4" />
      </Button>''',
    '<IconButton icon={<FiEdit2 />} label="Редактировать отпуск" onClick={actions.onEdit} />',
)
replace_exact(
    'src/features/employees/components/EmployeeOperationalRecords.tsx',
    '''<Button aria-label="Удалить отпуск" className="h-10 w-10 p-0" onClick={actions.onDelete} type="button" variant="ghost">
          <FiTrash2 className="h-4 w-4" />
        </Button>''',
    '<IconButton icon={<FiTrash2 />} label="Удалить отпуск" onClick={actions.onDelete} tone="danger" />',
)

# Shared dropdown and dialog
replace_exact(
    'src/shared/ui/DropdownMenu.tsx',
    "import { Button } from './Button'",
    "import { IconButton } from './IconButton'",
)
replace_exact(
    'src/shared/ui/DropdownMenu.tsx',
    '''<Button aria-label={triggerLabel} className="h-10 w-10 rounded-xl p-0" size="sm" variant="ghost">
          <FiMoreVertical className="h-4 w-4" />
        </Button>''',
    '<IconButton icon={<FiMoreVertical />} label={triggerLabel} />',
)
replace_exact(
    'src/shared/ui/Dialog.tsx',
    'import { Button } from "./Button";',
    'import { IconButton } from "./IconButton";',
)
replace_exact(
    'src/shared/ui/Dialog.tsx',
    '''<Button
                aria-label={t("common.actions.close")}
                className="h-10 w-10 shrink-0 rounded-xl p-0"
                variant="ghost"
              >
                <FiX className="h-5 w-5" />
              </Button>''',
    '<IconButton icon={<FiX />} label={t("common.actions.close")} />',
)

# Universal HR table raw icon actions
replace_exact(
    'src/features/hr-table/HrEntityTable.tsx',
    "import { Button, EmptyState, LoadingState, Select, type SelectOption } from '../../shared/ui'",
    "import { Button, EmptyState, IconButton, LoadingState, Select, type SelectOption } from '../../shared/ui'",
)
replace_exact(
    'src/features/hr-table/HrEntityTable.tsx',
    '''<button
                        type="button"
                        aria-label={t('common.actions.edit')}
                        title={t('common.actions.edit')}
                        onClick={() => handleEditClick(record)}
                        className="app-table-action-button app-table-action-button--edit inline-flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-border)]"
                      >
                        <FiEdit2 className="h-4 w-4" />
                      </button>''',
    '<IconButton className="app-table-action-button app-table-action-button--edit" icon={<FiEdit2 />} label={t(\'common.actions.edit\')} onClick={() => handleEditClick(record)} size="sm" />',
    expected=2,
)
replace_exact(
    'src/features/hr-table/HrEntityTable.tsx',
    '''<button
                        type="button"
                        aria-label={t('common.actions.delete')}
                        title={t('common.actions.delete')}
                        onClick={() => handleDeleteClick(record)}
                        className="app-table-action-button app-table-action-button--delete inline-flex h-9 w-9 items-center justify-center rounded-xl border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>''',
    '<IconButton className="app-table-action-button app-table-action-button--delete" icon={<FiTrash2 />} label={t(\'common.actions.delete\')} onClick={() => handleDeleteClick(record)} size="sm" tone="danger" />',
    expected=2,
)

# Access Control already uses an IconButton-shaped local helper; replace it with shared implementation.
replace_exact(
    'src/pages/access/AccessControlPage.tsx',
    '  EmptyState,\n  Input,',
    '  EmptyState,\n  IconButton,\n  Input,',
)
replace_exact(
    'src/pages/access/AccessControlPage.tsx',
    '''
function IconButton({
  children,
  danger = false,
  label,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  label: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      aria-label={label}
      className={[
        "app-table-action-button flex h-10 w-10 items-center justify-center rounded-xl border transition [&>svg]:h-4 [&>svg]:w-4",
        danger ? "app-table-action-button--delete" : "",
      ].join(" ")}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}
''',
    '\n',
)

# Final safety check: shared text Button must no longer be forced into icon geometry using p-0.
remaining = []
for path in Path('src').rglob('*.tsx'):
    if path.name == 'IconButton.tsx':
        continue
    text = path.read_text(encoding='utf-8')
    if '<Button' in text and 'p-0' in text:
        # Tight enough after exact replacements: report any file still combining these patterns for manual review.
        for block in text.split('<Button')[1:]:
            head = block.split('>', 1)[0]
            if 'p-0' in head:
                remaining.append(str(path))
                break

if remaining:
    raise RuntimeError('Button+p-0 remains in: ' + ', '.join(sorted(set(remaining))))

print('safe icon refactor completed')
