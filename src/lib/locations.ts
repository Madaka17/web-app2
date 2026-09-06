export interface Subdistrict {
  id: string;
  name: string;
  pricePerSqm: number;
}

export interface District {
  id: string;
  name: string;
  subdistricts: Subdistrict[];
}

export interface Region {
  id: "bangkok" | "metropolitan";
  name: string;
  districts: District[];
}

export const LOCATIONS: Region[] = [
  {
    "id": "bangkok",
    "name": "กรุงเทพมหานคร",
    "districts": [
      {
        "id": "1001",
        "name": "พระนคร",
        "subdistricts": [
          {
            "id": "100101",
            "name": "พระบรมมหาราชวัง",
            "pricePerSqm": 100000
          },
          {
            "id": "100102",
            "name": "วังบูรพาภิรมย์",
            "pricePerSqm": 100000
          },
          {
            "id": "100103",
            "name": "วัดราชบพิธ",
            "pricePerSqm": 100000
          },
          {
            "id": "100104",
            "name": "สำราญราษฎร์",
            "pricePerSqm": 100000
          },
          {
            "id": "100105",
            "name": "ศาลเจ้าพ่อเสือ",
            "pricePerSqm": 100000
          },
          {
            "id": "100106",
            "name": "เสาชิงช้า",
            "pricePerSqm": 100000
          },
          {
            "id": "100107",
            "name": "บวรนิเวศ",
            "pricePerSqm": 100000
          },
          {
            "id": "100108",
            "name": "ตลาดยอด",
            "pricePerSqm": 100000
          },
          {
            "id": "100109",
            "name": "ชนะสงคราม",
            "pricePerSqm": 100000
          },
          {
            "id": "100110",
            "name": "บ้านพานถม",
            "pricePerSqm": 100000
          },
          {
            "id": "100111",
            "name": "บางขุนพรหม",
            "pricePerSqm": 100000
          },
          {
            "id": "100112",
            "name": "วัดสามพระยา",
            "pricePerSqm": 145000
          }
        ]
      },
      {
        "id": "1002",
        "name": "ดุสิต",
        "subdistricts": [
          {
            "id": "100201",
            "name": "ดุสิต",
            "pricePerSqm": 100000
          },
          {
            "id": "100202",
            "name": "วชิรพยาบาล",
            "pricePerSqm": 100000
          },
          {
            "id": "100203",
            "name": "สวนจิตรลดา",
            "pricePerSqm": 100000
          },
          {
            "id": "100204",
            "name": "สี่แยกมหานาค",
            "pricePerSqm": 100000
          },
          {
            "id": "100206",
            "name": "ถนนนครไชยศรี",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1003",
        "name": "หนองจอก",
        "subdistricts": [
          {
            "id": "100301",
            "name": "กระทุ่มราย",
            "pricePerSqm": 100000
          },
          {
            "id": "100302",
            "name": "หนองจอก",
            "pricePerSqm": 70000
          },
          {
            "id": "100303",
            "name": "คลองสิบ",
            "pricePerSqm": 80000
          },
          {
            "id": "100304",
            "name": "คลองสิบสอง",
            "pricePerSqm": 78000
          },
          {
            "id": "100305",
            "name": "โคกแฝด",
            "pricePerSqm": 100000
          },
          {
            "id": "100306",
            "name": "คู้ฝั่งเหนือ",
            "pricePerSqm": 100000
          },
          {
            "id": "100307",
            "name": "ลำผักชี",
            "pricePerSqm": 65000
          },
          {
            "id": "100308",
            "name": "ลำต้อยติ่ง",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1004",
        "name": "บางรัก",
        "subdistricts": [
          {
            "id": "100401",
            "name": "มหาพฤฒาราม",
            "pricePerSqm": 100000
          },
          {
            "id": "100402",
            "name": "สีลม",
            "pricePerSqm": 220000
          },
          {
            "id": "100403",
            "name": "สุริยวงศ์",
            "pricePerSqm": 100000
          },
          {
            "id": "100404",
            "name": "บางรัก",
            "pricePerSqm": 200000
          },
          {
            "id": "100405",
            "name": "สี่พระยา",
            "pricePerSqm": 195000
          }
        ]
      },
      {
        "id": "1005",
        "name": "บางเขน",
        "subdistricts": [
          {
            "id": "100502",
            "name": "อนุสาวรีย์",
            "pricePerSqm": 150000
          },
          {
            "id": "100508",
            "name": "ท่าแร้ง",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1006",
        "name": "บางกะปิ",
        "subdistricts": [
          {
            "id": "100601",
            "name": "คลองจั่น",
            "pricePerSqm": 100000
          },
          {
            "id": "100608",
            "name": "หัวหมาก",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1007",
        "name": "ปทุมวัน",
        "subdistricts": [
          {
            "id": "100701",
            "name": "รองเมือง",
            "pricePerSqm": 100000
          },
          {
            "id": "100702",
            "name": "วังใหม่",
            "pricePerSqm": 150000
          },
          {
            "id": "100703",
            "name": "ปทุมวัน",
            "pricePerSqm": 100000
          },
          {
            "id": "100704",
            "name": "ลุมพินี",
            "pricePerSqm": 230000
          }
        ]
      },
      {
        "id": "1008",
        "name": "ป้อมปราบศัตรูพ่าย",
        "subdistricts": [
          {
            "id": "100801",
            "name": "ป้อมปราบ",
            "pricePerSqm": 100000
          },
          {
            "id": "100802",
            "name": "วัดเทพศิรินทร์",
            "pricePerSqm": 100000
          },
          {
            "id": "100803",
            "name": "คลองมหานาค",
            "pricePerSqm": 100000
          },
          {
            "id": "100804",
            "name": "บ้านบาตร",
            "pricePerSqm": 100000
          },
          {
            "id": "100805",
            "name": "วัดโสมนัส",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1009",
        "name": "พระโขนง",
        "subdistricts": [
          {
            "id": "100905",
            "name": "บางจาก",
            "pricePerSqm": 100000
          },
          {
            "id": "100910",
            "name": "พระโขนงใต้",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1010",
        "name": "มีนบุรี",
        "subdistricts": [
          {
            "id": "101001",
            "name": "มีนบุรี",
            "pricePerSqm": 100000
          },
          {
            "id": "101002",
            "name": "แสนแสบ",
            "pricePerSqm": 95000
          }
        ]
      },
      {
        "id": "1011",
        "name": "ลาดกระบัง",
        "subdistricts": [
          {
            "id": "101101",
            "name": "ลาดกระบัง",
            "pricePerSqm": 80000
          },
          {
            "id": "101102",
            "name": "คลองสองต้นนุ่น",
            "pricePerSqm": 100000
          },
          {
            "id": "101103",
            "name": "คลองสามประเวศ",
            "pricePerSqm": 100000
          },
          {
            "id": "101104",
            "name": "ลำปลาทิว",
            "pricePerSqm": 100000
          },
          {
            "id": "101105",
            "name": "ทับยาว",
            "pricePerSqm": 95000
          },
          {
            "id": "101106",
            "name": "ขุมทอง",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1012",
        "name": "ยานนาวา",
        "subdistricts": [
          {
            "id": "101203",
            "name": "ช่องนนทรี",
            "pricePerSqm": 100000
          },
          {
            "id": "101204",
            "name": "บางโพงพาง",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1013",
        "name": "สัมพันธวงศ์",
        "subdistricts": [
          {
            "id": "101301",
            "name": "จักรวรรดิ",
            "pricePerSqm": 100000
          },
          {
            "id": "101302",
            "name": "สัมพันธวงศ์",
            "pricePerSqm": 145000
          },
          {
            "id": "101303",
            "name": "ตลาดน้อย",
            "pricePerSqm": 135000
          }
        ]
      },
      {
        "id": "1014",
        "name": "พญาไท",
        "subdistricts": [
          {
            "id": "101401",
            "name": "สามเสนใน",
            "pricePerSqm": 155000
          },
          {
            "id": "101406",
            "name": "พญาไท",
            "pricePerSqm": 160000
          }
        ]
      },
      {
        "id": "1015",
        "name": "ธนบุรี",
        "subdistricts": [
          {
            "id": "101501",
            "name": "วัดกัลยาณ์",
            "pricePerSqm": 100000
          },
          {
            "id": "101502",
            "name": "หิรัญรูจี",
            "pricePerSqm": 100000
          },
          {
            "id": "101503",
            "name": "บางยี่เรือ",
            "pricePerSqm": 100000
          },
          {
            "id": "101504",
            "name": "บุคคโล",
            "pricePerSqm": 100000
          },
          {
            "id": "101505",
            "name": "ตลาดพลู",
            "pricePerSqm": 100000
          },
          {
            "id": "101506",
            "name": "ดาวคะนอง",
            "pricePerSqm": 100000
          },
          {
            "id": "101507",
            "name": "สำเหร่",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1016",
        "name": "บางกอกใหญ่",
        "subdistricts": [
          {
            "id": "101601",
            "name": "วัดอรุณ",
            "pricePerSqm": 135000
          },
          {
            "id": "101602",
            "name": "วัดท่าพระ",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1017",
        "name": "ห้วยขวาง",
        "subdistricts": [
          {
            "id": "101701",
            "name": "ห้วยขวาง",
            "pricePerSqm": 155000
          },
          {
            "id": "101702",
            "name": "บางกะปิ",
            "pricePerSqm": 145000
          },
          {
            "id": "101704",
            "name": "สามเสนนอก",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1018",
        "name": "คลองสาน",
        "subdistricts": [
          {
            "id": "101801",
            "name": "สมเด็จเจ้าพระยา",
            "pricePerSqm": 100000
          },
          {
            "id": "101802",
            "name": "คลองสาน",
            "pricePerSqm": 140000
          },
          {
            "id": "101803",
            "name": "บางลำภูล่าง",
            "pricePerSqm": 100000
          },
          {
            "id": "101804",
            "name": "คลองต้นไทร",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1019",
        "name": "ตลิ่งชัน",
        "subdistricts": [
          {
            "id": "101901",
            "name": "คลองชักพระ",
            "pricePerSqm": 100000
          },
          {
            "id": "101902",
            "name": "ตลิ่งชัน",
            "pricePerSqm": 100000
          },
          {
            "id": "101903",
            "name": "ฉิมพลี",
            "pricePerSqm": 100000
          },
          {
            "id": "101904",
            "name": "บางพรม",
            "pricePerSqm": 100000
          },
          {
            "id": "101905",
            "name": "บางระมาด",
            "pricePerSqm": 120000
          },
          {
            "id": "101907",
            "name": "บางเชือกหนัง",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1020",
        "name": "บางกอกน้อย",
        "subdistricts": [
          {
            "id": "102004",
            "name": "ศิริราช",
            "pricePerSqm": 135000
          },
          {
            "id": "102005",
            "name": "บ้านช่างหล่อ",
            "pricePerSqm": 100000
          },
          {
            "id": "102006",
            "name": "บางขุนนนท์",
            "pricePerSqm": 100000
          },
          {
            "id": "102007",
            "name": "บางขุนศรี",
            "pricePerSqm": 100000
          },
          {
            "id": "102009",
            "name": "อรุณอมรินทร์",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1021",
        "name": "บางขุนเทียน",
        "subdistricts": [
          {
            "id": "102105",
            "name": "ท่าข้าม",
            "pricePerSqm": 85000
          },
          {
            "id": "102107",
            "name": "แสมดำ",
            "pricePerSqm": 75000
          }
        ]
      },
      {
        "id": "1022",
        "name": "ภาษีเจริญ",
        "subdistricts": [
          {
            "id": "102201",
            "name": "บางหว้า",
            "pricePerSqm": 100000
          },
          {
            "id": "102202",
            "name": "บางด้วน",
            "pricePerSqm": 100000
          },
          {
            "id": "102206",
            "name": "บางจาก",
            "pricePerSqm": 100000
          },
          {
            "id": "102207",
            "name": "บางแวก",
            "pricePerSqm": 95000
          },
          {
            "id": "102208",
            "name": "คลองขวาง",
            "pricePerSqm": 100000
          },
          {
            "id": "102209",
            "name": "ปากคลองภาษีเจริญ",
            "pricePerSqm": 100000
          },
          {
            "id": "102210",
            "name": "คูหาสวรรค์",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1023",
        "name": "หนองแขม",
        "subdistricts": [
          {
            "id": "102302",
            "name": "หนองแขม",
            "pricePerSqm": 100000
          },
          {
            "id": "102303",
            "name": "หนองค้างพลู",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1024",
        "name": "ราษฎร์บูรณะ",
        "subdistricts": [
          {
            "id": "102401",
            "name": "ราษฎร์บูรณะ",
            "pricePerSqm": 100000
          },
          {
            "id": "102402",
            "name": "บางปะกอก",
            "pricePerSqm": 115000
          }
        ]
      },
      {
        "id": "1025",
        "name": "บางพลัด",
        "subdistricts": [
          {
            "id": "102501",
            "name": "บางพลัด",
            "pricePerSqm": 130000
          },
          {
            "id": "102502",
            "name": "บางอ้อ",
            "pricePerSqm": 100000
          },
          {
            "id": "102503",
            "name": "บางบำหรุ",
            "pricePerSqm": 100000
          },
          {
            "id": "102504",
            "name": "บางยี่ขัน",
            "pricePerSqm": 125000
          }
        ]
      },
      {
        "id": "1026",
        "name": "ดินแดง",
        "subdistricts": [
          {
            "id": "102601",
            "name": "ดินแดง",
            "pricePerSqm": 130000
          },
          {
            "id": "102602",
            "name": "รัชดาภิเษก",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1027",
        "name": "บึงกุ่ม",
        "subdistricts": [
          {
            "id": "102701",
            "name": "คลองกุ่ม",
            "pricePerSqm": 105000
          },
          {
            "id": "102704",
            "name": "นวมินทร์",
            "pricePerSqm": 100000
          },
          {
            "id": "102705",
            "name": "นวลจันทร์",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1028",
        "name": "สาทร",
        "subdistricts": [
          {
            "id": "102801",
            "name": "ทุ่งวัดดอน",
            "pricePerSqm": 150000
          },
          {
            "id": "102802",
            "name": "ยานนาวา",
            "pricePerSqm": 160000
          },
          {
            "id": "102803",
            "name": "ทุ่งมหาเมฆ",
            "pricePerSqm": 155000
          }
        ]
      },
      {
        "id": "1029",
        "name": "บางซื่อ",
        "subdistricts": [
          {
            "id": "102901",
            "name": "บางซื่อ",
            "pricePerSqm": 135000
          },
          {
            "id": "102902",
            "name": "วงศ์สว่าง",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1030",
        "name": "จตุจักร",
        "subdistricts": [
          {
            "id": "103001",
            "name": "ลาดยาว",
            "pricePerSqm": 100000
          },
          {
            "id": "103002",
            "name": "เสนานิคม",
            "pricePerSqm": 135000
          },
          {
            "id": "103003",
            "name": "จันทรเกษม",
            "pricePerSqm": 130000
          },
          {
            "id": "103004",
            "name": "จอมพล",
            "pricePerSqm": 100000
          },
          {
            "id": "103005",
            "name": "จตุจักร",
            "pricePerSqm": 150000
          }
        ]
      },
      {
        "id": "1031",
        "name": "บางคอแหลม",
        "subdistricts": [
          {
            "id": "103101",
            "name": "บางคอแหลม",
            "pricePerSqm": 135000
          },
          {
            "id": "103102",
            "name": "วัดพระยาไกร",
            "pricePerSqm": 100000
          },
          {
            "id": "103103",
            "name": "บางโคล่",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1032",
        "name": "ประเวศ",
        "subdistricts": [
          {
            "id": "103201",
            "name": "ประเวศ",
            "pricePerSqm": 100000
          },
          {
            "id": "103202",
            "name": "หนองบอน",
            "pricePerSqm": 90000
          },
          {
            "id": "103203",
            "name": "ดอกไม้",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1033",
        "name": "คลองเตย",
        "subdistricts": [
          {
            "id": "103301",
            "name": "คลองเตย",
            "pricePerSqm": 180000
          },
          {
            "id": "103302",
            "name": "คลองตัน",
            "pricePerSqm": 195000
          },
          {
            "id": "103303",
            "name": "พระโขนง",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1034",
        "name": "สวนหลวง",
        "subdistricts": [
          {
            "id": "103401",
            "name": "สวนหลวง",
            "pricePerSqm": 120000
          },
          {
            "id": "103402",
            "name": "อ่อนนุช",
            "pricePerSqm": 100000
          },
          {
            "id": "103403",
            "name": "พัฒนาการ",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1035",
        "name": "จอมทอง",
        "subdistricts": [
          {
            "id": "103501",
            "name": "บางขุนเทียน",
            "pricePerSqm": 90000
          },
          {
            "id": "103502",
            "name": "บางค้อ",
            "pricePerSqm": 100000
          },
          {
            "id": "103503",
            "name": "บางมด",
            "pricePerSqm": 100000
          },
          {
            "id": "103504",
            "name": "จอมทอง",
            "pricePerSqm": 130000
          }
        ]
      },
      {
        "id": "1036",
        "name": "ดอนเมือง",
        "subdistricts": [
          {
            "id": "103602",
            "name": "สีกัน",
            "pricePerSqm": 105000
          },
          {
            "id": "103604",
            "name": "ดอนเมือง",
            "pricePerSqm": 100000
          },
          {
            "id": "103605",
            "name": "สนามบิน",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1037",
        "name": "ราชเทวี",
        "subdistricts": [
          {
            "id": "103701",
            "name": "ทุ่งพญาไท",
            "pricePerSqm": 100000
          },
          {
            "id": "103702",
            "name": "ถนนพญาไท",
            "pricePerSqm": 100000
          },
          {
            "id": "103703",
            "name": "ถนนเพชรบุรี",
            "pricePerSqm": 100000
          },
          {
            "id": "103704",
            "name": "มักกะสัน",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1038",
        "name": "ลาดพร้าว",
        "subdistricts": [
          {
            "id": "103801",
            "name": "ลาดพร้าว",
            "pricePerSqm": 140000
          },
          {
            "id": "103802",
            "name": "จรเข้บัว",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1039",
        "name": "วัฒนา",
        "subdistricts": [
          {
            "id": "103901",
            "name": "คลองเตยเหนือ",
            "pricePerSqm": 100000
          },
          {
            "id": "103902",
            "name": "คลองตันเหนือ",
            "pricePerSqm": 100000
          },
          {
            "id": "103903",
            "name": "พระโขนงเหนือ",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1040",
        "name": "บางแค",
        "subdistricts": [
          {
            "id": "104001",
            "name": "บางแค",
            "pricePerSqm": 100000
          },
          {
            "id": "104002",
            "name": "บางแคเหนือ",
            "pricePerSqm": 100000
          },
          {
            "id": "104003",
            "name": "บางไผ่",
            "pricePerSqm": 88000
          },
          {
            "id": "104004",
            "name": "หลักสอง",
            "pricePerSqm": 85000
          }
        ]
      },
      {
        "id": "1041",
        "name": "หลักสี่",
        "subdistricts": [
          {
            "id": "104101",
            "name": "ทุ่งสองห้อง",
            "pricePerSqm": 120000
          },
          {
            "id": "104102",
            "name": "ตลาดบางเขน",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1042",
        "name": "สายไหม",
        "subdistricts": [
          {
            "id": "104201",
            "name": "สายไหม",
            "pricePerSqm": 100000
          },
          {
            "id": "104202",
            "name": "ออเงิน",
            "pricePerSqm": 100000
          },
          {
            "id": "104203",
            "name": "คลองถนน",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1043",
        "name": "คันนายาว",
        "subdistricts": [
          {
            "id": "104301",
            "name": "คันนายาว",
            "pricePerSqm": 100000
          },
          {
            "id": "104302",
            "name": "รามอินทรา",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1044",
        "name": "สะพานสูง",
        "subdistricts": [
          {
            "id": "104401",
            "name": "สะพานสูง",
            "pricePerSqm": 100000
          },
          {
            "id": "104402",
            "name": "ราษฎร์พัฒนา",
            "pricePerSqm": 100000
          },
          {
            "id": "104403",
            "name": "ทับช้าง",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1045",
        "name": "วังทองหลาง",
        "subdistricts": [
          {
            "id": "104501",
            "name": "วังทองหลาง",
            "pricePerSqm": 165000
          },
          {
            "id": "104502",
            "name": "สะพานสอง",
            "pricePerSqm": 100000
          },
          {
            "id": "104503",
            "name": "คลองเจ้าคุณสิงห์",
            "pricePerSqm": 100000
          },
          {
            "id": "104504",
            "name": "พลับพลา",
            "pricePerSqm": 115000
          }
        ]
      },
      {
        "id": "1046",
        "name": "คลองสามวา",
        "subdistricts": [
          {
            "id": "104601",
            "name": "สามวาตะวันตก",
            "pricePerSqm": 100000
          },
          {
            "id": "104602",
            "name": "สามวาตะวันออก",
            "pricePerSqm": 100000
          },
          {
            "id": "104603",
            "name": "บางชัน",
            "pricePerSqm": 100000
          },
          {
            "id": "104604",
            "name": "ทรายกองดิน",
            "pricePerSqm": 100000
          },
          {
            "id": "104605",
            "name": "ทรายกองดินใต้",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1047",
        "name": "บางนา",
        "subdistricts": [
          {
            "id": "104702",
            "name": "บางนาเหนือ",
            "pricePerSqm": 100000
          },
          {
            "id": "104703",
            "name": "บางนาใต้",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1048",
        "name": "ทวีวัฒนา",
        "subdistricts": [
          {
            "id": "104801",
            "name": "ทวีวัฒนา",
            "pricePerSqm": 100000
          },
          {
            "id": "104802",
            "name": "ศาลาธรรมสพน์",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1049",
        "name": "ทุ่งครุ",
        "subdistricts": [
          {
            "id": "104901",
            "name": "บางมด",
            "pricePerSqm": 100000
          },
          {
            "id": "104902",
            "name": "ทุ่งครุ",
            "pricePerSqm": 100000
          }
        ]
      },
      {
        "id": "1050",
        "name": "บางบอน",
        "subdistricts": [
          {
            "id": "105002",
            "name": "บางบอนเหนือ",
            "pricePerSqm": 100000
          },
          {
            "id": "105003",
            "name": "บางบอนใต้",
            "pricePerSqm": 100000
          },
          {
            "id": "105004",
            "name": "คลองบางพราน",
            "pricePerSqm": 100000
          },
          {
            "id": "105005",
            "name": "คลองบางบอน",
            "pricePerSqm": 80000
          }
        ]
      }
    ]
  },
  {
    "id": "metropolitan",
    "name": "ปริมณฑล",
    "districts": [
      {
        "id": "1101",
        "name": "เมืองสมุทรปราการ",
        "subdistricts": [
          {
            "id": "110101",
            "name": "ปากน้ำ",
            "pricePerSqm": 70000
          },
          {
            "id": "110102",
            "name": "สำโรงเหนือ",
            "pricePerSqm": 82000
          },
          {
            "id": "110103",
            "name": "บางเมือง",
            "pricePerSqm": 70000
          },
          {
            "id": "110104",
            "name": "ท้ายบ้าน",
            "pricePerSqm": 70000
          },
          {
            "id": "110108",
            "name": "บางปูใหม่",
            "pricePerSqm": 70000
          },
          {
            "id": "110110",
            "name": "แพรกษา",
            "pricePerSqm": 70000
          },
          {
            "id": "110111",
            "name": "บางโปรง",
            "pricePerSqm": 70000
          },
          {
            "id": "110112",
            "name": "บางปู",
            "pricePerSqm": 70000
          },
          {
            "id": "110113",
            "name": "บางด้วน",
            "pricePerSqm": 70000
          },
          {
            "id": "110114",
            "name": "บางเมืองใหม่",
            "pricePerSqm": 70000
          },
          {
            "id": "110115",
            "name": "เทพารักษ์",
            "pricePerSqm": 70000
          },
          {
            "id": "110116",
            "name": "ท้ายบ้านใหม่",
            "pricePerSqm": 70000
          },
          {
            "id": "110117",
            "name": "แพรกษาใหม่",
            "pricePerSqm": 70000
          }
        ]
      },
      {
        "id": "1102",
        "name": "บางบ่อ",
        "subdistricts": [
          {
            "id": "110201",
            "name": "บางบ่อ",
            "pricePerSqm": 72000
          },
          {
            "id": "110202",
            "name": "บ้านระกาศ",
            "pricePerSqm": 70000
          },
          {
            "id": "110203",
            "name": "บางพลีน้อย",
            "pricePerSqm": 70000
          },
          {
            "id": "110204",
            "name": "บางเพรียง",
            "pricePerSqm": 70000
          },
          {
            "id": "110205",
            "name": "คลองด่าน",
            "pricePerSqm": 95000
          },
          {
            "id": "110206",
            "name": "คลองสวน",
            "pricePerSqm": 70000
          },
          {
            "id": "110207",
            "name": "เปร็ง",
            "pricePerSqm": 70000
          },
          {
            "id": "110208",
            "name": "คลองนิยมยาตรา",
            "pricePerSqm": 70000
          }
        ]
      },
      {
        "id": "1103",
        "name": "บางพลี",
        "subdistricts": [
          {
            "id": "110301",
            "name": "บางพลีใหญ่",
            "pricePerSqm": 75000
          },
          {
            "id": "110302",
            "name": "บางแก้ว",
            "pricePerSqm": 58000
          },
          {
            "id": "110303",
            "name": "บางปลา",
            "pricePerSqm": 70000
          },
          {
            "id": "110304",
            "name": "บางโฉลง",
            "pricePerSqm": 70000
          },
          {
            "id": "110308",
            "name": "ราชาเทวะ",
            "pricePerSqm": 85000
          },
          {
            "id": "110309",
            "name": "หนองปรือ",
            "pricePerSqm": 70000
          }
        ]
      },
      {
        "id": "1104",
        "name": "พระประแดง",
        "subdistricts": [
          {
            "id": "110401",
            "name": "ตลาด",
            "pricePerSqm": 70000
          },
          {
            "id": "110402",
            "name": "บางพึ่ง",
            "pricePerSqm": 70000
          },
          {
            "id": "110403",
            "name": "บางจาก",
            "pricePerSqm": 70000
          },
          {
            "id": "110404",
            "name": "บางครุ",
            "pricePerSqm": 70000
          },
          {
            "id": "110405",
            "name": "บางหญ้าแพรก",
            "pricePerSqm": 70000
          },
          {
            "id": "110406",
            "name": "บางหัวเสือ",
            "pricePerSqm": 70000
          },
          {
            "id": "110407",
            "name": "สำโรงใต้",
            "pricePerSqm": 70000
          },
          {
            "id": "110408",
            "name": "บางยอ",
            "pricePerSqm": 70000
          },
          {
            "id": "110409",
            "name": "บางกะเจ้า",
            "pricePerSqm": 70000
          },
          {
            "id": "110410",
            "name": "บางน้ำผึ้ง",
            "pricePerSqm": 70000
          },
          {
            "id": "110411",
            "name": "บางกระสอบ",
            "pricePerSqm": 70000
          },
          {
            "id": "110412",
            "name": "บางกอบัว",
            "pricePerSqm": 70000
          },
          {
            "id": "110413",
            "name": "ทรงคนอง",
            "pricePerSqm": 70000
          },
          {
            "id": "110414",
            "name": "สำโรง",
            "pricePerSqm": 125000
          },
          {
            "id": "110415",
            "name": "สำโรงกลาง",
            "pricePerSqm": 70000
          }
        ]
      },
      {
        "id": "1105",
        "name": "พระสมุทรเจดีย์",
        "subdistricts": [
          {
            "id": "110501",
            "name": "นาเกลือ",
            "pricePerSqm": 70000
          },
          {
            "id": "110502",
            "name": "บ้านคลองสวน",
            "pricePerSqm": 70000
          },
          {
            "id": "110503",
            "name": "แหลมฟ้าผ่า",
            "pricePerSqm": 70000
          },
          {
            "id": "110504",
            "name": "ปากคลองบางปลากด",
            "pricePerSqm": 70000
          },
          {
            "id": "110505",
            "name": "ในคลองบางปลากด",
            "pricePerSqm": 70000
          }
        ]
      },
      {
        "id": "1106",
        "name": "บางเสาธง",
        "subdistricts": [
          {
            "id": "110601",
            "name": "บางเสาธง",
            "pricePerSqm": 70000
          },
          {
            "id": "110602",
            "name": "ศีรษะจรเข้น้อย",
            "pricePerSqm": 70000
          },
          {
            "id": "110603",
            "name": "ศีรษะจรเข้ใหญ่",
            "pricePerSqm": 70000
          }
        ]
      },
      {
        "id": "1201",
        "name": "เมืองนนทบุรี",
        "subdistricts": [
          {
            "id": "120101",
            "name": "สวนใหญ่",
            "pricePerSqm": 88000
          },
          {
            "id": "120102",
            "name": "ตลาดขวัญ",
            "pricePerSqm": 95000
          },
          {
            "id": "120103",
            "name": "บางเขน",
            "pricePerSqm": 110000
          },
          {
            "id": "120104",
            "name": "บางกระสอ",
            "pricePerSqm": 80000
          },
          {
            "id": "120105",
            "name": "ท่าทราย",
            "pricePerSqm": 90000
          },
          {
            "id": "120106",
            "name": "บางไผ่",
            "pricePerSqm": 88000
          },
          {
            "id": "120107",
            "name": "บางศรีเมือง",
            "pricePerSqm": 82000
          },
          {
            "id": "120108",
            "name": "บางกร่าง",
            "pricePerSqm": 80000
          },
          {
            "id": "120109",
            "name": "ไทรม้า",
            "pricePerSqm": 80000
          },
          {
            "id": "120110",
            "name": "บางรักน้อย",
            "pricePerSqm": 78000
          }
        ]
      },
      {
        "id": "1202",
        "name": "บางกรวย",
        "subdistricts": [
          {
            "id": "120201",
            "name": "วัดชลอ",
            "pricePerSqm": 80000
          },
          {
            "id": "120202",
            "name": "บางกรวย",
            "pricePerSqm": 85000
          },
          {
            "id": "120203",
            "name": "บางสีทอง",
            "pricePerSqm": 80000
          },
          {
            "id": "120204",
            "name": "บางขนุน",
            "pricePerSqm": 80000
          },
          {
            "id": "120205",
            "name": "บางขุนกอง",
            "pricePerSqm": 80000
          },
          {
            "id": "120206",
            "name": "บางคูเวียง",
            "pricePerSqm": 80000
          },
          {
            "id": "120207",
            "name": "มหาสวัสดิ์",
            "pricePerSqm": 82000
          },
          {
            "id": "120208",
            "name": "ปลายบาง",
            "pricePerSqm": 80000
          },
          {
            "id": "120209",
            "name": "ศาลากลาง",
            "pricePerSqm": 80000
          }
        ]
      },
      {
        "id": "1203",
        "name": "บางใหญ่",
        "subdistricts": [
          {
            "id": "120301",
            "name": "บางม่วง",
            "pricePerSqm": 52000
          },
          {
            "id": "120302",
            "name": "บางแม่นาง",
            "pricePerSqm": 80000
          },
          {
            "id": "120303",
            "name": "บางเลน",
            "pricePerSqm": 40000
          },
          {
            "id": "120304",
            "name": "เสาธงหิน",
            "pricePerSqm": 80000
          },
          {
            "id": "120305",
            "name": "บางใหญ่",
            "pricePerSqm": 80000
          },
          {
            "id": "120306",
            "name": "บ้านใหม่",
            "pricePerSqm": 80000
          }
        ]
      },
      {
        "id": "1204",
        "name": "บางบัวทอง",
        "subdistricts": [
          {
            "id": "120401",
            "name": "โสนลอย",
            "pricePerSqm": 80000
          },
          {
            "id": "120402",
            "name": "บางบัวทอง",
            "pricePerSqm": 90000
          },
          {
            "id": "120403",
            "name": "บางรักใหญ่",
            "pricePerSqm": 88000
          },
          {
            "id": "120404",
            "name": "บางคูรัด",
            "pricePerSqm": 80000
          },
          {
            "id": "120405",
            "name": "ละหาร",
            "pricePerSqm": 80000
          },
          {
            "id": "120406",
            "name": "ลำโพ",
            "pricePerSqm": 80000
          },
          {
            "id": "120407",
            "name": "พิมลราช",
            "pricePerSqm": 80000
          },
          {
            "id": "120408",
            "name": "บางรักพัฒนา",
            "pricePerSqm": 80000
          }
        ]
      },
      {
        "id": "1205",
        "name": "ไทรน้อย",
        "subdistricts": [
          {
            "id": "120501",
            "name": "ไทรน้อย",
            "pricePerSqm": 80000
          },
          {
            "id": "120502",
            "name": "ราษฎร์นิยม",
            "pricePerSqm": 80000
          },
          {
            "id": "120503",
            "name": "หนองเพรางาย",
            "pricePerSqm": 80000
          },
          {
            "id": "120504",
            "name": "ไทรใหญ่",
            "pricePerSqm": 80000
          },
          {
            "id": "120505",
            "name": "ขุนศรี",
            "pricePerSqm": 80000
          },
          {
            "id": "120506",
            "name": "คลองขวาง",
            "pricePerSqm": 80000
          },
          {
            "id": "120507",
            "name": "ทวีวัฒนา",
            "pricePerSqm": 80000
          }
        ]
      },
      {
        "id": "1206",
        "name": "ปากเกร็ด",
        "subdistricts": [
          {
            "id": "120601",
            "name": "ปากเกร็ด",
            "pricePerSqm": 90000
          },
          {
            "id": "120602",
            "name": "บางตลาด",
            "pricePerSqm": 80000
          },
          {
            "id": "120603",
            "name": "บ้านใหม่",
            "pricePerSqm": 80000
          },
          {
            "id": "120604",
            "name": "บางพูด",
            "pricePerSqm": 80000
          },
          {
            "id": "120605",
            "name": "บางตะไนย์",
            "pricePerSqm": 80000
          },
          {
            "id": "120606",
            "name": "คลองพระอุดม",
            "pricePerSqm": 80000
          },
          {
            "id": "120607",
            "name": "ท่าอิฐ",
            "pricePerSqm": 80000
          },
          {
            "id": "120608",
            "name": "เกาะเกร็ด",
            "pricePerSqm": 80000
          },
          {
            "id": "120609",
            "name": "อ้อมเกร็ด",
            "pricePerSqm": 80000
          },
          {
            "id": "120610",
            "name": "คลองข่อย",
            "pricePerSqm": 80000
          },
          {
            "id": "120611",
            "name": "บางพลับ",
            "pricePerSqm": 80000
          },
          {
            "id": "120612",
            "name": "คลองเกลือ",
            "pricePerSqm": 80000
          }
        ]
      },
      {
        "id": "1301",
        "name": "เมืองปทุมธานี",
        "subdistricts": [
          {
            "id": "130101",
            "name": "บางปรอก",
            "pricePerSqm": 65000
          },
          {
            "id": "130102",
            "name": "บ้านใหม่",
            "pricePerSqm": 65000
          },
          {
            "id": "130103",
            "name": "บ้านกลาง",
            "pricePerSqm": 65000
          },
          {
            "id": "130104",
            "name": "บ้านฉาง",
            "pricePerSqm": 65000
          },
          {
            "id": "130105",
            "name": "บ้านกระแชง",
            "pricePerSqm": 65000
          },
          {
            "id": "130106",
            "name": "บางขะแยง",
            "pricePerSqm": 65000
          },
          {
            "id": "130107",
            "name": "บางคูวัด",
            "pricePerSqm": 65000
          },
          {
            "id": "130108",
            "name": "บางหลวง",
            "pricePerSqm": 55000
          },
          {
            "id": "130109",
            "name": "บางเดื่อ",
            "pricePerSqm": 65000
          },
          {
            "id": "130110",
            "name": "บางพูด",
            "pricePerSqm": 65000
          },
          {
            "id": "130111",
            "name": "บางพูน",
            "pricePerSqm": 65000
          },
          {
            "id": "130112",
            "name": "บางกะดี",
            "pricePerSqm": 65000
          },
          {
            "id": "130113",
            "name": "สวนพริกไทย",
            "pricePerSqm": 65000
          },
          {
            "id": "130114",
            "name": "หลักหก",
            "pricePerSqm": 65000
          }
        ]
      },
      {
        "id": "1302",
        "name": "คลองหลวง",
        "subdistricts": [
          {
            "id": "130201",
            "name": "คลองหนึ่ง",
            "pricePerSqm": 62000
          },
          {
            "id": "130202",
            "name": "คลองสอง",
            "pricePerSqm": 65000
          },
          {
            "id": "130203",
            "name": "คลองสาม",
            "pricePerSqm": 70000
          },
          {
            "id": "130204",
            "name": "คลองสี่",
            "pricePerSqm": 65000
          },
          {
            "id": "130205",
            "name": "คลองห้า",
            "pricePerSqm": 90000
          },
          {
            "id": "130206",
            "name": "คลองหก",
            "pricePerSqm": 90000
          },
          {
            "id": "130207",
            "name": "คลองเจ็ด",
            "pricePerSqm": 88000
          }
        ]
      },
      {
        "id": "1303",
        "name": "ธัญบุรี",
        "subdistricts": [
          {
            "id": "130301",
            "name": "ประชาธิปัตย์",
            "pricePerSqm": 65000
          },
          {
            "id": "130302",
            "name": "บึงยี่โถ",
            "pricePerSqm": 65000
          },
          {
            "id": "130303",
            "name": "รังสิต",
            "pricePerSqm": 65000
          },
          {
            "id": "130304",
            "name": "ลำผักกูด",
            "pricePerSqm": 65000
          },
          {
            "id": "130305",
            "name": "บึงสนั่น",
            "pricePerSqm": 65000
          },
          {
            "id": "130306",
            "name": "บึงน้ำรักษ์",
            "pricePerSqm": 65000
          }
        ]
      },
      {
        "id": "1304",
        "name": "หนองเสือ",
        "subdistricts": [
          {
            "id": "130401",
            "name": "บึงบา",
            "pricePerSqm": 65000
          },
          {
            "id": "130402",
            "name": "บึงบอน",
            "pricePerSqm": 65000
          },
          {
            "id": "130403",
            "name": "บึงกาสาม",
            "pricePerSqm": 65000
          },
          {
            "id": "130404",
            "name": "บึงชำอ้อ",
            "pricePerSqm": 65000
          },
          {
            "id": "130405",
            "name": "หนองสามวัง",
            "pricePerSqm": 65000
          },
          {
            "id": "130406",
            "name": "ศาลาครุ",
            "pricePerSqm": 65000
          },
          {
            "id": "130407",
            "name": "นพรัตน์",
            "pricePerSqm": 65000
          }
        ]
      },
      {
        "id": "1305",
        "name": "ลาดหลุมแก้ว",
        "subdistricts": [
          {
            "id": "130501",
            "name": "ระแหง",
            "pricePerSqm": 68000
          },
          {
            "id": "130502",
            "name": "ลาดหลุมแก้ว",
            "pricePerSqm": 65000
          },
          {
            "id": "130503",
            "name": "คูบางหลวง",
            "pricePerSqm": 65000
          },
          {
            "id": "130504",
            "name": "คูขวาง",
            "pricePerSqm": 65000
          },
          {
            "id": "130505",
            "name": "คลองพระอุดม",
            "pricePerSqm": 65000
          },
          {
            "id": "130506",
            "name": "บ่อเงิน",
            "pricePerSqm": 65000
          },
          {
            "id": "130507",
            "name": "หน้าไม้",
            "pricePerSqm": 65000
          }
        ]
      },
      {
        "id": "1306",
        "name": "ลำลูกกา",
        "subdistricts": [
          {
            "id": "130601",
            "name": "คูคต",
            "pricePerSqm": 65000
          },
          {
            "id": "130602",
            "name": "ลาดสวาย",
            "pricePerSqm": 65000
          },
          {
            "id": "130603",
            "name": "บึงคำพร้อย",
            "pricePerSqm": 65000
          },
          {
            "id": "130604",
            "name": "ลำลูกกา",
            "pricePerSqm": 65000
          },
          {
            "id": "130605",
            "name": "บึงทองหลาง",
            "pricePerSqm": 65000
          },
          {
            "id": "130606",
            "name": "ลำไทร",
            "pricePerSqm": 65000
          },
          {
            "id": "130607",
            "name": "บึงคอไห",
            "pricePerSqm": 65000
          },
          {
            "id": "130608",
            "name": "พืชอุดม",
            "pricePerSqm": 65000
          }
        ]
      },
      {
        "id": "1307",
        "name": "สามโคก",
        "subdistricts": [
          {
            "id": "130701",
            "name": "บางเตย",
            "pricePerSqm": 65000
          },
          {
            "id": "130702",
            "name": "คลองควาย",
            "pricePerSqm": 65000
          },
          {
            "id": "130703",
            "name": "สามโคก",
            "pricePerSqm": 65000
          },
          {
            "id": "130704",
            "name": "กระแชง",
            "pricePerSqm": 65000
          },
          {
            "id": "130705",
            "name": "บางโพธิ์เหนือ",
            "pricePerSqm": 65000
          },
          {
            "id": "130706",
            "name": "เชียงรากใหญ่",
            "pricePerSqm": 65000
          },
          {
            "id": "130707",
            "name": "บ้านปทุม",
            "pricePerSqm": 65000
          },
          {
            "id": "130708",
            "name": "บ้านงิ้ว",
            "pricePerSqm": 65000
          },
          {
            "id": "130709",
            "name": "เชียงรากน้อย",
            "pricePerSqm": 65000
          },
          {
            "id": "130710",
            "name": "บางกระบือ",
            "pricePerSqm": 65000
          },
          {
            "id": "130711",
            "name": "ท้ายเกาะ",
            "pricePerSqm": 65000
          }
        ]
      },
      {
        "id": "7301",
        "name": "เมืองนครปฐม",
        "subdistricts": [
          {
            "id": "730101",
            "name": "พระปฐมเจดีย์",
            "pricePerSqm": 50000
          },
          {
            "id": "730102",
            "name": "บางแขม",
            "pricePerSqm": 50000
          },
          {
            "id": "730103",
            "name": "พระประโทน",
            "pricePerSqm": 50000
          },
          {
            "id": "730104",
            "name": "ธรรมศาลา",
            "pricePerSqm": 50000
          },
          {
            "id": "730105",
            "name": "ตาก้อง",
            "pricePerSqm": 50000
          },
          {
            "id": "730106",
            "name": "มาบแค",
            "pricePerSqm": 50000
          },
          {
            "id": "730107",
            "name": "สนามจันทร์",
            "pricePerSqm": 50000
          },
          {
            "id": "730108",
            "name": "ดอนยายหอม",
            "pricePerSqm": 50000
          },
          {
            "id": "730109",
            "name": "ถนนขาด",
            "pricePerSqm": 50000
          },
          {
            "id": "730110",
            "name": "บ่อพลับ",
            "pricePerSqm": 50000
          },
          {
            "id": "730111",
            "name": "นครปฐม",
            "pricePerSqm": 55000
          },
          {
            "id": "730112",
            "name": "วังตะกู",
            "pricePerSqm": 50000
          },
          {
            "id": "730113",
            "name": "หนองปากโลง",
            "pricePerSqm": 50000
          },
          {
            "id": "730114",
            "name": "สามควายเผือก",
            "pricePerSqm": 50000
          },
          {
            "id": "730115",
            "name": "ทุ่งน้อย",
            "pricePerSqm": 50000
          },
          {
            "id": "730116",
            "name": "หนองดินแดง",
            "pricePerSqm": 50000
          },
          {
            "id": "730117",
            "name": "วังเย็น",
            "pricePerSqm": 50000
          },
          {
            "id": "730118",
            "name": "โพรงมะเดื่อ",
            "pricePerSqm": 50000
          },
          {
            "id": "730119",
            "name": "ลำพยา",
            "pricePerSqm": 50000
          },
          {
            "id": "730120",
            "name": "สระกะเทียม",
            "pricePerSqm": 50000
          },
          {
            "id": "730121",
            "name": "สวนป่าน",
            "pricePerSqm": 50000
          },
          {
            "id": "730122",
            "name": "ห้วยจรเข้",
            "pricePerSqm": 50000
          },
          {
            "id": "730123",
            "name": "ทัพหลวง",
            "pricePerSqm": 50000
          },
          {
            "id": "730124",
            "name": "หนองงูเหลือม",
            "pricePerSqm": 50000
          },
          {
            "id": "730125",
            "name": "บ้านยาง",
            "pricePerSqm": 50000
          }
        ]
      },
      {
        "id": "7302",
        "name": "กำแพงแสน",
        "subdistricts": [
          {
            "id": "730201",
            "name": "ทุ่งกระพังโหม",
            "pricePerSqm": 50000
          },
          {
            "id": "730202",
            "name": "กระตีบ",
            "pricePerSqm": 50000
          },
          {
            "id": "730203",
            "name": "ทุ่งลูกนก",
            "pricePerSqm": 50000
          },
          {
            "id": "730204",
            "name": "ห้วยขวาง",
            "pricePerSqm": 155000
          },
          {
            "id": "730205",
            "name": "ทุ่งขวาง",
            "pricePerSqm": 50000
          },
          {
            "id": "730206",
            "name": "สระสี่มุม",
            "pricePerSqm": 50000
          },
          {
            "id": "730207",
            "name": "ทุ่งบัว",
            "pricePerSqm": 50000
          },
          {
            "id": "730208",
            "name": "ดอนข่อย",
            "pricePerSqm": 50000
          },
          {
            "id": "730209",
            "name": "สระพัฒนา",
            "pricePerSqm": 50000
          },
          {
            "id": "730210",
            "name": "ห้วยหมอนทอง",
            "pricePerSqm": 50000
          },
          {
            "id": "730211",
            "name": "ห้วยม่วง",
            "pricePerSqm": 50000
          },
          {
            "id": "730212",
            "name": "กำแพงแสน",
            "pricePerSqm": 42000
          },
          {
            "id": "730213",
            "name": "รางพิกุล",
            "pricePerSqm": 50000
          },
          {
            "id": "730214",
            "name": "หนองกระทุ่ม",
            "pricePerSqm": 50000
          },
          {
            "id": "730215",
            "name": "วังน้ำเขียว",
            "pricePerSqm": 50000
          }
        ]
      },
      {
        "id": "7303",
        "name": "นครชัยศรี",
        "subdistricts": [
          {
            "id": "730301",
            "name": "นครชัยศรี",
            "pricePerSqm": 52000
          },
          {
            "id": "730302",
            "name": "บางกระเบา",
            "pricePerSqm": 50000
          },
          {
            "id": "730303",
            "name": "วัดแค",
            "pricePerSqm": 50000
          },
          {
            "id": "730304",
            "name": "ท่าตำหนัก",
            "pricePerSqm": 50000
          },
          {
            "id": "730305",
            "name": "บางแก้ว",
            "pricePerSqm": 58000
          },
          {
            "id": "730306",
            "name": "ท่ากระชับ",
            "pricePerSqm": 50000
          },
          {
            "id": "730307",
            "name": "ขุนแก้ว",
            "pricePerSqm": 50000
          },
          {
            "id": "730308",
            "name": "ท่าพระยา",
            "pricePerSqm": 50000
          },
          {
            "id": "730309",
            "name": "พะเนียด",
            "pricePerSqm": 50000
          },
          {
            "id": "730310",
            "name": "บางระกำ",
            "pricePerSqm": 50000
          },
          {
            "id": "730311",
            "name": "โคกพระเจดีย์",
            "pricePerSqm": 50000
          },
          {
            "id": "730312",
            "name": "ศรีษะทอง",
            "pricePerSqm": 50000
          },
          {
            "id": "730313",
            "name": "แหลมบัว",
            "pricePerSqm": 50000
          },
          {
            "id": "730314",
            "name": "ศรีมหาโพธิ์",
            "pricePerSqm": 50000
          },
          {
            "id": "730315",
            "name": "สัมปทวน",
            "pricePerSqm": 50000
          },
          {
            "id": "730316",
            "name": "วัดสำโรง",
            "pricePerSqm": 50000
          },
          {
            "id": "730317",
            "name": "ดอนแฝก",
            "pricePerSqm": 50000
          },
          {
            "id": "730318",
            "name": "ห้วยพลู",
            "pricePerSqm": 50000
          },
          {
            "id": "730319",
            "name": "วัดละมุด",
            "pricePerSqm": 50000
          },
          {
            "id": "730320",
            "name": "บางพระ",
            "pricePerSqm": 135000
          },
          {
            "id": "730321",
            "name": "บางแก้วฟ้า",
            "pricePerSqm": 50000
          },
          {
            "id": "730322",
            "name": "ลานตากฟ้า",
            "pricePerSqm": 50000
          },
          {
            "id": "730323",
            "name": "งิ้วราย",
            "pricePerSqm": 50000
          },
          {
            "id": "730324",
            "name": "ไทยาวาส",
            "pricePerSqm": 50000
          }
        ]
      },
      {
        "id": "7304",
        "name": "ดอนตูม",
        "subdistricts": [
          {
            "id": "730401",
            "name": "สามง่าม",
            "pricePerSqm": 50000
          },
          {
            "id": "730402",
            "name": "ห้วยพระ",
            "pricePerSqm": 50000
          },
          {
            "id": "730403",
            "name": "ลำเหย",
            "pricePerSqm": 50000
          },
          {
            "id": "730404",
            "name": "ดอนพุทรา",
            "pricePerSqm": 50000
          },
          {
            "id": "730405",
            "name": "บ้านหลวง",
            "pricePerSqm": 50000
          },
          {
            "id": "730406",
            "name": "ดอนรวก",
            "pricePerSqm": 50000
          },
          {
            "id": "730407",
            "name": "ห้วยด้วน",
            "pricePerSqm": 50000
          },
          {
            "id": "730408",
            "name": "ลำลูกบัว",
            "pricePerSqm": 50000
          }
        ]
      },
      {
        "id": "7305",
        "name": "บางเลน",
        "subdistricts": [
          {
            "id": "730501",
            "name": "บางเลน",
            "pricePerSqm": 40000
          },
          {
            "id": "730502",
            "name": "บางปลา",
            "pricePerSqm": 50000
          },
          {
            "id": "730503",
            "name": "บางหลวง",
            "pricePerSqm": 55000
          },
          {
            "id": "730504",
            "name": "บางภาษี",
            "pricePerSqm": 50000
          },
          {
            "id": "730505",
            "name": "บางระกำ",
            "pricePerSqm": 50000
          },
          {
            "id": "730506",
            "name": "บางไทรป่า",
            "pricePerSqm": 50000
          },
          {
            "id": "730507",
            "name": "หินมูล",
            "pricePerSqm": 50000
          },
          {
            "id": "730508",
            "name": "ไทรงาม",
            "pricePerSqm": 50000
          },
          {
            "id": "730509",
            "name": "ดอนตูม",
            "pricePerSqm": 48000
          },
          {
            "id": "730510",
            "name": "นิลเพชร",
            "pricePerSqm": 50000
          },
          {
            "id": "730511",
            "name": "บัวปากท่า",
            "pricePerSqm": 50000
          },
          {
            "id": "730512",
            "name": "คลองนกกระทุง",
            "pricePerSqm": 50000
          },
          {
            "id": "730513",
            "name": "นราภิรมย์",
            "pricePerSqm": 50000
          },
          {
            "id": "730514",
            "name": "ลำพญา",
            "pricePerSqm": 50000
          },
          {
            "id": "730515",
            "name": "ไผ่หูช้าง",
            "pricePerSqm": 50000
          }
        ]
      },
      {
        "id": "7306",
        "name": "สามพราน",
        "subdistricts": [
          {
            "id": "730601",
            "name": "ท่าข้าม",
            "pricePerSqm": 85000
          },
          {
            "id": "730602",
            "name": "ทรงคนอง",
            "pricePerSqm": 50000
          },
          {
            "id": "730603",
            "name": "หอมเกร็ด",
            "pricePerSqm": 50000
          },
          {
            "id": "730604",
            "name": "บางกระทึก",
            "pricePerSqm": 50000
          },
          {
            "id": "730605",
            "name": "บางเตย",
            "pricePerSqm": 50000
          },
          {
            "id": "730606",
            "name": "สามพราน",
            "pricePerSqm": 50000
          },
          {
            "id": "730607",
            "name": "บางช้าง",
            "pricePerSqm": 68000
          },
          {
            "id": "730608",
            "name": "ไร่ขิง",
            "pricePerSqm": 50000
          },
          {
            "id": "730609",
            "name": "ท่าตลาด",
            "pricePerSqm": 50000
          },
          {
            "id": "730610",
            "name": "กระทุ่มล้ม",
            "pricePerSqm": 50000
          },
          {
            "id": "730611",
            "name": "คลองใหม่",
            "pricePerSqm": 50000
          },
          {
            "id": "730612",
            "name": "ตลาดจินดา",
            "pricePerSqm": 50000
          },
          {
            "id": "730613",
            "name": "คลองจินดา",
            "pricePerSqm": 50000
          },
          {
            "id": "730614",
            "name": "ยายชา",
            "pricePerSqm": 50000
          },
          {
            "id": "730615",
            "name": "บ้านใหม่",
            "pricePerSqm": 50000
          },
          {
            "id": "730616",
            "name": "อ้อมใหญ่",
            "pricePerSqm": 50000
          }
        ]
      },
      {
        "id": "7307",
        "name": "พุทธมณฑล",
        "subdistricts": [
          {
            "id": "730701",
            "name": "ศาลายา",
            "pricePerSqm": 50000
          },
          {
            "id": "730702",
            "name": "คลองโยง",
            "pricePerSqm": 50000
          },
          {
            "id": "730703",
            "name": "มหาสวัสดิ์",
            "pricePerSqm": 82000
          }
        ]
      },
      {
        "id": "7401",
        "name": "เมืองสมุทรสาคร",
        "subdistricts": [
          {
            "id": "740101",
            "name": "มหาชัย",
            "pricePerSqm": 62000
          },
          {
            "id": "740102",
            "name": "ท่าฉลอม",
            "pricePerSqm": 55000
          },
          {
            "id": "740103",
            "name": "โกรกกราก",
            "pricePerSqm": 55000
          },
          {
            "id": "740104",
            "name": "บ้านบ่อ",
            "pricePerSqm": 55000
          },
          {
            "id": "740105",
            "name": "บางโทรัด",
            "pricePerSqm": 55000
          },
          {
            "id": "740106",
            "name": "กาหลง",
            "pricePerSqm": 55000
          },
          {
            "id": "740107",
            "name": "นาโคก",
            "pricePerSqm": 55000
          },
          {
            "id": "740108",
            "name": "ท่าจีน",
            "pricePerSqm": 58000
          },
          {
            "id": "740109",
            "name": "นาดี",
            "pricePerSqm": 55000
          },
          {
            "id": "740110",
            "name": "ท่าทราย",
            "pricePerSqm": 90000
          },
          {
            "id": "740111",
            "name": "คอกกระบือ",
            "pricePerSqm": 55000
          },
          {
            "id": "740112",
            "name": "บางน้ำจืด",
            "pricePerSqm": 55000
          },
          {
            "id": "740113",
            "name": "พันท้ายนรสิงห์",
            "pricePerSqm": 55000
          },
          {
            "id": "740114",
            "name": "โคกขาม",
            "pricePerSqm": 55000
          },
          {
            "id": "740115",
            "name": "บ้านเกาะ",
            "pricePerSqm": 55000
          },
          {
            "id": "740116",
            "name": "บางกระเจ้า",
            "pricePerSqm": 55000
          },
          {
            "id": "740117",
            "name": "บางหญ้าแพรก",
            "pricePerSqm": 55000
          },
          {
            "id": "740118",
            "name": "ชัยมงคล",
            "pricePerSqm": 55000
          }
        ]
      },
      {
        "id": "7402",
        "name": "กระทุ่มแบน",
        "subdistricts": [
          {
            "id": "740201",
            "name": "ตลาดกระทุ่มแบน",
            "pricePerSqm": 55000
          },
          {
            "id": "740202",
            "name": "อ้อมน้อย",
            "pricePerSqm": 55000
          },
          {
            "id": "740203",
            "name": "ท่าไม้",
            "pricePerSqm": 55000
          },
          {
            "id": "740204",
            "name": "สวนหลวง",
            "pricePerSqm": 120000
          },
          {
            "id": "740205",
            "name": "บางยาง",
            "pricePerSqm": 55000
          },
          {
            "id": "740206",
            "name": "คลองมะเดื่อ",
            "pricePerSqm": 55000
          },
          {
            "id": "740207",
            "name": "หนองนกไข่",
            "pricePerSqm": 55000
          },
          {
            "id": "740208",
            "name": "ดอนไก่ดี",
            "pricePerSqm": 55000
          },
          {
            "id": "740209",
            "name": "แคราย",
            "pricePerSqm": 55000
          },
          {
            "id": "740210",
            "name": "ท่าเสา",
            "pricePerSqm": 55000
          }
        ]
      },
      {
        "id": "7403",
        "name": "บ้านแพ้ว",
        "subdistricts": [
          {
            "id": "740301",
            "name": "บ้านแพ้ว",
            "pricePerSqm": 55000
          },
          {
            "id": "740302",
            "name": "หลักสาม",
            "pricePerSqm": 55000
          },
          {
            "id": "740303",
            "name": "ยกกระบัตร",
            "pricePerSqm": 55000
          },
          {
            "id": "740304",
            "name": "โรงเข้",
            "pricePerSqm": 55000
          },
          {
            "id": "740305",
            "name": "หนองสองห้อง",
            "pricePerSqm": 55000
          },
          {
            "id": "740306",
            "name": "หนองบัว",
            "pricePerSqm": 55000
          },
          {
            "id": "740307",
            "name": "หลักสอง",
            "pricePerSqm": 85000
          },
          {
            "id": "740308",
            "name": "เจ็ดริ้ว",
            "pricePerSqm": 55000
          },
          {
            "id": "740309",
            "name": "คลองตัน",
            "pricePerSqm": 195000
          },
          {
            "id": "740310",
            "name": "อำแพง",
            "pricePerSqm": 55000
          },
          {
            "id": "740311",
            "name": "สวนส้ม",
            "pricePerSqm": 55000
          },
          {
            "id": "740312",
            "name": "เกษตรพัฒนา",
            "pricePerSqm": 55000
          }
        ]
      }
    ]
  }
];

export function findSubdistrict(subdistrictId: string): Subdistrict | undefined {
  for (const region of LOCATIONS) {
    for (const district of region.districts) {
      const found = district.subdistricts.find((s) => s.id === subdistrictId);
      if (found) return found;
    }
  }
  return undefined;
}

export function findDistrict(districtId: string): District | undefined {
  for (const region of LOCATIONS) {
    const found = region.districts.find((d) => d.id === districtId);
    if (found) return found;
  }
  return undefined;
}

export function findRegion(regionId: string): Region | undefined {
  return LOCATIONS.find((r) => r.id === regionId);
}

export interface LocationPath {
  region: Region;
  district: District;
  subdistrict: Subdistrict;
}

export function findLocationPath(subdistrictId: string): LocationPath | undefined {
  for (const region of LOCATIONS) {
    for (const district of region.districts) {
      const subdistrict = district.subdistricts.find((s) => s.id === subdistrictId);
      if (subdistrict) return { region, district, subdistrict };
    }
  }
  return undefined;
}
