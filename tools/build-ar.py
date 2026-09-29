"""
ARABIC PAGES — builds /ar/<page>.html from the English page of the same name
------------------------------------------------------------------------------
The Arabic pages have exactly the same structure as the English ones; only the
words, the direction and the paths change. So they are generated rather than
kept by hand: edit the English page, then run

    python tools/build-ar.py

It swaps every piece of visible text for its Arabic (from the tables below),
sets right-to-left, points links and images at the right folders, adds the
English/Arabic switch and hreflang links, and writes /ar/<page>.html.

If you add or change text on an English page, the script stops and lists the
text it has no Arabic for — add a line for it below and run it again. Words
that come from the data files (services, events, products …) are translated
in data/ar.js instead. The Arabic home page (ar/index.html) is kept by hand.

⚠ Have a native speaker read the Arabic before launch.
"""
import re
import sys
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
PAGES = ["about", "dietontherun", "sheontherun", "public-health", "shop", "connect"]
SITE = "https://sheontherun.com/"

# ─────────────────────────────────────────────────────── shared on every page
COMMON = {
    "Skip to content": "انتقل إلى المحتوى",
    "Fatima Mouzahem": "فاطمة مزاحم",
    "Dietitian · Sports Nutritionist": "أخصائية تغذية · تغذية رياضية",
    "About me": "عنّي",
    "Public Health": "الصحة العامة",
    "Shop": "المتجر",
    "Connect with me": "تواصل معي",
    "Menu": "القائمة",
    "Home": "الرئيسية",
    "WhatsApp": "واتساب",
    "Instagram": "إنستغرام",
    "Email": "البريد الإلكتروني",
    "Fatima": "فاطمة",
    "Mouzahem": "مزاحم",
    "Licensed dietitian, certified sports nutritionist and public health professional. Beirut, Lebanon — and online, wherever you are.":
        "أخصائية تغذية مرخّصة، وأخصائية تغذية رياضية معتمدة، ومختصة في الصحة العامة. بيروت، لبنان — وأونلاين أينما كنت.",
    "Explore": "تصفّح",
    "The Journal": "المدونة (بالإنجليزية)",
    "Start a conversation": "لنبدأ الحديث",
    "Beirut, Lebanon": "بيروت، لبنان",
    "Nutrition advice on this site is general. A consultation is personal.": "المعلومات الغذائية على هذا الموقع عامّة. أما الاستشارة فشخصية.",
}
COMMON_ATTR = {
    "Hi Fatima! I found you through your website.": "مرحباً فاطمة! وجدتك عبر موقعك الإلكتروني.",
    "Enquiry via your website": "استفسار عبر الموقع",
    "Hi Fatima! I'd like to book the free 15-minute discovery call.": "مرحباً فاطمة! أودّ حجز مكالمة التعارف المجانية لمدة 15 دقيقة.",
    "Primary": "القائمة الرئيسية",
    "Menu": "القائمة",
}

# ──────────────────────────────────────────────────────────────── per page
TEXT = {}
ATTR = {}
RAW = {}

