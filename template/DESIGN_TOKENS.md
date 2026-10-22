# Дизайн-токены, извлечённые из Astra.fig (canvas.fig → JSON)
# Получено конвертацией .fig через fig2sketch --dump-fig-json (окт. 2026)
# ⚠️ ВАЖНО: в репозитории НЕТ папки template с PNG-кадрами (проверено: git ls-tree, find, fetch).
# Все токены ниже извлечены напрямую из бинарника Astra.fig — это авторитетный источник макета.
# В assets/ лежат оригинальные изображения, встроенные в макет (hero, about, портреты мастеров, фоны админки).

## Шрифты
- Playfair Display Bold — логотип «A», H1 Hero (80px desktop / 44px mobile), заголовки секций (48px / 36px)
- Playfair Display SemiBold — названия услуг и мастеров (24px / 22px), подзаголовки футера (20px)
- Inter Regular/Medium/SemiBold/Bold — всё остальное (текст 14–16px, лейблы 12px)

## Палитра
- #F9F7F2 — основной фон (бежевый)
- #FFFFFF — карточки, секция Team, сайдбар админки
- #1F1F1F — тёмно-графитовый: текст акцентов, кнопки, футер
- #6B6B6B — вторичный серый текст
- #E5E1DA — границы/линии
- #D4A3A3 — пастельно-розовый: eyebrow-лейблы («Our Services», «Meet the Team»), required-звёздочки
- Статусы (админка): Confirmed #2E7D32 на #E8F5E9; Pending #B26A00 на #FFF4E5; Completed #356147 на #E8F3EC

## Клиентский сайт (Desktop 1920px, высота 5067px)
Секции: Header 1920x100 (pad 24/120) | Hero 1920x800 | About Us 1920x840 | Services 1920x821 (5 карточек) |
Team 1920x882 (фон белый) | Booking 1920x1106 | Footer 1920x518 (фон #1F1F1F)
- Header: лого «A» (белый на графите) + «Astra»; меню Services, Masters, About, Contact; кнопка «Book Now» (#1F1F1F, белый текст)
- Hero: eyebrow «Premium Beauty Salon» (#D4A3A3), H1 «Your Beauty, Our Art» 80px, подзаголовок 20px,
  кнопки «Book Appointment» (графит) и «View Services» (контур)
- Услуги: Haircuts & Styling / Nail Service / Browbar / Spray Tan / Men's Grooming, описание 14px, «View Details»
- Мастера: Elena Rossi (Lead Stylist), Marcus Thorne (Master Barber), Sarah Jenkins (Makeup Artist)
- Форма: Service*, Master*, Date*, Time* (select), Name* (Enter your first name), Phone* (+1 (555) 000-0000),
  Last Name (Optional), Email (Optional); кнопка «Confirm Booking»; примечание «* Required fields...»
- Футер: Opening Hours (Mon-Fri 9-8, Sat 10-6, Sun Closed), Location (1200 High Street, Suite 400 Beverly Hills, CA 90210),
  Navigation/Legal ссылки, телефон (555) 123-4567

## Мобильная версия (360px, высота 4972px)
header 84px (бургер) | hero 619 | about 658 | services 462 (гориз. свайп, «Swipe to explore all services») |
team 1132 (белый фон) | booking 1473 (форма на всю ширину) | footer 456 | bottom-nav 88px sticky
(«Записаться»/Book Now + иконка телефона)

## Админка
- Login (1920x1080): карточка 480x611, r=24, pad 48, по центру; лого «A», «Astra Admin» 36px Playfair,
  Username (salon@astra.com), Password (•••), «Log In» (белый текст на графите), «Forgot password?»
  Фон: 4 размытых цветных пятна по углам
- Dashboard PC (1920x1308): Sidebar 248px белый (Navigation: Dashboard, Schedule, Bookings, Settings),
  Top: поиск «Search bookings, clients, or masters» + профиль (Elena Rossi / Lead Stylist, аватар ER)
  Кнопка «Create Manual Booking»; KPI-карточки: Scheduled 18, Masters 6, Waitlist 3, Confirmed 96%;
  Daily Schedule — сетка мастера×время (09:00–16:30, услуги Haircut/Styling/Color/Shave/Fade/Mani/Pedi/Tan…);
  Recent Bookings — таблица Time/Client Name/Service/Status с фильтром статусов
- Mobile Admin (360x1345): Top Header 224 (профиль ER + Today/Week + оранжевая FAB «Create Booking»),
  список «Today's bookings» карточками (время, клиент, услуга, мастер, бейдж статуса),
  Bottom Navigation 84px: Home, Schedule, Bookings, (+ Profile)

## Детали сетки (из дерева узлов Astra.fig)
- Контейнер секций Desktop: 1680px (падды 120px по бокам), межколоночные отступы ~32px
- Services Grid: 5 карточек 310x420, r=24, фон #FFFFFF; заголовок секции eyebrow #D4A3A3 + H2 Playfair 48px
- Team: 3 карточки ~539x481 (фото 539x400, r сверху; имя Playfair SemiBold 24 + специализация Inter 14)
- Booking: форма — белая карточка 1200x866 r=24; поля в 2 колонки (524px): Service/Master, Date/Time;
  Name full-width; Phone+Last name? (Name*, затем строка 2×524 = Phone* и Last Name), Email full-width;
  поля: label 12px SemiBold + input 49px, border #E5E1DA r=12; кнопка Confirm Booking — pill (r=100), #1F1F1F;
  справа Info-блоки Opening Hours / Location (фон #F9F7F2)
- Footer: #1F1F1F, лого+описание, Navigation/Legal колонки, разделитель, копирайт + белая Phone Button 219x60 (pill) с иконкой
- Admin Dashboard: Sidebar 248 (#FFFFFF) [Brand 40px logo, Nav items 42px, active bg #F1EFE9 r~10, Sidebar Note #F1EFE9];
  Main 1672 pad 32: TopHeader (Search 420x48 белый r-pill + Create Manual Booking графит + профиль),
  Overview Row KPI 4 карточки (число 32px Bold), Schedule Section 1608x400 (сетка Master x время),
  Recent Bookings 1608x504 (таблица + фильтр статусов чипами)
