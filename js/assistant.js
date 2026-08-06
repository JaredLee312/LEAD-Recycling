const CATEGORY_INFO = {
  'blue-bin': { label: 'Blue Bin', icon: '♻️', href: 'blue-bin.html' },
  'e-waste': { label: 'E-Waste', icon: '🔌', href: 'e-waste.html' },
  'textile': { label: 'Textile Bin', icon: '👕', href: 'textile.html' },
  'bcrs': { label: 'Beverage Container Return', icon: '🥤', href: 'bcrs.html' }
};

function validateAssistantForm(form) {
  if (!form.hasPhoto) {
    return 'Please attach a photo of the item.';
  }
  return null;
}

// Keyword lists mapping the general-purpose ImageNet labels that
// @tensorflow-models/mobilenet returns onto BinFinderSG's four bin
// categories. This is a best-effort heuristic on top of a model that knows
// nothing about recycling — it recognizes "water bottle", not "recyclable
// plastic" — so mismatches are expected, especially for anything ambiguous,
// damaged, or made of mixed materials. It's the tradeoff for running fully
// client-side at zero cost instead of calling a real vision-reasoning API.
const BLUE_BIN_KEYWORDS = [
  'bottle', 'carton', 'envelope', 'newspaper', 'magazine', 'jar', 'tin can',
  'menu', 'comic book', 'paper towel', 'plastic bag'
];
const E_WASTE_KEYWORDS = [
  'phone', 'laptop', 'computer', 'ipod', 'modem', 'remote control', 'cassette',
  'cd player', 'hard disc', 'joystick', 'printer', 'monitor', 'keyboard',
  'mouse', 'digital clock', 'digital watch', 'toaster', 'washer', 'dishwasher',
  'microwave', 'space heater', 'electric fan', 'hair dryer', 'hand blower',
  'battery', 'radio', 'television'
];
const TEXTILE_KEYWORDS = [
  'jersey', 'sweatshirt', 'cardigan', 'kimono', 'poncho', 'jean', 'skirt',
  'gown', 'coat', 'sock', 'shoe', 'sandal', 'boot', 'loafer', 'clog',
  'sneaker', 'necktie', 'bow tie', 'bikini', 'trunks', 'brassiere',
  'handkerchief', 'bonnet', 'sombrero', 'shower cap', 'apron', 'robe',
  'scarf', 'shirt', 'suit', 'sweater', 'vest', 'dress', 'trouser', 'pajama'
];

// Reused as both a blue-bin match and a hint that the item might also
// qualify for BCRS if it carries the deposit refund logo — the model can't
// see the logo itself, so this is only ever offered as a "you could also
// check" suggestion, never as the primary verdict.
function looksLikeADrinkContainer(label) {
  return label.indexOf('bottle') !== -1 || label.indexOf('tin can') !== -1;
}

function mapLabelToCategory(label) {
  const lower = (label || '').toLowerCase();
  if (BLUE_BIN_KEYWORDS.some(function (k) { return lower.indexOf(k) !== -1; })) {
    return { category: 'blue-bin', bcrsHint: looksLikeADrinkContainer(lower) };
  }
  if (E_WASTE_KEYWORDS.some(function (k) { return lower.indexOf(k) !== -1; })) {
    return { category: 'e-waste', bcrsHint: false };
  }
  if (TEXTILE_KEYWORDS.some(function (k) { return lower.indexOf(k) !== -1; })) {
    return { category: 'textile', bcrsHint: false };
  }
  return null;
}

const REASON_TEMPLATES = {
  'blue-bin': 'This looks like paper, plastic, glass, or metal — the kind of thing a blue bin takes.',
  'e-waste': 'This looks like an electronic item or battery — take it to an e-waste point, not a regular bin.',
  'textile': 'This looks like clothing or fabric — a textile bin is the right place for this.',
  'none': "I couldn't confidently match this to one of our four categories. Check the Recycling Guide, or if it's genuinely not recyclable, it goes in general waste."
};

let _mobilenetModel = null;
async function loadClassifierModel() {
  if (_mobilenetModel) return _mobilenetModel;
  _mobilenetModel = await mobilenet.load();
  return _mobilenetModel;
}

function fileToImageElement(file) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    img.onload = function () { resolve(img); };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function classifyPhoto(file) {
  const model = await loadClassifierModel();
  const imgEl = await fileToImageElement(file);
  const predictions = await model.classify(imgEl);

  for (let i = 0; i < predictions.length; i++) {
    const mapped = mapLabelToCategory(predictions[i].className);
    if (mapped) {
      return {
        item: predictions[i].className.split(',')[0],
        recyclable: true,
        category: mapped.category,
        bcrsHint: mapped.bcrsHint,
        reason: REASON_TEMPLATES[mapped.category]
      };
    }
  }

  return {
    item: predictions[0] ? predictions[0].className.split(',')[0] : 'this item',
    recyclable: false,
    category: 'none',
    bcrsHint: false,
    reason: REASON_TEMPLATES.none
  };
}

// Node/Vitest export — no effect in the browser (module is undefined there),
// keeps every function above as a plain global for the <script> tags.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CATEGORY_INFO: CATEGORY_INFO,
    validateAssistantForm: validateAssistantForm,
    mapLabelToCategory: mapLabelToCategory,
    REASON_TEMPLATES: REASON_TEMPLATES
  };
}
