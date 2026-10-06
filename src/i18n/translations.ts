export const T = {
  en: {
    file: 'File', newProject: 'New Project', openImage: 'Open Image', export: 'Export',
    layers: 'Layers', settings: 'Settings', size: 'Size', brushes: 'Brushes',
    canvasColor: 'Canvas color', canvasDesc: 'Default canvas background',
    viewportColor: 'Viewport color', viewportDesc: 'Area around the canvas',
    theme: 'Theme', light: 'Light', dark: 'Dark', language: 'Language',
    presets: 'Presets', custom: 'Custom size', cancel: 'Cancel', create: 'Create',
    newLayer: 'New layer', deleteLayer: 'Delete', lock: 'Lock', unlock: 'Unlock',
    show: 'Show', hide: 'Hide', filled: 'Filled', outline: 'Outline',
    line: 'Line', square: 'Square', circle: 'Circle', triangle: 'Triangle',
    eyedropper: 'Eyedropper', bucket: 'Bucket', lasso: 'Lasso', hand: 'Hand', eraser: 'Eraser',
    auto: 'Auto', exportLayer: 'Export current layer',

    // basic
    bRound: 'Round', bPencil: 'Pencil', bMarker: 'Marker', bInk: 'Ink', bCalligraphy: 'Calligraphy',
    // soft
    bAirbrush: 'Airbrush', bGlow: 'Glow', bWatercolor: 'Watercolor', bNeon: 'Neon',
    bMist: 'Mist', bSmoke: 'Smoke', bCloud: 'Cloud', bAurora: 'Aurora', bFog: 'Fog',
    // textured
    bSpray: 'Spray', bChalk: 'Chalk', bCharcoal: 'Charcoal', bCrayon: 'Crayon', bBristle: 'Bristle',
    bOil: 'Oil', bPastel: 'Pastel', bSand: 'Sand', bRust: 'Rust',
    bConcrete: 'Concrete', bWood: 'Wood', bFabric: 'Fabric',
    // special
    bSparkle: 'Sparkle', bStars: 'Stars', bConfetti: 'Confetti', bBubbles: 'Bubbles',
    bGlitter: 'Glitter', bFrost: 'Frost', bSplatter: 'Splatter', bVine: 'Vine', bLeaves: 'Leaves',
    // grand
    bMosaic: 'Mosaic', bRings: 'Rings', bWeb: 'Web', bFlame: 'Flame', bGalaxy: 'Galaxy',
  },
  ru: {
    file: 'Файл', newProject: 'Новый проект', openImage: 'Открыть изображение', export: 'Экспорт',
    layers: 'Слои', settings: 'Настройки', size: 'Размер', brushes: 'Кисти',
    canvasColor: 'Цвет холста', canvasDesc: 'Фон холста по умолчанию',
    viewportColor: 'Цвет фона', viewportDesc: 'Область вокруг холста',
    theme: 'Тема', light: 'Светлая', dark: 'Тёмная', language: 'Язык',
    presets: 'Пресеты', custom: 'Свой размер', cancel: 'Отмена', create: 'Создать',
    newLayer: 'Новый слой', deleteLayer: 'Удалить', lock: 'Заблокировать', unlock: 'Разблокировать',
    show: 'Показать', hide: 'Скрыть', filled: 'Заливка', outline: 'Контур',
    line: 'Линия', square: 'Квадрат', circle: 'Круг', triangle: 'Треугольник',
    eyedropper: 'Пипетка', bucket: 'Заливка', lasso: 'Лассо', hand: 'Рука', eraser: 'Ластик',
    auto: 'Авто', exportLayer: 'Экспорт текущего слоя',

    // basic
    bRound: 'Круглая', bPencil: 'Карандаш', bMarker: 'Маркер', bInk: 'Тушь', bCalligraphy: 'Каллиграфия',
    // soft
    bAirbrush: 'Аэрограф', bGlow: 'Свечение', bWatercolor: 'Акварель', bNeon: 'Неон',
    bMist: 'Туман', bSmoke: 'Дым', bCloud: 'Облако', bAurora: 'Сияние', bFog: 'Дымка',
    // textured
    bSpray: 'Распыление', bChalk: 'Мел', bCharcoal: 'Уголь', bCrayon: 'Восковой', bBristle: 'Щетина',
    bOil: 'Масло', bPastel: 'Пастель', bSand: 'Песок', bRust: 'Ржавчина',
    bConcrete: 'Бетон', bWood: 'Дерево', bFabric: 'Ткань',
    // special
    bSparkle: 'Искры', bStars: 'Звёзды', bConfetti: 'Конфетти', bBubbles: 'Пузыри',
    bGlitter: 'Блёстки', bFrost: 'Мороз', bSplatter: 'Брызги', bVine: 'Лоза', bLeaves: 'Листья',
    // grand
    bMosaic: 'Мозаика', bRings: 'Кольца', bWeb: 'Паутина', bFlame: 'Пламя', bGalaxy: 'Галактика',
  },
};

export type TKey = keyof typeof T.en;