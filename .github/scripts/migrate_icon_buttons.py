from pathlib import Path
import re

ROOT = Path('src')
TARGETS = [
    Path('src/pages/recruitment/CandidatesPage.tsx'),
    Path('src/pages/recruitment/VacanciesPage.tsx'),
    Path('src/pages/recruitment/VacancyFormPage.tsx'),
    Path('src/pages/VacationsPage.tsx'),
    Path('src/shared/ui/DropdownMenu.tsx'),
    Path('src/shared/ui/Dialog.tsx'),
    Path('src/features/employees/related-records/RelatedRecordCards.tsx'),
    Path('src/features/employees/components/EmployeeOperationalRecords.tsx'),
    Path('src/features/hr-table/HrEntityTable.tsx'),
    Path('src/pages/access/AccessControlPage.tsx'),
]


def add_shared_import(text: str, name: str = 'IconButton') -> str:
    if re.search(rf'\b{name}\b', text) and re.search(r"from [\"'][^\"']*shared/ui[\"']", text):
        # The name may only appear in JSX/local helper, so still ensure it is imported.
        pass
    pattern = re.compile(r'import\s*\{(?P<body>[^}]*)\}\s*from\s*(?P<quote>[\"\'])(?P<module>[^\"\']*shared/ui)(?P=quote);?', re.S)
    match = pattern.search(text)
    if not match:
        return text
    body = match.group('body')
    if re.search(rf'(^|[,\s]){re.escape(name)}([,\s]|$)', body):
        return text
    new_body = '\n  ' + name + ',' + body if '\n' in body else f' {name},' + body
    return text[:match.start('body')] + new_body + text[match.end('body'):]


def migrate_button_icon_only(text: str) -> str:
    pattern = re.compile(
        r'<Button(?P<attrs>[^>]*)>\s*<(?P<icon>Fi[A-Za-z0-9]+)(?:\s+className="[^"]*")?\s*/>\s*</Button>',
        re.S,
    )

    def repl(match: re.Match[str]) -> str:
        attrs = match.group('attrs')
        if 'p-0' not in attrs:
            return match.group(0)
        icon = match.group('icon')
        label_match = re.search(r'aria-label=("[^"]*"|\{[^\n]*?\})', attrs)
        if not label_match:
            return match.group(0)
        label_value = label_match.group(1)
        size = 'sm' if re.search(r'h-9\s+w-9|w-9\s+h-9', attrs) else 'lg' if re.search(r'h-11\s+w-11|w-11\s+h-11', attrs) else 'md'
        on_click_match = re.search(r'onClick=(\{[^\n]*?\})', attrs)
        if not on_click_match:
            return match.group(0)
        on_click = on_click_match.group(1)
        tone = ' tone="danger"' if icon in {'FiTrash2', 'FiX'} else ''
        class_match = re.search(r'className="([^"]*)"', attrs)
        extra_class = ''
        if class_match and 'rounded-full' in class_match.group(1):
            extra_class = ' className="rounded-full"'
        return f'<IconButton icon={{<{icon} />}} label={label_value} onClick={on_click} size="{size}"{tone}{extra_class} />'

    return pattern.sub(repl, text)


def migrate_direct_shared_import(path: Path, text: str) -> str:
    if path.as_posix() == 'src/shared/ui/DropdownMenu.tsx':
        text = text.replace("import { Button } from './Button'", "import { IconButton } from './IconButton'")
    elif path.as_posix() == 'src/shared/ui/Dialog.tsx':
        text = text.replace('import { Button } from "./Button";', 'import { IconButton } from "./IconButton";')
    else:
        text = add_shared_import(text)
    return text


def migrate_hr_table(text: str) -> str:
    text = add_shared_import(text)
    edit_pattern = re.compile(
        r'<button\s+type="button"\s+aria-label=\{t\(\'common\.actions\.edit\'\)\}\s+title=\{t\(\'common\.actions\.edit\'\)\}\s+onClick=\{\(\) => handleEditClick\(record\)\}\s+className="[^"]*"\s*>\s*<FiEdit2 className="[^"]*" />\s*</button>',
        re.S,
    )
    delete_pattern = re.compile(
        r'<button\s+type="button"\s+aria-label=\{t\(\'common\.actions\.delete\'\)\}\s+title=\{t\(\'common\.actions\.delete\'\)\}\s+onClick=\{\(\) => handleDeleteClick\(record\)\}\s+className="[^"]*"\s*>\s*<FiTrash2 className="[^"]*" />\s*</button>',
        re.S,
    )
    text = edit_pattern.sub("<IconButton icon={<FiEdit2 />} label={t('common.actions.edit')} onClick={() => handleEditClick(record)} size=\"sm\" />", text)
    text = delete_pattern.sub("<IconButton icon={<FiTrash2 />} label={t('common.actions.delete')} onClick={() => handleDeleteClick(record)} size=\"sm\" tone=\"danger\" />", text)
    return text


def migrate_access(text: str) -> str:
    text = add_shared_import(text)
    local = re.compile(r'\nfunction IconButton\(\{.*?\n\}\n\nfunction StatusBadge', re.S)
    text, count = local.subn('\nfunction StatusBadge', text, count=1)
    if count != 1:
        raise RuntimeError('Could not remove local AccessControl IconButton helper')
    return text


