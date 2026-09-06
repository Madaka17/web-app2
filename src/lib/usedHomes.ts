export type UsedHomeType = "บ้านเดี่ยว" | "ทาวน์โฮม" | "คอนโด" | "บ้านแฝด";

export interface UsedHomeListing {
  id: string;
  title: string;
  location: string;
  district: string;
  subdistrict: string;
  type: UsedHomeType;
  price: number;
  area: number;
  bedrooms: number;
  bathrooms: number;
  yearBuilt: number;
  image: string;
  imageAlt: string;
  listedAt: string;
  verified: boolean;
  featured: boolean;
  position: { top: string; left: string };
  tags: string[];
}

export const USED_HOME_LISTINGS: UsedHomeListing[] = [
  {
    id: "home-001",
    title: "บ้านเดี่ยวรีโนเวท ใกล้ BTS อ่อนนุช",
    location: "แขวงสวนหลวง เขตสวนหลวง กรุงเทพมหานคร",
    district: "เขตสวนหลวง",
    subdistrict: "สวนหลวง",
    type: "บ้านเดี่ยว",
    price: 8490000,
    area: 188,
    bedrooms: 3,
    bathrooms: 3,
    yearBuilt: 2018,
    image: "https://images.pexels.com/photos/19826723/pexels-photo-19826723.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    imageAlt: "Modern residential building exterior in Bangkok",
    listedAt: "อัปเดต 2 ชั่วโมงที่แล้ว",
    verified: true,
    featured: true,
    position: { top: "52%", left: "59%" },
    tags: ["ใกล้รถไฟฟ้า", "รีโนเวทแล้ว", "วิวสวน"],
  },
  {
    id: "home-002",
    title: "ทาวน์โฮม 3 ชั้น โครงการพรีเมียม",
    location: "แขวงบางนา เขตบางนา กรุงเทพมหานคร",
    district: "เขตบางนา",
    subdistrict: "บางนา",
    type: "ทาวน์โฮม",
    price: 5290000,
    area: 142,
    bedrooms: 3,
    bathrooms: 3,
    yearBuilt: 2020,
    image: "https://images.pexels.com/photos/13620782/pexels-photo-13620782.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    imageAlt: "Mixed modern and traditional residential buildings",
    listedAt: "อัปเดต 1 วันที่แล้ว",
    verified: true,
    featured: false,
    position: { top: "67%", left: "68%" },
    tags: ["โครงการใหม่", "ที่จอดรถ 2 คัน"],
  },
  {
    id: "home-003",
    title: "คอนโดพร้อมอยู่ วิวเมืองย่านรัชดา",
    location: "แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพมหานคร",
    district: "เขตห้วยขวาง",
    subdistrict: "ห้วยขวาง",
    type: "คอนโด",
    price: 3980000,
    area: 48,
    bedrooms: 1,
    bathrooms: 1,
    yearBuilt: 2019,
    image: "https://images.pexels.com/photos/38018756/pexels-photo-38018756.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    imageAlt: "Urban apartment buildings at golden hour",
    listedAt: "อัปเดต 2 วันที่แล้ว",
    verified: true,
    featured: true,
    position: { top: "40%", left: "47%" },
    tags: ["ใกล้ MRT", "เฟอร์นิเจอร์ครบ", "ห้องมุม"],
  },
  {
    id: "home-004",
    title: "บ้านแฝดทำเลดี ใกล้ทางด่วน",
    location: "ตำบลบางพลีใหญ่ อำเภอบางพลี สมุทรปราการ",
    district: "อำเภอบางพลี",
    subdistrict: "บางพลี",
    type: "บ้านแฝด",
    price: 4650000,
    area: 156,
    bedrooms: 3,
    bathrooms: 2,
    yearBuilt: 2017,
    image: "https://images.pexels.com/photos/37161065/pexels-photo-37161065.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    imageAlt: "Residential buildings near an urban river",
    listedAt: "อัปเดต 3 วันที่แล้ว",
    verified: false,
    featured: false,
    position: { top: "74%", left: "76%" },
    tags: ["ใกล้ทางด่วน", "พื้นที่ใช้สอยเยอะ"],
  },
  {
    id: "home-005",
    title: "บ้านเดี่ยวหลังใหญ่ ย่านบางกรวย",
    location: "ตำบลบางกรวย อำเภอบางกรวย นนทบุรี",
    district: "อำเภอบางกรวย",
    subdistrict: "บางกรวย",
    type: "บ้านเดี่ยว",
    price: 6900000,
    area: 240,
    bedrooms: 4,
    bathrooms: 3,
    yearBuilt: 2016,
    image: "https://images.pexels.com/photos/11102625/pexels-photo-11102625.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    imageAlt: "Traditional urban home exterior in Thailand",
    listedAt: "อัปเดต 4 วันที่แล้ว",
    verified: true,
    featured: false,
    position: { top: "32%", left: "29%" },
    tags: ["บ้านหลังใหญ่", "ทำเลสงบ", "พร้อมเข้าอยู่"],
  },
  {
    id: "home-006",
    title: "ทาวน์โฮมใกล้รถไฟฟ้าสายสีชมพู",
    location: "ตำบลปากเกร็ด อำเภอปากเกร็ด นนทบุรี",
    district: "อำเภอปากเกร็ด",
    subdistrict: "ปากเกร็ด",
    type: "ทาวน์โฮม",
    price: 3290000,
    area: 124,
    bedrooms: 2,
    bathrooms: 2,
    yearBuilt: 2021,
    image: "https://images.pexels.com/photos/31436464/pexels-photo-31436464.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
    imageAlt: "Modern city skyline and residential neighborhood",
    listedAt: "อัปเดต 5 วันที่แล้ว",
    verified: true,
    featured: false,
    position: { top: "23%", left: "36%" },
    tags: ["ใกล้รถไฟฟ้า", "โครงการใหม่"],
  },
];

export const USED_HOME_DISTRICTS = [
  "ทั้งหมด",
  ...Array.from(new Set(USED_HOME_LISTINGS.map((home) => home.district))),
];

export const USED_HOME_TYPES: Array<"ทั้งหมด" | UsedHomeType> = [
  "ทั้งหมด",
  "บ้านเดี่ยว",
  "ทาวน์โฮม",
  "คอนโด",
  "บ้านแฝด",
];