TEXT["about"] = {
    "About Fatima Mouzahem — Dietitian, Athlete, Public Health Professional": "عن فاطمة مزاحم — أخصائية تغذية، رياضية، ومختصة في الصحة العامة",
    "A little about me": "القليل عنّي",
    "Always": "دائماً",
    "on the run": "في حركة",
    "Part runner, part dietitian, part public health professional, somehow, all the same person.":
        "جزء عدّاءة، وجزء أخصائية تغذية، وجزء مختصة في الصحة العامة — وبطريقة ما، كلّها الشخص نفسه.",
    "01 — The human": "01 — الإنسانة",
    "The Human": "الإنسانة",
    "I've been running for over 10 years, and I guess you could say I'm pretty good at running through life too.":
        "أركض منذ أكثر من 10 سنوات، ويمكن القول إنني أجيد الركض في الحياة أيضاً.",
    "I'm married, based in Lebanon, and happiest when I'm moving, cooking something healthy, travelling somewhere new, or helping individuals feel stronger and more confident in their bodies.":
        "متزوجة، أعيش في لبنان، وأكون في أسعد حالاتي حين أتحرّك، أو أطبخ شيئاً صحياً، أو أسافر إلى مكان جديد، أو أساعد الآخرين على الشعور بقوة وثقة أكبر في أجسادهم.",
    "I'm endlessly curious about health, which has taken me beyond nutrition into Chinese medicine and holistic approaches. And in another life, I'd probably be a fashion designer, I've always loved clothes as a form of self-expression.":
        "فضولي تجاه الصحة لا ينتهي، وقد أخذني أبعد من التغذية إلى الطب الصيني والمقاربات الشمولية. وفي حياة أخرى، ربما كنت مصمّمة أزياء؛ فلطالما أحببت الملابس كوسيلة للتعبير عن الذات.",
    "The professional me": "أنا المهنية",
    "I believe feeling your best comes from finding the right balance between how we eat, how we move, and how we live.":
        "أؤمن بأن الشعور بأفضل حال يأتي من إيجاد التوازن الصحيح بين طريقة أكلنا، وطريقة حركتنا، وطريقة عيشنا.",
    "02 — The professional": "02 — المهنية",
    "The Professional Me": "أنا المهنية",
    "I'm a licensed dietitian, certified sports nutritionist, and public health professional.":
        "أنا أخصائية تغذية مرخّصة، وأخصائية تغذية رياضية معتمدة، ومختصة في الصحة العامة.",
    "I studied Nutrition &amp; Dietetics at Lebanese American University-US coordinated program and earned my Master's in Public Health from American University of Beirut. Over the past eight years, I've worked across nutrition, public health, research, data, and humanitarian programmes with UNICEF, WFP, AUB, and the Ministry of Public Health.":
        "درست التغذية وعلم الحميات في الجامعة اللبنانية الأميركية ضمن البرنامج الأميركي المنسَّق، ونلت الماجستير في الصحة العامة من الجامعة الأميركية في بيروت. وعلى مدى السنوات الثماني الماضية، عملت في مجالات التغذية والصحة العامة والأبحاث والبيانات والبرامج الإنسانية مع اليونيسف وبرنامج الأغذية العالمي والجامعة الأميركية في بيروت ووزارة الصحة العامة.",
    "My work has taken me from supporting individuals and communities to working with health programmes, data, and systems, giving me a broader perspective on what it means to build healthier lives.":
        "أخذني عملي من دعم الأفراد والمجتمعات إلى العمل مع البرامج الصحية والبيانات والأنظمة، ما منحني نظرة أوسع إلى معنى بناء حياة أكثر صحة.",
    "More recently, curiosity took me to Shanghai, where I explored Traditional Chinese Medicine and another perspective on health. Today, I bring these different perspectives together in the way I work with individuals, focusing on helping you build a healthier life that actually feels sustainable.":
        "ومؤخراً، أخذني الفضول إلى شنغهاي، حيث استكشفت الطب الصيني التقليدي ونظرة أخرى إلى الصحة. واليوم، أجمع هذه النظرات المختلفة في طريقة عملي مع الأفراد، مع التركيز على مساعدتك في بناء حياة أكثر صحة يمكنك الاستمرار عليها فعلاً.",
    "Because being your best isn't about doing everything perfectly.": "لأن أن تكون في أفضل حالاتك لا يعني أن تفعل كل شيء بإتقان.",
    "It's about feeling good enough to go after the life you want.": "بل أن تشعر بما يكفي من الرضا لتسعى إلى الحياة التي تريدها.",
    "My journey": "مسيرتي",
    "It Started With Running": "البداية كانت مع الجري",
    "I started training in track &amp; field, beginning with the 800m and 1500m before finding my way to the 400m. I always had a soft spot for the 400m hurdles and eventually competed in it, earning 2nd place nationally.":
        "بدأت التدريب في ألعاب القوى، مع سباقَي 800 متر و1500 متر قبل أن أجد طريقي إلى سباق 400 متر. لطالما كان لسباق 400 متر حواجز مكانة خاصة لديّ، وشاركت فيه في النهاية وحللت في المركز الثاني على مستوى لبنان.",
    "Nutrition Meets Sport": "حين التقت التغذية بالرياضة",
    "I completed my academic coursework in Nutrition &amp; Dietetics at LAU and joined the American Coordinated Program, completing my 9-month dietetic internship at LAU Medical Center–Rizk Hospital.":
        "أنهيت دراستي الأكاديمية في التغذية وعلم الحميات في الجامعة اللبنانية الأميركية، وانضممت إلى البرنامج الأميركي المنسَّق، وأكملت تدريبي في علم الحميات لمدة 9 أشهر في المركز الطبي للجامعة اللبنانية الأميركية – مستشفى رزق.",
    "Becoming a Dietitian": "أصبحت أخصائية تغذية",
    "I graduated and became a licensed dietitian, then began my Master's in Public Health at AUB, specializing in Epidemiology and Biostatistics.":
        "تخرّجت وأصبحت أخصائية تغذية مرخّصة، ثم بدأت الماجستير في الصحة العامة في الجامعة الأميركية في بيروت، بتخصّص علم الأوبئة والإحصاء الحيوي.",
    "From Nutrition to Public Health": "من التغذية إلى الصحة العامة",
    "I joined UNICEF as one of Lebanon's first Youth UN Volunteers, as part of a global pilot program focused on child survival. I was one of just six young people selected in Lebanon — all while completing my Master's degree.":
        "انضممت إلى اليونيسف كواحدة من أوائل متطوعي الأمم المتحدة الشباب في لبنان، ضمن برنامج تجريبي عالمي يركّز على بقاء الأطفال. كنت واحدة من ستة شباب فقط اختيروا في لبنان — وكل ذلك أثناء إكمال الماجستير.",
    "Entering the UN World": "دخول عالم الأمم المتحدة",
    "I graduated from AUB with my Master's in Public Health and joined the World Food Programme (WFP) Lebanon as a Monitoring &amp; Evaluation Associate. Over the next 2.5 years, I took on different roles and grew deeper into the world of public health.":
        "تخرّجت من الجامعة الأميركية في بيروت بماجستير في الصحة العامة، وانضممت إلى برنامج الأغذية العالمي (WFP) في لبنان بصفة مساعدة في الرصد والتقييم. وعلى مدى السنتين والنصف التاليتين، تولّيت أدواراً مختلفة وتعمّقت أكثر في عالم الصحة العامة.",
    "Consulting &amp; New Perspectives": "الاستشارات ونظرات جديدة",
    "I began consulting with UNICEF as an Information Management Consultant, working at the intersection of health, data, and public health.":
        "بدأت العمل مع اليونيسف كمستشارة في إدارة المعلومات، عند نقطة التقاء الصحة والبيانات والصحة العامة.",
    "Back to Lebanon's Health System": "العودة إلى النظام الصحي اللبناني",
    "I began consulting with the Ministry of Public Health through AUB, continuing to work in public health while bringing together my background in nutrition, health, and data.":
        "بدأت العمل مستشارةً مع وزارة الصحة العامة عبر الجامعة الأميركية في بيروت، مواصلةً العمل في الصحة العامة وجامعةً بين خلفيتي في التغذية والصحة والبيانات.",
    "The Turning Point": "نقطة التحوّل",
    "After stepping away from professional training during COVID, I returned to track &amp; field for a full year of focused 400m training, and became a certified sports nutritionist.":
        "بعد ابتعادي عن التدريب الاحترافي خلال جائحة كوفيد، عدت إلى ألعاب القوى لعام كامل من التدريب المركّز على سباق 400 متر، وأصبحت أخصائية تغذية رياضية معتمدة.",
    "A New Way of Looking at Health": "نظرة جديدة إلى الصحة",
    "I travelled to China for a month to study Traditional Chinese Medicine, following my curiosity about different approaches to health and wellbeing. Back home, SheOnTheRun kept growing, and DietOnTheRun grew through my work with women one-on-one.":
        "سافرت إلى الصين لمدة شهر لدراسة الطب الصيني التقليدي، بدافع فضولي تجاه مقاربات مختلفة للصحة والعافية. وفي لبنان، واصل SheOnTheRun نموّه، ونما DietOnTheRun من خلال عملي الفردي مع النساء.",
    "Read: A month in Shanghai": "اقرأ: شهر في شنغهاي (بالإنجليزية)",
    "Bringing It All Together": "جمع كل ذلك معاً",
    "Today, I'm bringing together everything I've learned: the athlete, the dietitian, the sports nutritionist, the public health professional, and the curious human who never stops learning.":
        "اليوم، أجمع كل ما تعلّمته: الرياضية، وأخصائية التغذية، وأخصائية التغذية الرياضية، والمختصة في الصحة العامة، والإنسانة الفضولية التي لا تتوقف عن التعلّم.",
    "And this is only the beginning.": "وهذه ليست إلا البداية.",
}
ATTR["about"] = {
    "The journey from the 400m hurdles to a dietetics licence, a Master's in Public Health at AUB, eight years with UNICEF, WFP and Lebanon's Ministry of Public Health, and the founding of SheOnTheRun.":
        "المسيرة من سباق 400 متر حواجز إلى ترخيص في التغذية، وماجستير في الصحة العامة من الجامعة الأميركية في بيروت، وثماني سنوات مع اليونيسف وبرنامج الأغذية العالمي ووزارة الصحة العامة، وتأسيس SheOnTheRun.",
    "About Fatima Mouzahem": "عن فاطمة مزاحم",
    "Dietitian, former national 400m hurdler, public health professional, founder of SheOnTheRun.":
        "أخصائية تغذية، عدّاءة سابقة في سباق 400 متر حواجز على المستوى الوطني، مختصة في الصحة العامة، ومؤسِّسة SheOnTheRun.",
    "Fatima reading in a teal bookshelf corner, smiling": "فاطمة تقرأ مبتسمة في زاوية رفوف الكتب",
    "A white lotus in bloom with morning water droplets": "زهرة لوتس بيضاء متفتّحة تعلوها قطرات ندى الصباح",
}
RAW["about"] = [
    ('<p class="tl-born">The year <strong>SheOnTheRun</strong> and <strong>DietOnTheRun</strong> were born.</p>',
     '<p class="tl-born">العام الذي وُلد فيه <strong>SheOnTheRun</strong> و<strong>DietOnTheRun</strong>.</p>'),
    ('<p>Then I decided it was time to bring all the pieces together: I started <strong>SheOnTheRun</strong>, a women-only running and wellness community, and gave my nutrition practice its own name, <strong>DietOnTheRun</strong>.</p>',
     '<p>ثم قرّرت أن الوقت قد حان لجمع كل القطع معاً: أسّست <strong>SheOnTheRun</strong>، مجتمعاً للجري والعافية للنساء فقط، ومنحت عيادتي للتغذية اسمها الخاص، <strong>DietOnTheRun</strong>.</p>'),
]

