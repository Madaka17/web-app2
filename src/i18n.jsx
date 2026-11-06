import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const BRAND = 'OpenPlot';

const strings = {
  en: {
    future: 'Projects', land: 'House & Land Data', lease: 'Lease-sale',
    newListings: 'New Listings', news: 'News', about: 'About Us', login: 'Login', signup: 'Sign up',
    backToMap: 'Back to map', selectMode: 'Select Mode', comingSoon: 'Coming soon',
    projects: 'projects', plots: 'plots', search: 'Search', searchMap: 'Search the map',
    createAsset: 'Create Asset Data', createAssetShort: 'Click parcel to enter data', usageGuide: 'Usage guide',
    layer: 'Layer', filters: 'Filters', sumPrices: 'Sum prices', chooseArea: 'Choose Area',
    chooseAreaTitle: 'Choose Area to explore new opportunities',
    listings: 'listings', totalValue: 'Total Value', mthb: 'M THB', totalListings: 'Total Listings', medianPrice: 'Median Price',
    totalProjects: 'Total Projects', villages: 'Villages', condos: 'Condos', legend: 'MAP LEGEND',
    agent: 'Agent', devNotice: 'This feature is under development and will be available soon.',
    gotIt: 'Got it', signInTitle: 'Please sign in to continue', signInCta: 'Sign In / Register', cancel: 'Cancel',
    cookieTitle: 'Manage Cookie Permissions',
    cookieBody: 'This website uses cookies and related technologies to ensure smooth operation, understand how visitors use the site, and deliver content tailored to you. Please read our Cookie Policy and Privacy Policy before continuing.',
    accept: 'Accept', reject: 'Reject', viewDetails: 'View details', cookiePolicy: 'Cookie Policy', privacyPolicy: 'Privacy Policy',
    terms: 'Terms of Service',
    footerTag: `${BRAND} — Land Management Platform`,
    footerBody: 'Smart Land Management Platform designed to assist landowners, investors, and general users in storing, analyzing, and searching land data conveniently and efficiently.',
    rights: `© 2026 ${BRAND}. All rights reserved.`,
    newTitle: 'New Listings', newLead: 'The latest listings across all modes — tap a card to open it on the map.',
    searchProject: 'Search by project name...', allProvinces: 'All provinces', allModes: 'All modes', allTypes: 'All types',
    minPrice: 'Min price', maxPrice: 'Max price', ofListings: 'of', goToPage: 'Go to page', ok: 'OK', isNew: 'New',
    pendingReview: 'Pending review', approved: 'Approved', daysAgo: 'days ago',
    newsLead: 'News and articles from the sample land marketplace — plots and sale with right of redemption',
    aboutLead: 'Empowering the future of real estate through advanced data analytics and integrated ecosystem solutions.',
    leadership: 'Our Leadership', contactUs: 'Contact Us', sendMessage: 'Send us a message', fullName: 'Full Name',
    mobile: 'Mobile No', email: 'Email ID', message: 'Message', submit: 'Submit', lineId: 'LINE ID', phoneNo: 'PHONE NUMBER',
    thanks: 'Thank you. This sample form saved your message on this page only.', required: 'Please fill in the required fields.',
    exitSelect: 'Exit land selection', selectHint: 'Tap adjacent parcels to add/remove, then press merge',
    baseMap: 'Base map', hybrid: 'Hybrid map', satellite: 'Satellite', street: 'Street', terrain: 'Terrain',
    measure: 'Measure distance', cityPlan: 'CITY PLAN', listingType: 'Listing type', postedBy: 'Posted by', propertyType: 'Property type',
    all: 'All', plotSize: 'Plot size (sq.wa)', priceRange: 'Price range (Baht/sq.wa)', totalPrice: 'Total plot price', min: 'Min', max: 'Max',
    applyFilters: 'Apply filters', clear: 'Clear', openOnMap: 'Open details', next: 'Next', back: 'Back', done: 'Done', password: 'Password',
    t1: 'Pinch to zoom', t2: 'Tap the land', t3: 'Tap Add property data', t4: 'Explore the data', d2: 'When zoomed to 100 meters',
    emailLabel: 'EMAIL', passwordLabel: 'PASSWORD', remember: 'Remember me', forgot: 'Forgot password?', google: 'Continue with Google', or: 'OR',
    sample: 'Sample site: sign-in is for show only.',
    condo: 'Condo', house: 'House', townhome: 'Townhome', other: 'Other', landType: 'Land', village: 'Village',
    sizeSqm: 'Size (sq.m)', sqm: 'sq.m', openListing: 'Open listing', dataLoadError: 'Map data could not be loaded.',
    priceEstimate: 'Price estimate',
    priceNotice: 'Figures are based on asking prices and are not an official appraisal.',
    clickMapHint: 'Click the map or a pin to price a specific spot. Until then, the area below is used.',
    outOfCoverage: 'The price model covers Bangkok and its neighbouring provinces only.',
    apiError: 'The price model could not be reached.',
    typeUnsupported: 'The model does not price this property type, so there is no asking gap.',
    futureNote: 'These growth rates are assumptions, not a forecast.',
    closePanel: 'Close panel', selectedPoint: 'Selected point', clearTarget: 'Clear selection', location: 'Location',
    provinceLabel: 'Province', districtLabel: 'District', subdistrictLabel: 'Sub-district', rangeLabel: 'Range',
    moreDetails: 'More details', units: 'Units', yearLabel: 'Year (BE)', bedrooms: 'Bedrooms', bathrooms: 'Bathrooms',
    buildingAge: 'Building age (years)', estate: 'Housing estate', estateUnknown: 'Not stated', estateIn: 'Inside an estate', estateOut: 'Outside an estate',
    calculating: 'Calculating…', estimateRange: 'Likely range', estimateLow: 'Low', estimateMid: 'Estimate', estimateHigh: 'High',
    withinHit: 'Within 20% in tests', medianError: 'Typical error', resolvedLocation: 'Matched location', snappedProject: 'Nearby project',
    askingPrice: 'Asking price', askingVsEstimate: 'Asking vs estimate', askingAbove: 'Asking is well above the estimate',
    askingBelow: 'Asking is well below the estimate', askingNear: 'Asking is close to the estimate',
    comparables: 'Comparable listings', ppsqmUnit: 'baht/sq.m', compDistrict: 'District', compSubdistrict: 'Sub-district',
    compSizeBand: 'Similar size', compExactSize: 'Same size', compNearestSize: 'Nearest size',
    thinSample: 'Few listings in this district, so treat this figure with care.', models: 'Model blend',
    futureValue: 'Future value', growthRate: 'Annual growth', horizon: 'Years',
    healthOk: 'Price model online', healthDown: 'Price model unavailable', healthChecking: 'Checking price model',
  },
  th: {
    future: 'โครงการและหมู่บ้าน', land: 'ข้อมูลบ้านและที่ดิน', lease: 'ขายฝาก',
    newListings: 'รายการใหม่', news: 'ข่าวสาร', about: 'เกี่ยวกับเรา', login: 'เข้าสู่ระบบ', signup: 'สมัครสมาชิก',
    backToMap: 'กลับไปแผนที่', selectMode: 'เลือกโหมด', comingSoon: 'เร็ว ๆ นี้', projects: 'โครงการ', plots: 'แปลง',
    search: 'ค้นหา', searchMap: 'ค้นหาบนแผนที่', createAsset: 'สร้างข้อมูลทรัพย์', createAssetShort: 'แตะแปลงเพื่อกรอกข้อมูล', usageGuide: 'วิธีใช้งาน',
    layer: 'เลเยอร์', filters: 'ตัวกรอง', sumPrices: 'รวมราคา', chooseArea: 'เลือกพื้นที่', chooseAreaTitle: 'เลือกพื้นที่เพื่อสำรวจโอกาสใหม่',
    listings: 'รายการ', totalValue: 'มูลค่ารวม', mthb: 'ล้านบาท', totalListings: 'รายการทั้งหมด', medianPrice: 'ราคากลาง',
    totalProjects: 'โครงการทั้งหมด', villages: 'หมู่บ้าน', condos: 'คอนโด', legend: 'คำอธิบายแผนที่', agent: 'นายหน้า',
    devNotice: 'ฟีเจอร์นี้กำลังพัฒนาและจะเปิดให้ใช้เร็ว ๆ นี้', gotIt: 'รับทราบ', signInTitle: 'กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ', signInCta: 'เข้าสู่ระบบ / สมัคร', cancel: 'ยกเลิก',
    cookieTitle: 'จัดการสิทธิ์คุกกี้',
    cookieBody: 'เว็บไซต์นี้ใช้คุกกี้และเทคโนโลยีที่เกี่ยวข้องเพื่อให้ทำงานได้อย่างราบรื่น เข้าใจการใช้งาน และแสดงเนื้อหาที่เหมาะกับคุณ โปรดอ่านนโยบายคุกกี้และนโยบายความเป็นส่วนตัวก่อนใช้งานต่อ',
    accept: 'ยอมรับ', reject: 'ปฏิเสธ', viewDetails: 'ดูรายละเอียด', cookiePolicy: 'นโยบายคุกกี้', privacyPolicy: 'นโยบายความเป็นส่วนตัว', terms: 'เงื่อนไขการใช้บริการ',
    newTitle: 'รายการใหม่', newLead: 'ประกาศล่าสุดจากทุกโหมด แตะการ์ดเพื่อเปิดบนแผนที่', searchProject: 'ค้นหาตามชื่อโครงการ...',
    allProvinces: 'ทุกจังหวัด', allModes: 'ทุกโหมด', allTypes: 'ทุกประเภท', minPrice: 'ราคาต่ำสุด', maxPrice: 'ราคาสูงสุด', ofListings: 'จาก',
    goToPage: 'ไปหน้า', ok: 'ตกลง', isNew: 'ใหม่', pendingReview: 'รอตรวจสอบ', approved: 'อนุมัติแล้ว', daysAgo: 'วันก่อน',
    leadership: 'ผู้นำของเรา', contactUs: 'ติดต่อเรา', sendMessage: 'ส่งข้อความถึงเรา', fullName: 'ชื่อ-นามสกุล', mobile: 'เบอร์โทร', email: 'อีเมล', message: 'ข้อความ', submit: 'ส่ง',
    exitSelect: 'ออกจากการเลือกแปลง', selectHint: 'แตะแปลงที่อยู่ติดกันเพื่อเพิ่มหรือลบ แล้วกดรวม',
    baseMap: 'แผนที่พื้นฐาน', hybrid: 'แผนที่ผสม', satellite: 'ดาวเทียม', street: 'แผนที่ถนน', terrain: 'ภูมิประเทศ', measure: 'วัดระยะทาง', cityPlan: 'ผังเมือง',
    applyFilters: 'ใช้ตัวกรอง', clear: 'ล้าง', next: 'ถัดไป', back: 'ย้อนกลับ', done: 'เสร็จสิ้น',
    condo: 'คอนโด', house: 'บ้าน', townhome: 'ทาวน์โฮม', other: 'อื่น ๆ', landType: 'ที่ดิน', village: 'หมู่บ้าน',
    sizeSqm: 'ขนาด (ตร.ม.)', sqm: 'ตร.ม.', openListing: 'เปิดประกาศ', dataLoadError: 'โหลดข้อมูลแผนที่ไม่สำเร็จ',
    priceEstimate: 'ประมาณราคา',
    priceNotice: 'ตัวเลขนี้อ้างอิงจากราคาเสนอขาย ไม่ใช่การประเมินราคาทางการ',
    clickMapHint: 'คลิกแผนที่หรือหมุดเพื่อประเมินตำแหน่งที่ต้องการ จนกว่าจะเลือก ระบบใช้ทำเลด้านล่าง',
    outOfCoverage: 'โมเดลราคาครอบคลุมเฉพาะกรุงเทพฯ และจังหวัดใกล้เคียงเท่านั้น',
    apiError: 'ไม่สามารถเชื่อมต่อกับโมเดลราคาได้',
    typeUnsupported: 'โมเดลยังไม่รองรับประเภททรัพย์นี้ จึงไม่แสดงส่วนต่างราคา',
    futureNote: 'อัตราการเติบโตนี้เป็นสมมติฐาน ไม่ใช่การคาดการณ์',
    closePanel: 'ปิดแผง', selectedPoint: 'จุดที่เลือก', clearTarget: 'ล้างการเลือก', location: 'ทำเล',
    provinceLabel: 'จังหวัด', districtLabel: 'เขต/อำเภอ', subdistrictLabel: 'แขวง/ตำบล', rangeLabel: 'ช่วง',
    moreDetails: 'รายละเอียดเพิ่มเติม', units: 'จำนวนยูนิต', yearLabel: 'ปี พ.ศ.', bedrooms: 'ห้องนอน', bathrooms: 'ห้องน้ำ',
    buildingAge: 'อายุอาคาร (ปี)', estate: 'หมู่บ้านจัดสรร', estateUnknown: 'ไม่ระบุ', estateIn: 'ในหมู่บ้านจัดสรร', estateOut: 'นอกหมู่บ้านจัดสรร',
    calculating: 'กำลังคำนวณ…', estimateRange: 'ช่วงราคาที่เป็นไปได้', estimateLow: 'ต่ำ', estimateMid: 'ประมาณการ', estimateHigh: 'สูง',
    withinHit: 'ใกล้เคียงภายใน 20% ในการทดสอบ', medianError: 'ความคลาดเคลื่อนโดยทั่วไป', resolvedLocation: 'ทำเลที่จับคู่ได้', snappedProject: 'โครงการใกล้เคียง',
    askingPrice: 'ราคาเสนอขาย', askingVsEstimate: 'ราคาเสนอขายเทียบประมาณการ', askingAbove: 'ราคาเสนอขายสูงกว่าประมาณการมาก',
    askingBelow: 'ราคาเสนอขายต่ำกว่าประมาณการมาก', askingNear: 'ราคาเสนอขายใกล้เคียงประมาณการ',
    comparables: 'รายการเปรียบเทียบ', ppsqmUnit: 'บาท/ตร.ม.', compDistrict: 'เขต', compSubdistrict: 'แขวง/ตำบล',
    compSizeBand: 'ขนาดใกล้เคียง', compExactSize: 'ขนาดเท่ากัน', compNearestSize: 'ขนาดใกล้ที่สุด',
    thinSample: 'ประกาศในเขตนี้มีน้อย ควรใช้ตัวเลขนี้ด้วยความระมัดระวัง', models: 'การผสมโมเดล',
    futureValue: 'มูลค่าในอนาคต', growthRate: 'อัตราเติบโตต่อปี', horizon: 'ปี',
    healthOk: 'โมเดลราคาพร้อมใช้งาน', healthDown: 'โมเดลราคาไม่พร้อมใช้งาน', healthChecking: 'กำลังตรวจสอบโมเดลราคา',
  },
  zh: {
    future: '项目与小区', land: '房屋与土地数据', lease: '回购销售',
    newListings: '最新房源', news: '新闻', about: '关于我们', login: '登录', signup: '注册',
    backToMap: '返回地图', selectMode: '选择模式', comingSoon: '即将推出', projects: '个项目', plots: '块地',
    search: '搜索', searchMap: '搜索地图', createAsset: '创建资产数据', createAssetShort: '点击地块录入数据', usageGuide: '使用指南',
    layer: '图层', filters: '筛选', sumPrices: '价格合计', chooseArea: '选择区域', chooseAreaTitle: '选择区域，探索新机会',
    listings: '条', totalValue: '总价值', mthb: '百万泰铢', totalListings: '房源总数', medianPrice: '中位价',
    totalProjects: '项目总数', villages: '村庄', condos: '公寓', legend: '地图图例', agent: '代理',
    devNotice: '此功能正在开发中，即将推出。', gotIt: '知道了', signInTitle: '请登录后继续', signInCta: '登录 / 注册', cancel: '取消',
    cookieTitle: '管理 Cookie 权限',
    cookieBody: '本网站使用 Cookie 及相关技术以确保平稳运行、了解访问情况并提供合适的内容。继续之前请阅读 Cookie 政策和隐私政策。',
    accept: '接受', reject: '拒绝', viewDetails: '查看详情', cookiePolicy: 'Cookie 政策', privacyPolicy: '隐私政策', terms: '服务条款',
    newTitle: '最新房源', newLead: '所有模式的最新房源，点击卡片在地图上打开。', searchProject: '按项目名称搜索...',
    allProvinces: '所有府', allModes: '所有模式', allTypes: '所有类型', minPrice: '最低价', maxPrice: '最高价', ofListings: '共',
    goToPage: '跳至', ok: '确定', isNew: '新', pendingReview: '待审核', approved: '已批准', daysAgo: '天前',
    leadership: '领导团队', contactUs: '联系我们', sendMessage: '给我们留言', fullName: '姓名', mobile: '手机号', email: '邮箱', message: '留言', submit: '提交',
    exitSelect: '退出选地', selectHint: '点击相邻地块以添加或移除，然后合并',
    baseMap: '底图', hybrid: '混合地图', satellite: '卫星', street: '街道', terrain: '地形', measure: '测量距离', cityPlan: '城市规划',
    applyFilters: '应用筛选', clear: '清除', next: '下一步', back: '上一步', done: '完成',
    condo: '公寓', house: '房屋', townhome: '联排别墅', other: '其他', landType: '土地', village: '村庄',
    sizeSqm: '面积（平方米）', sqm: '平方米', openListing: '查看房源', dataLoadError: '地图数据加载失败',
    priceEstimate: '价格估算',
    priceNotice: '数字基于挂牌价格，并非官方评估。',
    clickMapHint: '点击地图或标记以估算具体位置。在此之前使用下方的位置。',
    outOfCoverage: '该价格模型仅覆盖曼谷及周边府。',
    apiError: '无法连接价格模型。',
    typeUnsupported: '模型不支持该房产类型，因此不显示报价差距。',
    futureNote: '以上增长率为假设，并非预测。',
    closePanel: '关闭面板', selectedPoint: '所选位置', clearTarget: '清除选择', location: '位置',
    provinceLabel: '府', districtLabel: '区', subdistrictLabel: '分区', rangeLabel: '范围',
    moreDetails: '更多信息', units: '户数', yearLabel: '年份（佛历）', bedrooms: '卧室', bathrooms: '浴室',
    buildingAge: '建筑年龄（年）', estate: '住宅小区', estateUnknown: '未说明', estateIn: '在小区内', estateOut: '在小区外',
    calculating: '计算中…', estimateRange: '可能区间', estimateLow: '低', estimateMid: '估算', estimateHigh: '高',
    withinHit: '测试中误差在20%以内', medianError: '典型误差', resolvedLocation: '匹配位置', snappedProject: '附近项目',
    askingPrice: '挂牌价', askingVsEstimate: '挂牌价与估算对比', askingAbove: '挂牌价明显高于估算',
    askingBelow: '挂牌价明显低于估算', askingNear: '挂牌价接近估算',
    comparables: '可比房源', ppsqmUnit: '泰铢/平方米', compDistrict: '区', compSubdistrict: '分区',
    compSizeBand: '相近面积', compExactSize: '相同面积', compNearestSize: '最接近面积',
    thinSample: '该区房源较少，请谨慎参考此数字。', models: '模型组合',
    futureValue: '未来价值', growthRate: '年增长率', horizon: '年',
    healthOk: '价格模型在线', healthDown: '价格模型不可用', healthChecking: '正在检查价格模型',
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
