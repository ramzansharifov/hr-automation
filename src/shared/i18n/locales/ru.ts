export const ru = {
  app: {
    brand: {
      title: 'HR Automation',
      subtitle: 'Кадровая система',
    },
    topbar: {
      title: 'Панель управления',
      databaseActive: 'SQLite активен',
    },
    sidebar: {
      expand: 'Раскрыть',
      collapse: 'Свернуть',
      expandSidebar: 'Раскрыть сайдбар',
      collapseSidebar: 'Свернуть сайдбар',
    },
  },

  navigation: {
    dashboard: 'Главная',
    employees: 'Сотрудники',
    departments: 'Отделы',
    positions: 'Должности',
    vacations: 'Отпуска',
    payroll: 'Зарплата',
    profile: 'Профиль',
    settings: 'Настройки',
  },

  common: {
    actions: {
      refresh: 'Обновить',
      open: 'Открыть',
      back: 'Назад',
      next: 'Далее',
    },
    fields: {
      search: 'Поиск',
    },
    table: {
      total: 'Всего',
      empty: 'Записей пока нет',
      noRecords: 'Нет записей',
      loading: 'Загрузка...',
      sort: {
        asc: 'ASC',
        desc: 'DESC',
      },
    },
    errors: {
      dashboardLoad: 'Не удалось загрузить панель',
      dataLoad: 'Не удалось загрузить данные',
    },
    notifications: {
      createFormSoon: 'Форма добавления будет в следующем патче',
    },
    status: {
      active: 'Активен',
      inactive: 'Неактивен',
      planned: 'Запланирован',
      approved: 'Одобрен',
      rejected: 'Отклонён',
      completed: 'Завершён',
      paid: 'Выплачено',
      pending: 'Ожидает',
      male: 'Мужской',
      female: 'Женский',
    },
  },

  dashboard: {
    hero: {
      productName: 'HR Automation',
      title: 'Автоматизация отдела кадров',
      employeesButton: 'Сотрудники',
    },
    stats: {
      total: 'Всего',
      active: 'Активные',
      month: 'Месяц',
      employees: 'Сотрудники',
      departments: 'Отделы',
      positions: 'Должности',
      vacations: 'Отпуска',
      payroll: 'Зарплата',
    },
    sections: {
      latestEmployees: 'Последние сотрудники',
      upcomingVacations: 'Ближайшие отпуска',
    },
  },

  profile: {
    title: 'Профиль',
    admin: 'Администратор',
    localUser: 'Локальный пользователь системы',
  },

  settings: {
    title: 'Настройки',
    appearance: {
      title: 'Внешний вид',
      description: 'Тема и акцент применяются ко всему интерфейсу и сохраняются локально.',
      theme: {
        title: 'Тема',
        currentPalette: 'Сейчас активна {{palette}} палитра.',
        palette: {
          light: 'светлая',
          dark: 'темная',
        },
        options: {
          light: 'Светлая',
          dark: 'Темная',
          system: 'Системная',
        },
      },
      accent: {
        title: 'Акцентный цвет',
        description: 'Используется для активной навигации, кнопок, ссылок и выделений.',
        options: {
          blue: 'Синий',
          indigo: 'Индиго',
          emerald: 'Изумруд',
          violet: 'Фиолетовый',
          rose: 'Розовый',
          amber: 'Янтарный',
        },
      },
    },
    language: {
      title: 'Язык интерфейса',
      description: 'Проект готов к нескольким языкам. Сейчас подключен русский язык.',
      current: 'Текущий язык',
      options: {
        ru: 'Русский',
      },
    },
    system: {
      title: 'Система',
      database: {
        title: 'База данных',
        description: 'SQLite подключена через Electron backend.',
      },
      interface: {
        title: 'Интерфейс',
        description: 'Настройки оформления и языка применяются без перезапуска приложения.',
      },
    },
  },

  entities: {
    employees: {
      title: 'Сотрудники',
      description: 'Кадровый состав, контакты, отделы, должности и даты приема на работу.',
      createLabel: 'Добавить сотрудника',
      columns: {
        employeeCode: 'Код',
        lastName: 'Фамилия',
        firstName: 'Имя',
        middleName: 'Отчество',
        department: 'Отдел',
        position: 'Должность',
        phone: 'Телефон',
        email: 'Email',
        hireDate: 'Дата приема',
        status: 'Статус',
      },
    },
    departments: {
      title: 'Отделы',
      description: 'Организационная структура, руководители, телефоны и расположение отделов.',
      createLabel: 'Добавить отдел',
      columns: {
        name: 'Наименование',
        managerName: 'Руководитель',
        phone: 'Телефон',
        email: 'Email',
        location: 'Расположение',
        createdOn: 'Дата создания',
        note: 'Примечание',
      },
    },
    positions: {
      title: 'Должности',
      description: 'Оклады, надбавки, премии, обязанности и требования по должностям.',
      createLabel: 'Добавить должность',
      columns: {
        name: 'Должность',
        baseSalary: 'Оклад',
        allowance: 'Надбавка',
        bonus: 'Премия',
        responsibilities: 'Обязанности',
        requirements: 'Требования',
      },
    },
    vacations: {
      title: 'Отпуска',
      description: 'Плановые, ежегодные и другие отпуска сотрудников с датами и статусами.',
      createLabel: 'Оформить отпуск',
      columns: {
        employee: 'Сотрудник',
        vacationType: 'Вид отпуска',
        startsAt: 'Начало',
        endsAt: 'Окончание',
        daysCount: 'Дней',
        reason: 'Причина',
        status: 'Статус',
      },
    },
    payroll: {
      title: 'Заработная плата',
      description: 'Начисления по месяцам: оклад, премии, надбавки, удержания, налоги и итог.',
      createLabel: 'Добавить начисление',
      columns: {
        employee: 'Сотрудник',
        accrualMonth: 'Месяц',
        baseSalary: 'Оклад',
        bonus: 'Премия',
        allowance: 'Надбавка',
        deductions: 'Удержания',
        taxes: 'Налоги',
        netAmount: 'Итого',
        paidAt: 'Дата выплаты',
      },
    },
  },
} as const