TEXT["dietontherun"] = {
    "DietOnTheRun — Dietitian in Beirut &amp; Online Nutrition Consultations": "DietOnTheRun — أخصائية تغذية في بيروت واستشارات تغذية أونلاين",
    "DietOnTheRun · Beirut &amp; online": "DietOnTheRun · بيروت وأونلاين",
    "Nutrition that works": "تغذية تنسجم",
    "with your life": "مع حياتك",
    "Licensed Dietitian": "أخصائية تغذية مرخّصة",
    "Since 2017": "منذ 2017",
    "Certified Sports Nutritionist": "أخصائية تغذية رياضية معتمدة",
    "Since 2024": "منذ 2024",
    "MPH — Epidemiology &amp; Biostatistics, AUB": "ماجستير في الصحة العامة — علم الأوبئة والإحصاء الحيوي، الجامعة الأميركية في بيروت",
    "See services &amp; packages": "الخدمات والباقات",
    "Free 15-min call": "مكالمة مجانية 15 دقيقة",
    "01 — You": "01 — أنت",
    "Before we talk about plans": "قبل أن نتحدث عن الخطط",
    "Does this sound like you?": "هل يشبهك هذا؟",
    "You've lost the same few kilos three times now, and you're tired of starting over.": "خسرت الكيلوغرامات القليلة نفسها ثلاث مرات حتى الآن، وتعبت من البدء من جديد.",
    "You eat well — mostly — so you can't work out why your energy disappears every afternoon.": "تأكل جيداً — في الغالب — ولا تفهم لماذا تختفي طاقتك كل بعد ظهر.",
    "You've started running and you genuinely don't know what to eat before, during or after.": "بدأت الجري ولا تعرف فعلاً ماذا تأكل قبله وأثناءه وبعده.",
    "Every plan you've tried assumed you had an hour to cook. You don't.": "كل خطة جرّبتها افترضت أن لديك ساعة للطبخ. وليس لديك.",
    "You're trying to gain weight or build strength, and everything online is written for someone trying to lose it.": "تحاول زيادة وزنك أو بناء قوتك، وكل ما على الإنترنت مكتوب لمن يحاول خسارته.",
    "Food has turned into a negotiation you keep losing, and you'd like it to just be food again.": "تحوّل الطعام إلى مفاوضة تخسرها دائماً، وتريد أن يعود مجرد طعام.",
    "Whatever brings you here, we start where you are — not where you think you should be.": "أياً كان ما أتى بك إلى هنا، نبدأ من حيث أنت — لا من حيث تظن أنه يجب أن تكون.",
    "02 — Approach": "02 — النهج",
    "My approach": "نهجي",
    "Through DietOnTheRun, I work with people who want to feel better, improve their health, and build a healthier relationship with food — whether your goal is weight loss, healthy weight gain, improving your eating habits, supporting your health, or fuelling an active lifestyle.":
        "من خلال DietOnTheRun، أعمل مع أشخاص يريدون الشعور بتحسّن، وتحسين صحتهم، وبناء علاقة أصحّ مع الطعام — سواء كان هدفك خسارة الوزن، أو زيادته بشكل صحي، أو تحسين عاداتك الغذائية، أو دعم صحتك، أو تغذية نمط حياة نشيط.",
    "My approach is": "نهجي",
    "personalised, evidence-based, and realistic": "شخصي، مبني على الأدلة، وواقعي",
    ". I don't believe in one-size-fits-all diets or quick fixes. We look at your lifestyle, goals, preferences, routines, relationship with food, and movement to create an approach that actually fits your life.":
        ". لا أؤمن بالحميات الموحّدة للجميع ولا بالحلول السريعة. ننظر إلى نمط حياتك وأهدافك وتفضيلاتك وروتينك وعلاقتك بالطعام وحركتك، لنبني نهجاً يناسب حياتك فعلاً.",
    "Because good nutrition isn't about eating perfectly. It's about finding a way of eating that helps you feel good, stay strong, and live the life you want.":
        "لأن التغذية الجيدة لا تعني الأكل بشكل مثالي، بل إيجاد طريقة أكل تساعدك على الشعور بالرضا، والبقاء قوياً، وعيش الحياة التي تريدها.",
    "03 — Focus": "03 — التركيز",
    "Who I work with": "مع من أعمل",
    "Weight Management": "إدارة الوزن",
    "Whether your goal is to lose weight, gain weight, or find a healthy and sustainable balance, we work together to find an approach that works for you.":
        "سواء كان هدفك خسارة الوزن أو زيادته أو إيجاد توازن صحي ومستدام، نعمل معاً لإيجاد النهج المناسب لك.",
    "Health &amp; Wellbeing": "الصحة والعافية",
    "Personalised nutrition support to help you improve your energy, habits, and overall wellbeing.": "دعم غذائي شخصي يساعدك على تحسين طاقتك وعاداتك وعافيتك بشكل عام.",
    "Sports &amp; Active Nutrition": "التغذية الرياضية والنشطة",
    "For runners, athletes, and active individuals looking to better fuel training, support recovery, and improve performance.":
        "للعدّائين والرياضيين والأشخاص النشيطين الذين يريدون تغذية تدريبهم بشكل أفضل، ودعم التعافي، وتحسين الأداء.",
    "A particular passion": "شغف خاص",
    "Women's": "تغذية",
    "nutrition": "المرأة",
    "While I work with people with different goals and at different stages of life, I have a particular passion for women's health and wellbeing.":
        "مع أنني أعمل مع أشخاص بأهداف مختلفة وفي مراحل مختلفة من الحياة، لديّ شغف خاص بصحة المرأة وعافيتها.",
    "I love helping women better understand their bodies, feel stronger and more confident, and build healthy habits that support the life they want to live.":
        "أحبّ مساعدة النساء على فهم أجسادهن بشكل أفضل، والشعور بقوة وثقة أكبر، وبناء عادات صحية تدعم الحياة التي يرغبن فيها.",
    "See what that looks like in practice": "كيف يبدو ذلك على أرض الواقع",
    "Not sure which to choose?": "لست متأكداً مما تختار؟",
    "Find your": "اعثر على",
    "best fit": "الخيار الأنسب",
    "Three or four quick questions and I'll point you to the consultation or package that suits you — with the price, and a button to book it.":
        "ثلاثة أو أربعة أسئلة سريعة، وسأدلّك على الاستشارة أو الباقة المناسبة لك — مع السعر وزرّ للحجز.",
    "Takes under a minute · Nothing is stored": "أقل من دقيقة · لا يُحفَظ أي شيء",
    "04 — Work with me": "04 — اعمل معي",
    "Choose how we work together": "اختر طريقة عملنا معاً",
    "In person": "حضورياً",
    "Online": "أونلاين",
    "Core services": "الخدمات الأساسية",
    "Services &amp; packages": "الخدمات والباقات",
    "Everything below is available in person in Beirut or online, except body composition testing, which needs the analyser in the clinic. Message me on WhatsApp or by email to book.":
        "كل ما يلي متوفّر حضورياً في بيروت أو أونلاين، باستثناء تحليل تكوين الجسم الذي يحتاج إلى الجهاز في العيادة. راسلني على واتساب أو عبر البريد الإلكتروني للحجز.",
    "Initial Nutrition Consultation — 50–60 min": "استشارة التغذية الأولى — 50–60 دقيقة",
    "Follow-Up Consultation — 30–45 min": "استشارة المتابعة — 30–45 دقيقة",
    "Body Composition Assessment — in person": "تحليل تكوين الجسم — حضورياً",
    "The Start — 4 weeks": "The Start — 4 أسابيع",
    "The Reset — 6 weeks": "The Reset — 6 أسابيع",
    "The Journey — 10 weeks": "The Journey — 10 أسابيع",
    "BackOnTheRun — 6-week group challenge": "BackOnTheRun — تحدٍّ جماعي لمدة 6 أسابيع",
    "Get in touch to book": "تواصل معي للحجز",
    "Or go further": "أو اذهب أبعد",
    "Packages": "الباقات",
    "Structured support over weeks rather than a single appointment — because habits are built in the space between sessions.":
        "دعم منظّم على مدى أسابيع بدلاً من موعد واحد — لأن العادات تُبنى في المسافة بين الجلسات.",
    "05 — In their words": "05 — بكلماتهم",
    "What clients say": "ماذا يقول العملاء",
    "15-minute discovery call — free": "مكالمة تعارف لمدة 15 دقيقة — مجاناً",
    "Not sure where to start?": "لست متأكداً من أين تبدأ؟",
    "You don't need to know which consultation or package is right for you. Let's have a quick 15-minute chat about your goals, what you're looking for, and how I can best support you. I'll help you find the right place to start.":
        "لا تحتاج إلى معرفة أي استشارة أو باقة تناسبك. لنتحدث 15 دقيقة عن أهدافك وما تبحث عنه وكيف يمكنني دعمك بأفضل طريقة، وسأساعدك على إيجاد نقطة البداية المناسبة.",
    "Book the free call": "حجز المكالمة المجانية",
    "Take the quiz instead": "أو خذ الاختبار",
    "06 — Reading": "06 — للقراءة",
    "From the Journal": "من المدونة",
    "Articles, tips and the questions I get asked most.": "مقالات ونصائح وأكثر الأسئلة التي تُطرح عليّ. (المقالات بالإنجليزية)",
    "All articles": "كل المقالات",
    "For my clients": "لعملائي",
    "Your plan, as a tracker": "خطتك، كأداة متابعة",
    "Upload the meal plan I gave you and it opens here, ready to use: pick your meals, watch calories and protein add up, plan the week and get your shopping list.":
        "حمّل الخطة الغذائية التي أعطيتك إياها وستُفتح هنا جاهزة للاستعمال: اختر وجباتك، وتابع السعرات والبروتين، وخطّط للأسبوع، واحصل على قائمة التسوّق.",
    "Upload the plan I sent you": "تحميل الخطة التي أرسلتها لك",
    "Tap to choose the file, or drop it here": "اضغط لاختيار الملف، أو اسحبه إلى هنا",
    "Use the file I sent you — the plan page made for you, or a spreadsheet plan. Once it's open it stays saved on this phone, so next time it's right here. Nothing is uploaded anywhere.":
        "استعمل الملف الذي أرسلته لك — صفحة الخطة المعدّة لك، أو خطة بجدول بيانات. بعد فتحها تبقى محفوظة على هذا الهاتف، فتجدها هنا في المرة القادمة. لا يُرفع أي شيء إلى أي مكان.",
    "Try a sample plan": "جرّب خطة نموذجية",
    "Saved on this phone. Your picks are kept for next time.": "محفوظة على هذا الهاتف. تبقى اختياراتك للمرة القادمة.",
    "Full screen": "ملء الشاشة",
    "Load a different plan": "تحميل خطة أخرى",
    "Close full screen": "إغلاق ملء الشاشة",
    "Save a copy": "حفظ نسخة",
    "Today's plate": "طبق اليوم",
    "Whole week": "الأسبوع كاملاً",
    "Shopping": "التسوّق",
    "Only show meals I can make with what's in my kitchen": "إظهار الوجبات التي يمكنني تحضيرها بما في مطبخي فقط",
    "Clear day": "مسح اليوم",
    "Surprise me": "فاجئني",
    "Calories": "السعرات",
    "Protein": "البروتين",
    "Remove this pick": "إزالة هذا الاختيار",
    "General guidance only — follow the plan your dietitian gave you.": "إرشادات عامة فقط — اتّبع الخطة التي أعطتك إياها أخصائية التغذية.",
    "Spreadsheet template (for Fatima)": "نموذج جدول البيانات (لفاطمة)",
}
ATTR["dietontherun"] = {
    "Personalised, evidence-based nutrition consultations and packages with Fatima Mouzahem, licensed dietitian and certified sports nutritionist. In person in Beirut or online worldwide. Weight management, women's nutrition and sports nutrition. Free 15-minute discovery call.":
        "استشارات وباقات تغذية شخصية ومبنية على الأدلة مع فاطمة مزاحم، أخصائية تغذية مرخّصة وأخصائية تغذية رياضية معتمدة. حضورياً في بيروت أو أونلاين حول العالم. إدارة الوزن وتغذية المرأة والتغذية الرياضية. مكالمة تعارف مجانية لمدة 15 دقيقة.",
    "DietOnTheRun — Nutrition that works with your life": "DietOnTheRun — تغذية تنسجم مع حياتك",
    "Consultations and packages with a licensed dietitian and certified sports nutritionist. Beirut and online.": "استشارات وباقات مع أخصائية تغذية مرخّصة وأخصائية تغذية رياضية معتمدة. بيروت وأونلاين.",
    "Fatima Mouzahem, licensed dietitian, in a quiet corner in Beirut": "فاطمة مزاحم، أخصائية تغذية مرخّصة، في زاوية هادئة في بيروت",
    "Choose in person or online": "اختر حضورياً أو أونلاين",
    "Your meal plan": "خطتك الغذائية",
    "Day": "اليوم",
    "View": "العرض",
    "Close": "إغلاق",
}

