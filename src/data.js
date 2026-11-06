// Invented sample data. Nothing here is a real listing, price, or owner.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLACES = [
  { code: 'BKK', province: 'กรุงเทพมหานคร', lat: 13.75, lng: 100.52, spread: 0.13, districts: ['เขตบางแค', 'เขตตลิ่งชัน', 'เขตภาษีเจริญ', 'เขตจอมทอง', 'เขตทวีวัฒนา', 'เขตสวนหลวง', 'เขตจตุจักร', 'เขตบางนา'] },
  { code: 'NBI', province: 'นนทบุรี', lat: 13.86, lng: 100.46, spread: 0.07, districts: ['เมืองนนทบุรี', 'บางกรวย', 'ปากเกร็ด', 'บางบัวทอง'] },
];

const PROJECT_NAMES = ['Sample Residence Patong', 'Demo Condo Phaholyothin', 'Example Hotel Sukhumvit', 'Sample Tower Rama 9', 'Demo Office Sathorn'];

// Soft colour washes for the placeholder listing pictures.
const WASHES = [[["#99a2bc", "#9fb6da", "#aab2cf"], ["#848784", "#b4b9b8", "#a5b6b9"], ["#adac9e", "#989474", "#aba787"], ["#bcbbb6", "#c8c5ba", "#d3cbbc"]], [["#bcbbc3", "#b6b0b2", "#c3b4bc"], ["#5f5c59", "#857c78", "#979494"], ["#494c3a", "#403734", "#626446"], ["#3c4b2c", "#545447", "#8c8578"]], [["#606a76", "#7a9acc", "#747c9d"], ["#8b98a2", "#4f5e6a", "#7c899c"], ["#584746", "#6d4a46", "#455f4f"], ["#707580", "#575e6b", "#4f5763"]], [["#afbcd0", "#c4cedb", "#d3ccd1"], ["#abb1b6", "#c0c4c5", "#bfc3c3"], ["#828979", "#8b9084", "#8e8777"], ["#979284", "#908367", "#8e8a7d"]], [["#a1b2c9", "#89a1c1", "#8e94b2"], ["#9ca3a5", "#99a5ae", "#8b96a3"], ["#706c5e", "#706c5b", "#827866"], ["#70675a", "#907b5c", "#8b7b60"]], [["#848b89", "#848b8e", "#716a65"], ["#5b6948", "#71806c", "#607063"], ["#536f2f", "#846d47", "#57542a"], ["#476526", "#536137", "#43572f"]], [["#a3b0c7", "#a0afc8", "#bbb6c5"], ["#8d9179", "#666f49", "#a4aa99"], ["#71784e", "#66684b", "#948d79"], ["#c3b4a0", "#a69982", "#8f897e"]], [["#f8f5f5", "#f6f6f6", "#ffffff"], ["#d3cec8", "#d2c5bd", "#d6d3cd"], ["#d2c6b3", "#a8a186", "#78683b"], ["#d5c8b4", "#dbccba", "#bfb79f"]], [["#c4c0bf", "#c2c2ca", "#b3aba9"], ["#706b61", "#828472", "#818575"], ["#6c7461", "#868767", "#939086"], ["#847e67", "#7f7f77", "#7f807c"]], [["#6d6b63", "#706c66", "#74615a"], ["#6c675a", "#61635a", "#646e64"], ["#6a5d50", "#505849", "#3d5545"], ["#99948f", "#818571", "#32523e"]], [["#707266", "#64674f", "#9f8682"], ["#657164", "#5d664d", "#888778"], ["#777c73", "#5e6850", "#76796c"], ["#667364", "#4c594a", "#808379"]], [["#3e3d29", "#9f9e97", "#a38b85"], ["#1a1c10", "#7b786a", "#8b8578"], ["#171710", "#3b3228", "#696051"], ["#323020", "#766957", "#918877"]], [["#95a7c2", "#a08d7a", "#aecaeb"], ["#a5927f", "#a58e76", "#baa793"], ["#6a6442", "#917d54", "#7c7545"], ["#454937", "#79745e", "#837c73"]], [["#afcfe3", "#9bb6c6", "#aad1e4"], ["#abc6d4", "#4e4b53", "#8194a0"], ["#8b9aa6", "#3c414d", "#373e47"], ["#868e92", "#44484d", "#494d51"]], [["#d1cfdd", "#bac0d1", "#9c9da3"], ["#bdb4ac", "#9e9a97", "#9a9690"], ["#7f7969", "#64594a", "#654c35"], ["#626458", "#75736b", "#78756d"]], [["#94988c", "#959396", "#8b817d"], ["#a49d93", "#9d9989", "#8e9787"], ["#9a958b", "#91b27a", "#9aa095"], ["#aaa49c", "#839480", "#6f8371"]], [["#7a8784", "#9ba5a7", "#98908e"], ["#8e9b91", "#c6c8c9", "#a1b0b1"], ["#9ea198", "#a9b381", "#6d805d"], ["#969d7c", "#939666", "#8c997d"]], [["#a3aec3", "#a1b5d2", "#b2a9bd"], ["#9ca58d", "#848859", "#949a90"], ["#8f8e5c", "#8b8853", "#a79f84"], ["#b8a77d", "#c0b198", "#c9beab"]], [["#72775d", "#808671", "#9e887d"], ["#797b67", "#6a7a4e", "#748753"], ["#8d8f81", "#586f3a", "#6e824b"], ["#aaa99a", "#9ca78a", "#9ba489"]], [["#74785f", "#7f8671", "#9e887d"], ["#7a7c69", "#6a7a4e", "#748753"], ["#8e9083", "#576f3a", "#6e814b"], ["#abaa9b", "#9ca78a", "#9ba589"]], [["#2c2e15", "#757e87", "#a999a7"], ["#2a381a", "#6b705d", "#616c47"], ["#54543a", "#938262", "#9e917a"], ["#4e4a34", "#96886a", "#beaf9d"]], [["#adaebe", "#eae9ed", "#c5b3c1"], ["#8c949d", "#c3c8cc", "#c9d9e8"], ["#4a4f40", "#72736c", "#9e9b95"], ["#7d715f", "#a29481", "#aea599"]], [["#8da1be", "#88afec", "#9fa0cc"], ["#93aabf", "#9cc0ec", "#a4c2e1"], ["#9f9f8a", "#acab90", "#98a18d"], ["#6b766f", "#a9a9a3", "#abaaaa"]], [["#8c817d", "#c7c6c1", "#8f6b64"], ["#685f4e", "#6d674c", "#656457"], ["#4b5046", "#7f7760", "#50727c"], ["#5f5d51", "#887b62", "#545b51"]]];

