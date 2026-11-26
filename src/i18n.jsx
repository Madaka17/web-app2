import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const BRAND = 'OpenPlot';

const strings = {
  en: {
    backToMap: 'Back to map',
    search: 'Search', searchMap: 'Search the map',
    createAsset: 'Create Asset Data',
    layer: 'Layer', filters: 'Filters',
    listings: 'listings', totalValue: 'Total Value', mthb: 'M THB', thb: 'THB', totalListings: 'Total Listings', medianPrice: 'Median Price',
    legend: 'MAP LEGEND',
    devNotice: 'This feature is under development and will be available soon.',
    gotIt: 'Got it',
    cookieTitle: 'Manage Cookie Permissions',
    cookieBody: 'This website uses cookies and related technologies to ensure smooth operation, understand how visitors use the site, and deliver content tailored to you. Please read our Cookie Policy and Privacy Policy before continuing.',
    accept: 'Accept', reject: 'Reject', viewDetails: 'View details', cookiePolicy: 'Cookie Policy', privacyPolicy: 'Privacy Policy',
    terms: 'Terms of Service',
    footerTag: `${BRAND} — Land Management Platform`,
    footerBody: 'Smart Land Management Platform designed to assist landowners, investors, and general users in storing, analyzing, and searching land data conveniently and efficiently.',
    rights: `© 2026 ${BRAND}. All rights reserved.`,
    ok: 'OK',
    submit: 'Submit',
    exitSelect: 'Exit land selection', selectHint: 'Tap adjacent parcels to add/remove, then press merge',
    baseMap: 'Base map', hybrid: 'Hybrid map', satellite: 'Satellite', street: 'Street', terrain: 'Terrain',
    measure: 'Measure distance', cityPlan: 'CITY PLAN', propertyType: 'Property type',
    all: 'All', totalPrice: 'Total plot price', min: 'Min', max: 'Max',
    applyFilters: 'Apply filters', clear: 'Clear',
    condo: 'Condo', house: 'House', townhome: 'Townhome', other: 'Other', landType: 'Land',
    sizeSqm: 'Size (sq.m)', sqm: 'sq.m', openListing: 'Open listing', dataLoadError: 'Map data could not be loaded.',
    priceEstimate: 'Price estimate',
    priceNotice: 'Figures are based on asking prices and are not an official appraisal.',
    clickMapHint: 'Click the map or a pin to price a specific spot. Until then, the area below is used.',
    outOfCoverage: 'The price model covers Bangkok and its neighbouring provinces only.',
    apiError: 'The price model could not be reached.',
    typeUnsupported: 'The model does not price this property type, so there is no asking gap.',
    gapNotComparable: 'Size or type differs from the listing, so the prices cannot be compared.',
    closePanel: 'Close panel', selectedPoint: 'Selected point', clearTarget: 'Clear selection', location: 'Location',
    provinceLabel: 'Province', districtLabel: 'District', subdistrictLabel: 'Sub-district', rangeLabel: 'Range',
    moreDetails: 'More details', units: 'Units', yearLabel: 'Year (BE)', bedrooms: 'Bedrooms', bathrooms: 'Bathrooms',
    landLowAccuracy: 'Land estimates are far less accurate than other types. Use this figure as a rough reference only.',
    buildingAge: 'Building age (years)', estate: 'Housing estate', estateUnknown: 'Not stated', estateIn: 'Inside an estate', estateOut: 'Outside an estate', estateUnmeasured: 'Too few listings outside estates to measure the price gap, so no adjustment was made',
    calculating: 'Calculating…', estimateRange: 'Likely range', estimateLow: 'Low', estimateMid: 'Estimate', estimateHigh: 'High',
    withinHit: 'Within 20% in tests', medianError: 'Typical error', resolvedLocation: 'Matched location', snappedProject: 'Nearby project',
    askingPrice: 'Asking price', askingVsEstimate: 'Asking vs estimate', askingAbove: 'Asking is well above the estimate',
    askingBelow: 'Asking is well below the estimate', askingNear: 'Asking is close to the estimate',
    comparables: 'Comparable listings', ppsqmUnit: 'baht/sq.m', compDistrict: 'District', compSubdistrict: 'Sub-district',
    compSizeBand: 'Similar size', compExactSize: 'Same size', compNearestSize: 'Nearest size',
    thinSample: 'Few listings in this district, so treat this figure with care.', models: 'Model blend',
    explainTitle: 'What drives this estimate', explainBase: 'Starting point (model average)', explainOther: 'Blending and estate adjustment', explainDetail: 'Strongest single factors', explainNote: 'SHAP shows what the model used, not cause and effect', groupLocation: 'Location', groupComparables: 'Same-size comparables', groupSize: 'Size', groupUnit: 'Rooms and building age', groupType_project: 'Type and project', groupTime: 'Listing year',
    healthOk: 'Price model online', healthDown: 'Price model unavailable', healthChecking: 'Checking price model',
    decisionAccept: 'Accept estimate', decisionDefer: 'Refer to appraiser', decisionReject: 'Do not rely on estimate',
    decisionAcceptHint: 'Models agree and comparables are plentiful', decisionDeferHint: 'Mixed signals; have an appraiser check it', decisionRejectHint: 'Models disagree or comparables are scarce',
    decisionScore: 'Quality score (WQS)', decisionAgreement: 'Model agreement', decisionLocal: 'Sub-district comparables', decisionSize: 'Same-size comparables', decisionDistrict: 'District comparables',
    colorByType: 'Type', colorByDecision: 'Reliability', decisionUnscored: 'Not scored',
  },
  th: {
    backToMap: 'กลับไปแผนที่',
    search: 'ค้นหา', searchMap: 'ค้นหาบนแผนที่', createAsset: 'สร้างข้อมูลทรัพย์',
    layer: 'เลเยอร์', filters: 'ตัวกรอง',
    listings: 'รายการ', totalValue: 'มูลค่ารวม', mthb: 'ล้านบาท', thb: 'บาท', totalListings: 'รายการทั้งหมด', medianPrice: 'ราคากลาง',
    legend: 'คำอธิบายแผนที่',
    devNotice: 'ฟีเจอร์นี้กำลังพัฒนาและจะเปิดให้ใช้เร็ว ๆ นี้', gotIt: 'รับทราบ',
    cookieTitle: 'จัดการสิทธิ์คุกกี้',
    cookieBody: 'เว็บไซต์นี้ใช้คุกกี้และเทคโนโลยีที่เกี่ยวข้องเพื่อให้ทำงานได้อย่างราบรื่น เข้าใจการใช้งาน และแสดงเนื้อหาที่เหมาะกับคุณ โปรดอ่านนโยบายคุกกี้และนโยบายความเป็นส่วนตัวก่อนใช้งานต่อ',
    accept: 'ยอมรับ', reject: 'ปฏิเสธ', viewDetails: 'ดูรายละเอียด', cookiePolicy: 'นโยบายคุกกี้', privacyPolicy: 'นโยบายความเป็นส่วนตัว', terms: 'เงื่อนไขการใช้บริการ',
    ok: 'ตกลง',
    submit: 'ส่ง',
    exitSelect: 'ออกจากการเลือกแปลง', selectHint: 'แตะแปลงที่อยู่ติดกันเพื่อเพิ่มหรือลบ แล้วกดรวม',
    baseMap: 'แผนที่พื้นฐาน', hybrid: 'แผนที่ผสม', satellite: 'ดาวเทียม', street: 'แผนที่ถนน', terrain: 'ภูมิประเทศ', measure: 'วัดระยะทาง', cityPlan: 'ผังเมือง',
    applyFilters: 'ใช้ตัวกรอง', clear: 'ล้าง',
    condo: 'คอนโด', house: 'บ้าน', townhome: 'ทาวน์โฮม', other: 'อื่น ๆ', landType: 'ที่ดิน',
    sizeSqm: 'ขนาด (ตร.ม.)', sqm: 'ตร.ม.', openListing: 'เปิดประกาศ', dataLoadError: 'โหลดข้อมูลแผนที่ไม่สำเร็จ',
    priceEstimate: 'ประมาณราคา',
    priceNotice: 'ตัวเลขนี้อ้างอิงจากราคาเสนอขาย ไม่ใช่การประเมินราคาทางการ',
    clickMapHint: 'คลิกแผนที่หรือหมุดเพื่อประเมินตำแหน่งที่ต้องการ จนกว่าจะเลือก ระบบใช้ทำเลด้านล่าง',
    outOfCoverage: 'โมเดลราคาครอบคลุมเฉพาะกรุงเทพฯ และจังหวัดใกล้เคียงเท่านั้น',
    apiError: 'ไม่สามารถเชื่อมต่อกับโมเดลราคาได้',
    typeUnsupported: 'โมเดลยังไม่รองรับประเภททรัพย์นี้ จึงไม่แสดงส่วนต่างราคา',
    gapNotComparable: 'ขนาดหรือประเภทต่างจากประกาศ จึงเทียบราคาไม่ได้',
    closePanel: 'ปิดแผง', selectedPoint: 'จุดที่เลือก', clearTarget: 'ล้างการเลือก', location: 'ทำเล',
    provinceLabel: 'จังหวัด', districtLabel: 'เขต/อำเภอ', subdistrictLabel: 'แขวง/ตำบล', rangeLabel: 'ช่วง',
    moreDetails: 'รายละเอียดเพิ่มเติม', units: 'จำนวนยูนิต', yearLabel: 'ปี พ.ศ.', bedrooms: 'ห้องนอน', bathrooms: 'ห้องน้ำ',
    landLowAccuracy: 'ที่ดินมีความแม่นยำต่ำกว่าประเภทอื่นมาก ใช้เป็นตัวเลขอ้างอิงเท่านั้น',
    buildingAge: 'อายุอาคาร (ปี)', estate: 'หมู่บ้านจัดสรร', estateUnknown: 'ไม่ระบุ', estateIn: 'ในหมู่บ้านจัดสรร', estateOut: 'นอกหมู่บ้านจัดสรร', estateUnmeasured: 'ยังวัดส่วนต่างราคาบ้านนอกหมู่บ้านไม่ได้ (ข้อมูลน้อยเกินไป) จึงไม่ได้ปรับราคา',
    calculating: 'กำลังคำนวณ…', estimateRange: 'ช่วงราคาที่เป็นไปได้', estimateLow: 'ต่ำ', estimateMid: 'ประมาณการ', estimateHigh: 'สูง',
    withinHit: 'ใกล้เคียงภายใน 20% ในการทดสอบ', medianError: 'ความคลาดเคลื่อนโดยทั่วไป', resolvedLocation: 'ทำเลที่จับคู่ได้', snappedProject: 'โครงการใกล้เคียง',
    askingPrice: 'ราคาเสนอขาย', askingVsEstimate: 'ราคาเสนอขายเทียบประมาณการ', askingAbove: 'ราคาเสนอขายสูงกว่าประมาณการมาก',
    askingBelow: 'ราคาเสนอขายต่ำกว่าประมาณการมาก', askingNear: 'ราคาเสนอขายใกล้เคียงประมาณการ',
    comparables: 'รายการเปรียบเทียบ', ppsqmUnit: 'บาท/ตร.ม.', compDistrict: 'เขต', compSubdistrict: 'แขวง/ตำบล',
    compSizeBand: 'ขนาดใกล้เคียง', compExactSize: 'ขนาดเท่ากัน', compNearestSize: 'ขนาดใกล้ที่สุด',
    thinSample: 'ประกาศในเขตนี้มีน้อย ควรใช้ตัวเลขนี้ด้วยความระมัดระวัง', models: 'การผสมโมเดล',
    explainTitle: 'ปัจจัยที่มีผลต่อราคานี้', explainBase: 'ราคาตั้งต้น (ค่ากลางของโมเดล)', explainOther: 'ผลจากการรวมโมเดลและปรับหมู่บ้าน', explainDetail: 'ตัวแปรที่มีผลมากที่สุด', explainNote: 'SHAP บอกว่าโมเดลใช้อะไร ไม่ใช่เหตุและผล', groupLocation: 'ทำเล', groupComparables: 'ทรัพย์เทียบเคียงขนาดเดียวกัน', groupSize: 'ขนาด', groupUnit: 'ห้องและอายุอาคาร', groupType_project: 'ประเภทและโครงการ', groupTime: 'ปีที่ประกาศ',
    healthOk: 'โมเดลราคาพร้อมใช้งาน', healthDown: 'โมเดลราคาไม่พร้อมใช้งาน', healthChecking: 'กำลังตรวจสอบโมเดลราคา',
    decisionAccept: 'ยอมรับราคาประเมิน', decisionDefer: 'ส่งผู้ประเมินตรวจ', decisionReject: 'ไม่ควรใช้ราคานี้',
    decisionAcceptHint: 'โมเดลเห็นตรงกันและมีทรัพย์เทียบเคียงพอ', decisionDeferHint: 'สัญญาณปนกัน ควรให้ผู้ประเมินดูอีกครั้ง', decisionRejectHint: 'โมเดลเห็นต่างกันมากหรือทรัพย์เทียบเคียงน้อย',
    decisionScore: 'คะแนนคุณภาพ (WQS)', decisionAgreement: 'โมเดลเห็นตรงกัน', decisionLocal: 'ทรัพย์ในตำบล', decisionSize: 'ทรัพย์ขนาดใกล้กัน', decisionDistrict: 'ทรัพย์ในอำเภอ',
    colorByType: 'ประเภท', colorByDecision: 'ความน่าเชื่อถือ', decisionUnscored: 'ไม่ได้ประเมิน',
  },
  zh: {
    backToMap: '返回地图',
    search: '搜索', searchMap: '搜索地图', createAsset: '创建资产数据',
    layer: '图层', filters: '筛选',
    listings: '条', totalValue: '总价值', mthb: '百万泰铢', thb: '泰铢', totalListings: '房源总数', medianPrice: '中位价',
    legend: '地图图例',
    devNotice: '此功能正在开发中，即将推出。', gotIt: '知道了',
    cookieTitle: '管理 Cookie 权限',
    cookieBody: '本网站使用 Cookie 及相关技术以确保平稳运行、了解访问情况并提供合适的内容。继续之前请阅读 Cookie 政策和隐私政策。',
    accept: '接受', reject: '拒绝', viewDetails: '查看详情', cookiePolicy: 'Cookie 政策', privacyPolicy: '隐私政策', terms: '服务条款',
    ok: '确定',
    submit: '提交',
    exitSelect: '退出选地', selectHint: '点击相邻地块以添加或移除，然后合并',
    baseMap: '底图', hybrid: '混合地图', satellite: '卫星', street: '街道', terrain: '地形', measure: '测量距离', cityPlan: '城市规划',
    applyFilters: '应用筛选', clear: '清除',
    condo: '公寓', house: '房屋', townhome: '联排别墅', other: '其他', landType: '土地',
    sizeSqm: '面积（平方米）', sqm: '平方米', openListing: '查看房源', dataLoadError: '地图数据加载失败',
    priceEstimate: '价格估算',
    priceNotice: '数字基于挂牌价格，并非官方评估。',
    clickMapHint: '点击地图或标记以估算具体位置。在此之前使用下方的位置。',
    outOfCoverage: '该价格模型仅覆盖曼谷及周边府。',
    apiError: '无法连接价格模型。',
    typeUnsupported: '模型不支持该房产类型，因此不显示报价差距。',
    gapNotComparable: '面积或类型与房源不同，无法比较价格。',
    closePanel: '关闭面板', selectedPoint: '所选位置', clearTarget: '清除选择', location: '位置',
    provinceLabel: '府', districtLabel: '区', subdistrictLabel: '分区', rangeLabel: '范围',
    moreDetails: '更多信息', units: '户数', yearLabel: '年份（佛历）', bedrooms: '卧室', bathrooms: '浴室',
    landLowAccuracy: '土地估价的准确度远低于其他类型，仅供粗略参考。',
    buildingAge: '建筑年龄（年）', estate: '住宅小区', estateUnknown: '未说明', estateIn: '在小区内', estateOut: '在小区外', estateUnmeasured: '小区外房源过少，无法测量价差，因此未作调整',
    calculating: '计算中…', estimateRange: '可能区间', estimateLow: '低', estimateMid: '估算', estimateHigh: '高',
    withinHit: '测试中误差在20%以内', medianError: '典型误差', resolvedLocation: '匹配位置', snappedProject: '附近项目',
    askingPrice: '挂牌价', askingVsEstimate: '挂牌价与估算对比', askingAbove: '挂牌价明显高于估算',
    askingBelow: '挂牌价明显低于估算', askingNear: '挂牌价接近估算',
    comparables: '可比房源', ppsqmUnit: '泰铢/平方米', compDistrict: '区', compSubdistrict: '分区',
    compSizeBand: '相近面积', compExactSize: '相同面积', compNearestSize: '最接近面积',
    thinSample: '该区房源较少，请谨慎参考此数字。', models: '模型组合',
    explainTitle: '影响此估价的因素', explainBase: '起点（模型平均）', explainOther: '模型融合与小区调整', explainDetail: '影响最大的单项因素', explainNote: 'SHAP 显示模型依据，并非因果关系', groupLocation: '地段', groupComparables: '同面积可比', groupSize: '面积', groupUnit: '房间与楼龄', groupType_project: '类型与项目', groupTime: '挂牌年份',
    healthOk: '价格模型在线', healthDown: '价格模型不可用', healthChecking: '正在检查价格模型',
    decisionAccept: '接受估价', decisionDefer: '交由估价师复核', decisionReject: '不建议采用此估价',
    decisionAcceptHint: '模型一致且可比样本充足', decisionDeferHint: '信号不一，建议估价师复核', decisionRejectHint: '模型分歧大或可比样本稀少',
    decisionScore: '质量分 (WQS)', decisionAgreement: '模型一致性', decisionLocal: '街道可比样本', decisionSize: '同面积可比样本', decisionDistrict: '区可比样本',
    colorByType: '类型', colorByDecision: '可靠性', decisionUnscored: '未评估',
  },
};

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem('lang') || 'en'; } catch { return 'en'; }
  });
  const setLang = useCallback((next) => {
    setLangState(next);
    try { localStorage.setItem('lang', next); } catch { /* storage is optional */ }
  }, []);
  const t = useCallback((key) => strings[lang][key] ?? strings.en[key] ?? key, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  return useContext(LangContext);
}

export function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title;
    const tag = document.querySelector('meta[name="description"]');
    if (tag && description) tag.setAttribute('content', description);
  }, [title, description]);
}