TEXT["sheontherun"] = {
    "SheOnTheRun — Women's Running &amp; Wellness Community in Beirut": "SheOnTheRun — مجتمع الجري والعافية للنساء في بيروت",
    "Women only · Beirut": "للنساء فقط · بيروت",
    "A women-only active and wellness community where movement is the starting point.": "مجتمع للنشاط والعافية للنساء فقط، تكون فيه الحركة نقطة البداية.",
    "What's coming up": "ما القادم",
    "Join us": "انضمّي إلينا",
    "01 — Why": "01 — لماذا",
    "Why I started": "لماذا أسّست",
    "It started with a question I kept hearing:": "بدأ الأمر بسؤال كنت أسمعه باستمرار:",
    '"How do I start running?"': "«كيف أبدأ الجري؟»",
    "There weren't really running communities in Lebanon for women who simply wanted to run for fun — most clubs were about training, performance and competition. So I made the space I wished existed. Somewhere women could show up, run at their own pace, take it easy, have fun, and feel safe. No pressure, no competition, no judgment.":
        "لم تكن هناك فعلاً مجتمعات جري في لبنان للنساء اللواتي يرغبن ببساطة في الجري للمتعة — معظم الأندية كانت تركّز على التدريب والأداء والمنافسة. فأنشأت المساحة التي تمنّيت وجودها: مكاناً تأتي إليه النساء، ويركضن بوتيرتهن، ويأخذن الأمور بهدوء، ويستمتعن، ويشعرن بالأمان. لا ضغط، لا منافسة، لا أحكام.",
    "Then running took off, and clubs appeared everywhere. But SheOnTheRun had already become something bigger: a women-only active and wellness community where movement is the starting point for connection, confidence and growth. Alongside the runs there's yoga, Pilates, creative workshops, art, retreats.":
        "ثم انتشر الجري، وظهرت الأندية في كل مكان. لكن SheOnTheRun كان قد أصبح شيئاً أكبر: مجتمعاً للنشاط والعافية للنساء فقط، تكون فيه الحركة نقطة البداية للتواصل والثقة والنمو. وإلى جانب الجري هناك اليوغا والبيلاتس وورش العمل الإبداعية والفن والخلوات.",
    "The point of it": "الغاية منه",
    "It's about creating a space where women feel comfortable showing up exactly as they are — and leave a little stronger, a little happier, a little more connected.":
        "الغاية هي خلق مساحة تشعر فيها النساء بالراحة ليأتين كما هنّ تماماً — ويغادرن أقوى قليلاً، وأسعد قليلاً، وأكثر تواصلاً قليلاً.",
    "Move": "تحرّكي",
    "Group runs at an easy, talking pace. Yoga and Pilates. Whatever gets you out of the chair and into your body.":
        "جري جماعي بوتيرة هادئة تسمح بالحديث. يوغا وبيلاتس. كل ما يُخرجك من الكرسي ويعيدك إلى جسدك.",
    "Connect": "تواصلي",
    "You arrive not knowing anyone. You leave with numbers in your phone. That part happens on its own.":
        "تصلين لا تعرفين أحداً، وتغادرين وفي هاتفك أرقام جديدة. هذا الجزء يحدث من تلقاء نفسه.",
    "Grow": "تطوّري",
    "Workshops, art, retreats and challenges — the things that make space for you outside everyone else's schedule.":
        "ورش عمل وفن وخلوات وتحديات — أشياء تفسح لك مساحة خارج جداول الآخرين.",
    "02 — When": "02 — متى",
    "Come move with us": "تعالي وتحرّكي معنا",
    "All paces welcome. If you can walk for thirty minutes, you can come to your first run.":
        "جميع الوتيرات مرحّب بها. إن كنت تستطيعين المشي لثلاثين دقيقة، يمكنك المجيء إلى أول جري لك.",
    "Upcoming runs, classes &amp; events": "جولات الجري والصفوف والفعاليات القادمة",
    "Sunset runs, every week": "جري الغروب، كل أسبوع",
    "Tuesdays and Thursdays at 6:30 PM, Biel, Beirut. Thirty minutes at an easy, talking pace — all paces welcome.":
        "كل ثلاثاء وخميس الساعة 6:30 مساءً، بيال، بيروت. ثلاثون دقيقة بوتيرة هادئة تسمح بالحديث — جميع الوتيرات مرحّب بها.",
    "Get in touch to join a run": "تواصلي للانضمام إلى الجري",
    "Dates are Beirut time. Anything that's already happened disappears from this list by itself.":
        "المواعيد بتوقيت بيروت. كل ما مضى يختفي من هذه القائمة من تلقاء نفسه.",
    "03 — The community": "03 — المجتمع",
    "Moments": "لحظات",
    "on the run": "على الطريق",
    "Scroll to explore": "مرّري للاستكشاف",
}
ATTR["sheontherun"] = {
    "SheOnTheRun is a women-only running and wellness community in Beirut. Group runs at an easy pace, yoga, Pilates, workshops, retreats and challenges. No pressure, no competition, no judgment. Founded by dietitian Fatima Mouzahem.":
        "SheOnTheRun مجتمع للجري والعافية للنساء فقط في بيروت. جري جماعي بوتيرة هادئة، يوغا، بيلاتس، ورش عمل، خلوات وتحديات. لا ضغط، لا منافسة، لا أحكام. أسّسته أخصائية التغذية فاطمة مزاحم.",
    "SheOnTheRun — Move. Connect. Grow.": "SheOnTheRun — تحرّكي. تواصلي. تطوّري.",
    "A women-only running and wellness community in Beirut. Run at your own pace.": "مجتمع للجري والعافية للنساء فقط في بيروت. اركضي بوتيرتك.",
    "The SheOnTheRun women together at a race in Beirut": "نساء SheOnTheRun معاً في سباق في بيروت",
    "Show": "إظهار",
}
RAW["sheontherun"] = [
    ("connect.html?interest=sheontherun&amp;note=Hi%20Fatima!%20I'd%20like%20to%20join%20SheOnTheRun.#form",
     "connect.html?interest=sheontherun&amp;note=" + quote("مرحباً فاطمة! أودّ الانضمام إلى SheOnTheRun.") + "#form"),
]

