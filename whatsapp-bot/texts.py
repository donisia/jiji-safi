"""
All the words the bot says, in one place.

T            = the WhatsApp text for each step (English + Kiswahili)
VOICE        = what the pre-recorded voice note says for each step
generate_voices.py turns VOICE into mp3 files (once) using ElevenLabs.
Change a sentence here, run generate_voices.py --force, and the new voice is used.
"""

ZONES = ["Ngong", "Matasia", "Kiserian", "Ongata Rongai"]

# canonical waste type (saved to reports) -> label shown to the user
LABELS = {
    "en": {"Plastic": "Plastic", "Organic": "Organic (food)", "Metal": "Metal",
           "General": "General / mixed", "Hazard": "Dangerous waste"},
    "sw": {"Plastic": "Plastiki", "Organic": "Taka za chakula", "Metal": "Chuma",
           "General": "Taka mchanganyiko", "Hazard": "Taka hatari"},
}

T = {
    "en": {
        "language": "Karibu Jiji Safi! 👋\nChoose your language / Chagua lugha:\n1. English\n2. Kiswahili",
        "menu": "Jiji Safi main menu:\n1. Report waste dumping\n2. Chat with Jiji (ask anything)\n3. About Jiji Safi\n4. Change language\n\nReply with a number.",
        "type": "What kind of waste is it?\n1. Plastic\n2. Organic (food, vegetables)\n3. Metal\n4. General / mixed\n5. Dangerous (chemicals, medical, fire)\n\nReply with a number. Send 'menu' to cancel.",
        "zone": "Where is it?\n1. Ngong\n2. Matasia\n3. Kiserian\n4. Ongata Rongai\n5. Another place\n\nReply with a number.",
        "zone_other": "Please type the name of the area.",
        "landmark": "Add a landmark so the team can find it (for example: near the market, behind the school). Reply 0 to skip.",
        "photo": "If you can, send a photo of the waste. Reply 0 to skip.",
        "confirm": "Please check your report:\n\nWaste: {waste}\nArea: {zone}\nLandmark: {landmark}\nPhoto: {photo}\n\n1. Send report\n2. Cancel",
        "done": "Asante! Your report is in and the Jiji Safi team has been notified. Send 'menu' to go back to the menu.",
        "done_hazard": "Asante! Your report is in and the team has been notified. Please stay away from it and do not touch it. Send 'menu' to go back to the menu.",
        "cancelled": "Report cancelled. Send 'menu' any time.",
        "chat": "Sure, I'm listening. Ask me anything about waste, or tell me what you saw. Send 'menu' to go back.",
        "about": "Jiji Safi helps people in Ngong, Matasia, Kiserian and Ongata Rongai report waste dumping so the team can follow up. Send 'menu' to go back.",
        "invalid": "Sorry, I didn't get that. Please reply with one of the numbers above.",
        "not_waste": "I couldn't see waste in that photo. Please send a clearer one, or reply 0 to skip.",
        "yes": "Yes", "no": "No", "none": "-",
    },
    "sw": {
        "language": "Karibu Jiji Safi! 👋\nChoose your language / Chagua lugha:\n1. English\n2. Kiswahili",
        "menu": "Menyu kuu ya Jiji Safi:\n1. Ripoti taka zilizotupwa\n2. Ongea na Jiji (uliza chochote)\n3. Kuhusu Jiji Safi\n4. Badilisha lugha\n\nJibu kwa nambari.",
        "type": "Ni taka za aina gani?\n1. Plastiki\n2. Taka za chakula\n3. Chuma\n4. Taka mchanganyiko\n5. Hatari (kemikali, taka za hospitali, moto)\n\nJibu kwa nambari. Tuma 'menu' kughairi.",
        "zone": "Ni wapi?\n1. Ngong\n2. Matasia\n3. Kiserian\n4. Ongata Rongai\n5. Mahali pengine\n\nJibu kwa nambari.",
        "zone_other": "Tafadhali andika jina la eneo.",
        "landmark": "Ongeza alama ya kupatambua ili timu ipafikie (mfano: karibu na soko, nyuma ya shule). Jibu 0 kuruka.",
        "photo": "Ukiweza, tuma picha ya taka. Jibu 0 kuruka.",
        "confirm": "Tafadhali hakiki ripoti yako:\n\nTaka: {waste}\nEneo: {zone}\nAlama: {landmark}\nPicha: {photo}\n\n1. Tuma ripoti\n2. Ghairi",
        "done": "Asante! Ripoti yako imepokelewa na timu ya Jiji Safi imearifiwa. Tuma 'menu' kurudi kwenye menyu.",
        "done_hazard": "Asante! Ripoti yako imepokelewa na timu imearifiwa. Tafadhali kaa mbali nayo na usiiguse. Tuma 'menu' kurudi kwenye menyu.",
        "cancelled": "Ripoti imeghairiwa. Tuma 'menu' wakati wowote.",
        "chat": "Sawa, nakusikiliza. Niulize chochote kuhusu taka, au niambie ulichoona. Tuma 'menu' kurudi.",
        "about": "Jiji Safi inasaidia wakazi wa Ngong, Matasia, Kiserian na Ongata Rongai kuripoti taka zilizotupwa ili timu ifuatilie. Tuma 'menu' kurudi.",
        "invalid": "Samahani, sijaelewa. Tafadhali jibu kwa mojawapo ya nambari zilizo hapo juu.",
        "not_waste": "Sijaona taka kwenye picha hiyo. Tafadhali tuma picha iliyo wazi zaidi, au jibu 0 kuruka.",
        "yes": "Ndiyo", "no": "Hapana", "none": "-",
    },
}

