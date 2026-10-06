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
    bRound: 'Round', bPencil: 'Pencil', bMarker: 'Marker', bAirbrush: 'Airbrush', bGlow: 'Glow',
    bWatercolor: 'Watercolor', bSpray: 'Spray', bChalk: 'Chalk', bCharcoal: 'Charcoal',
    bCrayon: 'Crayon', bNeon: 'Neon', bInk: 'Ink', bCalligraphy: 'Calligraphy',
    bBristle: 'Bristle', bSparkle: 'Sparkle',
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
    bRound: 'Круглая', bPencil: 'Карандаш', bMarker: 'Маркер', bAirbrush: 'Аэрограф', bGlow: 'Свечение',
    bWatercolor: 'Акварель', bSpray: 'Распыление', bChalk: 'Мел', bCharcoal: 'Уголь',
    bCrayon: 'Восковой', bNeon: 'Неон', bInk: 'Тушь', bCalligraphy: 'Каллиграфия',
    bBristle: 'Щетина', bSparkle: 'Искры',
  }
};

export type TKey = keyof typeof T.en;