TEXT["public-health"] = {
    "Public Health Consulting — Fatima Mouzahem, MPH | Lebanon": "استشارات الصحة العامة — فاطمة مزاحم | لبنان",
    "Public health &amp; humanitarian work": "الصحة العامة والعمل الإنساني",
    "Evidence into": "من الأدلة",
    "implementation": "إلى التنفيذ",
    "8+ years across UN agencies, government, academia and humanitarian settings — turning data into insights, and insights into action.":
        "أكثر من 8 سنوات بين وكالات الأمم المتحدة والجهات الحكومية والأكاديمية والبيئات الإنسانية — أحوّل البيانات إلى رؤى، والرؤى إلى أفعال.",
    "Discuss a project": "مناقشة مشروع",
    "Areas of expertise": "مجالات الخبرة",
    "I bring together public health, nutrition, data, research, and program experience to help organizations design, implement, monitor, and improve health programmes.":
        "أجمع بين خبرتي في الصحة العامة والتغذية والبيانات والأبحاث والبرامج لمساعدة المؤسسات على تصميم البرامج الصحية وتنفيذها ورصدها وتحسينها.",
    "With": "بفضل",
    "8+ years of experience": "أكثر من 8 سنوات من الخبرة",
    "across UN agencies, government, academia, and humanitarian settings, I have worked on projects spanning health and nutrition, primary healthcare, monitoring and evaluation, information management, research, community health, and emergency response.":
        "في وكالات الأمم المتحدة والجهات الحكومية والأكاديمية والبيئات الإنسانية، عملت على مشاريع تشمل الصحة والتغذية، والرعاية الصحية الأولية، والرصد والتقييم، وإدارة المعلومات، والأبحاث، وصحة المجتمع، والاستجابة للطوارئ.",
    "My work sits at the intersection of evidence and implementation — turning data into insights, insights into action, and complex public health challenges into practical solutions.":
        "يقع عملي عند نقطة التقاء الأدلة والتنفيذ — تحويل البيانات إلى رؤى، والرؤى إلى أفعال، وتحديات الصحة العامة المعقّدة إلى حلول عملية.",
    "Master of Public Health": "ماجستير في الصحة العامة",
    "Epidemiology &amp; Biostatistics, AUB · 2019": "علم الأوبئة والإحصاء الحيوي، الجامعة الأميركية في بيروت · 2019",
    "Organisations": "المؤسسات",
    "UNICEF · WFP · AUB · Ministry of Public Health": "اليونيسف · برنامج الأغذية العالمي · الجامعة الأميركية في بيروت · وزارة الصحة العامة",
    "Peer-reviewed": "أبحاث محكّمة",
    "Based in": "مقرّي",
    "Beirut, Lebanon — available remotely": "بيروت، لبنان — متاحة للعمل عن بُعد",
    "01 — Expertise": "01 — الخبرة",
    "Five bodies of work that keep meeting each other in the field.": "خمسة مجالات عمل تلتقي باستمرار في الميدان.",
    "Public Health &amp; Health Systems": "الصحة العامة والأنظمة الصحية",
    "Programme design, primary healthcare, health systems strengthening, referral pathways, community health, and health service improvement.":
        "تصميم البرامج، والرعاية الصحية الأولية، وتعزيز الأنظمة الصحية، ومسارات الإحالة، وصحة المجتمع، وتحسين الخدمات الصحية.",
    "Monitoring, Evaluation &amp; Learning": "الرصد والتقييم والتعلّم",
    "Monitoring frameworks, indicators, logframes, programme evaluations, data quality, performance monitoring, and reporting.":
        "أطر الرصد، والمؤشرات، والأطر المنطقية، وتقييم البرامج، وجودة البيانات، ورصد الأداء، وإعداد التقارير.",
    "Research &amp; Information Management": "الأبحاث وإدارة المعلومات",
    "Data management, dashboards, data visualization, information systems, data quality, analysis, and evidence-based decision-making.":
        "إدارة البيانات، ولوحات المعلومات، وتصوير البيانات، وأنظمة المعلومات، وجودة البيانات، والتحليل، واتخاذ القرار المبني على الأدلة.",
    "Research design, literature reviews, qualitative and quantitative research, data analysis, systematic reviews, and evidence synthesis.":
        "تصميم الأبحاث، ومراجعات الأدبيات، والأبحاث النوعية والكمية، وتحليل البيانات، والمراجعات المنهجية، وتجميع الأدلة.",
    "Humanitarian &amp; Emergency Response": "العمل الإنساني والاستجابة للطوارئ",
    "Emergency needs assessments, health and nutrition response, programme monitoring, accountability, beneficiary data management, and emergency information systems.":
        "تقييم الاحتياجات في حالات الطوارئ، والاستجابة الصحية والغذائية، ورصد البرامج، والمساءلة، وإدارة بيانات المستفيدين، وأنظمة المعلومات في حالات الطوارئ.",
    "Training &amp; Capacity Building": "التدريب وبناء القدرات",
    "Developing training programmes, learning materials, workshops, and practical tools for public health professionals, community health workers, partners, and programme teams.":
        "تطوير برامج التدريب والمواد التعليمية وورش العمل والأدوات العملية للعاملين في الصحة العامة، والعاملين الصحيين المجتمعيين، والشركاء، وفرق البرامج.",
    "02 — The path": "02 — المسار",
    "How I got here": "كيف وصلت إلى هنا",
    "I trained as a dietitian first. What I kept running into was the limit of the room: you can change what one person eats, but you can't change what a country eats one consultation at a time. So I went to AUB for a Master's in Public Health, specialising in Epidemiology and Biostatistics.":
        "تدرّبت أولاً كأخصائية تغذية. وما كنت أصطدم به باستمرار هو حدود الغرفة: يمكنك أن تغيّر ما يأكله شخص واحد، لكن لا يمكنك أن تغيّر ما يأكله بلد بأكمله استشارةً تلو الأخرى. لذلك التحقت بالجامعة الأميركية في بيروت لنيل الماجستير في الصحة العامة، بتخصّص علم الأوبئة والإحصاء الحيوي.",
    "In": "في عام",
    "I joined UNICEF as one of Lebanon's first Youth UN Volunteers — one of six selected nationally — on a global pilot focused on child survival, while still finishing the degree.":
        "انضممت إلى اليونيسف كواحدة من أوائل متطوعي الأمم المتحدة الشباب في لبنان — واحدة من ستة اختيروا على المستوى الوطني — ضمن برنامج تجريبي عالمي يركّز على بقاء الأطفال، وكنت لا أزال أُكمل دراستي.",
    "I joined the World Food Programme in Lebanon as a Monitoring &amp; Evaluation Associate, and spent two and a half years moving through different roles as the country moved through a compounding crisis.":
        "انضممت إلى برنامج الأغذية العالمي في لبنان بصفة مساعدة في الرصد والتقييم، وأمضيت سنتين ونصفاً أتنقّل بين أدوار مختلفة بينما كان البلد يمرّ بأزمات متراكمة.",
    "From": "ابتداءً من عام",
    "I consulted with UNICEF on information management — health, data and public health meeting in the same place. From":
        "عملت مستشارةً مع اليونيسف في إدارة المعلومات — حيث تلتقي الصحة والبيانات والصحة العامة. وابتداءً من عام",
    "I have consulted with Lebanon's Ministry of Public Health through AUB, working inside the national health system rather than beside it.":
        "أعمل مستشارةً مع وزارة الصحة العامة اللبنانية عبر الجامعة الأميركية في بيروت، من داخل النظام الصحي الوطني لا من جانبه.",
    "The through-line is the same one that runs through everything else I do: find out what is actually true, then make it usable by someone who has to act on Monday morning.":
        "والخيط الذي يجمع كل ما أفعله واحد: أن أعرف ما هو صحيح فعلاً، ثم أجعله قابلاً للاستعمال لمن عليه أن يتصرّف صباح الإثنين.",
    "03 — Research": "03 — الأبحاث",
    "Research &amp; publications": "الأبحاث والمنشورات",
    "Research interests": "الاهتمامات البحثية",
    "04 — In the field": "04 — في الميدان",
    "8 years in the humanitarian field": "8 سنوات في العمل الإنساني",
    "For organisations": "للمؤسسات",
    "Have a programme that needs a hand?": "لديكم برنامج يحتاج إلى دعم؟",
    "Short-term consultancies, evaluations, research support, information systems, training design — or a conversation about whether I'm the right person for it. Tell me what you're working on.":
        "استشارات قصيرة الأمد، وتقييمات، ودعم بحثي، وأنظمة معلومات، وتصميم تدريب — أو حديث حول ما إذا كنت الشخص المناسب لذلك. أخبروني بما تعملون عليه.",
    "Professional enquiries": "الاستفسارات المهنية",
    "Email directly": "مراسلة عبر البريد مباشرة",
}
ATTR["public-health"] = {
    "Public health and nutrition consulting with 8+ years across UN agencies, government, academia and humanitarian settings. Programme design, monitoring and evaluation, information management, research and capacity building. Based in Beirut, Lebanon.":
        "استشارات في الصحة العامة والتغذية بخبرة تزيد على 8 سنوات بين وكالات الأمم المتحدة والجهات الحكومية والأكاديمية والبيئات الإنسانية. تصميم البرامج، والرصد والتقييم، وإدارة المعلومات، والأبحاث، وبناء القدرات. مقرّها بيروت، لبنان.",
    "Public Health Consulting — Fatima Mouzahem, MPH": "استشارات الصحة العامة — فاطمة مزاحم",
    "8+ years across UNICEF, WFP, AUB and Lebanon's Ministry of Public Health. Evidence into implementation.":
        "أكثر من 8 سنوات مع اليونيسف وبرنامج الأغذية العالمي والجامعة الأميركية في بيروت ووزارة الصحة العامة. من الأدلة إلى التنفيذ.",
    "A UNICEF for-every-child team event in Lebanon": "فعالية لفريق اليونيسف «من أجل كل طفل» في لبنان",
    "Previous photos": "الصور السابقة",
    "Next photos": "الصور التالية",
    "Public health consulting enquiry": "استفسار حول استشارات الصحة العامة",
}
RAW["public-health"] = [
    # right-to-left: "previous" lies to the right, so the arrows swap
    ('aria-label="Previous photos">&#8592;</button>', 'aria-label="Previous photos">&#8594;</button>'),
    ('aria-label="Next photos">&#8594;</button>', 'aria-label="Next photos">&#8592;</button>'),
]

