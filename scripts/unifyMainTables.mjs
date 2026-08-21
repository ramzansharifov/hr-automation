import fs from 'node:fs'

function read(path) {
  return fs.readFileSync(path, 'utf8')
}

function write(path, content) {
  fs.writeFileSync(path, content)
}

function replaceOnce(content, before, after, label) {
  const index = content.indexOf(before)
  if (index < 0) throw new Error(`Missing block: ${label}`)
  if (content.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Duplicate block: ${label}`)
  }
  return content.slice(0, index) + after + content.slice(index + before.length)
}

function replaceRegex(content, regex, after, label) {
  const matches = [...content.matchAll(regex)]
  if (matches.length !== 1) throw new Error(`${label}: expected 1 match, got ${matches.length}`)
  return content.replace(regex, after)
}

function migrateCandidates() {
  const path = 'src/pages/recruitment/CandidatesPage.tsx'
  let text = read(path)

  text = text.replace('import { CandidateSummaryCard } from "../../features/recruitment/CandidateSummaryCard";\n', '')
  text = replaceOnce(
    text,
    `import {\n  Button,\n  ConfirmDialog,\n  IconButton,\n  Dialog,\n  EmptyState,\n  Input,\n  LoadingState,\n  Select,\n  ViewModeToggle,\n  useStoredViewMode,\n  type SelectOption,\n} from "../../shared/ui";`,
    `import {\n  Button,\n  ConfirmDialog,\n  DataTable,\n  Dialog,\n  IconButton,\n  Input,\n  Select,\n  type DataTableColumn,\n  type SelectOption,\n} from "../../shared/ui";`,
    'candidate imports',
  )
  text = text.replace('  const [viewMode, setViewMode] = useStoredViewMode("candidates", "cards");\n', '')

  text = replaceRegex(
    text,
    /      <section className="app-surface app-border overflow-hidden rounded-\[28px\] border">[\s\S]*?      <\/section>\n\n      <Dialog/,
    `      <CandidatesTable\n        canManage={canManage}\n        candidates={filteredCandidates}\n        hasAnyCandidates={candidates.length > 0}\n        isLoading={isLoading}\n        onDelete={setDeleteTarget}\n        onOpen={(candidate) => void openCandidate(candidate)}\n        onRefresh={() => void loadData()}\n      />\n\n      <Dialog`,
    'candidate registry section',
  )

  const replacement = `function CandidatesTable({\n  canManage,\n  candidates,\n  hasAnyCandidates,\n  isLoading,\n  onDelete,\n  onOpen,\n  onRefresh,\n}: {\n  canManage: boolean;\n  candidates: HrRecord[];\n  hasAnyCandidates: boolean;\n  isLoading: boolean;\n  onDelete: (candidate: HrRecord) => void;\n  onOpen: (candidate: HrRecord) => void;\n  onRefresh: () => void;\n}): JSX.Element {\n  const columns: DataTableColumn<HrRecord>[] = [\n    {\n      key: "name",\n      header: "ФИО",\n      render: (candidate) => (\n        <span className="app-text font-black">{candidateFullName(candidate)}</span>\n      ),\n    },\n    {\n      key: "vacancy",\n      header: "Вакансия / структура",\n      render: (candidate) => (\n        <div className="min-w-[210px]">\n          <p className="app-text font-bold">{String(candidate.position_name ?? "—")}</p>\n          <p className="app-muted mt-1 text-xs font-semibold">\n            {[candidate.enterprise_name, candidate.department_name].filter(Boolean).join(" · ") || "—"}\n          </p>\n        </div>\n      ),\n    },\n    {\n      key: "contacts",\n      header: "Контакты",\n      render: (candidate) => (\n        <div className="min-w-[170px] space-y-1">\n          <p className="app-text-soft text-sm">{String(candidate.phone ?? "—")}</p>\n          <p className="app-muted truncate text-xs">{String(candidate.email ?? "—")}</p>\n        </div>\n      ),\n    },\n    {\n      key: "status",\n      header: "Этап",\n      render: (candidate) => (\n        <RecruitmentBadge tone={candidate.status === "hired" ? "success" : candidate.status === "offer" ? "warning" : "accent"}>\n          {candidateStatusLabel(String(candidate.status))}\n        </RecruitmentBadge>\n      ),\n    },\n    {\n      key: "match",\n      header: "Соответствие",\n      render: (candidate) => (\n        <div className="min-w-[160px]">\n          <MatchBar value={Number(candidate.match_percentage ?? 0)} />\n        </div>\n      ),\n    },\n    {\n      key: "source",\n      header: "Источник",\n      render: (candidate) => (\n        <span className="app-text-soft">{String(candidate.source ?? "—")}</span>\n      ),\n    },\n    ...(canManage\n      ? [\n          {\n            key: "actions",\n            header: "Действия",\n            align: "center" as const,\n            render: (candidate: HrRecord) => (\n              <div\n                className="flex items-center justify-center gap-2"\n                onClick={(event) => event.stopPropagation()}\n              >\n                <IconButton\n                  icon={<FiEdit2 />}\n                  label="Редактировать кандидата"\n                  onClick={() => onOpen(candidate)}\n                  size="sm"\n                />\n                {!candidate.employee_id && (\n                  <IconButton\n                    icon={<FiTrash2 />}\n                    label="Удалить кандидата"\n                    onClick={() => onDelete(candidate)}\n                    size="sm"\n                    tone="danger"\n                  />\n                )}\n              </div>\n            ),\n          },\n        ]\n      : []),\n  ];\n\n  return (\n    <DataTable\n      ariaLabel="Реестр кандидатов"\n      columns={columns}\n      emptyDescription={\n        hasAnyCandidates\n          ? "Измените или очистите фильтры на странице фильтров."\n          : canManage\n            ? "Добавьте кандидата к существующей вакансии и оцените его навыки."\n            : "В доступной области пока нет кандидатов."\n      }\n      emptyTitle={hasAnyCandidates ? "Нет кандидатов по выбранным фильтрам" : "Кандидатов пока нет"}\n      footer={\n        <>\n          Всего в выборке: <span className="app-text font-black">{candidates.length}</span>\n        </>\n      }\n      getRowKey={(candidate) => String(candidate.id)}\n      isLoading={isLoading}\n      loadingLabel="Загрузка кандидатов..."\n      onRowClick={onOpen}\n      rows={candidates}\n      toolbar={\n        <div className="ml-auto">\n          <Button\n            leftIcon={<FiRefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />}\n            onClick={onRefresh}\n            type="button"\n            variant="secondary"\n          >\n            Обновить\n          </Button>\n        </div>\n      }\n    />\n  );\n}\n\nfunction candidateFullName`

  text = replaceRegex(
    text,
    /function CandidatesTable\([\s\S]*?\nfunction candidateFullName/,
    replacement,
    'candidate table functions',
  )

  write(path, text)
}

function migrateAccess() {
  const path = 'src/pages/access/AccessControlPage.tsx'
  let text = read(path)

  text = replaceOnce(
    text,
    `  ConfirmDialog,\n  Dialog,\n  EmptyState,\n  IconButton,`,
    `  ConfirmDialog,\n  DataTable,\n  Dialog,\n  IconButton,`,
    'access DataTable import',
  )
  text = replaceOnce(
    text,
    `  Textarea,\n  type SelectOption,`,
    `  Textarea,\n  type DataTableColumn,\n  type SelectOption,`,
    'access DataTable type import',
  )

  const sections = `function UsersSection({\n  onDelete,\n  onEdit,\n  onResetPassword,\n  systemAdmin,\n  users,\n}: {\n  onDelete: (user: AccessUserSummary) => void;\n  onEdit: (user: AccessUserSummary) => void;\n  onResetPassword: (user: AccessUserSummary) => void;\n  systemAdmin: SystemAdminSummary;\n  users: AccessUserSummary[];\n}): JSX.Element {\n  type UserRow =\n    | { kind: "system"; id: string; admin: SystemAdminSummary }\n    | { kind: "user"; id: string; user: AccessUserSummary };\n\n  const rows: UserRow[] = [\n    { kind: "system", id: "system-superadmin", admin: systemAdmin },\n    ...users.map((user) => ({ kind: "user" as const, id: String(user.id), user })),\n  ];\n\n  const columns: DataTableColumn<UserRow>[] = [\n    {\n      key: "account",\n      header: "Учётная запись",\n      render: (row) => row.kind === "system" ? (\n        <div className="flex min-w-[210px] items-center gap-3">\n          <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">\n            <FiShield className="h-5 w-5" />\n          </span>\n          <div>\n            <div className="flex flex-wrap items-center gap-2">\n              <span className="app-text font-black">Системный администратор</span>\n              <span className="app-accent-soft app-accent-text rounded-full px-2 py-0.5 text-[10px] font-black">Встроенная</span>\n            </div>\n            <p className="app-accent-text mt-1 text-xs font-black">@{row.admin.username}</p>\n          </div>\n        </div>\n      ) : (\n        <div className="flex min-w-[210px] items-center gap-3">\n          <span className="app-accent-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">\n            <FiUserCheck className="h-5 w-5" />\n          </span>\n          <div>\n            <p className="app-text font-black">{row.user.employeeName}</p>\n            <p className="app-accent-text mt-1 text-xs font-black">@{row.user.username}</p>\n          </div>\n        </div>\n      ),\n    },\n    {\n      key: "structure",\n      header: "Сотрудник / структура",\n      render: (row) => row.kind === "system" ? (\n        <span className="app-muted text-sm">Не связан с сотрудником</span>\n      ) : (\n        <div className="min-w-[180px]">\n          <p className="app-text-soft text-sm font-semibold">{row.user.employeeName}</p>\n          <p className="app-muted mt-1 text-xs">\n            {[row.user.enterpriseName, row.user.departmentName].filter(Boolean).join(" · ") || "—"}\n          </p>\n        </div>\n      ),\n    },\n    {\n      key: "status",\n      header: "Статус",\n      render: (row) => row.kind === "system" ? <StatusBadge status="active" /> : <StatusBadge status={row.user.status} />,\n    },\n    {\n      key: "roles",\n      header: "Роли",\n      render: (row) => (\n        <div className="flex max-w-[260px] flex-wrap gap-1.5">\n          {row.kind === "system" ? (\n            <span className="app-surface-muted app-border rounded-full border px-2.5 py-1 text-xs font-bold">Superadmin</span>\n          ) : row.user.roles.length > 0 ? (\n            row.user.roles.slice(0, 3).map((role) => (\n              <span className="app-surface-muted app-border rounded-full border px-2.5 py-1 text-xs font-bold" key={role.id}>\n                {role.name}\n              </span>\n            ))\n          ) : (\n            <span className="app-muted text-xs">Нет ролей</span>\n          )}\n          {row.kind === "user" && row.user.roles.length > 3 && (\n            <span className="app-muted text-xs font-bold">+{row.user.roles.length - 3}</span>\n          )}\n        </div>\n      ),\n    },\n    {\n      key: "access",\n      header: "Доступ",\n      render: (row) => row.kind === "system" ? (\n        <div>\n          <p className="app-text font-bold">Полный системный доступ</p>\n          <p className="app-muted mt-1 text-xs">Пароль: {row.admin.mustChangePassword ? "требуется смена" : "установлен"}</p>\n        </div>\n      ) : (\n        <div>\n          <p className="app-text font-bold">{row.user.effectivePermissionCodes.length} разрешений</p>\n          {row.user.mustChangePassword && (\n            <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-300">Требуется смена пароля</p>\n          )}\n        </div>\n      ),\n    },\n    {\n      key: "actions",\n      header: "Действия",\n      align: "center",\n      render: (row) => row.kind === "system" ? (\n        <span className="app-muted text-xs font-semibold">Системная</span>\n      ) : (\n        <div className="flex items-center justify-center gap-2">\n          <IconButton label="Сбросить пароль" onClick={() => onResetPassword(row.user)}>\n            <FiKey />\n          </IconButton>\n          <IconButton label="Редактировать" onClick={() => onEdit(row.user)}>\n            <FiEdit2 />\n          </IconButton>\n          <IconButton danger label="Удалить" onClick={() => onDelete(row.user)}>\n            <FiTrash2 />\n          </IconButton>\n        </div>\n      ),\n    },\n  ];\n\n  return (\n    <DataTable\n      ariaLabel="Пользователи системы"\n      columns={columns}\n      footer={\n        <>\n          Учётных записей: <span className="app-text font-black">{rows.length}</span>\n        </>\n      }\n      frame={false}\n      getRowKey={(row) => row.id}\n      rows={rows}\n    />\n  );\n}\n\nfunction RolesSection({\n  onDelete,\n  onEdit,\n  permissions,\n  roles,\n}: {\n  onDelete: (role: AccessRoleSummary) => void;\n  onEdit: (role: AccessRoleSummary) => void;\n  permissions: AccessPermission[];\n  roles: AccessRoleSummary[];\n}): JSX.Element {\n  const permissionMap = new Map(permissions.map((permission) => [permission.code, permission]));\n  const columns: DataTableColumn<AccessRoleSummary>[] = [\n    {\n      key: "role",\n      header: "Роль",\n      render: (role) => (\n        <div className="min-w-[220px]">\n          <div className="flex flex-wrap items-center gap-2">\n            <span className="app-text font-black">{role.name}</span>\n            {role.isSystem && (\n              <span className="app-accent-soft app-accent-text rounded-full px-2 py-0.5 text-[10px] font-black">Системная</span>\n            )}\n          </div>\n          <p className="app-muted mt-1 max-w-[360px] text-xs leading-5">{role.description || "—"}</p>\n        </div>\n      ),\n    },\n    {\n      key: "scope",\n      header: "Область данных",\n      render: (role) => <span className="app-text-soft font-semibold">{scopeLabel(role.scopeType)}</span>,\n    },\n    {\n      key: "users",\n      header: "Пользователей",\n      align: "center",\n      render: (role) => <span className="app-text font-black">{role.userCount}</span>,\n    },\n    {\n      key: "permissions",\n      header: "Разрешения",\n      render: (role) => (\n        <div className="flex max-w-[360px] flex-wrap gap-1.5">\n          {role.permissionCodes.slice(0, 3).map((code) => (\n            <span className="app-surface-muted app-border inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold" key={code}>\n              <FiCheck className="app-accent-text h-3 w-3" />\n              {permissionMap.get(code)?.name ?? code}\n            </span>\n          ))}\n          {role.permissionCodes.length > 3 && (\n            <span className="app-muted self-center text-xs font-bold">+{role.permissionCodes.length - 3}</span>\n          )}\n        </div>\n      ),\n    },\n    {\n      key: "actions",\n      header: "Действия",\n      align: "center",\n      render: (role) => role.isSystem ? (\n        <span className="app-muted text-xs font-semibold">Защищена</span>\n      ) : (\n        <div className="flex items-center justify-center gap-2">\n          <IconButton label="Редактировать" onClick={() => onEdit(role)}>\n            <FiEdit2 />\n          </IconButton>\n          <IconButton danger label="Удалить" onClick={() => onDelete(role)}>\n            <FiTrash2 />\n          </IconButton>\n        </div>\n      ),\n    },\n  ];\n\n  return (\n    <DataTable\n      ariaLabel="Роли доступа"\n      columns={columns}\n      emptyDescription="Создайте первую кастомную роль или используйте системные роли."\n      emptyTitle="Ролей пока нет"\n      footer={\n        <>\n          Ролей: <span className="app-text font-black">{roles.length}</span>\n        </>\n      }\n      frame={false}\n      getRowKey={(role) => role.id}\n      rows={roles}\n    />\n  );\n}\n\nfunction RoleDialog`

  text = replaceRegex(
    text,
    /function UsersSection\([\s\S]*?\nfunction RoleDialog/,
    sections,
    'access table sections',
  )

  text = text.replace(/\nfunction RoleMetric\([\s\S]*?\n}\n\nfunction Field/, '\nfunction Field')
  text = text.replace(/\nfunction formatDateTime\([\s\S]*?\n}\n\nfunction getErrorMessage/, '\nfunction getErrorMessage')

  write(path, text)
}

function migrateHrEntityTable() {
  const path = 'src/features/hr-table/HrEntityTable.tsx'
  let text = read(path)

  text = replaceOnce(
    text,
    `import { Button, EmptyState, IconButton, LoadingState, Select, type SelectOption } from '../../shared/ui'`,
    `import { Button, DataTable, EmptyState, IconButton, LoadingState, Select, type DataTableColumn, type SelectOption } from '../../shared/ui'`,
    'hr table imports',
  )
  text = text.replace('  const tableColumnCount = visibleColumns.length + (hasActions ? 1 : 0)\n', '')

  const block = `      <div className={viewMode === 'table' ? 'min-h-0 flex-1 overflow-auto' : 'hidden'}>\n        <DataTable\n          columns={[\n            ...visibleColumns.map((column): DataTableColumn<HrRecord> => ({\n              key: column.key,\n              header: (\n                <button\n                  type="button"\n                  onClick={() => handleSort(column.key)}\n                  className="flex items-center gap-2 text-left transition hover:text-[var(--accent)]"\n                >\n                  {column.label}\n                  {orderBy === column.key && (\n                    <span className="app-accent-soft rounded-full px-2 py-0.5 text-[10px]">\n                      {orderDirection === 'asc'\n                        ? t('common.table.sort.asc')\n                        : t('common.table.sort.desc')}\n                    </span>\n                  )}\n                </button>\n              ),\n              className: [\n                'app-text-soft max-w-[280px] align-top',\n                column.className ?? '',\n              ].join(' '),\n              render: (record) => (\n                <span className="line-clamp-2">{renderCell(record, column, locale)}</span>\n              ),\n            })),\n            ...(hasActions\n              ? [\n                  {\n                    key: 'actions',\n                    header: t('common.table.actions'),\n                    align: 'center' as const,\n                    className: 'align-top',\n                    render: (record: HrRecord) => (\n                      <div\n                        className="flex items-center justify-center gap-2"\n                        onClick={(event) => event.stopPropagation()}\n                      >\n                        <IconButton\n                          className="app-table-action-button app-table-action-button--edit"\n                          icon={<FiEdit2 />}\n                          label={t('common.actions.edit')}\n                          onClick={() => handleEditClick(record)}\n                          size="sm"\n                        />\n                        <IconButton\n                          className="app-table-action-button app-table-action-button--delete"\n                          icon={<FiTrash2 />}\n                          label={t('common.actions.delete')}\n                          onClick={() => handleDeleteClick(record)}\n                          size="sm"\n                          tone="danger"\n                        />\n                      </div>\n                    ),\n                  },\n                ]\n              : []),\n          ]}\n          emptyTitle={t('common.table.empty')}\n          frame={false}\n          getRowKey={(record, index) => String(record.id ?? index)}\n          isLoading={isLoading}\n          loadingLabel={t('common.table.loading')}\n          onRowClick={onRowClick}\n          rows={result.items}\n        />\n      </div>`

  text = replaceRegex(
    text,
    /      <div className=\{viewMode === 'table' \? 'min-h-0 flex-1 overflow-auto' : 'hidden'\}>[\s\S]*?      <\/div>\n\n      \{viewMode === 'cards'/,
    `${block}\n\n      {viewMode === 'cards'`,
    'hr entity table markup',
  )

  write(path, text)
}

migrateCandidates()
migrateAccess()
migrateHrEntityTable()
console.log('Unified main tables migration completed')