function makeListing(i) {
  const r = rng(i * 131 + 7);
  const isProject = i % 41 === 12 || i % 41 === 13 || i % 41 === 14;
  const placeIndex = r() < 0.68 ? 0 : 1;
  const place = PLACES[placeIndex];
  const district = place.districts[(r() * place.districts.length) | 0];
  const number = String(9064 - i).padStart(7, '0');
  const lat = place.lat + (r() - 0.5) * place.spread * 2;
  const lng = place.lng + (r() - 0.5) * place.spread * 2.4;
  const days = 2 + Math.floor(i / 6);
  if (isProject) {
    const type = i % 41 === 14 ? 'Hotel' : 'Condo';
    return {
      id: `sample-${i}`, code: PROJECT_NAMES[i % PROJECT_NAMES.length], mode: 'future', province: i % 2 ? 'ภูเก็ต' : place.province,
      district: i % 2 ? 'กะทู้' : district, type, status: 'approved', seed: i + 3, wash: WASHES[i % WASHES.length], price: null, size: null, days, lat, lng,
    };
  }
  const magnitude = [12000, 65000, 90000, 380000, 2400000, 8500000, 18000000, 95000000][(r() * 8) | 0];
  const price = Math.round((magnitude * (1 + r() * 0.8)) / 1000) * 1000;
  const rai = r() < 0.6 ? 0 : (r() * 4) | 0;
  const ngan = (r() * 4) | 0;
  const wah = (r() * 99) | 0;
  return {
    id: `sample-${i}`, code: `${place.code}-S-${number}`, mode: 'land', province: place.province, district, type: 'Agent', status: 'pending',
    seed: i + 3, wash: WASHES[i % WASHES.length], price, size: `${rai} rai ${ngan} ngan ${wah} sq. wah`, days, lat, lng,
  };
}

export const LISTINGS = Array.from({ length: 1250 }, (_, i) => makeListing(i));
export const PROVINCES = ['กรุงเทพมหานคร', 'นนทบุรี', 'ภูเก็ต'];

// Areas offered by the future-projects picker. `art` is a key of areaArt() in art.js.
export const AREAS = [
  { key: 'bangkok', name: 'Bangkok', th: 'กรุงเทพฯ', center: [13.75, 100.52], zoom: 12, art: 'bangkok' },
  { key: 'nonthaburi', name: 'Nonthaburi', th: 'นนทบุรี', center: [13.86, 100.51], zoom: 12, art: 'eec' },
  { key: 'pathumthani', name: 'Pathum Thani', th: 'ปทุมธานี', center: [14.02, 100.6], zoom: 12, art: 'phuket' },
  { key: 'samutprakan', name: 'Samut Prakan', th: 'สมุทรปราการ', center: [13.6, 100.6], zoom: 12, art: 'khonkaen' },
];

export const PLACE_LABELS = [
  { lat: 13.752, lng: 100.495, text: 'Bangkok', sub: 'กรุงเทพมหานคร', size: 24 },
  { lat: 13.862, lng: 100.514, text: 'Nonthaburi', sub: 'นนทบุรี', size: 16 },
  { lat: 13.817, lng: 100.53, text: 'BANG SUE', sub: 'บางซื่อ', size: 12 },
  { lat: 13.828, lng: 100.565, text: 'CHATUCHAK', sub: 'จตุจักร', size: 12 },
  { lat: 13.774, lng: 100.579, text: 'HUAI KHWANG', sub: 'ห้วยขวาง', size: 12 },
  { lat: 13.754, lng: 100.645, text: 'BANG KAPI', sub: 'บางกะปิ', size: 12 },
  { lat: 13.686, lng: 100.611, text: 'BANG NA', sub: 'บางนา', size: 12 },
  { lat: 13.72, lng: 100.53, text: 'SATHON', sub: 'สาทร', size: 12 },
  { lat: 13.72, lng: 100.45, text: 'BANG KHAE', sub: 'บางแค', size: 12 },
  { lat: 13.79, lng: 100.36, text: 'THAWI WATTHANA', sub: 'ทวีวัฒนา', size: 12 },
  { lat: 13.64, lng: 100.53, text: 'Phra Pradaeng', sub: 'พระประแดง', size: 13 },
  { lat: 13.6, lng: 100.6, text: 'Samut Prakan', sub: 'สมุทรปราการ', size: 13 },
];
