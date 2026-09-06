#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to generate real estate data for Bangkok and Metropolitan area (กรุงเทพและปริมณฑล).
Outputs CSV, JSON, and Excel (.xlsx) formats.
"""

import json
import random
import pandas as pd

# Curated high-quality, geographically accurate dataset
CURATED_DATA = [
    # --- กรุงเทพมหานคร (Bangkok) ---
    {
        "property_id": "PROP-BKK-001",
        "project_name": "คอนโด ไอดีโอ สุขุมวิท 93 (Ideo Sukhumvit 93)",
        "project_type_category": "โครงการ (คอนโด)",
        "property_type": "คอนโด",
        "usable_area_sqm": 35.5,
        "land_area_sqwa": None,
        "land_area_rai_ngan_sqwa": "ไม่มีที่ดิน (กรรมสิทธิ์ห้องชุด)",
        "bedrooms": 1,
        "bathrooms": 1,
        "living_rooms": 1,
        "floors": 38,
        "floor_level": 18,
        "road": "ถนนสุขุมวิท",
        "soi": "ซอยสุขุมวิท 93",
        "sub_district": "บางจาก",
        "district": "พระโขนง",
        "province": "กรุงเทพมหานคร",
        "latitude": 13.6998,
        "longitude": 100.6052,
        "price_thb": 4200000
    },
    {
        "property_id": "PROP-BKK-002",
        "project_name": "คอนโด แอชตัน สีลม (Ashton Silom)",
        "project_type_category": "โครงการ (คอนโด)",
        "property_type": "คอนโด",
        "usable_area_sqm": 86.0,
        "land_area_sqwa": None,
        "land_area_rai_ngan_sqwa": "ไม่มีที่ดิน (กรรมสิทธิ์ห้องชุด)",
        "bedrooms": 2,
        "bathrooms": 2,
        "living_rooms": 1,
        "floors": 48,
        "floor_level": 32,
        "road": "ถนนสีลม",
        "soi": "-",
        "sub_district": "สุริยวรวงศ์",
        "district": "บางรัก",
        "province": "กรุงเทพมหานคร",
        "latitude": 13.7262,
        "longitude": 100.5268,
        "price_thb": 17500000
    },
    {
        "property_id": "PROP-BKK-003",
        "project_name": "หมู่บ้าน นันทวัน บางนา กม.7 (Nanthawan Bangna Km.7)",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "บ้านเดี่ยว",
        "usable_area_sqm": 338.0,
        "land_area_sqwa": 105.4,
        "land_area_rai_ngan_sqwa": "0 ไร่ 1 งาน 5.4 ตร.ว.",
        "bedrooms": 4,
        "bathrooms": 5,
        "living_rooms": 2,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนบางนา-ตราด",
        "soi": "ซอยราชวินิตบางแก้ว",
        "sub_district": "บางแก้ว",
        "district": "บางพลี",
        "province": "สมุทรปราการ",
        "latitude": 13.6542,
        "longitude": 100.6721,
        "price_thb": 28900000
    },
    {
        "property_id": "PROP-BKK-004",
        "project_name": "หมู่บ้าน เซนโทร รามอินทรา-จตุโชติ (Centro Ramindra-Chatuchot)",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "บ้านเดี่ยว",
        "usable_area_sqm": 225.0,
        "land_area_sqwa": 62.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 62.0 ตร.ว.",
        "bedrooms": 4,
        "bathrooms": 4,
        "living_rooms": 1,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนจตุโชติ",
        "soi": "ซอยจตุโชติ 10",
        "sub_district": "ออเงิน",
        "district": "สายไหม",
        "province": "กรุงเทพมหานคร",
        "latitude": 13.8895,
        "longitude": 100.6872,
        "price_thb": 8500000
    },
    {
        "property_id": "PROP-BKK-005",
        "project_name": "หมู่บ้าน อารียา โคโม่ บางนา-วงแหวน (Areeya Como Bangna-Wongwaen)",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "บ้านแฝด",
        "usable_area_sqm": 165.0,
        "land_area_sqwa": 40.5,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 40.5 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 3,
        "living_rooms": 1,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนกาญจนาภิเษก",
        "soi": "ซอยมหาชัย 1",
        "sub_district": "บางพลีใหญ่",
        "district": "บางพลี",
        "province": "สมุทรปราการ",
        "latitude": 13.6288,
        "longitude": 100.6935,
        "price_thb": 5490000
    },
    {
        "property_id": "PROP-BKK-006",
        "project_name": "หมู่บ้าน พลีโน่ สุขุมวิท-บางนา (Pleno Sukhumvit-Bangna)",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "ทาวน์โฮม",
        "usable_area_sqm": 106.8,
        "land_area_sqwa": 18.2,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 18.2 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 2,
        "living_rooms": 1,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนบางนา-ตราด",
        "soi": "ซอยวัดศรีวารีน้อย",
        "sub_district": "ศีรษะจรเข้น้อย",
        "district": "บางเสาธง",
        "province": "สมุทรปราการ",
        "latitude": 13.6391,
        "longitude": 100.7892,
        "price_thb": 2690000
    },
    {
        "property_id": "PROP-BKK-007",
        "project_name": "ไม่ใช่โครงการ (ตึกแถวพาณิชย์ 4.5 ชั้น ย่านเยาวราช)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "ตึกแถว",
        "usable_area_sqm": 240.0,
        "land_area_sqwa": 16.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 16.0 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 3,
        "living_rooms": 1,
        "floors": 4,
        "floor_level": 4,
        "road": "ถนนเยาวราช",
        "soi": "ซอยมังกร",
        "sub_district": "จักรวรรดิ",
        "district": "สัมพันธวงศ์",
        "province": "กรุงเทพมหานคร",
        "latitude": 13.7412,
        "longitude": 100.5076,
        "price_thb": 22000000
    },
    {
        "property_id": "PROP-BKK-008",
        "project_name": "ไม่ใช่โครงการ (บ้านเดี่ยวสร้างเอง 2 ชั้น ริมคลองชักพระ)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "บ้านเดี่ยว",
        "usable_area_sqm": 280.0,
        "land_area_sqwa": 85.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 85.0 ตร.ว.",
        "bedrooms": 4,
        "bathrooms": 3,
        "living_rooms": 2,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนชักพระ",
        "soi": "ซอยชักพระ 5",
        "sub_district": "คลองชักพระ",
        "district": "ตลิ่งชัน",
        "province": "กรุงเทพมหานคร",
        "latitude": 13.7745,
        "longitude": 100.4568,
        "price_thb": 11500000
    },
    {
        "property_id": "PROP-BKK-009",
        "project_name": "ไม่ใช่โครงการ (ที่ดินเปล่าถมแล้ว ติดถนนสาธารณะ สุวินทวงศ์)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "ที่ดินเปล่า",
        "usable_area_sqm": None,
        "land_area_sqwa": 950.0,
        "land_area_rai_ngan_sqwa": "2 ไร่ 1 งาน 50.0 ตร.ว.",
        "bedrooms": 0,
        "bathrooms": 0,
        "living_rooms": 0,
        "floors": 0,
        "floor_level": 0,
        "road": "ถนนสุวินทวงศ์",
        "soi": "ซอยสุวินทวงศ์ 13",
        "sub_district": "มีนบุรี",
        "district": "มีนบุรี",
        "province": "กรุงเทพมหานคร",
        "latitude": 13.8214,
        "longitude": 100.7485,
        "price_thb": 19000000
    },
    {
        "property_id": "PROP-BKK-010",
        "project_name": "คอนโด ไลฟ์ อโศก ไฮป์ (Life Asoke Hype)",
        "project_type_category": "โครงการ (คอนโด)",
        "property_type": "คอนโด",
        "usable_area_sqm": 40.0,
        "land_area_sqwa": None,
        "land_area_rai_ngan_sqwa": "ไม่มีที่ดิน (กรรมสิทธิ์ห้องชุด)",
        "bedrooms": 1,
        "bathrooms": 1,
        "living_rooms": 1,
        "floors": 40,
        "floor_level": 25,
        "road": "ถนนอโศก-ดินแดง",
        "soi": "-",
        "sub_district": "มักกะสัน",
        "district": "ราชเทวี",
        "province": "กรุงเทพมหานคร",
        "latitude": 13.7547,
        "longitude": 100.5621,
        "price_thb": 5100000
    },
    {
        "property_id": "PROP-BKK-011",
        "project_name": "หมู่บ้าน โกลเด้น นีโอ สาทร (Golden Neo Sathorn)",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "บ้านแฝด",
        "usable_area_sqm": 151.0,
        "land_area_sqwa": 38.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 38.0 ตร.ว.",
        "bedrooms": 4,
        "bathrooms": 3,
        "living_rooms": 1,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนกัลปพฤกษ์",
        "soi": "ซอยกัลปพฤกษ์ 4",
        "sub_district": "บางขุนเทียน",
        "district": "จอมทอง",
        "province": "กรุงเทพมหานคร",
        "latitude": 13.7025,
        "longitude": 100.4498,
        "price_thb": 7200000
    },
    {
        "property_id": "PROP-BKK-012",
        "project_name": "หมู่บ้าน ทาวน์พลัส เกษตร-นวมินทร์ (Town Plus Kaset-Nawamin)",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "ทาวน์โฮม",
        "usable_area_sqm": 157.0,
        "land_area_sqwa": 22.5,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 22.5 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 3,
        "living_rooms": 1,
        "floors": 3,
        "floor_level": 3,
        "road": "ถนนประเสริฐมนูกิจ",
        "soi": "ซอยประเสริฐมนูกิจ 29",
        "sub_district": "จรเข้บัว",
        "district": "ลาดพร้าว",
        "province": "กรุงเทพมหานคร",
        "latitude": 13.8290,
        "longitude": 100.6189,
        "price_thb": 4650000
    },
    {
        "property_id": "PROP-BKK-013",
        "project_name": "ไม่ใช่โครงการ (ตึกแถวสร้างเอง 3 ชั้น ริมถนนจรัญสนิทวงศ์)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "ตึกแถว",
        "usable_area_sqm": 180.0,
        "land_area_sqwa": 18.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 18.0 ตร.ว.",
        "bedrooms": 2,
        "bathrooms": 2,
        "living_rooms": 1,
        "floors": 3,
        "floor_level": 3,
        "road": "ถนนจรัญสนิทวงศ์",
        "soi": "ซอยจรัญสนิทวงศ์ 75",
        "sub_district": "บางพลัด",
        "district": "บางพลัด",
        "province": "กรุงเทพมหานคร",
        "latitude": 13.7915,
        "longitude": 100.5012,
        "price_thb": 6800000
    },
    {
        "property_id": "PROP-BKK-014",
        "project_name": "ไม่ใช่โครงการ (ที่ดินเปล่าผืนงาม บางขุนเทียน-ชายทะเล)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "ที่ดินเปล่า",
        "usable_area_sqm": None,
        "land_area_sqwa": 1600.0,
        "land_area_rai_ngan_sqwa": "4 ไร่ 0 งาน 0.0 ตร.ว.",
        "bedrooms": 0,
        "bathrooms": 0,
        "living_rooms": 0,
        "floors": 0,
        "floor_level": 0,
        "road": "ถนนบางขุนเทียน-ชายทะเล",
        "soi": "ซอยเทียนทะเล 20",
        "sub_district": "ท่าข้าม",
        "district": "บางขุนเทียน",
        "province": "กรุงเทพมหานคร",
        "latitude": 13.6120,
        "longitude": 100.4315,
        "price_thb": 24000000
    },
    {
        "property_id": "PROP-BKK-015",
        "project_name": "คอนโด ริธึ่ม เจริญกรุง พาวิลเลี่ยน (Rhythm Charoenkrung Pavillion)",
        "project_type_category": "โครงการ (คอนโด)",
        "property_type": "คอนโด",
        "usable_area_sqm": 102.0,
        "land_area_sqwa": None,
        "land_area_rai_ngan_sqwa": "ไม่มีที่ดิน (กรรมสิทธิ์ห้องชุด)",
        "bedrooms": 2,
        "bathrooms": 2,
        "living_rooms": 1,
        "floors": 44,
        "floor_level": 28,
        "road": "ถนนเจริญกรุง",
        "soi": "ซอยเจริญกรุง 73",
        "sub_district": "วัดพระยาไกร",
        "district": "บางคอแหลม",
        "province": "กรุงเทพมหานคร",
        "latitude": 13.7135,
        "longitude": 100.5098,
        "price_thb": 16800000
    },

    # --- นนทบุรี (Nonthaburi) ---
    {
        "property_id": "PROP-NON-001",
        "project_name": "คอนโด แอสปาย งามวงศ์วาน (Aspire Ngamwongwan)",
        "project_type_category": "โครงการ (คอนโด)",
        "property_type": "คอนโด",
        "usable_area_sqm": 28.0,
        "land_area_sqwa": None,
        "land_area_rai_ngan_sqwa": "ไม่มีที่ดิน (กรรมสิทธิ์ห้องชุด)",
        "bedrooms": 1,
        "bathrooms": 1,
        "living_rooms": 1,
        "floors": 28,
        "floor_level": 12,
        "road": "ถนนงามวงศ์วาน",
        "soi": "ซอยงามวงศ์วาน 23",
        "sub_district": "บางเขน",
        "district": "เมืองนนทบุรี",
        "province": "นนทบุรี",
        "latitude": 13.8564,
        "longitude": 100.5332,
        "price_thb": 1890000
    },
    {
        "property_id": "PROP-NON-002",
        "project_name": "หมู่บ้าน แกรนด์ บางกอก บูเลอวาร์ด ราชพฤกษ์-พระราม 5",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "บ้านเดี่ยว",
        "usable_area_sqm": 415.0,
        "land_area_sqwa": 112.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 1 งาน 12.0 ตร.ว.",
        "bedrooms": 5,
        "bathrooms": 6,
        "living_rooms": 2,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนนครอินทร์",
        "soi": "ซอยนครอินทร์ 4",
        "sub_district": "บางขุนกอง",
        "district": "บางกรวย",
        "province": "นนทบุรี",
        "latitude": 13.8241,
        "longitude": 100.4502,
        "price_thb": 35000000
    },
    {
        "property_id": "PROP-NON-003",
        "project_name": "หมู่บ้าน ชวนชื่น พาร์ค กาญจนา-บางใหญ่",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "บ้านแฝด",
        "usable_area_sqm": 140.0,
        "land_area_sqwa": 36.2,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 36.2 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 3,
        "living_rooms": 1,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนกาญจนาภิเษก",
        "soi": "ซอยแก้วอินทร์",
        "sub_district": "เสาธงหิน",
        "district": "บางใหญ่",
        "province": "นนทบุรี",
        "latitude": 13.8742,
        "longitude": 100.4075,
        "price_thb": 4190000
    },
    {
        "property_id": "PROP-NON-004",
        "project_name": "หมู่บ้าน พฤกษาวิลล์ 64 สายไหม-วงแหวน",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "ทาวน์โฮม",
        "usable_area_sqm": 98.0,
        "land_area_sqwa": 17.5,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 17.5 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 2,
        "living_rooms": 1,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนกาญจนาภิเษก",
        "soi": "ซอยวัดลาดปลาดุก",
        "sub_district": "บางรักพัฒนา",
        "district": "บางบัวทอง",
        "province": "นนทบุรี",
        "latitude": 13.9015,
        "longitude": 100.3842,
        "price_thb": 1790000
    },
    {
        "property_id": "PROP-NON-005",
        "project_name": "ไม่ใช่โครงการ (อาคารพาณิชย์ 4 ชั้น ติดถนนรัตนาธิเบศร์ ใกล้ MRT)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "ตึกแถว",
        "usable_area_sqm": 220.0,
        "land_area_sqwa": 21.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 21.0 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 4,
        "living_rooms": 1,
        "floors": 4,
        "floor_level": 4,
        "road": "ถนนรัตนาธิเบศร์",
        "soi": "ซอยรัตนาธิเบศร์ 18",
        "sub_district": "บางกระสอ",
        "district": "เมืองนนทบุรี",
        "province": "นนทบุรี",
        "latitude": 13.8639,
        "longitude": 100.4925,
        "price_thb": 8900000
    },
    {
        "property_id": "PROP-NON-006",
        "project_name": "ไม่ใช่โครงการ (บ้านเดี่ยวไม้สักสร้างเอง ริมแม่น้ำเจ้าพระยา)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "บ้านเดี่ยว",
        "usable_area_sqm": 310.0,
        "land_area_sqwa": 140.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 1 งาน 40.0 ตร.ว.",
        "bedrooms": 4,
        "bathrooms": 4,
        "living_rooms": 2,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนชัยพฤกษ์",
        "soi": "ซอยวัดเตย",
        "sub_district": "บางตะไนย์",
        "district": "ปากเกร็ด",
        "province": "นนทบุรี",
        "latitude": 13.9185,
        "longitude": 100.4982,
        "price_thb": 18500000
    },
    {
        "property_id": "PROP-NON-007",
        "project_name": "ไม่ใช่โครงการ (ที่ดินเปล่าสำหรับสร้างบ้านหรือโกดัง ไทรน้อย)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "ที่ดินเปล่า",
        "usable_area_sqm": None,
        "land_area_sqwa": 450.0,
        "land_area_rai_ngan_sqwa": "1 ไร่ 0 งาน 50.0 ตร.ว.",
        "bedrooms": 0,
        "bathrooms": 0,
        "living_rooms": 0,
        "floors": 0,
        "floor_level": 0,
        "road": "ถนนไทรน้อย-บางบัวทอง",
        "soi": "ซอยเทศบาล 1",
        "sub_district": "ไทรน้อย",
        "district": "ไทรน้อย",
        "province": "นนทบุรี",
        "latitude": 13.9782,
        "longitude": 100.3125,
        "price_thb": 4950000
    },
    {
        "property_id": "PROP-NON-008",
        "project_name": "คอนโด ศุภาลัย ซิตี้ รีสอร์ท แจ้งวัฒนะ (Supalai City Resort Chaengwattana)",
        "project_type_category": "โครงการ (คอนโด)",
        "property_type": "คอนโด",
        "usable_area_sqm": 47.0,
        "land_area_sqwa": None,
        "land_area_rai_ngan_sqwa": "ไม่มีที่ดิน (กรรมสิทธิ์ห้องชุด)",
        "bedrooms": 1,
        "bathrooms": 1,
        "living_rooms": 1,
        "floors": 24,
        "floor_level": 9,
        "road": "ถนนแจ้งวัฒนะ",
        "soi": "ซอยแจ้งวัฒนะ 28",
        "sub_district": "บางตลาด",
        "district": "ปากเกร็ด",
        "province": "นนทบุรี",
        "latitude": 13.9042,
        "longitude": 100.5284,
        "price_thb": 2350000
    },

    # --- ปทุมธานี (Pathum Thani) ---
    {
        "property_id": "PROP-PTE-001",
        "project_name": "คอนโด เคฟ ทาวน์ สเปซ ม.กรุงเทพ (Kave Town Space)",
        "project_type_category": "โครงการ (คอนโด)",
        "property_type": "คอนโด",
        "usable_area_sqm": 24.5,
        "land_area_sqwa": None,
        "land_area_rai_ngan_sqwa": "ไม่มีที่ดิน (กรรมสิทธิ์ห้องชุด)",
        "bedrooms": 1,
        "bathrooms": 1,
        "living_rooms": 1,
        "floors": 8,
        "floor_level": 5,
        "road": "ถนนพหลโยธิน",
        "soi": "ซอยรังสิตภิรมย์",
        "sub_district": "คลองหนึ่ง",
        "district": "คลองหลวง",
        "province": "ปทุมธานี",
        "latitude": 14.0378,
        "longitude": 100.6124,
        "price_thb": 1750000
    },
    {
        "property_id": "PROP-PTE-002",
        "project_name": "หมู่บ้าน บางกอก บูเลอวาร์ด รังสิต (Bangkok Boulevard Rangsit)",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "บ้านเดี่ยว",
        "usable_area_sqm": 248.0,
        "land_area_sqwa": 70.5,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 70.5 ตร.ว.",
        "bedrooms": 4,
        "bathrooms": 4,
        "living_rooms": 2,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนรังสิต-นครนายก",
        "soi": "ซอยรังสิต-นครนายก 34",
        "sub_district": "รังสิต",
        "district": "ธัญบุรี",
        "province": "ปทุมธานี",
        "latitude": 13.9934,
        "longitude": 100.6692,
        "price_thb": 9200000
    },
    {
        "property_id": "PROP-PTE-003",
        "project_name": "หมู่บ้าน ชวนชื่น ไพรม์ กรุงเทพ-ปทุมธานี",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "บ้านแฝด",
        "usable_area_sqm": 143.0,
        "land_area_sqwa": 39.8,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 39.8 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 3,
        "living_rooms": 1,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนกรุงเทพฯ-ปทุมธานี",
        "soi": "ซอยร่วมสุข",
        "sub_district": "บางเดื่อ",
        "district": "เมืองปทุมธานี",
        "province": "ปทุมธานี",
        "latitude": 14.0041,
        "longitude": 100.5186,
        "price_thb": 3890000
    },
    {
        "property_id": "PROP-PTE-004",
        "project_name": "หมู่บ้าน พฤกษา 83 ลำลูกกา-คลอง 5",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "ทาวน์โฮม",
        "usable_area_sqm": 95.0,
        "land_area_sqwa": 18.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 18.0 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 2,
        "living_rooms": 1,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนลำลูกกา",
        "soi": "ซอยบึงคำพร้อย",
        "sub_district": "บึงคำพร้อย",
        "district": "ลำลูกกา",
        "province": "ปทุมธานี",
        "latitude": 13.9482,
        "longitude": 100.7125,
        "price_thb": 1590000
    },
    {
        "property_id": "PROP-PTE-005",
        "project_name": "ไม่ใช่โครงการ (ตึกแถว 3 ชั้น ย่านรังสิต หน้า ม.รังสิต)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "ตึกแถว",
        "usable_area_sqm": 190.0,
        "land_area_sqwa": 20.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 20.0 ตร.ว.",
        "bedrooms": 4,
        "bathrooms": 3,
        "living_rooms": 1,
        "floors": 3,
        "floor_level": 3,
        "road": "ถนนพหลโยธิน",
        "soi": "ซอยพหลโยธิน 87",
        "sub_district": "ประชาธิปัตย์",
        "district": "ธัญบุรี",
        "province": "ปทุมธานี",
        "latitude": 13.9702,
        "longitude": 100.6015,
        "price_thb": 5600000
    },
    {
        "property_id": "PROP-PTE-006",
        "project_name": "ไม่ใช่โครงการ (บ้านสวนเดี่ยวสร้างเอง บรรยากาศร่มรื่น คลอง 7)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "บ้านเดี่ยว",
        "usable_area_sqm": 210.0,
        "land_area_sqwa": 120.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 1 งาน 20.0 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 3,
        "living_rooms": 1,
        "floors": 1,
        "floor_level": 1,
        "road": "ถนนรังสิต-นครนายก",
        "soi": "ซอยเลียบคลอง 7 ฝั่งตะวันออก",
        "sub_district": "ลำผักกูด",
        "district": "ธัญบุรี",
        "province": "ปทุมธานี",
        "latitude": 14.0321,
        "longitude": 100.7584,
        "price_thb": 4200000
    },
    {
        "property_id": "PROP-PTE-007",
        "project_name": "ไม่ใช่โครงการ (ที่ดินแปลงใหญ่ติดถนนสาย 347 ใกล้ศูนย์ศิลปาชีพ)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "ที่ดินเปล่า",
        "usable_area_sqm": None,
        "land_area_sqwa": 3200.0,
        "land_area_rai_ngan_sqwa": "8 ไร่ 0 งาน 0.0 ตร.ว.",
        "bedrooms": 0,
        "bathrooms": 0,
        "living_rooms": 0,
        "floors": 0,
        "floor_level": 0,
        "road": "ทางหลวงสาย 347",
        "soi": "-",
        "sub_district": "บางเตย",
        "district": "สามโคก",
        "province": "ปทุมธานี",
        "latitude": 14.0725,
        "longitude": 100.5361,
        "price_thb": 38400000
    },

    # --- สมุทรปราการ (Samut Prakan) ---
    {
        "property_id": "PROP-SPK-001",
        "project_name": "คอนโด เดอะ สกาย สุขุมวิท สำโรง (The Sky Sukhumvit Samrong)",
        "project_type_category": "โครงการ (คอนโด)",
        "property_type": "คอนโด",
        "usable_area_sqm": 31.5,
        "land_area_sqwa": None,
        "land_area_rai_ngan_sqwa": "ไม่มีที่ดิน (กรรมสิทธิ์ห้องชุด)",
        "bedrooms": 1,
        "bathrooms": 1,
        "living_rooms": 1,
        "floors": 30,
        "floor_level": 15,
        "road": "ถนนสุขุมวิท",
        "soi": "ซอยสุขุมวิท 113",
        "sub_district": "สำโรงเหนือ",
        "district": "เมืองสมุทรปราการ",
        "province": "สมุทรปราการ",
        "latitude": 13.6512,
        "longitude": 100.5984,
        "price_thb": 2150000
    },
    {
        "property_id": "PROP-SPK-002",
        "project_name": "หมู่บ้าน มัณฑนา บางนา-วงแหวน (Mantana Bangna-Wongwaen)",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "บ้านเดี่ยว",
        "usable_area_sqm": 222.0,
        "land_area_sqwa": 68.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 68.0 ตร.ว.",
        "bedrooms": 4,
        "bathrooms": 4,
        "living_rooms": 1,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนวงแหวนรอบนอก",
        "soi": "ซอยรามคำแหง 2",
        "sub_district": "ดอกไม้",
        "district": "ประเวศ",
        "province": "กรุงเทพมหานคร",
        "latitude": 13.6625,
        "longitude": 100.6812,
        "price_thb": 11900000
    },
    {
        "property_id": "PROP-SPK-003",
        "project_name": "หมู่บ้าน บริทาเนีย บางนา กม.26 (Britania Bangna Km.26)",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "บ้านแฝด",
        "usable_area_sqm": 150.0,
        "land_area_sqwa": 37.5,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 37.5 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 3,
        "living_rooms": 1,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนบางนา-ตราด",
        "soi": "ซอยเอแบคบางนา",
        "sub_district": "บางบ่อ",
        "district": "บางบ่อ",
        "province": "สมุทรปราการ",
        "latitude": 13.6124,
        "longitude": 100.8291,
        "price_thb": 4350000
    },
    {
        "property_id": "PROP-SPK-004",
        "project_name": "หมู่บ้าน อินดี้ บางนา-กม.7 (Indy Bangna Km.7)",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "ทาวน์โฮม",
        "usable_area_sqm": 122.0,
        "land_area_sqwa": 21.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 21.0 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 3,
        "living_rooms": 1,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนบางนา-ตราด",
        "soi": "ซอยโรงเรียนราชวินิตบางแก้ว",
        "sub_district": "บางแก้ว",
        "district": "บางพลี",
        "province": "สมุทรปราการ",
        "latitude": 13.6558,
        "longitude": 100.6698,
        "price_thb": 3890000
    },
    {
        "property_id": "PROP-SPK-005",
        "project_name": "ไม่ใช่โครงการ (อาคารพาณิชย์ 3.5 ชั้น ริมถนนเทพารักษ์)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "ตึกแถว",
        "usable_area_sqm": 210.0,
        "land_area_sqwa": 24.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 24.0 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 3,
        "living_rooms": 1,
        "floors": 3,
        "floor_level": 3,
        "road": "ถนนเทพารักษ์",
        "soi": "ซอยเทพารักษ์ 14",
        "sub_district": "เทพารักษ์",
        "district": "เมืองสมุทรปราการ",
        "province": "สมุทรปราการ",
        "latitude": 13.6335,
        "longitude": 100.6184,
        "price_thb": 5900000
    },
    {
        "property_id": "PROP-SPK-006",
        "project_name": "ไม่ใช่โครงการ (ที่ดินสวนร่มรื่น ใกล้คุ้งบางกระเจ้า สวนเฉลิมพระเกียรติ)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "ที่ดินเปล่า",
        "usable_area_sqm": None,
        "land_area_sqwa": 680.0,
        "land_area_rai_ngan_sqwa": "1 ไร่ 2 งาน 80.0 ตร.ว.",
        "bedrooms": 0,
        "bathrooms": 0,
        "living_rooms": 0,
        "floors": 0,
        "floor_level": 0,
        "road": "ถนนเพชรหึงษ์",
        "soi": "ซอยเพชรหึงษ์ 26",
        "sub_district": "บางกระเจ้า",
        "district": "พระประแดง",
        "province": "สมุทรปราการ",
        "latitude": 13.6912,
        "longitude": 100.5694,
        "price_thb": 13600000
    },

    # --- สมุทรสาคร (Samut Sakhon) ---
    {
        "property_id": "PROP-SKN-001",
        "project_name": "หมู่บ้าน ศุภาลัย พรีมา วิลล่า พระราม 2 (Supalai Prima Villa Rama 2)",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "บ้านเดี่ยว",
        "usable_area_sqm": 295.0,
        "land_area_sqwa": 92.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 92.0 ตร.ว.",
        "bedrooms": 4,
        "bathrooms": 5,
        "living_rooms": 2,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนพระราม 2",
        "soi": "ซอยพันท้ายนรสิงห์",
        "sub_district": "พันท้ายนรสิงห์",
        "district": "เมืองสมุทรสาคร",
        "province": "สมุทรสาคร",
        "latitude": 13.5962,
        "longitude": 100.3754,
        "price_thb": 10500000
    },
    {
        "property_id": "PROP-SKN-002",
        "project_name": "หมู่บ้าน โกลเด้น นีโอ สาทร-เศรษฐกิจ",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "บ้านแฝด",
        "usable_area_sqm": 136.0,
        "land_area_sqwa": 35.5,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 35.5 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 3,
        "living_rooms": 1,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนเศรษฐกิจ 1",
        "soi": "ซอยเทศบาล 8",
        "sub_district": "ท่าไม้",
        "district": "กระทุ่มแบน",
        "province": "สมุทรสาคร",
        "latitude": 13.6621,
        "longitude": 100.2982,
        "price_thb": 3590000
    },
    {
        "property_id": "PROP-SKN-003",
        "project_name": "หมู่บ้าน อารียา เดอะคัลเลอร์ส เพชรเกษม-พุทธสาคร",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "ทาวน์โฮม",
        "usable_area_sqm": 118.0,
        "land_area_sqwa": 19.5,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 19.5 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 2,
        "living_rooms": 1,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนพุทธสาคร",
        "soi": "ซอยเพชรเกษม 91",
        "sub_district": "อ้อมน้อย",
        "district": "กระทุ่มแบน",
        "province": "สมุทรสาคร",
        "latitude": 13.7052,
        "longitude": 100.3204,
        "price_thb": 2190000
    },
    {
        "property_id": "PROP-SKN-004",
        "project_name": "ไม่ใช่โครงการ (อาคารพาณิชย์ 3 ชั้น ใจกลางเมืองมหาชัย ใกล้ตลาดทะเลไทย)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "ตึกแถว",
        "usable_area_sqm": 230.0,
        "land_area_sqwa": 25.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 25.0 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 3,
        "living_rooms": 1,
        "floors": 3,
        "floor_level": 3,
        "road": "ถนนเอกชัย",
        "soi": "ซอยเอกชัย 3",
        "sub_district": "มหาชัย",
        "district": "เมืองสมุทรสาคร",
        "province": "สมุทรสาคร",
        "latitude": 13.5485,
        "longitude": 100.2781,
        "price_thb": 6500000
    },
    {
        "property_id": "PROP-SKN-005",
        "project_name": "ไม่ใช่โครงการ (ที่ดินเปล่าสวนผลไม้-เกษตรผสมผสาน บ้านแพ้ว)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "ที่ดินเปล่า",
        "usable_area_sqm": None,
        "land_area_sqwa": 2400.0,
        "land_area_rai_ngan_sqwa": "6 ไร่ 0 งาน 0.0 ตร.ว.",
        "bedrooms": 0,
        "bathrooms": 0,
        "living_rooms": 0,
        "floors": 0,
        "floor_level": 0,
        "road": "ถนนบ้านแพ้ว-พระประโทน",
        "soi": "ซอยคลองดำเนินสะดวก 4",
        "sub_district": "ยกกระบัตร",
        "district": "บ้านแพ้ว",
        "province": "สมุทรสาคร",
        "latitude": 13.5852,
        "longitude": 100.1124,
        "price_thb": 12000000
    },
    {
        "property_id": "PROP-SKN-006",
        "project_name": "คอนโด เดอะ รูม คอนโด พระราม 2 มหาชัย (The Room Condo)",
        "project_type_category": "โครงการ (คอนโด)",
        "property_type": "คอนโด",
        "usable_area_sqm": 30.0,
        "land_area_sqwa": None,
        "land_area_rai_ngan_sqwa": "ไม่มีที่ดิน (กรรมสิทธิ์ห้องชุด)",
        "bedrooms": 1,
        "bathrooms": 1,
        "living_rooms": 1,
        "floors": 8,
        "floor_level": 4,
        "road": "ถนนพระราม 2",
        "soi": "-",
        "sub_district": "นาดี",
        "district": "เมืองสมุทรสาคร",
        "province": "สมุทรสาคร",
        "latitude": 13.5684,
        "longitude": 100.2891,
        "price_thb": 1450000
    },

    # --- นครปฐม (Nakhon Pathom) ---
    {
        "property_id": "PROP-NPT-001",
        "project_name": "คอนโด ดิ เอ็กเซล ศาลายา (The Excel Salaya)",
        "project_type_category": "โครงการ (คอนโด)",
        "property_type": "คอนโด",
        "usable_area_sqm": 29.0,
        "land_area_sqwa": None,
        "land_area_rai_ngan_sqwa": "ไม่มีที่ดิน (กรรมสิทธิ์ห้องชุด)",
        "bedrooms": 1,
        "bathrooms": 1,
        "living_rooms": 1,
        "floors": 8,
        "floor_level": 6,
        "road": "ถนนบรมราชชนนี",
        "soi": "ซอยศาลายา 9",
        "sub_district": "ศาลายา",
        "district": "พุทธมณฑล",
        "province": "นครปฐม",
        "latitude": 13.7994,
        "longitude": 100.3241,
        "price_thb": 1690000
    },
    {
        "property_id": "PROP-NPT-002",
        "project_name": "หมู่บ้าน นาราสิริ พุทธมณฑลสาย 4 (Narasiri Phutthamonthon Sai 4)",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "บ้านเดี่ยว",
        "usable_area_sqm": 380.0,
        "land_area_sqwa": 125.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 1 งาน 25.0 ตร.ว.",
        "bedrooms": 4,
        "bathrooms": 5,
        "living_rooms": 2,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนพุทธมณฑลสาย 4",
        "soi": "ซอยกระทุ่มล้ม 18",
        "sub_district": "กระทุ่มล้ม",
        "district": "สามพราน",
        "province": "นครปฐม",
        "latitude": 13.7431,
        "longitude": 100.3345,
        "price_thb": 22500000
    },
    {
        "property_id": "PROP-NPT-003",
        "project_name": "หมู่บ้าน เพอร์เฟค พาร์ค ศาลายา (Perfect Park Salaya)",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "บ้านแฝด",
        "usable_area_sqm": 142.0,
        "land_area_sqwa": 38.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 38.0 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 3,
        "living_rooms": 1,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนศาลายา-บางภาษี",
        "soi": "ซอยคลองโยง 2",
        "sub_district": "คลองโยง",
        "district": "พุทธมณฑล",
        "province": "นครปฐม",
        "latitude": 13.8315,
        "longitude": 100.3014,
        "price_thb": 3790000
    },
    {
        "property_id": "PROP-NPT-004",
        "project_name": "หมู่บ้าน พฤกษา ศาลายา-บรมราชชนนี",
        "project_type_category": "โครงการ (หมู่บ้าน)",
        "property_type": "ทาวน์โฮม",
        "usable_area_sqm": 110.0,
        "land_area_sqwa": 18.5,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 18.5 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 2,
        "living_rooms": 1,
        "floors": 2,
        "floor_level": 2,
        "road": "ถนนบรมราชชนนี",
        "soi": "ซอยบางเตย 5",
        "sub_district": "บางเตย",
        "district": "สามพราน",
        "province": "นครปฐม",
        "latitude": 13.7884,
        "longitude": 100.2985,
        "price_thb": 1950000
    },
    {
        "property_id": "PROP-NPT-005",
        "project_name": "ไม่ใช่โครงการ (ตึกแถวทำเลค้าขาย 3.5 ชั้น หน้าองค์พระปฐมเจดีย์)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "ตึกแถว",
        "usable_area_sqm": 260.0,
        "land_area_sqwa": 22.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 22.0 ตร.ว.",
        "bedrooms": 4,
        "bathrooms": 3,
        "living_rooms": 1,
        "floors": 3,
        "floor_level": 3,
        "road": "ถนนราชดำเนิน",
        "soi": "-",
        "sub_district": "พระปฐมเจดีย์",
        "district": "เมืองนครปฐม",
        "province": "นครปฐม",
        "latitude": 13.8202,
        "longitude": 100.0594,
        "price_thb": 9800000
    },
    {
        "property_id": "PROP-NPT-006",
        "project_name": "ไม่ใช่โครงการ (ที่ดินเปล่าติดริมแม่น้ำท่าจีน งิ้วราย นครชัยศรี)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "ที่ดินเปล่า",
        "usable_area_sqm": None,
        "land_area_sqwa": 1400.0,
        "land_area_rai_ngan_sqwa": "3 ไร่ 2 งาน 0.0 ตร.ว.",
        "bedrooms": 0,
        "bathrooms": 0,
        "living_rooms": 0,
        "floors": 0,
        "floor_level": 0,
        "road": "ถนนศาลายา-นครชัยศรี",
        "soi": "ซอยงิ้วราย 3",
        "sub_district": "งิ้วราย",
        "district": "นครชัยศรี",
        "province": "นครปฐม",
        "latitude": 13.8185,
        "longitude": 100.2312,
        "price_thb": 21000000
    },
    {
        "property_id": "PROP-NPT-007",
        "project_name": "ไม่ใช่โครงการ (บ้านเดี่ยวชั้นเดียว สไตล์โมเดิร์นคันทรี สามพราน)",
        "project_type_category": "ไม่ใช่โครงการ",
        "property_type": "บ้านเดี่ยว",
        "usable_area_sqm": 190.0,
        "land_area_sqwa": 95.0,
        "land_area_rai_ngan_sqwa": "0 ไร่ 0 งาน 95.0 ตร.ว.",
        "bedrooms": 3,
        "bathrooms": 2,
        "living_rooms": 1,
        "floors": 1,
        "floor_level": 1,
        "road": "ถนนเพชรเกษม",
        "soi": "ซอยไร่ขิง 26",
        "sub_district": "ไร่ขิง",
        "district": "สามพราน",
        "province": "นครปฐม",
        "latitude": 13.7182,
        "longitude": 100.2794,
        "price_thb": 4600000
    }
]

def format_rai_ngan_sqwa(total_sqwa):
    """Convert total sq.wa into 'X ไร่ Y งาน Z ตร.ว.'"""
    if total_sqwa is None:
        return "ไม่มีที่ดิน (กรรมสิทธิ์ห้องชุด)"
    rai = int(total_sqwa // 400)
    rem = total_sqwa % 400
    ngan = int(rem // 100)
    sqwa = round(rem % 100, 1)
    return f"{rai} ไร่ {ngan} งาน {sqwa} ตร.ว."

def generate_synthetic_data(num_samples=60):
    """Generate synthetic realistic properties across Bangkok and metropolitan area."""
    provinces_config = {
        "กรุงเทพมหานคร": {
            "districts": [
                ("วัฒนา", "คลองเตยเหนือ", "ถนนสุขุมวิท", "ซอยสุขุมวิท 39", 13.738, 100.573),
                ("จตุจักร", "จอมพล", "ถนนพหลโยธิน", "ซอยพหลโยธิน 18", 13.805, 100.558),
                ("บางรัก", "สีลม", "ถนนสีลม", "ซอยสีลม 3", 13.727, 100.528),
                ("บางนา", "บางนาเหนือ", "ถนนบางนา-ตราด", "ซอยบางนา-ตราด 23", 13.668, 100.628),
                ("ลาดพร้าว", "ลาดพร้าว", "ถนนลาดพร้าววังหิน", "ซอยลาดพร้าววังหิน 48", 13.815, 100.595),
                ("สัมพันธวงศ์", "สัมพันธวงศ์", "ถนนเยาวราช", "ซอยเยาวราช 11", 13.740, 100.508),
                ("มีนบุรี", "มีนบุรี", "ถนนสุวินทวงศ์", "ซอยสุวินทวงศ์ 7", 13.818, 100.742),
                ("ตลิ่งชัน", "ฉิมพลี", "ถนนบรมราชชนนี", "ซอยบรมราชชนนี 39", 13.784, 100.441),
                ("บางขุนเทียน", "ท่าข้าม", "ถนนพระราม 2", "ซอยเทียนทะเล 19", 13.628, 100.435)
            ]
        },
        "นนทบุรี": {
            "districts": [
                ("เมืองนนทบุรี", "บางกระสอ", "ถนนรัตนาธิเบศร์", "ซอยรัตนาธิเบศร์ 22", 13.864, 100.495),
                ("ปากเกร็ด", "บางพูด", "ถนนแจ้งวัฒนะ", "ซอยแจ้งวัฒนะ-ปากเกร็ด 19", 13.910, 100.518),
                ("บางกรวย", "บางสีทอง", "ถนนนครอินทร์", "ซอยวัดโคนอน", 13.821, 100.472),
                ("บางบัวทอง", "พิมลราช", "ถนนบ้านกล้วย-ไทรน้อย", "ซอยบ้านกล้วย 12", 13.921, 100.375),
                ("บางใหญ่", "เสาธงหิน", "ถนนกาญจนาภิเษก", "ซอยแก้วอินทร์", 13.874, 100.407),
                ("ไทรน้อย", "ไทรน้อย", "ถนนไทรน้อย-ต้นเชือก", "-", 13.982, 100.315)
            ]
        },
        "ปทุมธานี": {
            "districts": [
                ("คลองหลวง", "คลองหนึ่ง", "ถนนพหลโยธิน", "ซอยคลองหลวง 27", 14.052, 100.618),
                ("ธัญบุรี", "ประชาธิปัตย์", "ถนนรังสิต-นครนายก", "ซอยรังสิต-นครนายก 15", 13.988, 100.625),
                ("ลำลูกกา", "คูคต", "ถนนลำลูกกา", "ซอยลำลูกกา 21", 13.952, 100.648),
                ("เมืองปทุมธานี", "บางเดื่อ", "ถนนกรุงเทพฯ-ปทุมธานี", "ซอยเทศบาล 4", 14.008, 100.521),
                ("สามโคก", "สามโคก", "ทางหลวงสาย 347", "-", 14.081, 100.535)
            ]
        },
        "สมุทรปราการ": {
            "districts": [
                ("เมืองสมุทรปราการ", "ปากน้ำ", "ถนนสุขุมวิท", "ซอยสายลวด 3", 13.589, 100.601),
                ("บางพลี", "บางแก้ว", "ถนนบางนา-ตราด", "ซอยกิ่งแก้ว 25/1", 13.665, 100.688),
                ("บางเสาธง", "ศีรษะจรเข้ใหญ่", "ถนนเทพารักษ์", "ซอยวัดศรีวารีน้อย", 13.628, 100.781),
                ("บางบ่อ", "คลองด่าน", "ถนนสุขุมวิทสายเก่า", "-", 13.515, 100.802),
                ("พระประแดง", "บางกระเจ้า", "ถนนเพชรหึงษ์", "ซอยเพชรหึงษ์ 12", 13.688, 100.572)
            ]
        },
        "สมุทรสาคร": {
            "districts": [
                ("เมืองสมุทรสาคร", "มหาชัย", "ถนนเอกชัย", "ซอยเอกชัย 5", 13.548, 100.278),
                ("เมืองสมุทรสาคร", "พันท้ายนรสิงห์", "ถนนพระราม 2", "ซอยวัดพันท้ายฯ", 13.596, 100.375),
                ("กระทุ่มแบน", "อ้อมน้อย", "ถนนเพชรเกษม", "ซอยเพชรเกษม 95", 13.702, 100.325),
                ("บ้านแพ้ว", "หลักสาม", "ถนนพระประโทน-บ้านแพ้ว", "-", 13.585, 100.112)
            ]
        },
        "นครปฐม": {
            "districts": [
                ("เมืองนครปฐม", "พระปฐมเจดีย์", "ถนนเทศา", "ซอยเทศา 2", 13.820, 100.062),
                ("พุทธมณฑล", "ศาลายา", "ถนนบรมราชชนนี", "ซอยศาลายา 5", 13.799, 100.324),
                ("สามพราน", "ไร่ขิง", "ถนนพุทธมณฑลสาย 5", "ซอยไร่ขิง 16", 13.725, 100.301),
                ("นครชัยศรี", "งิ้วราย", "ถนนศาลายา-นครชัยศรี", "ซอยวัดงิ้วราย", 13.818, 100.231),
                ("บางเลน", "บางเลน", "ทางหลวงสาย 346", "-", 14.025, 100.168)
            ]
        }
    }

    condo_names = [
        "ดิ เอส คอนโด", "เดอะ รีเซิร์ฟ", "แอชตัน การ์เดน", "ไอดีโอ โมบิ", "วิสซ์ดอม แอฟเวนิว",
        "ลุมพินี เพลส", "ยู ดีไลท์", "เซ็นทริค", "ออริจิ้น เพลส", "ไนท์บริดจ์ ไพรม์",
        "ชาโตว์ อินทาวน์", "ศุภาลัย ปาร์ค", "ริทึ่ม ไฮด์อเวย์", "เดอะ สกาย เอ็กเซ็กคิวทีฟ"
    ]

    house_project_names = [
        "มัณฑนา", "เพอร์เฟค เพลส", "เซนโทร", "บางกอก บูเลอวาร์ด", "สราญสิริ",
        "บุราสิริ", "นันทวัน", "แกรนด์ บางกอก บูเลอวาร์ด", "ลัดดารมย์", "ชัยพฤกษ์",
        "ชวนชื่น แกรนด์", "บริทาเนีย", "ศุภาลัย พรีมา วิลล่า", "เศรษฐสิริ"
    ]

    townhome_project_names = [
        "พลีโน่", "บ้านพฤกษา", "พฤกษาวิลล์", "สิริ เพลส", "โกลเด้น ทาวน์",
        "เดอะ คัลเลอร์ส", "กัสโต้", "อินดี้", "อารียา เดอะวิลเลจ", "วิลเลต ไลท์"
    ]

    property_types = ["คอนโด", "บ้านเดี่ยว", "บ้านแฝด", "ทาวน์โฮม", "ตึกแถว", "ที่ดินเปล่า"]
    rows = []

    # Include curated data first
    rows.extend(CURATED_DATA)

    count = len(rows)
    for i in range(num_samples - len(CURATED_DATA)):
        count += 1
        prov = random.choice(list(provinces_config.keys()))
        dist_info = random.choice(provinces_config[prov]["districts"])
        district, sub_district, road, soi, base_lat, base_lng = dist_info
        
        # Add slight jitter to coordinates
        lat = round(base_lat + random.uniform(-0.015, 0.015), 5)
        lng = round(base_lng + random.uniform(-0.015, 0.015), 5)

        # Decide property type
        ptype = random.choice(property_types)
        
        # Determine if it's a project or non-project
        is_project_roll = random.random()
        
        if ptype == "คอนโด":
            is_project = "โครงการ (คอนโด)"
            pname = f"คอนโด {random.choice(condo_names)} {sub_district}"
            usable_sqm = round(random.uniform(25.0, 115.0), 1)
            land_sqwa = None
            land_rai = "ไม่มีที่ดิน (กรรมสิทธิ์ห้องชุด)"
            floors = random.choice([8, 15, 24, 30, 35, 42])
            floor_level = random.randint(2, floors)
            bedrooms = 1 if usable_sqm < 45 else (2 if usable_sqm < 85 else 3)
            bathrooms = 1 if bedrooms == 1 else (2 if bedrooms == 2 else 3)
            living_rooms = 1
            price = int(usable_sqm * random.randint(55000, 180000) / 10000) * 10000

        elif ptype == "บ้านเดี่ยว":
            if is_project_roll < 0.7:
                is_project = "โครงการ (หมู่บ้าน)"
                pname = f"หมู่บ้าน {random.choice(house_project_names)} {sub_district}"
            else:
                is_project = "ไม่ใช่โครงการ"
                pname = f"ไม่ใช่โครงการ (บ้านเดี่ยวสร้างเอง 2 ชั้น ย่าน{district})"
            
            land_sqwa = round(random.uniform(50.0, 180.0), 1)
            usable_sqm = round(random.uniform(160.0, 420.0), 1)
            land_rai = format_rai_ngan_sqwa(land_sqwa)
            floors = random.choice([2, 2, 2, 3])
            floor_level = floors
            bedrooms = random.choice([3, 4, 4, 5])
            bathrooms = bedrooms if random.random() > 0.3 else bedrooms - 1
            living_rooms = random.choice([1, 2, 2])
            price = int((land_sqwa * 35000 + usable_sqm * 25000) * random.uniform(1.0, 1.8) / 10000) * 10000

        elif ptype == "บ้านแฝด":
            if is_project_roll < 0.8:
                is_project = "โครงการ (หมู่บ้าน)"
                pname = f"หมู่บ้าน {random.choice(house_project_names)} {district}"
            else:
                is_project = "ไม่ใช่โครงการ"
                pname = f"ไม่ใช่โครงการ (บ้านแฝดสร้างเอง {district})"
            
            land_sqwa = round(random.uniform(35.0, 49.0), 1)
            usable_sqm = round(random.uniform(130.0, 175.0), 1)
            land_rai = format_rai_ngan_sqwa(land_sqwa)
            floors = 2
            floor_level = 2
            bedrooms = random.choice([3, 3, 4])
            bathrooms = random.choice([2, 3])
            living_rooms = 1
            price = int((land_sqwa * 30000 + usable_sqm * 20000) * random.uniform(0.9, 1.4) / 10000) * 10000

        elif ptype == "ทาวน์โฮม":
            if is_project_roll < 0.85:
                is_project = "โครงการ (หมู่บ้าน)"
                pname = f"หมู่บ้าน {random.choice(townhome_project_names)} {sub_district}"
            else:
                is_project = "ไม่ใช่โครงการ"
                pname = f"ไม่ใช่โครงการ (ทาวน์เฮ้าส์/ทาวน์โฮมสร้างเอง ย่าน{district})"
            
            land_sqwa = round(random.uniform(16.0, 30.0), 1)
            usable_sqm = round(random.uniform(85.0, 160.0), 1)
            land_rai = format_rai_ngan_sqwa(land_sqwa)
            floors = random.choice([2, 2, 3])
            floor_level = floors
            bedrooms = random.choice([2, 3, 3, 4])
            bathrooms = 2 if floors == 2 else 3
            living_rooms = 1
            price = int((land_sqwa * 30000 + usable_sqm * 15000) * random.uniform(0.9, 1.3) / 10000) * 10000

        elif ptype == "ตึกแถว":
            is_project = "ไม่ใช่โครงการ" if is_project_roll < 0.85 else "โครงการ (อาคารพาณิชย์)"
            if is_project == "ไม่ใช่โครงการ":
                floors = random.choice([3, 4, 4, 5])
                pname = f"ไม่ใช่โครงการ (ตึกแถว {floors} ชั้น ติด{road})"
            else:
                floors = random.choice([3, 4])
                pname = f"โครงการอาคารพาณิชย์ บิซพาวิลเลี่ยน {district}"
            
            land_sqwa = round(random.uniform(14.0, 32.0), 1)
            usable_sqm = round(land_sqwa * floors * random.uniform(3.5, 4.2), 1)
            land_rai = format_rai_ngan_sqwa(land_sqwa)
            floor_level = floors
            bedrooms = random.choice([2, 3, 4])
            bathrooms = random.choice([2, 3, 4])
            living_rooms = 1
            price = int((usable_sqm * random.randint(22000, 48000)) / 10000) * 10000

        elif ptype == "ที่ดินเปล่า":
            is_project = "ไม่ใช่โครงการ" if is_project_roll < 0.9 else "โครงการ (ที่ดินจัดสรร)"
            land_sqwa = round(random.choice([
                random.uniform(80.0, 200.0),
                random.uniform(200.0, 400.0),
                random.uniform(400.0, 1600.0),
                random.uniform(1600.0, 4000.0)
            ]), 1)
            usable_sqm = None
            land_rai = format_rai_ngan_sqwa(land_sqwa)
            floors = 0
            floor_level = 0
            bedrooms = 0
            bathrooms = 0
            living_rooms = 0
            
            if is_project == "ไม่ใช่โครงการ":
                pname = f"ไม่ใช่โครงการ (ที่ดินเปล่า {land_rai} ริม{road})"
            else:
                pname = f"โครงการที่ดินจัดสรร กรีนฟิลด์ {district}"
                
            price_per_sqwa = random.randint(8000, 65000) if prov != "กรุงเทพมหานคร" else random.randint(25000, 150000)
            price = int((land_sqwa * price_per_sqwa) / 10000) * 10000

        prov_short = {
            "กรุงเทพมหานคร": "BKK",
            "นนทบุรี": "NON",
            "ปทุมธานี": "PTE",
            "สมุทรปราการ": "SPK",
            "สมุทรสาคร": "SKN",
            "นครปฐม": "NPT"
        }
        prop_code = f"PROP-{prov_short.get(prov, 'GEN')}-{count:03d}"
        row = {
            "property_id": prop_code,
            "project_name": pname,
            "project_type_category": is_project,
            "property_type": ptype,
            "usable_area_sqm": usable_sqm,
            "land_area_sqwa": land_sqwa,
            "land_area_rai_ngan_sqwa": land_rai,
            "bedrooms": bedrooms,
            "bathrooms": bathrooms,
            "living_rooms": living_rooms,
            "floors": floors,
            "floor_level": floor_level,
            "road": road,
            "soi": soi,
            "sub_district": sub_district,
            "district": district,
            "province": prov,
            "latitude": lat,
            "longitude": lng,
            "price_thb": price
        }
        rows.append(row)

    return rows

def export_all(data, base_name="real_estate_bkk_metro"):
    df = pd.DataFrame(data)
    
    # Export to CSV with UTF-8 BOM so Thai characters display correctly in Excel
    csv_filename = f"{base_name}.csv"
    df.to_csv(csv_filename, index=False, encoding="utf-8-sig")
    print(f"Successfully generated CSV: {csv_filename} ({len(df)} records)")
    
    # Export to JSON
    json_filename = f"{base_name}.json"
    with open(json_filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Successfully generated JSON: {json_filename}")

    # Export to Excel (.xlsx)
    xlsx_filename = f"{base_name}.xlsx"
    df.to_excel(xlsx_filename, index=False, engine="openpyxl")
    print(f"Successfully generated Excel: {xlsx_filename}")

if __name__ == "__main__":
    random.seed(42)  # For reproducible realistic data
    dataset = generate_synthetic_data(num_samples=60)
    export_all(dataset)