def migrate_skill_fields(text: str) -> str:
    old_guide = '''      <div className="app-muted mt-4 flex items-center gap-2 text-xs font-bold">\n        <span>Уровень 1–10</span><FiChevronRight className="h-3.5 w-3.5" /><span>вес 1–5</span>\n      </div>\n'''
    new_guide = '''      <div className="app-surface-muted app-border mt-4 rounded-2xl border px-4 py-3">\n        <p className="app-text-soft text-xs font-semibold leading-5">\n          <strong className="app-text">Уровень</strong> — ожидаемое владение навыком по шкале 1–10. <strong className="app-text">Важность</strong> — насколько этот навык влияет на оценку кандидата, по шкале 1–5.\n        </p>\n      </div>\n'''
    if old_guide not in text:
        raise RuntimeError('Skill guide block not found')
    text = text.replace(old_guide, new_guide, 1)

    old_inputs = '''            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_110px_100px]">\n              <Input\n                aria-label={`${title}, навык ${index + 1}`}\n                onChange={(event) => onUpdate(skill.key, { name: event.target.value })}\n                placeholder={skill.type === "hard" ? "Например: SQL" : "Например: Командная работа"}\n                required\n                value={skill.name}\n              />\n              <Input\n                aria-label="Требуемый уровень"\n                max="10"\n                min="1"\n                onChange={(event) => onUpdate(skill.key, { requiredLevel: Number(event.target.value) })}\n                required\n                type="number"\n                value={skill.requiredLevel}\n              />\n              <Input\n                aria-label="Вес навыка"\n                max="5"\n                min="1"\n                onChange={(event) => onUpdate(skill.key, { weight: Number(event.target.value) })}\n                required\n                type="number"\n                value={skill.weight}\n              />\n            </div>'''
    new_inputs = '''            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_150px]">\n              <SkillInputField label="Навык">\n                <Input\n                  aria-label={`${title}, навык ${index + 1}`}\n                  onChange={(event) => onUpdate(skill.key, { name: event.target.value })}\n                  placeholder={skill.type === "hard" ? "Например: SQL" : "Например: Командная работа"}\n                  required\n                  value={skill.name}\n                />\n              </SkillInputField>\n              <SkillInputField hint="1–10" label="Уровень">\n                <Input\n                  aria-label="Требуемый уровень навыка от 1 до 10"\n                  max="10"\n                  min="1"\n                  onChange={(event) => onUpdate(skill.key, { requiredLevel: Number(event.target.value) })}\n                  required\n                  type="number"\n                  value={skill.requiredLevel}\n                />\n              </SkillInputField>\n              <SkillInputField hint="1–5" label="Важность">\n                <Input\n                  aria-label="Важность навыка от 1 до 5"\n                  max="5"\n                  min="1"\n                  onChange={(event) => onUpdate(skill.key, { weight: Number(event.target.value) })}\n                  required\n                  type="number"\n                  value={skill.weight}\n                />\n              </SkillInputField>\n            </div>'''
    if old_inputs not in text:
        raise RuntimeError('Skill input block not found')
    text = text.replace(old_inputs, new_inputs, 1)

    marker = '\nfunction SummaryRow({ label, value }: { label: string; value: string }): JSX.Element {'
    helper = '''\nfunction SkillInputField({ children, hint, label }: { children: JSX.Element; hint?: string; label: string }): JSX.Element {\n  return (\n    <label className="grid gap-1.5">\n      <span className="flex items-center justify-between gap-2 px-1 text-xs font-black">\n        <span className="app-text-soft">{label}</span>\n        {hint && <span className="app-muted font-bold">{hint}</span>}\n      </span>\n      {children}\n    </label>\n  );\n}\n'''
    if marker not in text:
        raise RuntimeError('SummaryRow marker not found')
    text = text.replace(marker, helper + marker, 1)
    return text


for path in TARGETS:
    text = path.read_text(encoding='utf-8')
    original = text
    text = migrate_direct_shared_import(path, text)

    if path.as_posix() == 'src/features/hr-table/HrEntityTable.tsx':
        text = migrate_hr_table(text)
    elif path.as_posix() == 'src/pages/access/AccessControlPage.tsx':
        text = migrate_access(text)
    else:
        text = migrate_button_icon_only(text)

    if path.as_posix() == 'src/pages/recruitment/VacancyFormPage.tsx':
        text = migrate_skill_fields(text)

    if text != original:
        path.write_text(text, encoding='utf-8')
        print('updated', path)

# Assert that the fragile Button+p-0 pattern is gone from application TSX except IconButton itself.
remaining = []
for path in ROOT.rglob('*.tsx'):
    if path.name == 'IconButton.tsx':
        continue
    content = path.read_text(encoding='utf-8')
    if re.search(r'<Button[^>]*className="[^"]*p-0[^"]*"', content, re.S):
        remaining.append(str(path))

if remaining:
    raise RuntimeError('Button+p-0 icon candidates remain: ' + ', '.join(remaining))