TEXT["shop"] = {
    "Shop — SheOnTheRun Merchandise &amp; Wellness Tools | Beirut": "المتجر — منتجات SheOnTheRun وأدوات العافية | بيروت",
    "Pay on delivery · Delivery across Lebanon": "الدفع عند الاستلام · التوصيل إلى كل لبنان",
    "The shop": "المتجر",
    "SheOnTheRun club kit, practical wellness tools and a few of my own picks. Payment is cash on delivery, anywhere in Lebanon.":
        "ملابس نادي SheOnTheRun، وأدوات عافية عملية، وبعض اختياراتي الشخصية. الدفع نقداً عند الاستلام، في أي مكان في لبنان.",
    "Get in touch to order": "تواصل معي للطلب",
}
ATTR["shop"] = {
    "SheOnTheRun club merchandise, practical wellness tools recommended by a licensed dietitian, and personal picks for running and nutrition. Cash on delivery across Lebanon. Modest activewear coming soon.":
        "منتجات نادي SheOnTheRun، وأدوات عافية عملية توصي بها أخصائية تغذية مرخّصة، واختيارات شخصية للجري والتغذية. الدفع عند الاستلام في كل لبنان. ملابس رياضية محتشمة قريباً.",
    "Shop — SheOnTheRun": "المتجر — SheOnTheRun",
    "Club kit, wellness tools and my own picks. Cash on delivery across Lebanon.": "ملابس النادي وأدوات العافية واختياراتي. الدفع عند الاستلام في كل لبنان.",
    "Filter by category": "تصفية حسب الفئة",
}
RAW["shop"] = [
    ('The <span class="echo" data-echo="Shop">Shop</span>', '<span class="echo" data-echo="المتجر">المتجر</span>'),
]

