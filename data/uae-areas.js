/* Source-attributed, non-exhaustive area reference. See docs/AREA-REFERENCE.md. */
(function(root){
const data = {
  "version": 1,
  "reviewedAt": "2026-11-01",
  "sources": {
    "dubai-mirror": {
      "url": "https://github.com/martaferreirahuspy/dubai-realestate-gis/blob/main/dubai_communities.geojson",
      "description": "Third-party snapshot attributed to Dubai Municipality, 222 communities; mirror source blob 562baec8f88f680b88ea3a7586f6ea28eba87020. Names/codes only, no geometry. Not certified as the latest official register.",
      "kind": "municipality-derived-mirror"
    },
    "abu-residents": {
      "url": "https://www.adro.gov.ae/Living-in-Abu-Dhabi/Where-To-Live",
      "kind": "government-page"
    },
    "abu-government": {
      "url": "https://u.ae/en/about-the-uae/the-seven-emirates/abu-dhabi",
      "kind": "government-page"
    },
    "sharjah-municipalities": {
      "url": "https://dma.shj.ae/ar/municipalities",
      "kind": "government-page"
    },
    "sharjah-councils": {
      "url": "https://sda.sharjah.ae/ar/deceased-affairs-follow-up/organize-condolence-service/organize-condolence-service.aspx",
      "kind": "government-page"
    },
    "sharjah-renaming": {
      "url": "https://www.sharjahnews.gov.ae/news/مسميات-وتقسيمات-إدارية-جديدة-لعدد-من-مناطق-ضاحيتي-السيوح-والرحمانية.-807",
      "kind": "government-announcement"
    },
    "ajman-statistics": {
      "url": "https://scc.ajman.ae/sites/default/files/publications/Ajman%20Statistical%20Report%202019%20Ar.pdf",
      "kind": "government-statistical-table"
    },
    "ajman-licenses": {
      "url": "https://data.ajman.ae/explore/dataset/license-in-ajman-area/table/?flg=ar-001",
      "kind": "government-open-data"
    },
    "ajman-government": {
      "url": "https://u.ae/ar/about-the-uae/the-seven-emirates/ajman",
      "kind": "government-page"
    },
    "rak-government": {
      "url": "https://www.rak.ae/wps/portal/rak/about/ras-al-khaimah/general-information",
      "kind": "government-page"
    },
    "uaq-addressing": {
      "url": "https://www.aletihad.ae/news/الإمارات/4141960/--تخطيط-أم-القيوين--تستكمل-عنونة-الشوارع-والمناطق",
      "kind": "reported-government-statement"
    },
    "uaq-plans": {
      "url": "https://www.aletihad.ae/article/27663/2018",
      "kind": "reported-government-statement"
    },
    "uaq-government": {
      "url": "https://uaqftz.gov.ae/ar/umm-al-quwain",
      "kind": "government-page"
    },
    "fuj-government": {
      "url": "https://u.ae/ar/about-the-uae/the-seven-emirates/Fujairah",
      "kind": "government-page"
    },
    "fuj-licenses": {
      "url": "https://rukhsati.fujmun.gov.ae/EServices/QZone/AdvertisementsTasks/AdvertisementsInquiry",
      "kind": "municipal-public-register"
    }
  },
  "emirates": [
    {
      "id": "dubai",
      "legacy": "Dubai",
      "ar": "دبي",
      "en": "Dubai"
    },
    {
      "id": "abu-dhabi",
      "legacy": "Abu Dhabi",
      "ar": "أبوظبي",
      "en": "Abu Dhabi"
    },
    {
      "id": "sharjah",
      "legacy": "Sharjah",
      "ar": "الشارقة",
      "en": "Sharjah"
    },
    {
      "id": "ajman",
      "legacy": "Ajman",
      "ar": "عجمان",
      "en": "Ajman"
    },
    {
      "id": "umm-al-quwain",
      "legacy": "Umm Al Quwain",
      "ar": "أم القيوين",
      "en": "Umm Al Quwain"
    },
    {
      "id": "ras-al-khaimah",
      "legacy": "Ras Al Khaimah",
      "ar": "رأس الخيمة",
      "en": "Ras Al Khaimah"
    },
    {
      "id": "fujairah",
      "legacy": "Fujairah",
      "ar": "الفجيرة",
      "en": "Fujairah"
    }
  ],
  "areas": [
    {
      "id": "dubai:369",
      "emirateId": "dubai",
      "ar": "القوز الصناعية الرابعة",
      "en": "Al Qouz Ind Fourth",
      "aliases": [
        "AL QOUZ IND.FOURTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "369"
    },
    {
      "id": "dubai:681",
      "emirateId": "dubai",
      "ar": "البرشاء جنوب الرابعة",
      "en": "Al Barsha South Fourth",
      "aliases": [
        "AL BARSHA SOUTH FOURTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "681"
    },
    {
      "id": "dubai:324",
      "emirateId": "dubai",
      "ar": "الكفاف",
      "en": "Al Kifaf",
      "aliases": [
        "AL KIFAF"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "324"
    },
    {
      "id": "dubai:231",
      "emirateId": "dubai",
      "ar": "النهدة الأولى",
      "en": "Al Nahda First",
      "aliases": [
        "AL NAHDA FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "231"
    },
    {
      "id": "dubai:221",
      "emirateId": "dubai",
      "ar": "مطار دبي الدولي",
      "en": "Dubai Int'l Airport",
      "aliases": [
        "DUBAI INT'L AIRPORT"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "221"
    },
    {
      "id": "dubai:367",
      "emirateId": "dubai",
      "ar": "أم الشيف",
      "en": "Umm al Sheif",
      "aliases": [
        "UMM AL SHEIF"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "367"
    },
    {
      "id": "dubai:956",
      "emirateId": "dubai",
      "ar": "الحثمة",
      "en": "Al Hathmah",
      "aliases": [
        "AL HATHMAH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "956"
    },
    {
      "id": "dubai:364",
      "emirateId": "dubai",
      "ar": "القوز الصناعية الأولى",
      "en": "Al Qouz Ind First",
      "aliases": [
        "AL QOUZ IND.FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "364"
    },
    {
      "id": "dubai:672",
      "emirateId": "dubai",
      "ar": "البرشاء جنوب الثانية",
      "en": "Al Barsha South Second",
      "aliases": [
        "AL BARSHA SOUTH SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "672"
    },
    {
      "id": "dubai:851",
      "emirateId": "dubai",
      "ar": "رماح",
      "en": "Remah",
      "aliases": [
        "REMAH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "851"
    },
    {
      "id": "dubai:614",
      "emirateId": "dubai",
      "ar": "رأس الخور الصناعية الثالثة",
      "en": "Ras al Khor Ind Third",
      "aliases": [
        "RAS AL KHOR IND. THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "614"
    },
    {
      "id": "dubai:975",
      "emirateId": "dubai",
      "ar": "العشوش",
      "en": "Al O'shoosh",
      "aliases": [
        "AL O'SHOOSH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "975"
    },
    {
      "id": "dubai:988",
      "emirateId": "dubai",
      "ar": "الليان 2",
      "en": "Al Layan 2",
      "aliases": [
        "AL LAYAN 2"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "988"
    },
    {
      "id": "dubai:241",
      "emirateId": "dubai",
      "ar": "النهدة الثانية",
      "en": "Al Nahda Second",
      "aliases": [
        "AL NAHDA SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "241"
    },
    {
      "id": "dubai:978",
      "emirateId": "dubai",
      "ar": "سيح شعيله",
      "en": "Saih Shua'alah",
      "aliases": [
        "SAIH SHUA'ALAH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "978"
    },
    {
      "id": "dubai:214",
      "emirateId": "dubai",
      "ar": "القرهود",
      "en": "Al Garhoud",
      "aliases": [
        "AL GARHOUD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "214"
    },
    {
      "id": "dubai:363",
      "emirateId": "dubai",
      "ar": "المنارة",
      "en": "Al Manara",
      "aliases": [
        "AL MANARA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "363"
    },
    {
      "id": "dubai:213",
      "emirateId": "dubai",
      "ar": "ند شما",
      "en": "Nadd Shamma",
      "aliases": [
        "NADD SHAMMA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "213"
    },
    {
      "id": "dubai:319",
      "emirateId": "dubai",
      "ar": "عود ميثاء",
      "en": "Oud Metha",
      "aliases": [
        "OUD METHA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "319"
    },
    {
      "id": "dubai:134",
      "emirateId": "dubai",
      "ar": "الممزر",
      "en": "Al Mamzar",
      "aliases": [
        "AL MAMZAR"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "134"
    },
    {
      "id": "dubai:721",
      "emirateId": "dubai",
      "ar": "العوير الثانية",
      "en": "Al Awir Second",
      "aliases": [
        "AL AWIR SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "721"
    },
    {
      "id": "dubai:311",
      "emirateId": "dubai",
      "ar": "الشندغة",
      "en": "Al Shindagha",
      "aliases": [
        "AL SHINDAGHA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "311"
    },
    {
      "id": "dubai:394",
      "emirateId": "dubai",
      "ar": "الثنيه الرابعة",
      "en": "Al Thanyah Fourth",
      "aliases": [
        "AL THANYAH  FOURTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "394"
    },
    {
      "id": "dubai:616",
      "emirateId": "dubai",
      "ar": "ند الشبا الثالثة",
      "en": "Nadd al Shiba Third",
      "aliases": [
        "NADD AL SHIBA THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "616"
    },
    {
      "id": "dubai:116",
      "emirateId": "dubai",
      "ar": "عيال ناصر",
      "en": "Ayal Nasir",
      "aliases": [
        "AYAL NASIR"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "116"
    },
    {
      "id": "dubai:811",
      "emirateId": "dubai",
      "ar": "ورسان الثالثة",
      "en": "Warsan Third",
      "aliases": [
        "WARSAN THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "811"
    },
    {
      "id": "dubai:232",
      "emirateId": "dubai",
      "ar": "القصيص الأولى",
      "en": "Al Qusais First",
      "aliases": [
        "AL QUSAIS FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "232"
    },
    {
      "id": "dubai:281",
      "emirateId": "dubai",
      "ar": "الخوانيج الأولى",
      "en": "Al Khwaneej First",
      "aliases": [
        "AL KHWANEEJ FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "281"
    },
    {
      "id": "dubai:246",
      "emirateId": "dubai",
      "ar": "القصيص الصناعية الثالثة",
      "en": "Al Qusais Ind Third",
      "aliases": [
        "AL QUSAIS IND. THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "246"
    },
    {
      "id": "dubai:262",
      "emirateId": "dubai",
      "ar": "المزهر الأولى",
      "en": "Al Mizhar First",
      "aliases": [
        "AL MIZHAR FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "262"
    },
    {
      "id": "dubai:591",
      "emirateId": "dubai",
      "ar": "جبل علي الأولى",
      "en": "Jabal Ali First",
      "aliases": [
        "JABAL ALI FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "591"
    },
    {
      "id": "dubai:711",
      "emirateId": "dubai",
      "ar": "العوير الأولى",
      "en": "Al Awir First",
      "aliases": [
        "AL AWIR FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "711"
    },
    {
      "id": "dubai:991",
      "emirateId": "dubai",
      "ar": "حفير",
      "en": "Hefair",
      "aliases": [
        "HEFAIR"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "991"
    },
    {
      "id": "dubai:392",
      "emirateId": "dubai",
      "ar": "مرسى دبي",
      "en": "Marsa Dubai",
      "aliases": [
        "MARSA DUBAI"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "392"
    },
    {
      "id": "dubai:981",
      "emirateId": "dubai",
      "ar": "مقطره",
      "en": "Mugatrah",
      "aliases": [
        "MUGATRAH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "981"
    },
    {
      "id": "dubai:914",
      "emirateId": "dubai",
      "ar": "مدينة هند 4",
      "en": "Madinat Hind 4",
      "aliases": [
        "MADINAT HIND 4"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "914"
    },
    {
      "id": "dubai:646",
      "emirateId": "dubai",
      "ar": "وادي الصفا 4",
      "en": "Wadi al Safa 4",
      "aliases": [
        "WADI AL SAFA 4"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "646"
    },
    {
      "id": "dubai:521",
      "emirateId": "dubai",
      "ar": "مدينة المطار",
      "en": "Madinat al Mataar",
      "aliases": [
        "MADINAT AL MATAAR"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "521"
    },
    {
      "id": "dubai:365",
      "emirateId": "dubai",
      "ar": "القوز الصناعية الثانية",
      "en": "Al Qouz Ind Second",
      "aliases": [
        "AL QOUZ IND.SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "365"
    },
    {
      "id": "dubai:215",
      "emirateId": "dubai",
      "ar": "أم رمول",
      "en": "Umm Ramool",
      "aliases": [
        "UMM RAMOOL"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "215"
    },
    {
      "id": "dubai:424",
      "emirateId": "dubai",
      "ar": "الورقاء الرابعة",
      "en": "Al Warqa'a Fourth",
      "aliases": [
        "AL WARQA'A FOURTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "424"
    },
    {
      "id": "dubai:283",
      "emirateId": "dubai",
      "ar": "العياص",
      "en": "Aleyas",
      "aliases": [
        "ALEYAS"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "283"
    },
    {
      "id": "dubai:114",
      "emirateId": "dubai",
      "ar": "البطين",
      "en": "Al Buteen",
      "aliases": [
        "AL BUTEEN"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "114"
    },
    {
      "id": "dubai:861",
      "emirateId": "dubai",
      "ar": "يراح",
      "en": "Yaraah",
      "aliases": [
        "YARAAH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "861"
    },
    {
      "id": "dubai:925",
      "emirateId": "dubai",
      "ar": "اليلايس 5",
      "en": "Al Yalayis 5",
      "aliases": [
        "AL YALAYIS 5"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "925"
    },
    {
      "id": "dubai:244",
      "emirateId": "dubai",
      "ar": "محيصنة الثالثة",
      "en": "Muhaisanah Third",
      "aliases": [
        "MUHAISANAH THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "244"
    },
    {
      "id": "dubai:267",
      "emirateId": "dubai",
      "ar": "محيصنة الخامسة",
      "en": "Muhaisanah Fifth",
      "aliases": [
        "MUHAISANAH FIFTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "267"
    },
    {
      "id": "dubai:615",
      "emirateId": "dubai",
      "ar": "ند الشبا الثانية",
      "en": "Nadd al Shiba Second",
      "aliases": [
        "NADD AL SHIBA SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "615"
    },
    {
      "id": "dubai:592",
      "emirateId": "dubai",
      "ar": "جبل علي الثانية",
      "en": "Jabal Ali Second",
      "aliases": [
        "JABAL ALI SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "592"
    },
    {
      "id": "dubai:261",
      "emirateId": "dubai",
      "ar": "محيصنة الأولى",
      "en": "Muhaisnah First",
      "aliases": [
        "MUHAISNAH FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "261"
    },
    {
      "id": "dubai:422",
      "emirateId": "dubai",
      "ar": "الورقاء الثانية",
      "en": "Al Warqa'a Second",
      "aliases": [
        "AL WARQA'A SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "422"
    },
    {
      "id": "dubai:129",
      "emirateId": "dubai",
      "ar": "بور سعيد",
      "en": "Port Saeed",
      "aliases": [
        "PORT SAEED"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "129"
    },
    {
      "id": "dubai:599",
      "emirateId": "dubai",
      "ar": "جبل علي الصناعية الأولى",
      "en": "Jabal Ali Industrial First",
      "aliases": [
        "JABAL ALI INDUSTRIAL FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "599"
    },
    {
      "id": "dubai:674",
      "emirateId": "dubai",
      "ar": "الحبيه الأولى",
      "en": "Al Hebiah First",
      "aliases": [
        "AL HEBIAH FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "674"
    },
    {
      "id": "dubai:271",
      "emirateId": "dubai",
      "ar": "وادي العمردي",
      "en": "Wadi Alamardi",
      "aliases": [
        "WADI ALAMARDI"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "271"
    },
    {
      "id": "dubai:665",
      "emirateId": "dubai",
      "ar": "وادي الصفا 7",
      "en": "Wadi al Safa 7",
      "aliases": [
        "WADI AL SAFA 7"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "665"
    },
    {
      "id": "dubai:333",
      "emirateId": "dubai",
      "ar": "البدع",
      "en": "Al Bada'",
      "aliases": [
        "AL BADA'"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "333"
    },
    {
      "id": "dubai:121",
      "emirateId": "dubai",
      "ar": "كورنيش ديره",
      "en": "Corniche Deira",
      "aliases": [
        "CORNICHE DEIRA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "121"
    },
    {
      "id": "dubai:358",
      "emirateId": "dubai",
      "ar": "القوز الثالثة",
      "en": "Al Qouz Third",
      "aliases": [
        "AL QOUZ THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "358"
    },
    {
      "id": "dubai:325",
      "emirateId": "dubai",
      "ar": "زعبيل الأولى",
      "en": "Zaa'beel First",
      "aliases": [
        "ZAA'BEEL FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "325"
    },
    {
      "id": "dubai:354",
      "emirateId": "dubai",
      "ar": "القوز الأولى",
      "en": "Al Qouz First",
      "aliases": [
        "AL QOUZ FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "354"
    },
    {
      "id": "dubai:686",
      "emirateId": "dubai",
      "ar": "معيصم الثانية",
      "en": "Me'aisem Second",
      "aliases": [
        "ME'AISEM SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "686"
    },
    {
      "id": "dubai:318",
      "emirateId": "dubai",
      "ar": "الكرامة",
      "en": "Al Karama",
      "aliases": [
        "AL KARAMA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "318"
    },
    {
      "id": "dubai:931",
      "emirateId": "dubai",
      "ar": "الليسيلي",
      "en": "Al Lesaily",
      "aliases": [
        "AL LESAILY"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "931"
    },
    {
      "id": "dubai:671",
      "emirateId": "dubai",
      "ar": "البرشاء جنوب الأولى",
      "en": "Al Barsha South First",
      "aliases": [
        "AL BARSHA SOUTH FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "671"
    },
    {
      "id": "dubai:421",
      "emirateId": "dubai",
      "ar": "الورقاء الأولى",
      "en": "Al Warqa'a First",
      "aliases": [
        "AL WARQA'A FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "421"
    },
    {
      "id": "dubai:282",
      "emirateId": "dubai",
      "ar": "الخوانيج الثانية",
      "en": "Al Khwaneej Second",
      "aliases": [
        "AL KHWANEEJ SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "282"
    },
    {
      "id": "dubai:373",
      "emirateId": "dubai",
      "ar": "البرشاء الأولى",
      "en": "Al Barsha First",
      "aliases": [
        "AL BARSHA FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "373"
    },
    {
      "id": "dubai:353",
      "emirateId": "dubai",
      "ar": "الصفا الأولى",
      "en": "Al Safa First",
      "aliases": [
        "AL SAFA FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "353"
    },
    {
      "id": "dubai:216",
      "emirateId": "dubai",
      "ar": "الراشدية",
      "en": "Al Rashidiya",
      "aliases": [
        "AL RASHIDIYA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "216"
    },
    {
      "id": "dubai:346",
      "emirateId": "dubai",
      "ar": "الخليج التجاري",
      "en": "Business Bay",
      "aliases": [
        "BUSINESS BAY"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "346"
    },
    {
      "id": "dubai:345",
      "emirateId": "dubai",
      "ar": "برج خليفة",
      "en": "Burj Khalifa",
      "aliases": [
        "BURJ KHALIFA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "345"
    },
    {
      "id": "dubai:265",
      "emirateId": "dubai",
      "ar": "عود المطينة الأولى",
      "en": "Oud al Muteena First",
      "aliases": [
        "OUD AL MUTEENA FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "265"
    },
    {
      "id": "dubai:648",
      "emirateId": "dubai",
      "ar": "وادي الصفا 5",
      "en": "Wadi al Safa 5",
      "aliases": [
        "WADI AL SAFA 5"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "648"
    },
    {
      "id": "dubai:423",
      "emirateId": "dubai",
      "ar": "الورقاء الثالثة",
      "en": "Al Warqa'a Third",
      "aliases": [
        "AL WARQA'A THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "423"
    },
    {
      "id": "dubai:415",
      "emirateId": "dubai",
      "ar": "الخيران الأولى",
      "en": "Al Kheeran First",
      "aliases": [
        "AL KHEERAN FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "415"
    },
    {
      "id": "dubai:618",
      "emirateId": "dubai",
      "ar": "ند الشبا الأولى",
      "en": "Nadd al Shiba First",
      "aliases": [
        "NADD AL SHIBA FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "618"
    },
    {
      "id": "dubai:917",
      "emirateId": "dubai",
      "ar": "المرموم",
      "en": "Al Marmoom",
      "aliases": [
        "AL MARMOOM"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "917"
    },
    {
      "id": "dubai:124",
      "emirateId": "dubai",
      "ar": "المرقبات",
      "en": "Al Muraqqabat",
      "aliases": [
        "AL MURAQQABAT"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "124"
    },
    {
      "id": "dubai:594",
      "emirateId": "dubai",
      "ar": "ميناء جبل علي",
      "en": "Mena Jabal Ali",
      "aliases": [
        "MENA JABAL ALI"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "594"
    },
    {
      "id": "dubai:593",
      "emirateId": "dubai",
      "ar": "جبل علي الثالثة",
      "en": "Jabal Ali Third",
      "aliases": [
        "JABAL ALI THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "593"
    },
    {
      "id": "dubai:951",
      "emirateId": "dubai",
      "ar": "سيح السلم",
      "en": "Saih al Salam",
      "aliases": [
        "SAIH AL SALAM"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "951"
    },
    {
      "id": "dubai:416",
      "emirateId": "dubai",
      "ar": "ند الحمر",
      "en": "Nadd al Hamar",
      "aliases": [
        "NADD AL HAMAR"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "416"
    },
    {
      "id": "dubai:845",
      "emirateId": "dubai",
      "ar": "المها",
      "en": "Al Maha",
      "aliases": [
        "AL MAHA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "845"
    },
    {
      "id": "dubai:376",
      "emirateId": "dubai",
      "ar": "البرشاء الثانية",
      "en": "Al Barsha Second",
      "aliases": [
        "AL BARSHA SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "376"
    },
    {
      "id": "dubai:967",
      "emirateId": "dubai",
      "ar": "غدير براشي",
      "en": "Ghadeer Barashy",
      "aliases": [
        "GHADEER BARASHY"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "967"
    },
    {
      "id": "dubai:128",
      "emirateId": "dubai",
      "ar": "الخبيصي",
      "en": "Al Khabaisi",
      "aliases": [
        "AL KHABAISI"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "128"
    },
    {
      "id": "dubai:987",
      "emirateId": "dubai",
      "ar": "الليان 1",
      "en": "Al Layan 1",
      "aliases": [
        "AL LAYAN 1"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "987"
    },
    {
      "id": "dubai:117",
      "emirateId": "dubai",
      "ar": "المرر",
      "en": "Al Murar",
      "aliases": [
        "AL MURAR"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "117"
    },
    {
      "id": "dubai:683",
      "emirateId": "dubai",
      "ar": "الحبيه الخامسة",
      "en": "Al Hebiah Fifth",
      "aliases": [
        "AL HEBIAH FIFTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "683"
    },
    {
      "id": "dubai:857",
      "emirateId": "dubai",
      "ar": "مرقب",
      "en": "Margab",
      "aliases": [
        "MARGAB"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "857"
    },
    {
      "id": "dubai:251",
      "emirateId": "dubai",
      "ar": "مردف",
      "en": "Mirdif",
      "aliases": [
        "MIRDIF"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "251"
    },
    {
      "id": "dubai:812",
      "emirateId": "dubai",
      "ar": "الرويه الأولى",
      "en": "Al Rowaiyah First",
      "aliases": [
        "AL ROWAIYAH FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "812"
    },
    {
      "id": "dubai:684",
      "emirateId": "dubai",
      "ar": "البرشاء جنوب الخامسة",
      "en": "Al Barsha South Fifth",
      "aliases": [
        "AL BARSHA SOUTH FIFTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "684"
    },
    {
      "id": "dubai:357",
      "emirateId": "dubai",
      "ar": "الصفا الثانية",
      "en": "Al Safa Second",
      "aliases": [
        "AL SAFA SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "357"
    },
    {
      "id": "dubai:685",
      "emirateId": "dubai",
      "ar": "معيصم الأولى",
      "en": "Me'aisem First",
      "aliases": [
        "ME'AISEM FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "685"
    },
    {
      "id": "dubai:336",
      "emirateId": "dubai",
      "ar": "المركز التجاري الثانية",
      "en": "Trade Center Second",
      "aliases": [
        "TRADE CENTER SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "336"
    },
    {
      "id": "dubai:941",
      "emirateId": "dubai",
      "ar": "قريطيسه",
      "en": "Grayteesah",
      "aliases": [
        "GRAYTEESAH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "941"
    },
    {
      "id": "dubai:532",
      "emirateId": "dubai",
      "ar": "سيح شعيب 3",
      "en": "Saih Shuaib 3",
      "aliases": [
        "SAIH SHUAIB 3"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "532"
    },
    {
      "id": "dubai:531",
      "emirateId": "dubai",
      "ar": "سيح شعيب 2",
      "en": "Saih Shuaib 2",
      "aliases": [
        "SAIH SHUAIB 2"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "531"
    },
    {
      "id": "dubai:119",
      "emirateId": "dubai",
      "ar": "الرقة",
      "en": "Al Rigga",
      "aliases": [
        "AL RIGGA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "119"
    },
    {
      "id": "dubai:115",
      "emirateId": "dubai",
      "ar": "السبخة",
      "en": "Al Sabkha",
      "aliases": [
        "AL SABKHA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "115"
    },
    {
      "id": "dubai:335",
      "emirateId": "dubai",
      "ar": "المركز التجاري الأولى",
      "en": "Trade Center First",
      "aliases": [
        "TRADE CENTER FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "335"
    },
    {
      "id": "dubai:334",
      "emirateId": "dubai",
      "ar": "السطوة",
      "en": "Al Satwa",
      "aliases": [
        "AL SATWA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "334"
    },
    {
      "id": "dubai:626",
      "emirateId": "dubai",
      "ar": "ند حصه",
      "en": "Nadd Hessa",
      "aliases": [
        "NADD HESSA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "626"
    },
    {
      "id": "dubai:315",
      "emirateId": "dubai",
      "ar": "أم هرير الثانية",
      "en": "Umm Hurair Second",
      "aliases": [
        "UMM HURAIR SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "315"
    },
    {
      "id": "dubai:317",
      "emirateId": "dubai",
      "ar": "منخول",
      "en": "Mankhool",
      "aliases": [
        "MANKHOOL"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "317"
    },
    {
      "id": "dubai:263",
      "emirateId": "dubai",
      "ar": "المزهر الثانية",
      "en": "Al Mizhar Second",
      "aliases": [
        "AL MIZHAR SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "263"
    },
    {
      "id": "dubai:735",
      "emirateId": "dubai",
      "ar": "المريال",
      "en": "Al Meryal",
      "aliases": [
        "AL MERYAL"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "735"
    },
    {
      "id": "dubai:513",
      "emirateId": "dubai",
      "ar": "سيح شعيب 1",
      "en": "Saih Shuaib 1",
      "aliases": [
        "SAIH SHUAIB 1"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "513"
    },
    {
      "id": "dubai:352",
      "emirateId": "dubai",
      "ar": "جميرا الثالثة",
      "en": "Jumeira Third",
      "aliases": [
        "JUMEIRA THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "352"
    },
    {
      "id": "dubai:347",
      "emirateId": "dubai",
      "ar": "المركاض",
      "en": "Al Merkadh",
      "aliases": [
        "AL MERKADH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "347"
    },
    {
      "id": "dubai:268",
      "emirateId": "dubai",
      "ar": "عود المطينة الثانية",
      "en": "Oud al Muteena Second",
      "aliases": [
        "OUD AL MUTEENA SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "268"
    },
    {
      "id": "dubai:228",
      "emirateId": "dubai",
      "ar": "الطوار الثالثة",
      "en": "Al Twar Third",
      "aliases": [
        "AL TWAR THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "228"
    },
    {
      "id": "dubai:234",
      "emirateId": "dubai",
      "ar": "الطوار الرابعة",
      "en": "Al Twar Fourth",
      "aliases": [
        "AL TWAR FOURTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "234"
    },
    {
      "id": "dubai:922",
      "emirateId": "dubai",
      "ar": "اليلايس 2",
      "en": "Al Yalayis 2",
      "aliases": [
        "AL YALAYIS 2"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "922"
    },
    {
      "id": "dubai:622",
      "emirateId": "dubai",
      "ar": "ورسان الثانية",
      "en": "Warsan Second",
      "aliases": [
        "WARSAN SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "622"
    },
    {
      "id": "dubai:242",
      "emirateId": "dubai",
      "ar": "القصيص الصناعية الأولى",
      "en": "Al Qusais Ind First",
      "aliases": [
        "AL QUSAIS IND. FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "242"
    },
    {
      "id": "dubai:382",
      "emirateId": "dubai",
      "ar": "الصفوح الثانية",
      "en": "Al Safouh Second",
      "aliases": [
        "AL SAFOUH SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "382"
    },
    {
      "id": "dubai:133",
      "emirateId": "dubai",
      "ar": "هور العنز شرق",
      "en": "Hor al Anz East",
      "aliases": [
        "HOR AL ANZ EAST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "133"
    },
    {
      "id": "dubai:111",
      "emirateId": "dubai",
      "ar": "الكورنيش",
      "en": "Al Corniche",
      "aliases": [
        "AL CORNICHE"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "111"
    },
    {
      "id": "dubai:891",
      "emirateId": "dubai",
      "ar": "حتا",
      "en": "Hatta",
      "aliases": [
        "HATTA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "891"
    },
    {
      "id": "dubai:366",
      "emirateId": "dubai",
      "ar": "أم سقيم الثالثة",
      "en": "Umm Suqeim Third",
      "aliases": [
        "UMM SUQEIM THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "366"
    },
    {
      "id": "dubai:372",
      "emirateId": "dubai",
      "ar": "الصفوح الأولى",
      "en": "Al Safouh First",
      "aliases": [
        "AL SAFOUH FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "372"
    },
    {
      "id": "dubai:412",
      "emirateId": "dubai",
      "ar": "الخيران",
      "en": "Al Kheeran",
      "aliases": [
        "AL KHEERAN"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "412"
    },
    {
      "id": "dubai:266",
      "emirateId": "dubai",
      "ar": "المزهر الثالثة",
      "en": "Al Mizhar Third",
      "aliases": [
        "AL MIZHAR THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "266"
    },
    {
      "id": "dubai:631",
      "emirateId": "dubai",
      "ar": "حدائق الشيخ محمد بن راشد",
      "en": "Hadaeq Sheikh Mohammed bin Rashid",
      "aliases": [
        "HADAEQ SHEIKH MOHAMMED BIN RASHID"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "631"
    },
    {
      "id": "dubai:919",
      "emirateId": "dubai",
      "ar": "اليفره 2",
      "en": "Al Yufrah 2",
      "aliases": [
        "AL YUFRAH 2"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "919"
    },
    {
      "id": "dubai:313",
      "emirateId": "dubai",
      "ar": "الحمرية",
      "en": "Al Hamriya",
      "aliases": [
        "AL HAMRIYA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "313"
    },
    {
      "id": "dubai:621",
      "emirateId": "dubai",
      "ar": "ورسان الأولى",
      "en": "Warsan First",
      "aliases": [
        "WARSAN FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "621"
    },
    {
      "id": "dubai:826",
      "emirateId": "dubai",
      "ar": "الحميرا",
      "en": "Le Hemaira",
      "aliases": [
        "LE HEMAIRA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "826"
    },
    {
      "id": "dubai:533",
      "emirateId": "dubai",
      "ar": "سيح شعيب 4",
      "en": "Saih Shuaib 4",
      "aliases": [
        "SAIH SHUAIB 4"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "533"
    },
    {
      "id": "dubai:682",
      "emirateId": "dubai",
      "ar": "الحبيه الرابعة",
      "en": "Al Hebiah Fourth",
      "aliases": [
        "AL HEBIAH FOURTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "682"
    },
    {
      "id": "dubai:388",
      "emirateId": "dubai",
      "ar": "الثنيه الثالثة",
      "en": "Al Thanyah Third",
      "aliases": [
        "AL THANYAH THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "388"
    },
    {
      "id": "dubai:393",
      "emirateId": "dubai",
      "ar": "الثنيه الخامسة",
      "en": "Al Thanyah Fifth",
      "aliases": [
        "AL THANYAH FIFTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "393"
    },
    {
      "id": "dubai:384",
      "emirateId": "dubai",
      "ar": "الثنيه الثانية",
      "en": "Al Thanyah Second",
      "aliases": [
        "AL THANYAH SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "384"
    },
    {
      "id": "dubai:362",
      "emirateId": "dubai",
      "ar": "أم سقيم الثانية",
      "en": "Umm Suqeim Second",
      "aliases": [
        "UMM SUQEIM SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "362"
    },
    {
      "id": "dubai:337",
      "emirateId": "dubai",
      "ar": "زعبيل الثانية",
      "en": "Zaa'beel Second",
      "aliases": [
        "ZAA'BEEL SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "337"
    },
    {
      "id": "dubai:343",
      "emirateId": "dubai",
      "ar": "الوصل",
      "en": "Al Wasl",
      "aliases": [
        "AL WASL"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "343"
    },
    {
      "id": "dubai:122",
      "emirateId": "dubai",
      "ar": "البراحة",
      "en": "Al Baraha",
      "aliases": [
        "AL BARAHA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "122"
    },
    {
      "id": "dubai:127",
      "emirateId": "dubai",
      "ar": "هور العنز",
      "en": "Hor al Anz",
      "aliases": [
        "HOR AL ANZ"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "127"
    },
    {
      "id": "dubai:835",
      "emirateId": "dubai",
      "ar": "أم المؤمنين",
      "en": "Umm al Mo'meneen",
      "aliases": [
        "UMM AL MO'MENEEN"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "835"
    },
    {
      "id": "dubai:132",
      "emirateId": "dubai",
      "ar": "الوحيدة",
      "en": "Al Wuheida",
      "aliases": [
        "AL WUHEIDA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "132"
    },
    {
      "id": "dubai:247",
      "emirateId": "dubai",
      "ar": "القصيص الصناعية الرابعة",
      "en": "Al Qusais Ind Fourth",
      "aliases": [
        "AL QUSAIS IND. FOURTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "247"
    },
    {
      "id": "dubai:248",
      "emirateId": "dubai",
      "ar": "القصيص الصناعية الخامسة",
      "en": "Al Qusais Ind Fifth",
      "aliases": [
        "AL QUSAIS IND. FIFTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "248"
    },
    {
      "id": "dubai:518",
      "emirateId": "dubai",
      "ar": "جبل علي الصناعية الثانية",
      "en": "Jabal Ali Industrial Second",
      "aliases": [
        "JABAL ALI INDUSTRIAL SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "518"
    },
    {
      "id": "dubai:676",
      "emirateId": "dubai",
      "ar": "الحبيه الثالثة",
      "en": "Al Hebiah Third",
      "aliases": [
        "AL HEBIAH THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "676"
    },
    {
      "id": "dubai:413",
      "emirateId": "dubai",
      "ar": "راس الخور",
      "en": "Ras al Khor",
      "aliases": [
        "RAS AL KHOR"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "413"
    },
    {
      "id": "dubai:227",
      "emirateId": "dubai",
      "ar": "الطوار الثانية",
      "en": "Al Twar Second",
      "aliases": [
        "AL TWAR SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "227"
    },
    {
      "id": "dubai:322",
      "emirateId": "dubai",
      "ar": "الحضيبة",
      "en": "Al Hudaiba",
      "aliases": [
        "AL HUDAIBA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "322"
    },
    {
      "id": "dubai:375",
      "emirateId": "dubai",
      "ar": "البرشاء الثالثة",
      "en": "Al Barsha Third",
      "aliases": [
        "AL BARSHA THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "375"
    },
    {
      "id": "dubai:123",
      "emirateId": "dubai",
      "ar": "المطينة",
      "en": "Al Muteena",
      "aliases": [
        "AL MUTEENA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "123"
    },
    {
      "id": "dubai:847",
      "emirateId": "dubai",
      "ar": "أم السلي",
      "en": "Umm Eselay",
      "aliases": [
        "UMM ESELAY"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "847"
    },
    {
      "id": "dubai:118",
      "emirateId": "dubai",
      "ar": "نايف",
      "en": "Naif",
      "aliases": [
        "NAIF"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "118"
    },
    {
      "id": "dubai:597",
      "emirateId": "dubai",
      "ar": "مجمع دبي للاستثمار الثاني",
      "en": "Dubai Investment Park Second",
      "aliases": [
        "DUBAI INVESTMENT PARK SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "597"
    },
    {
      "id": "dubai:813",
      "emirateId": "dubai",
      "ar": "الرويه الثانية",
      "en": "Al Rowaiyah Second",
      "aliases": [
        "AL ROWAIYAH SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "813"
    },
    {
      "id": "dubai:924",
      "emirateId": "dubai",
      "ar": "اليلايس 4",
      "en": "Al Yalayis 4",
      "aliases": [
        "AL YALAYIS 4"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "924"
    },
    {
      "id": "dubai:675",
      "emirateId": "dubai",
      "ar": "الحبيه الثانية",
      "en": "Al Hebiah Second",
      "aliases": [
        "AL HEBIAH SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "675"
    },
    {
      "id": "dubai:611",
      "emirateId": "dubai",
      "ar": "بو كدرة",
      "en": "Bu Kadra",
      "aliases": [
        "BU KADRA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "611"
    },
    {
      "id": "dubai:612",
      "emirateId": "dubai",
      "ar": "رأس الخور الصناعية الأولى",
      "en": "Ras al Khor Ind First",
      "aliases": [
        "RAS AL KHOR IND. FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "612"
    },
    {
      "id": "dubai:736",
      "emirateId": "dubai",
      "ar": "نزوه",
      "en": "Nazwah",
      "aliases": [
        "NAZWAH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "736"
    },
    {
      "id": "dubai:314",
      "emirateId": "dubai",
      "ar": "أم هرير الأولى",
      "en": "Umm Hurair First",
      "aliases": [
        "UMM HURAIR FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "314"
    },
    {
      "id": "dubai:921",
      "emirateId": "dubai",
      "ar": "اليلايس 1",
      "en": "Al Yalayis 1",
      "aliases": [
        "AL YALAYIS 1"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "921"
    },
    {
      "id": "dubai:302",
      "emirateId": "dubai",
      "ar": "جميرا باي",
      "en": "Jumeira Bay",
      "aliases": [
        "JUMEIRA BAY"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "302"
    },
    {
      "id": "dubai:814",
      "emirateId": "dubai",
      "ar": "الرويه الثالثة",
      "en": "Al Rowaiyah Third",
      "aliases": [
        "AL ROWAIYAH THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "814"
    },
    {
      "id": "dubai:821",
      "emirateId": "dubai",
      "ar": "مرييل",
      "en": "Mereiyeel",
      "aliases": [
        "MEREIYEEL"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "821"
    },
    {
      "id": "dubai:113",
      "emirateId": "dubai",
      "ar": "الضغاية",
      "en": "Al Daghaya",
      "aliases": [
        "AL DAGHAYA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "113"
    },
    {
      "id": "dubai:645",
      "emirateId": "dubai",
      "ar": "وادي الصفا 3",
      "en": "Wadi al Safa 3",
      "aliases": [
        "WADI AL SAFA 3"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "645"
    },
    {
      "id": "dubai:911",
      "emirateId": "dubai",
      "ar": "مدينة هند 1",
      "en": "Madinat Hind 1",
      "aliases": [
        "MADINAT HIND 1"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "911"
    },
    {
      "id": "dubai:511",
      "emirateId": "dubai",
      "ar": "حصيان الأولى",
      "en": "Hessyan First",
      "aliases": [
        "HESSYAN FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "511"
    },
    {
      "id": "dubai:321",
      "emirateId": "dubai",
      "ar": "مدينة دبي الملاحية",
      "en": "Madinat Dubai al Melaheyah",
      "aliases": [
        "MADINAT DUBAI AL MELAHEYAH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "321"
    },
    {
      "id": "dubai:613",
      "emirateId": "dubai",
      "ar": "رأس الخور الصناعية الثانية",
      "en": "Ras al Khor Ind Second",
      "aliases": [
        "RAS AL KHOR IND. SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "613"
    },
    {
      "id": "dubai:431",
      "emirateId": "dubai",
      "ar": "وادي الشبك",
      "en": "Wadi Alshabak",
      "aliases": [
        "WADI ALSHABAK"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "431"
    },
    {
      "id": "dubai:226",
      "emirateId": "dubai",
      "ar": "الطوار الأولى",
      "en": "Al Twar First",
      "aliases": [
        "AL TWAR FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "226"
    },
    {
      "id": "dubai:945",
      "emirateId": "dubai",
      "ar": "الفقع",
      "en": "Al Fagaa",
      "aliases": [
        "AL FAGAA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "945"
    },
    {
      "id": "dubai:673",
      "emirateId": "dubai",
      "ar": "البرشاء جنوب الثالثة",
      "en": "Al Barsha South Third",
      "aliases": [
        "AL BARSHA SOUTH THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "673"
    },
    {
      "id": "dubai:252",
      "emirateId": "dubai",
      "ar": "مشرف",
      "en": "Mushraif",
      "aliases": [
        "MUSHRAIF"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "252"
    },
    {
      "id": "dubai:841",
      "emirateId": "dubai",
      "ar": "مرغم",
      "en": "Margham",
      "aliases": [
        "MARGHAM"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "841"
    },
    {
      "id": "dubai:731",
      "emirateId": "dubai",
      "ar": "لهباب الأولى",
      "en": "Lehbab First",
      "aliases": [
        "LEHBAB FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "731"
    },
    {
      "id": "dubai:245",
      "emirateId": "dubai",
      "ar": "محيصنة الرابعة",
      "en": "Muhaisanah Fourth",
      "aliases": [
        "MUHAISANAH FOURTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "245"
    },
    {
      "id": "dubai:316",
      "emirateId": "dubai",
      "ar": "الرفاعة",
      "en": "Al Raffa",
      "aliases": [
        "AL RAFFA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "316"
    },
    {
      "id": "dubai:112",
      "emirateId": "dubai",
      "ar": "الراس",
      "en": "Al Ras",
      "aliases": [
        "AL RAS"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "112"
    },
    {
      "id": "dubai:233",
      "emirateId": "dubai",
      "ar": "القصيص الثانية",
      "en": "Al Qusais Second",
      "aliases": [
        "AL QUSAIS SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "233"
    },
    {
      "id": "dubai:323",
      "emirateId": "dubai",
      "ar": "الجافلية",
      "en": "Al Jafiliya",
      "aliases": [
        "AL JAFILIYA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "323"
    },
    {
      "id": "dubai:359",
      "emirateId": "dubai",
      "ar": "القوز الرابعة",
      "en": "Al Qouz Fourth",
      "aliases": [
        "AL QOUZ FOURTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "359"
    },
    {
      "id": "dubai:664",
      "emirateId": "dubai",
      "ar": "وادي الصفا 6",
      "en": "Wadi al Safa 6",
      "aliases": [
        "WADI AL SAFA 6"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "664"
    },
    {
      "id": "dubai:824",
      "emirateId": "dubai",
      "ar": "أم الدمن",
      "en": "Umm al Daman",
      "aliases": [
        "UMM AL DAMAN"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "824"
    },
    {
      "id": "dubai:923",
      "emirateId": "dubai",
      "ar": "اليلايس 3",
      "en": "Al Yalayis 3",
      "aliases": [
        "AL YALAYIS 3"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "923"
    },
    {
      "id": "dubai:831",
      "emirateId": "dubai",
      "ar": "لهباب الثانية",
      "en": "Lehbab Second",
      "aliases": [
        "LEHBAB SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "831"
    },
    {
      "id": "dubai:284",
      "emirateId": "dubai",
      "ar": "الطي",
      "en": "Al Ttay",
      "aliases": [
        "AL TTAY"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "284"
    },
    {
      "id": "dubai:961",
      "emirateId": "dubai",
      "ar": "مدينة لطيفة",
      "en": "Madinat Latifa",
      "aliases": [
        "MADINAT LATIFA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "961"
    },
    {
      "id": "dubai:355",
      "emirateId": "dubai",
      "ar": "غدير الطير",
      "en": "Ghadeer al Tair",
      "aliases": [
        "GHADEER AL TAIR"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "355"
    },
    {
      "id": "dubai:342",
      "emirateId": "dubai",
      "ar": "جميرا الثانية",
      "en": "Jumeira Second",
      "aliases": [
        "JUMEIRA SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "342"
    },
    {
      "id": "dubai:125",
      "emirateId": "dubai",
      "ar": "رقة البطين",
      "en": "Riggat al Buteen",
      "aliases": [
        "RIGGAT AL BUTEEN"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "125"
    },
    {
      "id": "dubai:381",
      "emirateId": "dubai",
      "ar": "نخلة جميرا",
      "en": "Nakhlat Jumeira",
      "aliases": [
        "NAKHLAT JUMEIRA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "381"
    },
    {
      "id": "dubai:304",
      "emirateId": "dubai",
      "ar": "جزيرة جميرا الثانية",
      "en": "Jumeira Island 2",
      "aliases": [
        "JUMEIRA ISLAND 2"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "304"
    },
    {
      "id": "dubai:915",
      "emirateId": "dubai",
      "ar": "اليفره 1",
      "en": "Al Yufrah 1",
      "aliases": [
        "AL YUFRAH 1"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "915"
    },
    {
      "id": "dubai:425",
      "emirateId": "dubai",
      "ar": "الورقاء الخامسة",
      "en": "Al Warqa'a Fifth",
      "aliases": [
        "AL WARQA'A FIFTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "425"
    },
    {
      "id": "dubai:383",
      "emirateId": "dubai",
      "ar": "الثنيه الأولى",
      "en": "Al Thanyah First",
      "aliases": [
        "AL THANYAH FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "383"
    },
    {
      "id": "dubai:913",
      "emirateId": "dubai",
      "ar": "مدينة هند 3",
      "en": "Madinat Hind 3",
      "aliases": [
        "MADINAT HIND 3"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "913"
    },
    {
      "id": "dubai:101",
      "emirateId": "dubai",
      "ar": "نخلة ديره",
      "en": "Nakhlat Deira",
      "aliases": [
        "NAKHLAT DEIRA"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "101"
    },
    {
      "id": "dubai:332",
      "emirateId": "dubai",
      "ar": "جميرا الأولى",
      "en": "Jumeira First",
      "aliases": [
        "JUMEIRA FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "332"
    },
    {
      "id": "dubai:912",
      "emirateId": "dubai",
      "ar": "مدينة هند 2",
      "en": "Madinat Hind 2",
      "aliases": [
        "MADINAT HIND 2"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "912"
    },
    {
      "id": "dubai:326",
      "emirateId": "dubai",
      "ar": "الجداف",
      "en": "Al Jadaf",
      "aliases": [
        "AL JADAF"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "326"
    },
    {
      "id": "dubai:368",
      "emirateId": "dubai",
      "ar": "القوز الصناعية الثالثة",
      "en": "Al Qouz Ind Third",
      "aliases": [
        "AL QOUZ IND.THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "368"
    },
    {
      "id": "dubai:264",
      "emirateId": "dubai",
      "ar": "محيصنة الثانية",
      "en": "Muhaisanah Second",
      "aliases": [
        "MUHAISANAH SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "264"
    },
    {
      "id": "dubai:971",
      "emirateId": "dubai",
      "ar": "سيح الدحل",
      "en": "Saih al Dahal",
      "aliases": [
        "SAIH AL DAHAL"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "971"
    },
    {
      "id": "dubai:727",
      "emirateId": "dubai",
      "ar": "الوحوش",
      "en": "Al Wohoosh",
      "aliases": [
        "AL WOHOOSH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "727"
    },
    {
      "id": "dubai:677",
      "emirateId": "dubai",
      "ar": "الحبيه السادسة",
      "en": "Al Hebiah Sixth",
      "aliases": [
        "AL HEBIAH SIXTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "677"
    },
    {
      "id": "dubai:724",
      "emirateId": "dubai",
      "ar": "نخلي",
      "en": "Enkhali",
      "aliases": [
        "ENKHALI"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "724"
    },
    {
      "id": "dubai:643",
      "emirateId": "dubai",
      "ar": "وادي الصفا 2",
      "en": "Wadi al Safa 2",
      "aliases": [
        "WADI AL SAFA 2"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "643"
    },
    {
      "id": "dubai:303",
      "emirateId": "dubai",
      "ar": "جزر العالم",
      "en": "World Islands",
      "aliases": [
        "WORLD ISLANDS"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "303"
    },
    {
      "id": "dubai:312",
      "emirateId": "dubai",
      "ar": "السوق الكبير",
      "en": "Al Souq al Kabeer",
      "aliases": [
        "AL SOUQ AL KABEER"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "312"
    },
    {
      "id": "dubai:131",
      "emirateId": "dubai",
      "ar": "ميناء الحمرية",
      "en": "Al Hamriya Port",
      "aliases": [
        "AL HAMRIYA PORT"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "131"
    },
    {
      "id": "dubai:516",
      "emirateId": "dubai",
      "ar": "جبل علي الصناعية الثالثة",
      "en": "Jabal Ali Industrial Third",
      "aliases": [
        "JABAL ALI INDUSTRIAL THIRD"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "516"
    },
    {
      "id": "dubai:356",
      "emirateId": "dubai",
      "ar": "أم سقيم الأولى",
      "en": "Umm Suqeim First",
      "aliases": [
        "UMM SUQEIM FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "356"
    },
    {
      "id": "dubai:598",
      "emirateId": "dubai",
      "ar": "مجمع دبي للاستثمار الأول",
      "en": "Dubai Investment Park First",
      "aliases": [
        "DUBAI INVESTMENT PARK FIRST"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "598"
    },
    {
      "id": "dubai:617",
      "emirateId": "dubai",
      "ar": "ند الشبا الرابعة",
      "en": "Nadd al Shiba Fourth",
      "aliases": [
        "NADD AL SHIBA FOURTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "617"
    },
    {
      "id": "dubai:624",
      "emirateId": "dubai",
      "ar": "ورسان الرابعة",
      "en": "Warsan Fourth",
      "aliases": [
        "WARSAN FOURTH"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "624"
    },
    {
      "id": "dubai:512",
      "emirateId": "dubai",
      "ar": "حصيان الثانية",
      "en": "Hessyan Second",
      "aliases": [
        "HESSYAN SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "512"
    },
    {
      "id": "dubai:126",
      "emirateId": "dubai",
      "ar": "أبو هيل",
      "en": "Abu Hail",
      "aliases": [
        "ABU HAIL"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "126"
    },
    {
      "id": "dubai:243",
      "emirateId": "dubai",
      "ar": "القصيص الصناعية الثانية",
      "en": "Al Qusais Ind Second",
      "aliases": [
        "AL QUSAIS IND. SECOND"
      ],
      "sourceId": "dubai-mirror",
      "sourceCode": "243"
    },
    {
      "id": "abu-dhabi:3d7e67ab655e85",
      "emirateId": "abu-dhabi",
      "ar": "مدينة خليفة",
      "en": "Khalifa City",
      "aliases": [],
      "sourceId": "abu-residents",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:347dab483c42b0",
      "emirateId": "abu-dhabi",
      "ar": "مدينة شخبوط",
      "en": "Shakhbout City",
      "aliases": [],
      "sourceId": "abu-residents",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:079867dd7428f2",
      "emirateId": "abu-dhabi",
      "ar": "مدينة محمد بن زايد",
      "en": "Mohammed Bin Zayed City",
      "aliases": [],
      "sourceId": "abu-residents",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:be76043e683c75",
      "emirateId": "abu-dhabi",
      "ar": "جزيرة ياس",
      "en": "Yas Island",
      "aliases": [],
      "sourceId": "abu-residents",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:d1c97d69e7c6a7",
      "emirateId": "abu-dhabi",
      "ar": "جزيرة السعديات",
      "en": "Saadiyat Island",
      "aliases": [],
      "sourceId": "abu-residents",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:0e7fd2164d6adb",
      "emirateId": "abu-dhabi",
      "ar": "المشرف",
      "en": "Al Mushrif",
      "aliases": [],
      "sourceId": "abu-residents",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:56e527fe057554",
      "emirateId": "abu-dhabi",
      "ar": "الخالدية",
      "en": "Al Khalidiyah",
      "aliases": [],
      "sourceId": "abu-residents",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:4fe51df3e38b67",
      "emirateId": "abu-dhabi",
      "ar": "جزيرة الريم",
      "en": "Al Reem Island",
      "aliases": [],
      "sourceId": "abu-residents",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:721634508efce8",
      "emirateId": "abu-dhabi",
      "ar": "الريف",
      "en": "Al Reef",
      "aliases": [],
      "sourceId": "abu-residents",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:8e32c06d0a27dc",
      "emirateId": "abu-dhabi",
      "ar": "شاطئ الراحة",
      "en": "Al Raha Beach",
      "aliases": [],
      "sourceId": "abu-residents",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:3b95de02d68b9e",
      "emirateId": "abu-dhabi",
      "ar": "البندر",
      "en": "Al Bandar",
      "aliases": [],
      "sourceId": "abu-residents",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:5e9288551d9d6e",
      "emirateId": "abu-dhabi",
      "ar": "الزينة",
      "en": "Al Zeina",
      "aliases": [],
      "sourceId": "abu-residents",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:d87913ac5f6235",
      "emirateId": "abu-dhabi",
      "ar": "المنيرة",
      "en": "Al Muneera",
      "aliases": [],
      "sourceId": "abu-residents",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:e1aa5ed596c881",
      "emirateId": "abu-dhabi",
      "ar": "الكورنيش",
      "en": "Corniche Area",
      "aliases": [],
      "sourceId": "abu-residents",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:d5f37289224de4",
      "emirateId": "abu-dhabi",
      "ar": "الرأس الأخضر",
      "en": "Al Ras Al Akhdar",
      "aliases": [],
      "sourceId": "abu-residents",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:9d9ac4f6197bba",
      "emirateId": "abu-dhabi",
      "ar": "جزيرة الجبيل",
      "en": "Jubail Island",
      "aliases": [],
      "sourceId": "abu-residents",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:f61a89970fa1b1",
      "emirateId": "abu-dhabi",
      "ar": "أبوظبي",
      "en": "Abu Dhabi",
      "aliases": [],
      "sourceId": "abu-government",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:2600f9a6a4dfbc",
      "emirateId": "abu-dhabi",
      "ar": "العين",
      "en": "Al Ain",
      "aliases": [],
      "sourceId": "abu-government",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:aeba2e274ea06e",
      "emirateId": "abu-dhabi",
      "ar": "الظفرة",
      "en": "Al Dhafra",
      "aliases": [],
      "sourceId": "abu-government",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:028e92e7baae83",
      "emirateId": "abu-dhabi",
      "ar": "ليوا",
      "en": "Liwa",
      "aliases": [],
      "sourceId": "abu-government",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:866feef77af8a9",
      "emirateId": "abu-dhabi",
      "ar": "مدينة زايد",
      "en": "Madinat Zayed",
      "aliases": [],
      "sourceId": "abu-government",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:5429692e05e08e",
      "emirateId": "abu-dhabi",
      "ar": "غياثي",
      "en": "Ghayathi",
      "aliases": [],
      "sourceId": "abu-government",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:1030578beec2d5",
      "emirateId": "abu-dhabi",
      "ar": "الرويس",
      "en": "Ruwais",
      "aliases": [],
      "sourceId": "abu-government",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:b81a52048bf252",
      "emirateId": "abu-dhabi",
      "ar": "المرفأ",
      "en": "Mirfa",
      "aliases": [],
      "sourceId": "abu-government",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:8bfcbd7086a061",
      "emirateId": "abu-dhabi",
      "ar": "السلع",
      "en": "Sila",
      "aliases": [],
      "sourceId": "abu-government",
      "sourceCode": null
    },
    {
      "id": "abu-dhabi:9d035ec0c2fcaf",
      "emirateId": "abu-dhabi",
      "ar": "جزيرة دلما",
      "en": "Delma Island",
      "aliases": [],
      "sourceId": "abu-government",
      "sourceCode": null
    },
    {
      "id": "sharjah:fb353cd263d585",
      "emirateId": "sharjah",
      "ar": "مدينة الشارقة",
      "en": "Sharjah City",
      "aliases": [],
      "sourceId": "sharjah-municipalities",
      "sourceCode": null
    },
    {
      "id": "sharjah:c4bdb3886b3f82",
      "emirateId": "sharjah",
      "ar": "خورفكان",
      "en": "Khor Fakkan",
      "aliases": [],
      "sourceId": "sharjah-municipalities",
      "sourceCode": null
    },
    {
      "id": "sharjah:4f88ecb6efd7eb",
      "emirateId": "sharjah",
      "ar": "الذيد",
      "en": "Al Dhaid",
      "aliases": [],
      "sourceId": "sharjah-municipalities",
      "sourceCode": null
    },
    {
      "id": "sharjah:741f712b851857",
      "emirateId": "sharjah",
      "ar": "مليحة",
      "en": "Mleiha",
      "aliases": [],
      "sourceId": "sharjah-municipalities",
      "sourceCode": null
    },
    {
      "id": "sharjah:a3401315fe31e3",
      "emirateId": "sharjah",
      "ar": "البطائح",
      "en": "Al Bataeh",
      "aliases": [],
      "sourceId": "sharjah-municipalities",
      "sourceCode": null
    },
    {
      "id": "sharjah:90b0eca15f760c",
      "emirateId": "sharjah",
      "ar": "المدام",
      "en": "Al Madam",
      "aliases": [],
      "sourceId": "sharjah-municipalities",
      "sourceCode": null
    },
    {
      "id": "sharjah:a273e6883cd59f",
      "emirateId": "sharjah",
      "ar": "الحمرية",
      "en": "Al Hamriyah",
      "aliases": [],
      "sourceId": "sharjah-municipalities",
      "sourceCode": null
    },
    {
      "id": "sharjah:a2b8388189355c",
      "emirateId": "sharjah",
      "ar": "دبا الحصن",
      "en": "Dibba Al Hisn",
      "aliases": [],
      "sourceId": "sharjah-municipalities",
      "sourceCode": null
    },
    {
      "id": "sharjah:df8700c3de46a2",
      "emirateId": "sharjah",
      "ar": "كلباء",
      "en": "Kalba",
      "aliases": [],
      "sourceId": "sharjah-municipalities",
      "sourceCode": null
    },
    {
      "id": "sharjah:b011e58783a9a3",
      "emirateId": "sharjah",
      "ar": "واسط",
      "en": "Wasit",
      "aliases": [],
      "sourceId": "sharjah-councils",
      "sourceCode": null
    },
    {
      "id": "sharjah:5ec9f8bb899779",
      "emirateId": "sharjah",
      "ar": "مغيدر",
      "en": "Mughaidir",
      "aliases": [],
      "sourceId": "sharjah-councils",
      "sourceCode": null
    },
    {
      "id": "sharjah:40a7df85a81806",
      "emirateId": "sharjah",
      "ar": "الرحمانية",
      "en": "Al Rahmaniyah",
      "aliases": [],
      "sourceId": "sharjah-councils",
      "sourceCode": null
    },
    {
      "id": "sharjah:3ec4521b18728e",
      "emirateId": "sharjah",
      "ar": "السيوح",
      "en": "Al Suyoh",
      "aliases": [],
      "sourceId": "sharjah-councils",
      "sourceCode": null
    },
    {
      "id": "sharjah:da38296251b425",
      "emirateId": "sharjah",
      "ar": "موافجة",
      "en": "Muwafjah",
      "aliases": [],
      "sourceId": "sharjah-councils",
      "sourceCode": null
    },
    {
      "id": "sharjah:5bf92bdf2de556",
      "emirateId": "sharjah",
      "ar": "السويحات",
      "en": "Al Sweihat",
      "aliases": [],
      "sourceId": "sharjah-councils",
      "sourceCode": null
    },
    {
      "id": "sharjah:812e310d86a937",
      "emirateId": "sharjah",
      "ar": "الدفين",
      "en": "Al Dafeen",
      "aliases": [],
      "sourceId": "sharjah-councils",
      "sourceCode": null
    },
    {
      "id": "sharjah:ba5373a04db68b",
      "emirateId": "sharjah",
      "ar": "مزيرعة",
      "en": "Muzairaa",
      "aliases": [],
      "sourceId": "sharjah-councils",
      "sourceCode": null
    },
    {
      "id": "sharjah:ca749c54137737",
      "emirateId": "sharjah",
      "ar": "الرقيبة 1",
      "en": "Al Raqeeba 1",
      "aliases": [
        "السيوح 1"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:3cab083cb74c7e",
      "emirateId": "sharjah",
      "ar": "الرقيبة 2",
      "en": "Al Raqeeba 2",
      "aliases": [
        "السيوح 2"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:ec85bad379c3ee",
      "emirateId": "sharjah",
      "ar": "الرقيبة 3",
      "en": "Al Raqeeba 3",
      "aliases": [
        "السيوح 3"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:36487b2b763f40",
      "emirateId": "sharjah",
      "ar": "الرقيبة 4",
      "en": "Al Raqeeba 4",
      "aliases": [
        "السيوح 4"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:9f370a8c869e4b",
      "emirateId": "sharjah",
      "ar": "الرقيبة 5",
      "en": "Al Raqeeba 5",
      "aliases": [
        "السيوح 5"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:f346da69d2f69f",
      "emirateId": "sharjah",
      "ar": "الرقيبة 6",
      "en": "Al Raqeeba 6",
      "aliases": [
        "السيوح 6"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:4fd24ac46ff93d",
      "emirateId": "sharjah",
      "ar": "الرقيبة 7",
      "en": "Al Raqeeba 7",
      "aliases": [
        "السيوح 7"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:f44b3ccf129786",
      "emirateId": "sharjah",
      "ar": "الرقيبة 8",
      "en": "Al Raqeeba 8",
      "aliases": [
        "السيوح 8"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:66493991b7e582",
      "emirateId": "sharjah",
      "ar": "الموردة 1",
      "en": "Al Mowrrada 1",
      "aliases": [
        "السيوح 9"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:f5f21aa51ffefe",
      "emirateId": "sharjah",
      "ar": "الموردة 2",
      "en": "Al Mowrrada 2",
      "aliases": [
        "السيوح 10"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:029d3b2bb92e55",
      "emirateId": "sharjah",
      "ar": "الموردة 3",
      "en": "Al Mowrrada 3",
      "aliases": [
        "السيوح 11"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:cd8ee44a3757c5",
      "emirateId": "sharjah",
      "ar": "الموردة 4",
      "en": "Al Mowrrada 4",
      "aliases": [
        "السيوح 12"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:24dce8e7e27733",
      "emirateId": "sharjah",
      "ar": "الموردة 5",
      "en": "Al Mowrrada 5",
      "aliases": [
        "السيوح 13"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:b1529726fc685e",
      "emirateId": "sharjah",
      "ar": "الموردة 6",
      "en": "Al Mowrrada 6",
      "aliases": [
        "السيوح 14"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:71a1a86ccf25a8",
      "emirateId": "sharjah",
      "ar": "الموردة 7",
      "en": "Al Mowrrada 7",
      "aliases": [
        "السيوح 15"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:4b5943f5264c4b",
      "emirateId": "sharjah",
      "ar": "الموردة 8",
      "en": "Al Mowrrada 8",
      "aliases": [
        "السيوح 16"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:612d87ecc6962d",
      "emirateId": "sharjah",
      "ar": "شغرافة 1",
      "en": "Shaghrafa 1",
      "aliases": [
        "الرحمانية 1"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:686bc71bfb456d",
      "emirateId": "sharjah",
      "ar": "شغرافة 2",
      "en": "Shaghrafa 2",
      "aliases": [
        "الرحمانية 2"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:e103f54620a50a",
      "emirateId": "sharjah",
      "ar": "شغرافة 3",
      "en": "Shaghrafa 3",
      "aliases": [
        "الرحمانية 3"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:7bf76b94abfa12",
      "emirateId": "sharjah",
      "ar": "شغرافة 4",
      "en": "Shaghrafa 4",
      "aliases": [
        "الرحمانية 4"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:00aac7999f2a18",
      "emirateId": "sharjah",
      "ar": "كشيشة 1",
      "en": "Kshisha 1",
      "aliases": [
        "الرحمانية 5"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:d420d6af58e5dd",
      "emirateId": "sharjah",
      "ar": "كشيشة 2",
      "en": "Kshisha 2",
      "aliases": [
        "الرحمانية 6"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:87a828caca1840",
      "emirateId": "sharjah",
      "ar": "كشيشة 3",
      "en": "Kshisha 3",
      "aliases": [
        "الرحمانية 7"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:ee691d8c5d2f6f",
      "emirateId": "sharjah",
      "ar": "كشيشة 4",
      "en": "Kshisha 4",
      "aliases": [
        "الرحمانية 8"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:ea43856494a9df",
      "emirateId": "sharjah",
      "ar": "كشيشة 5",
      "en": "Kshisha 5",
      "aliases": [
        "الرحمانية 9"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "sharjah:1bfe7ca581b3a1",
      "emirateId": "sharjah",
      "ar": "كشيشة 6",
      "en": "Kshisha 6",
      "aliases": [
        "الرحمانية 10"
      ],
      "sourceId": "sharjah-renaming",
      "sourceCode": null
    },
    {
      "id": "ajman:8e1181d173a8d9",
      "emirateId": "ajman",
      "ar": "عجمان",
      "en": "Ajman",
      "aliases": [],
      "sourceId": "ajman-government",
      "sourceCode": null
    },
    {
      "id": "ajman:4654e073ba7736",
      "emirateId": "ajman",
      "ar": "مصفوت",
      "en": "Masfout",
      "aliases": [],
      "sourceId": "ajman-government",
      "sourceCode": null
    },
    {
      "id": "ajman:ff23a981de16ca",
      "emirateId": "ajman",
      "ar": "المنامة",
      "en": "Al Manama",
      "aliases": [],
      "sourceId": "ajman-government",
      "sourceCode": null
    },
    {
      "id": "ajman:ebe49087229716",
      "emirateId": "ajman",
      "ar": "مزيرع",
      "en": "Muzairaa",
      "aliases": [],
      "sourceId": "ajman-government",
      "sourceCode": null
    },
    {
      "id": "ajman:ba3c7ff4f284a8",
      "emirateId": "ajman",
      "ar": "الصبغة",
      "en": "Al Sabgha",
      "aliases": [],
      "sourceId": "ajman-government",
      "sourceCode": null
    },
    {
      "id": "ajman:3954e1ee4b340d",
      "emirateId": "ajman",
      "ar": "الجرف 1",
      "en": "Al Jurf 1",
      "aliases": [],
      "sourceId": "ajman-statistics",
      "sourceCode": null
    },
    {
      "id": "ajman:7174bf6ffffa2c",
      "emirateId": "ajman",
      "ar": "الجرف 2",
      "en": "Al Jurf 2",
      "aliases": [],
      "sourceId": "ajman-statistics",
      "sourceCode": null
    },
    {
      "id": "ajman:43171be706db52",
      "emirateId": "ajman",
      "ar": "الحميدية 1",
      "en": "Al Hamidiyah 1",
      "aliases": [],
      "sourceId": "ajman-statistics",
      "sourceCode": null
    },
    {
      "id": "ajman:eee95f76a804c5",
      "emirateId": "ajman",
      "ar": "الحميدية 2",
      "en": "Al Hamidiyah 2",
      "aliases": [],
      "sourceId": "ajman-statistics",
      "sourceCode": null
    },
    {
      "id": "ajman:038fa15ee4c209",
      "emirateId": "ajman",
      "ar": "النعيمية 1",
      "en": "Al Nuaimiya 1",
      "aliases": [],
      "sourceId": "ajman-statistics",
      "sourceCode": null
    },
    {
      "id": "ajman:b47969f17129eb",
      "emirateId": "ajman",
      "ar": "النعيمية 2",
      "en": "Al Nuaimiya 2",
      "aliases": [],
      "sourceId": "ajman-statistics",
      "sourceCode": null
    },
    {
      "id": "ajman:92df1799f77ed4",
      "emirateId": "ajman",
      "ar": "النعيمية 3",
      "en": "Al Nuaimiya 3",
      "aliases": [],
      "sourceId": "ajman-statistics",
      "sourceCode": null
    },
    {
      "id": "ajman:b5959133ca1d05",
      "emirateId": "ajman",
      "ar": "الجرف الصناعية 1",
      "en": "Al Jurf Industrial 1",
      "aliases": [],
      "sourceId": "ajman-licenses",
      "sourceCode": null
    },
    {
      "id": "ajman:9d3e07d1492e2b",
      "emirateId": "ajman",
      "ar": "عجمان الصناعية 1",
      "en": "Ajman Industrial 1",
      "aliases": [],
      "sourceId": "ajman-licenses",
      "sourceCode": null
    },
    {
      "id": "ajman:cf598839982c40",
      "emirateId": "ajman",
      "ar": "عجمان الصناعية 2",
      "en": "Ajman Industrial 2",
      "aliases": [],
      "sourceId": "ajman-licenses",
      "sourceCode": null
    },
    {
      "id": "ajman:1917e6e9ab69d9",
      "emirateId": "ajman",
      "ar": "الروضة 2",
      "en": "Al Rawdha 2",
      "aliases": [],
      "sourceId": "ajman-licenses",
      "sourceCode": null
    },
    {
      "id": "ajman:12d94cd7a807cb",
      "emirateId": "ajman",
      "ar": "الروضة 3",
      "en": "Al Rawdha 3",
      "aliases": [],
      "sourceId": "ajman-licenses",
      "sourceCode": null
    },
    {
      "id": "ajman:95fe3ad09dcccd",
      "emirateId": "ajman",
      "ar": "مصفوت 1",
      "en": "Masfout 1",
      "aliases": [],
      "sourceId": "ajman-licenses",
      "sourceCode": null
    },
    {
      "id": "ajman:ace8636478e97a",
      "emirateId": "ajman",
      "ar": "مصفوت 3",
      "en": "Masfout 3",
      "aliases": [],
      "sourceId": "ajman-licenses",
      "sourceCode": null
    },
    {
      "id": "ajman:810fbfa1c60ffd",
      "emirateId": "ajman",
      "ar": "المنامة 15",
      "en": "Al Manama 15",
      "aliases": [],
      "sourceId": "ajman-licenses",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:c1427845af536f",
      "emirateId": "ras-al-khaimah",
      "ar": "رأس الخيمة",
      "en": "Ras Al Khaimah",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:b0fef94a118607",
      "emirateId": "ras-al-khaimah",
      "ar": "شعم",
      "en": "Shaam",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:3de429842fc58b",
      "emirateId": "ras-al-khaimah",
      "ar": "غليلة",
      "en": "Ghalilah",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:a8295e1a9df5cb",
      "emirateId": "ras-al-khaimah",
      "ar": "الجير",
      "en": "Al Jeer",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:d9dab57170b091",
      "emirateId": "ras-al-khaimah",
      "ar": "الرمس",
      "en": "Al Rams",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:9e71eabeed3ae4",
      "emirateId": "ras-al-khaimah",
      "ar": "شمل",
      "en": "Shamal",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:242263c5f7f3a2",
      "emirateId": "ras-al-khaimah",
      "ar": "مسافي",
      "en": "Masafi",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:2cc7944fb4e9ef",
      "emirateId": "ras-al-khaimah",
      "ar": "كدرا",
      "en": "Kadra",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:b349eb1ac441f0",
      "emirateId": "ras-al-khaimah",
      "ar": "الحويلات",
      "en": "Al Huwaylat",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:60242868fcada1",
      "emirateId": "ras-al-khaimah",
      "ar": "الغيل",
      "en": "Al Ghail",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:9bdf7dff6539b7",
      "emirateId": "ras-al-khaimah",
      "ar": "إذن",
      "en": "Idhn",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:72635a984351cf",
      "emirateId": "ras-al-khaimah",
      "ar": "عسمة",
      "en": "Asimah",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:44fdfb868d5fc8",
      "emirateId": "ras-al-khaimah",
      "ar": "دفتا",
      "en": "Daftah",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:9798f48b6d3414",
      "emirateId": "ras-al-khaimah",
      "ar": "رفاق",
      "en": "Rafaq",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:898ec9641869a0",
      "emirateId": "ras-al-khaimah",
      "ar": "الظيت الجنوبي",
      "en": "Al Dhait South",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:f4c67858087cc7",
      "emirateId": "ras-al-khaimah",
      "ar": "الخران",
      "en": "Al Kharran",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:987df42dd172cf",
      "emirateId": "ras-al-khaimah",
      "ar": "الدقداقة",
      "en": "Digdaga",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:7af0c6c4ff051d",
      "emirateId": "ras-al-khaimah",
      "ar": "الحمرانية",
      "en": "Al Hamraniyah",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "ras-al-khaimah:ea3a69069874ee",
      "emirateId": "ras-al-khaimah",
      "ar": "خت",
      "en": "Khatt",
      "aliases": [],
      "sourceId": "rak-government",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:9f1480c01dfcab",
      "emirateId": "umm-al-quwain",
      "ar": "أم القيوين",
      "en": "Umm Al Quwain",
      "aliases": [],
      "sourceId": "uaq-government",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:26f840d54375ca",
      "emirateId": "umm-al-quwain",
      "ar": "فلج المعلا",
      "en": "Falaj Al Mualla",
      "aliases": [],
      "sourceId": "uaq-government",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:b6ed65f87c20ad",
      "emirateId": "umm-al-quwain",
      "ar": "أم الثوب",
      "en": "Umm Al Thoob",
      "aliases": [],
      "sourceId": "uaq-government",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:6801acf8f0eeeb",
      "emirateId": "umm-al-quwain",
      "ar": "الراشدية",
      "en": "Al Rashidiyah",
      "aliases": [],
      "sourceId": "uaq-addressing",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:99d7e1dfde0aaf",
      "emirateId": "umm-al-quwain",
      "ar": "بياته",
      "en": "Bayatah",
      "aliases": [],
      "sourceId": "uaq-addressing",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:88cbf808ab3ca8",
      "emirateId": "umm-al-quwain",
      "ar": "السلمة 1",
      "en": "Al Salamah 1",
      "aliases": [],
      "sourceId": "uaq-addressing",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:191ec71f899b2c",
      "emirateId": "umm-al-quwain",
      "ar": "السلمة 2",
      "en": "Al Salamah 2",
      "aliases": [],
      "sourceId": "uaq-addressing",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:5df05d4b9b080f",
      "emirateId": "umm-al-quwain",
      "ar": "السلمة 3",
      "en": "Al Salamah 3",
      "aliases": [],
      "sourceId": "uaq-addressing",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:5bf92bdf2de556",
      "emirateId": "umm-al-quwain",
      "ar": "السويحات",
      "en": "Al Sweihat",
      "aliases": [],
      "sourceId": "uaq-addressing",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:772ee5a27a177d",
      "emirateId": "umm-al-quwain",
      "ar": "محمد بن راشد",
      "en": "Mohammed Bin Rashid",
      "aliases": [],
      "sourceId": "uaq-addressing",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:7b9b444b13d74a",
      "emirateId": "umm-al-quwain",
      "ar": "القراين",
      "en": "Al Qarayen",
      "aliases": [],
      "sourceId": "uaq-addressing",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:3f1cebe423297d",
      "emirateId": "umm-al-quwain",
      "ar": "عود الطاير 1",
      "en": "Oud Al Tayer 1",
      "aliases": [],
      "sourceId": "uaq-addressing",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:f61bc04e4ca0bf",
      "emirateId": "umm-al-quwain",
      "ar": "عود الطاير 2",
      "en": "Oud Al Tayer 2",
      "aliases": [],
      "sourceId": "uaq-addressing",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:0b0cedc432fcd7",
      "emirateId": "umm-al-quwain",
      "ar": "الراعفة",
      "en": "Al Raafah",
      "aliases": [],
      "sourceId": "uaq-addressing",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:928e43f22e33e3",
      "emirateId": "umm-al-quwain",
      "ar": "مدينة الشهداء",
      "en": "Martyrs City",
      "aliases": [],
      "sourceId": "uaq-addressing",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:c8cd7a42f735c5",
      "emirateId": "umm-al-quwain",
      "ar": "الأبرق",
      "en": "Al Abraq",
      "aliases": [],
      "sourceId": "uaq-plans",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:17e6f14c8386e9",
      "emirateId": "umm-al-quwain",
      "ar": "الرملة",
      "en": "Al Ramlah",
      "aliases": [],
      "sourceId": "uaq-plans",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:f16acdd58b73f5",
      "emirateId": "umm-al-quwain",
      "ar": "الشص",
      "en": "Al Shis",
      "aliases": [],
      "sourceId": "uaq-plans",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:a83fb851488f27",
      "emirateId": "umm-al-quwain",
      "ar": "شنتير",
      "en": "Shanteer",
      "aliases": [],
      "sourceId": "uaq-plans",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:75133c125f7db6",
      "emirateId": "umm-al-quwain",
      "ar": "البوغة",
      "en": "Al Bughah",
      "aliases": [],
      "sourceId": "uaq-plans",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:78e0b5ac529425",
      "emirateId": "umm-al-quwain",
      "ar": "النخيلة",
      "en": "Al Nakhilah",
      "aliases": [],
      "sourceId": "uaq-plans",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:3d7e67ab655e85",
      "emirateId": "umm-al-quwain",
      "ar": "مدينة خليفة",
      "en": "Khalifa City",
      "aliases": [],
      "sourceId": "uaq-plans",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:73ebd72159eabd",
      "emirateId": "umm-al-quwain",
      "ar": "الهبوب",
      "en": "Al Huboob",
      "aliases": [],
      "sourceId": "uaq-plans",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:e2c076ad8a261c",
      "emirateId": "umm-al-quwain",
      "ar": "كابر",
      "en": "Kaber",
      "aliases": [],
      "sourceId": "uaq-plans",
      "sourceCode": null
    },
    {
      "id": "umm-al-quwain:7b03ae207a0e09",
      "emirateId": "umm-al-quwain",
      "ar": "الثنية",
      "en": "Al Thaniyah",
      "aliases": [],
      "sourceId": "uaq-plans",
      "sourceCode": null
    },
    {
      "id": "fujairah:f85ca6bd948591",
      "emirateId": "fujairah",
      "ar": "الفجيرة",
      "en": "Fujairah",
      "aliases": [],
      "sourceId": "fuj-government",
      "sourceCode": null
    },
    {
      "id": "fujairah:977bc6c5505df8",
      "emirateId": "fujairah",
      "ar": "دبا الفجيرة",
      "en": "Dibba Al Fujairah",
      "aliases": [],
      "sourceId": "fuj-government",
      "sourceCode": null
    },
    {
      "id": "fujairah:661097e4f827bb",
      "emirateId": "fujairah",
      "ar": "مربح",
      "en": "Mirbah",
      "aliases": [],
      "sourceId": "fuj-government",
      "sourceCode": null
    },
    {
      "id": "fujairah:91bed446601daf",
      "emirateId": "fujairah",
      "ar": "قدفع",
      "en": "Qidfa",
      "aliases": [],
      "sourceId": "fuj-government",
      "sourceCode": null
    },
    {
      "id": "fujairah:e066e024f7c561",
      "emirateId": "fujairah",
      "ar": "البدية",
      "en": "Al Bidyah",
      "aliases": [],
      "sourceId": "fuj-government",
      "sourceCode": null
    },
    {
      "id": "fujairah:242263c5f7f3a2",
      "emirateId": "fujairah",
      "ar": "مسافي",
      "en": "Masafi",
      "aliases": [],
      "sourceId": "fuj-government",
      "sourceCode": null
    },
    {
      "id": "fujairah:8d422729a922b0",
      "emirateId": "fujairah",
      "ar": "السيجي",
      "en": "Al Siji",
      "aliases": [],
      "sourceId": "fuj-government",
      "sourceCode": null
    },
    {
      "id": "fujairah:ccc054fd56280e",
      "emirateId": "fujairah",
      "ar": "مريشيد",
      "en": "Mraisheed",
      "aliases": [],
      "sourceId": "fuj-licenses",
      "sourceCode": null
    },
    {
      "id": "fujairah:7db364db60767f",
      "emirateId": "fujairah",
      "ar": "الحيل",
      "en": "Al Hayl",
      "aliases": [],
      "sourceId": "fuj-licenses",
      "sourceCode": null
    },
    {
      "id": "fujairah:079867dd7428f2",
      "emirateId": "fujairah",
      "ar": "مدينة محمد بن زايد",
      "en": "Mohammed Bin Zayed City",
      "aliases": [],
      "sourceId": "fuj-licenses",
      "sourceCode": null
    },
    {
      "id": "fujairah:7a1954efdd8454",
      "emirateId": "fujairah",
      "ar": "الطويين",
      "en": "Al Tuwayeen",
      "aliases": [],
      "sourceId": "fuj-licenses",
      "sourceCode": null
    },
    {
      "id": "fujairah:760b4b6792c6d3",
      "emirateId": "fujairah",
      "ar": "سيح الصرم",
      "en": "Seih Al Saram",
      "aliases": [],
      "sourceId": "fuj-licenses",
      "sourceCode": null
    }
  ]
};
if(typeof module!=="undefined"&&module.exports)module.exports=data;else root.UaeAreaSeed=data;
})(typeof window!=="undefined"?window:globalThis);