# Spoken versions (the "common" one is bilingual, used before a language is picked)
VOICE = {
    "common": {
        "language": "Karibu Jiji Safi! Welcome to Jiji Safi. For English, reply one. Kwa Kiswahili, jibu mbili.",
    },
    "en": {
        "menu": "Welcome to the Jiji Safi main menu. Reply one to report waste dumping. Two, to chat with Jiji. Three, to learn about Jiji Safi. Four, to change language.",
        "type": "What kind of waste is it? Reply one for plastic, two for organic, three for metal, four for general waste, or five if it is dangerous.",
        "zone": "Where is it? Reply one for Ngong, two for Matasia, three for Kiserian, four for Ongata Rongai, or five for another place.",
        "zone_other": "Please type the name of the area.",
        "landmark": "Add a landmark so the team can find the place, like near the market or behind the school. Or reply zero to skip.",
        "photo": "If you can, send a photo of the waste. Or reply zero to skip.",
        "confirm": "Please check your report summary above. Reply one to send it, or two to cancel.",
        "done": "Asante! Your report is in, and the Jiji Safi team has been notified. Send menu to go back to the menu.",
        "done_hazard": "Asante! Your report is in. Please stay away from the waste and do not touch it. The team has been notified.",
        "cancelled": "Your report has been cancelled. Send menu any time to start again.",
        "chat": "Sure, I'm listening. Ask me anything about waste, or tell me what you saw.",
        "about": "Jiji Safi helps people in Ngong, Matasia, Kiserian and Ongata Rongai report waste dumping, so the team can follow up.",
    },
    "sw": {
        "menu": "Karibu kwenye menyu kuu ya Jiji Safi. Jibu moja kuripoti taka zilizotupwa. Mbili, kuongea na Jiji. Tatu, kujua kuhusu Jiji Safi. Nne, kubadilisha lugha.",
        "type": "Ni taka za aina gani? Jibu moja kwa plastiki, mbili kwa taka za chakula, tatu kwa chuma, nne kwa taka mchanganyiko, au tano kama ni hatari.",
        "zone": "Ni wapi? Jibu moja kwa Ngong, mbili kwa Matasia, tatu kwa Kiserian, nne kwa Ongata Rongai, au tano kwa mahali pengine.",
        "zone_other": "Tafadhali andika jina la eneo.",
        "landmark": "Ongeza alama ya kupatambua ili timu ipafikie, kama karibu na soko au nyuma ya shule. Au jibu sifuri kuruka.",
        "photo": "Ukiweza, tuma picha ya taka. Au jibu sifuri kuruka.",
        "confirm": "Tafadhali hakiki muhtasari wa ripoti yako hapo juu. Jibu moja kuituma, au mbili kughairi.",
        "done": "Asante! Ripoti yako imepokelewa, na timu ya Jiji Safi imearifiwa. Tuma menu kurudi kwenye menyu.",
        "done_hazard": "Asante! Ripoti yako imepokelewa. Tafadhali kaa mbali na taka hizo na usiziguse. Timu imearifiwa.",
        "cancelled": "Ripoti yako imeghairiwa. Tuma menu wakati wowote kuanza tena.",
        "chat": "Sawa, nakusikiliza. Niulize chochote kuhusu taka, au niambie ulichoona.",
        "about": "Jiji Safi inasaidia wakazi wa Ngong, Matasia, Kiserian na Ongata Rongai kuripoti taka zilizotupwa, ili timu ifuatilie.",
    },
}