TEXT["connect"] = {
    "Connect with Fatima Mouzahem — Dietitian in Beirut": "تواصل مع فاطمة مزاحم — أخصائية تغذية في بيروت",
    "Usually replies within a day": "تردّ عادةً خلال يوم",
    "Let's connect": "لنتواصل",
    "Tell me which part of my work you're here for and your message goes straight to the right inbox.":
        "أخبرني بأيّ جزء من عملي تهتم، وستصل رسالتك مباشرة إلى البريد المناسب.",
    "I'm getting in touch about": "أتواصل بخصوص",
    "Nutrition Consultation": "استشارة تغذية",
    "Events / Partnerships": "فعاليات / شراكات",
    "Research / Professional Enquiries": "أبحاث / استفسارات مهنية",
    "General": "عام",
    "Your name": "اسمك",
    "Your email": "بريدك الإلكتروني",
    "Your message": "رسالتك",
    "Send by email": "إرسال عبر البريد الإلكتروني",
    "Send on WhatsApp": "إرسال عبر واتساب",
    "Your message opens in your email app, already written and addressed to the right inbox — nothing is stored on this site.":
        "تُفتح رسالتك في تطبيق البريد لديك، مكتوبة وموجّهة إلى البريد المناسب — لا يُحفظ أي شيء على هذا الموقع.",
    "Where I am": "أين أنا",
    "Gemmayze, Beirut": "الجمّيزة، بيروت",
    "I offer in-person consultations in Lebanon and online services around the world.": "أقدّم استشارات حضورية في لبنان وخدمات أونلاين حول العالم.",
    "Address:": "العنوان:",
    "Gemmayze, Beirut, Lebanon": "الجمّيزة، بيروت، لبنان",
    "Gemmayze, Accaoui Street, next to Belbol Ameublement, Blue Building, Beirut, Lebanon":
        "الجمّيزة، شارع العكاوي، بجانب Belbol Ameublement، المبنى الأزرق، بيروت، لبنان",
    "Open in Google Maps": "فتح في خرائط Google",
    "Email me directly": "راسلني مباشرة",
    "Main &amp; professional": "الرئيسي والمهني",
    "Message me": "راسلني",
}
ATTR["connect"] = {
    "Book a nutrition consultation, join SheOnTheRun, ask about events and partnerships, or send a research or professional enquiry. WhatsApp or email, Beirut and online.":
        "احجز استشارة تغذية، أو انضمّي إلى SheOnTheRun، أو اسأل عن الفعاليات والشراكات، أو أرسل استفساراً بحثياً أو مهنياً. واتساب أو البريد الإلكتروني، بيروت وأونلاين.",
    "Connect with Fatima Mouzahem": "تواصل مع فاطمة مزاحم",
    "Nutrition, SheOnTheRun, events, research — tell me which one and I'll come back to you.": "التغذية، SheOnTheRun، الفعاليات، الأبحاث — أخبرني بأيّها وسأعود إليك.",
    "What you're hoping for, and anything you'd like me to know before we talk.": "ما الذي تأمل فيه، وأي شيء تودّ أن أعرفه قبل أن نتحدث.",
    "Map: Accaoui Street, Gemmayze, Beirut": "خريطة: شارع العكاوي، الجمّيزة، بيروت",
}

