from pathlib import Path
import re

ROOT = Path('src')


def ensure_icon_import(text: str) -> str:
    pattern = re.compile(r'import\s*\{(?P<body>[^}]*)\}\s*from\s*(?P<quote>[\"\'])(?P<module>[^\"\']*shared/ui)(?P=quote);?', re.S)
    match = pattern.search(text)
    if not match:
        return text
    body = match.group('body')
    if re.search(r'(^|[,\s])IconButton([,\s]|$)', body):
        return text
    new_body = '\n  IconButton,' + body if '\n' in body else ' IconButton,' + body
    return text[:match.start('body')] + new_body + text[match.end('body'):]


def transform_text_button(text: str) -> str:
    pattern = re.compile(
        r'<Button(?P<attrs>.*?)>\s*<(?P<icon>Fi[A-Za-z0-9]+)(?:\s+className="[^"]*")?\s*/>\s*</Button>',
        re.S,
    )

    def repl(match: re.Match[str]) -> str:
        attrs = match.group('attrs')
        if 'p-0' not in attrs:
            return match.group(0)
        label_match = re.search(r'aria-label=("[^"]*"|\{.*?\})', attrs, re.S)
        if not label_match:
            return match.group(0)
        on_click_match = re.search(r'onClick=(\{.*?\})(?=\s+(?:type|variant|className|size|aria-label)|\s*$)', attrs, re.S)
        if not on_click_match:
            return match.group(0)
        icon = match.group('icon')
        label = label_match.group(1).strip()
        on_click = on_click_match.group(1).strip()
        size = 'sm' if re.search(r'\bh-9\b.*\bw-9\b|\bw-9\b.*\bh-9\b', attrs, re.S) else 'lg' if re.search(r'\bh-11\b.*\bw-11\b|\bw-11\b.*\bh-11\b', attrs, re.S) else 'md'
        tone = ' tone="danger"' if icon in {'FiTrash2', 'FiX'} else ''
        round_class = ' className="rounded-full"' if 'rounded-full' in attrs else ''
        return f'<IconButton icon={{<{icon} />}} label={label} onClick={on_click} size="{size}"{tone}{round_class} />'

    return pattern.sub(repl, text)


for path in ROOT.rglob('*.tsx'):
    text = path.read_text(encoding='utf-8')
    original = text

    if path.as_posix() == 'src/shared/ui/DropdownMenu.tsx':
        text = text.replace(
            '<Button aria-label={triggerLabel} className="h-10 w-10 rounded-xl p-0" size="sm" variant="ghost">\n          <FiMoreVertical className="h-4 w-4" />\n        </Button>',
            '<IconButton icon={<FiMoreVertical />} label={triggerLabel} />',
        )
    elif path.as_posix() == 'src/shared/ui/Dialog.tsx':
        text = text.replace(
            '''<Button\n                aria-label={t("common.actions.close")}\n                className="h-10 w-10 shrink-0 rounded-xl p-0"\n                variant="ghost"\n              >\n                <FiX className="h-5 w-5" />\n              </Button>''',
            '<IconButton icon={<FiX />} label={t("common.actions.close")} />',
        )
    else:
        text = transform_text_button(text)

    if '<IconButton' in text and 'shared/ui' in text:
        text = ensure_icon_import(text)

    if path.as_posix() == 'src/pages/recruitment/VacancyFormPage.tsx':
        text = text.replace('  FiChevronRight,\n', '')

    if text != original:
        path.write_text(text, encoding='utf-8')
        print('updated', path)

remaining = []
for path in ROOT.rglob('*.tsx'):
    if path.name == 'IconButton.tsx':
        continue
    content = path.read_text(encoding='utf-8')
    if re.search(r'<Button.*?className="[^"]*p-0[^"]*"', content, re.S):
        remaining.append(str(path))

if remaining:
    raise RuntimeError('Button+p-0 candidates remain: ' + ', '.join(remaining))