# Text that may stay in Latin script on an Arabic page (names, logos, emails).
KEEP = {
    "DietOnTheRun", "SheOnTheRun", "BackOnTheRun", "She", "On the Run", "BMJ Open · Public Health",
    "fatimahmouzahem08@gmail.com", "dietontherun@gmail.com", "sheonzrun@gmail.com", "&times;", "English",
}
TEXT_ATTRS = ["alt", "aria-label", "placeholder", "title", "data-wa", "data-email", "data-alt", "data-cap", "content"]
FONTS = ('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..700,0..100,0..1'
         '&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&family=IBM+Plex+Sans+Arabic:wght@400;500;600'
         '&family=Noto+Naskh+Arabic:wght@400..600&display=swap')


def lang_links(page):
    """The English/Arabic switch for the English page's nav and drawer."""
    return (f'<a class="lang" href="ar/{page}.html" lang="ar" hreflang="ar">العربية</a>',
            f'<a href="ar/{page}.html" lang="ar" hreflang="ar">العربية</a>')


def prepare_english(page):
    """Give the English page its switch and hreflang links (once)."""
    path = ROOT / f"{page}.html"
    s = path.read_text(encoding="utf8")
    nav_link, drawer_link = lang_links(page)
    changed = False
    if f'href="ar/{page}.html"' not in s:
        s = s.replace('      <a href="shop.html">Shop</a>\n      <a class="btn sm lilac"',
                      f'      <a href="shop.html">Shop</a>\n      {nav_link}\n      <a class="btn sm lilac"', 1)
        s = s.replace('    <a href="shop.html">Shop</a>\n  </nav>',
                      f'    <a href="shop.html">Shop</a>\n    {drawer_link}\n  </nav>', 1)
        changed = True
    if 'hreflang="ar" href=' not in s:
        s = re.sub(r'(<link rel="canonical" href="[^"]+">)',
                   r'\1\n<link rel="alternate" hreflang="en" href="' + SITE + page + '.html">'
                   '\n<link rel="alternate" hreflang="ar" href="' + SITE + 'ar/' + page + '.html">', s, count=1)
        changed = True
    if f'href="ar/{page}.html"' not in s:
        sys.exit(f"{page}.html: couldn't place the Arabic switch — check its nav.")
    if changed:
        path.write_text(s, encoding="utf8")


def to_arabic(page):
    s = (ROOT / f"{page}.html").read_text(encoding="utf8")
    text = dict(COMMON, **TEXT.get(page, {}))
    attrs = dict(COMMON_ATTR, **text, **ATTR.get(page, {}))
    problems = []

    for en, ar in RAW.get(page, []):
        if en not in s:
            problems.append("raw text not found: " + en[:70])
        s = s.replace(en, ar)

    # language, direction, and where "the root" is from one folder down
    s = s.replace('<html lang="en">', '<html lang="ar" dir="rtl" data-root="../">', 1)
    nav_link, drawer_link = lang_links(page)
    s = s.replace(nav_link, f'<a class="lang" href="../{page}.html" lang="en" hreflang="en">English</a>')
    s = s.replace(drawer_link, f'<a href="../{page}.html" lang="en" hreflang="en">English</a>')
    s = re.sub(r'<link rel="canonical" href="[^"]+">', f'<link rel="canonical" href="{SITE}ar/{page}.html">', s, count=1)
    s = re.sub(r'(<meta property="og:url" content=")[^"]+(">)', r'\g<1>' + SITE + 'ar/' + page + r'.html\2', s, count=1)
    s = s.replace('<meta property="og:type"', '<meta property="og:locale" content="ar_LB">\n<meta property="og:type"', 1)
    s = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com/css2\?[^"]+">',
               f'<link rel="stylesheet" href="{FONTS}">', s, count=1)
    s = s.replace('<script src="assets/js/site.js" defer></script>',
                  '<script src="data/ar.js"></script>\n<script src="assets/js/site.js" defer></script>', 1)

    # paths: files live one folder up; the Journal stays in English
    def fix_paths(value):
        return re.sub(r'(^|[\s,])((?:public|assets|data|journal)/|favicon\.ico|site\.webmanifest|feed\.xml)',
                      r'\1../\2', value)
    s = re.sub(r'\b(href|src|srcset|imagesrcset)="([^"]*)"',
               lambda m: f'{m.group(1)}="{fix_paths(m.group(2))}"', s)

    # words: text between tags (outside scripts and styles), then attributes
    parts = re.split(r'(<script\b[\s\S]*?</script>|<style\b[\s\S]*?</style>|<!--[\s\S]*?-->)', s)
    for i in range(0, len(parts), 2):
        def swap(m):
            raw = m.group(1)
            key = raw.strip()
            if not key or not re.search(r'[A-Za-z]{2,}', key):
                return m.group(0)
            if key in text:
                lead = raw[:len(raw) - len(raw.lstrip())]
                trail = raw[len(raw.rstrip()):]
                return ">" + lead + text[key] + trail + "<"
            if key not in KEEP and not re.search(r'[؀-ۿ]', key):
                problems.append("text: " + key)
            return m.group(0)
        parts[i] = re.sub(r'>([^<>]+)<', swap, parts[i])

        def swap_attr(m):
            name, value = m.group(1), m.group(2)
            if value in attrs:
                return f'{name}="{attrs[value]}"'
            if name == "content" and (not re.search(r'\s', value) or "=" in value):
                return m.group(0)
            if re.search(r'[A-Za-z]{2,}', value) and not re.search(r'[؀-ۿ]', value) and value not in KEEP:
                problems.append(f"{name}: {value}")
            return m.group(0)
        parts[i] = re.sub(r'\b(' + '|'.join(TEXT_ATTRS) + r')="([^"]*)"', swap_attr, parts[i])
    s = "".join(parts)
    return s, problems


def main():
    all_problems = {}
    for page in PAGES:
        prepare_english(page)
        html, problems = to_arabic(page)
        if problems:
            all_problems[page] = problems
            continue
        (ROOT / "ar" / f"{page}.html").write_text(html, encoding="utf8")
        print(f"ar/{page}.html written")
    if all_problems:
        for page, problems in all_problems.items():
            print(f"\n{page}.html — no Arabic yet for:")
            for p in dict.fromkeys(problems):
                print("   ", p)
        sys.exit(1)


if __name__ == "__main__":
    main()
