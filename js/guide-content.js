/* DYON — the beginner guide.
   Plain language, bilingual, no jargon left undefined. Every chapter explains
   WHAT a thing is, WHY it exists, and WHEN to use it — because a ledger full of
   unexplained fiqh and finance terms would exclude the very people it is for. */

export const GUIDE = [
  {
    id: "start",
    icon: "fa-hand-sparkles",
    title: {
      en: "Start here: what DYON is",
      ar: "ابدأ من هنا: ما هو ديون",
      fr: "Commencer ici : ce qu’est DYON"
    },
    lead: {
      en: "DYON is a private notebook for everything you owe and everything you are owed. Not only money — also items, hours, promises and trusts.",
      ar: "ديون دفتر خاص لكل ما عليك وكل ما لك. ليس المال وحده، بل الأشياء والساعات والوعود والأمانات أيضًا.",
      fr: "DYON est un carnet privé pour tout ce que vous devez et tout ce qu’on vous doit. Pas seulement de l’argent — aussi des objets, des heures, des promesses et des dépôts confiés."
    },
    blocks: [
      {
        type: "why",
        title: {
          en: "Why it exists",
          ar: "لماذا وُجد",
          fr: "Pourquoi il existe"
        },
        body: {
          en: "The heaviest part of a debt is often not the amount. It is the not-knowing: who exactly, how much, since when, and whether the other person is quietly hurt. Writing it down removes that fog.",
          ar: "أثقل ما في الدَّين ليس المبلغ غالبًا، بل عدم المعرفة: مَن بالضبط، وكم، ومنذ متى، وهل الطرف الآخر متضايق في صمت. الكتابة تزيل هذا الضباب.",
          fr: "Le plus lourd dans une dette, ce n’est souvent pas le montant. C’est le flou : qui exactement, combien, depuis quand, et si l’autre personne est blessée sans le dire. L’écrire dissipe ce brouillard."
        }
      },
      {
        type: "list",
        title: {
          en: "What it will never do",
          ar: "ما لن يفعله أبدًا",
          fr: "Ce qu’il ne fera jamais"
        },
        items: [
          {
            en: "It never lends you money and never takes a fee from a loan.",
            ar: "لا يُقرضك ولا يأخذ عمولة على قرض.",
            fr: "Il ne vous prête jamais d’argent et ne prélève jamais de commission sur un prêt."
          },
          {
            en: "It never adds interest, late fees or penalties. Not as an option, not anywhere.",
            ar: "لا يضيف فائدة ولا رسوم تأخير ولا غرامة. لا كخيار ولا في أي مكان.",
            fr: "Il n’ajoute jamais d’intérêt, de frais de retard ni de pénalité. Ni en option, ni nulle part."
          },
          {
            en: "It never messages anyone for you. You write and send every message yourself.",
            ar: "لا يراسل أحدًا نيابة عنك. أنت من يكتب ويرسل كل رسالة.",
            fr: "Il n’écrit jamais à personne à votre place. Chaque message, c’est vous qui l’écrivez et l’envoyez."
          },
          {
            en: "It never shows your debts to anyone. There is no public list, no score sent anywhere.",
            ar: "لا يُظهر ديونك لأحد. لا قائمة عامة ولا تقييم يُرسل إلى أي جهة.",
            fr: "Il ne montre jamais vos dettes à qui que ce soit. Pas de liste publique, pas de score envoyé où que ce soit."
          }
        ]
      },
      {
        type: "tip",
        body: {
          en: "Everything lives in this browser, on this device. No account, no server. That also means: if you clear your browser data, it is gone — so export a backup now and then.",
          ar: "كل شيء داخل هذا المتصفح على هذا الجهاز. بلا حساب ولا خادم. وهذا يعني أيضًا أن مسح بيانات المتصفح يمحوها، فصدِّر نسخة احتياطية بين حين وآخر.",
          fr: "Tout vit dans ce navigateur, sur cet appareil. Pas de compte, pas de serveur. Cela veut aussi dire que si vous effacez les données du navigateur, tout disparaît — pensez donc à exporter une sauvegarde de temps en temps."
        }
      }
    ]
  },
  {
    id: "first-entry",
    icon: "fa-pen-to-square",
    title: {
      en: "Your first entry, step by step",
      ar: "أول إدخال، خطوة خطوة",
      fr: "Votre première note, pas à pas"
    },
    lead: {
      en: "Press the + button in the header (or the big + on your phone). The form asks six small things. Only three are required.",
      ar: "اضغط زر + في الأعلى (أو زر + الكبير على الهاتف). يسألك النموذج عن ست أمور صغيرة، ثلاثة منها فقط مطلوبة.",
      fr: "Appuyez sur le bouton + en haut (ou sur le grand + de votre téléphone). Le formulaire pose six petites questions. Trois seulement sont obligatoires."
    },
    blocks: [
      {
        type: "steps",
        items: [
          {
            k: {
              en: "1. Direction",
              ar: "١. الاتجاه",
              fr: "1. Sens"
            },
            v: {
              en: "Is this money/thing going FROM you or TO you? Pick \"I owe\" or \"Owed to me\".",
              ar: "هل هذا الشيء عليك أم لك؟ اختر «عليّ» أو «لي».",
              fr: "Cet argent ou cet objet part-il DE vous ou VERS vous ? Choisissez « Je dois » ou « On me doit »."
            }
          },
          {
            k: {
              en: "2. Type",
              ar: "٢. النوع",
              fr: "2. Type"
            },
            v: {
              en: "A loan? A shop tab? A borrowed drill? A promise? Pick the closest chip. You can change it later.",
              ar: "قرض؟ حساب عند محل؟ مثقاب مستعار؟ وعد؟ اختر الأقرب، ويمكنك تغييره لاحقًا.",
              fr: "Un prêt ? Une ardoise chez un commerçant ? Une perceuse empruntée ? Une promesse ? Choisissez la pastille la plus proche. Vous pourrez la changer ensuite."
            }
          },
          {
            k: {
              en: "3. Who",
              ar: "٣. مع مَن",
              fr: "3. Qui"
            },
            v: {
              en: "A name, or a nickname if you prefer privacy (\"the neighbour\"). Required.",
              ar: "اسم، أو كنية إن أردت الخصوصية («الجار»). مطلوب.",
              fr: "Un nom, ou un surnom si vous préférez la discrétion (« le voisin »). Obligatoire."
            }
          },
          {
            k: {
              en: "4. Amount + unit",
              ar: "٤. المبلغ والوحدة",
              fr: "4. Montant + unité"
            },
            v: {
              en: "A number and what it is counted in: SAR, EUR, hours, items, grams of gold. Required unless it is a pure promise.",
              ar: "رقم وما يُعدّ به: ريال، يورو، ساعات، قطع، غرامات ذهب. مطلوب إلا إذا كان وعدًا خالصًا.",
              fr: "Un nombre et ce dans quoi il se compte : SAR, EUR, heures, objets, grammes d’or. Obligatoire, sauf pour une simple promesse."
            }
          },
          {
            k: {
              en: "5. Dates",
              ar: "٥. التواريخ",
              fr: "5. Dates"
            },
            v: {
              en: "\"Date incurred\" is when it happened (required, cannot be in the future). \"Due\" is optional — \"when able\" is a perfectly valid answer.",
              ar: "«تاريخ النشوء» متى حدث (مطلوب، ولا يكون في المستقبل). و«الاستحقاق» اختياري، و«عند الميسرة» إجابة صحيحة تمامًا.",
              fr: "La « date de l’engagement » est le moment où c’est arrivé (obligatoire, jamais dans le futur). L’« échéance » est facultative — « quand ce sera possible » est une réponse tout à fait valable."
            }
          },
          {
            k: {
              en: "6. Privacy",
              ar: "٦. الخصوصية",
              fr: "6. Confidentialité"
            },
            v: {
              en: "Private (only you) or Shared (you will send the other person a summary to confirm).",
              ar: "خاص (أنت فقط) أو مشارَك (سترسل للطرف الآخر ملخصًا ليؤكده).",
              fr: "Privé (vous seul) ou Partagé (vous enverrez un résumé à l’autre personne pour qu’elle confirme)."
            }
          }
        ]
      },
      {
        type: "tip",
        title: {
          en: "The fastest way",
          ar: "أسرع طريقة",
          fr: "Le plus rapide"
        },
        body: {
          en: "Type a whole sentence in the top box — \"Lent Sara 200 euros, she'll pay me back on 1 March\" — and press \"Read it\". DYON fills the fields in for you. It always shows you what it understood before anything is saved; it never guesses silently.",
          ar: "اكتب جملة كاملة في الصندوق العلوي — «أخذت من أحمد ٥٠٠ ريال أردها بعد شهر» — واضغط «افهمها». يملأ ديون الحقول نيابةً عنك، ويعرض دائمًا ما فهمه قبل الحفظ، ولا يخمّن في صمت.",
          fr: "Tapez une phrase entière dans la case du haut — « Prêté 200 euros à Sara, elle me rembourse le 1er mars » — puis appuyez sur « Lire ». DYON remplit les champs pour vous. Il vous montre toujours ce qu’il a compris avant d’enregistrer quoi que ce soit ; il ne devine jamais en silence."
        }
      },
      {
        type: "tip",
        title: {
          en: "Rough is fine",
          ar: "التقريب مقبول",
          fr: "L’approximation suffit"
        },
        body: {
          en: "Do not stall because you cannot remember the exact figure. Write \"maybe 300\", tick \"It's approximate\", and tidy it later. A rough written record beats a perfect forgotten one.",
          ar: "لا تتوقف لأنك لا تذكر الرقم بدقة. اكتب «ربما ٣٠٠» وعلِّم «المبلغ تقريبي» ثم هذِّبه لاحقًا. سجل تقريبي مكتوب خير من سجل دقيق منسي.",
          fr: "Ne bloquez pas parce que vous ne vous souvenez plus du chiffre exact. Écrivez « peut-être 300 », cochez « C’est approximatif » et précisez plus tard. Une note approximative vaut mieux qu’une note parfaite oubliée."
        }
      }
    ]
  },
  {
    id: "screens",
    icon: "fa-compass",
    title: {
      en: "Every screen, and what it is for",
      ar: "كل شاشة وما فائدتها",
      fr: "Chaque écran, et à quoi il sert"
    },
    lead: {
      en: "The left sidebar (bottom bar on a phone) holds these. Here is when to open each one.",
      ar: "الشريط الجانبي (أو الشريط السفلي في الهاتف) يحوي هذه الشاشات. وإليك متى تفتح كلًّا منها.",
      fr: "La barre latérale (la barre du bas sur un téléphone) les regroupe. Voici quand ouvrir chacun."
    },
    blocks: [
      {
        type: "defs",
        items: [
          {
            k: {
              en: "Overview",
              ar: "النظرة العامة",
              fr: "Vue d’ensemble"
            },
            v: {
              en: "Your home. The honest whole picture, plus one suggested next step. Open it daily, for a minute.",
              ar: "بيتك. الصورة الكاملة بصدق، مع خطوة تالية مقترحة واحدة. افتحها يوميًا لدقيقة.",
              fr: "Votre accueil. Le tableau complet et honnête, plus une étape suggérée. Ouvrez-la chaque jour, une minute."
            }
          },
          {
            k: {
              en: "Ledger",
              ar: "السجل",
              fr: "Registre"
            },
            v: {
              en: "Every commitment in one searchable list. Filter by direction, unit or status; toggle \"Closed\" to see finished ones.",
              ar: "كل الالتزامات في قائمة واحدة قابلة للبحث. صفِّ حسب الاتجاه أو الوحدة أو الحالة، وافتح «المغلقة» لترى المنتهية.",
              fr: "Tous les engagements dans une seule liste où l’on peut chercher. Filtrez par sens, unité ou statut ; activez « Clos » pour voir ceux qui sont terminés."
            }
          },
          {
            k: {
              en: "People",
              ar: "الأشخاص",
              fr: "Personnes"
            },
            v: {
              en: "The same debts seen as relationships. Shows your balance with each person across every unit.",
              ar: "الديون نفسها لكن كعلاقات. تُظهر رصيدك مع كل شخص بكل الوحدات.",
              fr: "Les mêmes dettes, vues comme des relations. Montre votre solde avec chaque personne, pour chaque unité."
            }
          },
          {
            k: {
              en: "Inbox",
              ar: "الوارد",
              fr: "À traiter"
            },
            v: {
              en: "Only things that need a decision from you: confirmations, respite requests, disputes, settlement offers.",
              ar: "ما يحتاج قرارًا منك فقط: تأكيدات، طلبات إنظار، نزاعات، عروض صلح.",
              fr: "Uniquement ce qui demande une décision de votre part : confirmations, demandes de délai de grâce, désaccords, propositions de règlement."
            }
          },
          {
            k: {
              en: "Calendar",
              ar: "التقويم",
              fr: "Calendrier"
            },
            v: {
              en: "Due dates on a month grid, so nothing surprises you. Supports Hijri dates.",
              ar: "مواعيد الاستحقاق على شبكة شهرية فلا يفاجئك شيء، ويدعم التاريخ الهجري.",
              fr: "Les échéances sur une grille mensuelle, pour ne jamais être surpris. Accepte les dates hégiriennes."
            }
          },
          {
            k: {
              en: "Promises · Services · Trusts",
              ar: "الوعود والخدمات والأمانات",
              fr: "Promesses · Services · Dépôts confiés"
            },
            v: {
              en: "The non-money modules. A promised visit, twelve owed hours, your brother's laptop — these weigh on the mind too.",
              ar: "الوحدات غير المالية. زيارة موعودة، واثنتا عشرة ساعة مستحقة، وحاسوب أخيك — هذه تثقل القلب أيضًا.",
              fr: "Les modules sans argent. Une visite promise, douze heures dues, l’ordinateur de votre frère — cela pèse aussi sur l’esprit."
            }
          },
          {
            k: {
              en: "Plans",
              ar: "الخطط",
              fr: "Plans"
            },
            v: {
              en: "A kinder order for paying things off, based on what you can really set aside each month. No interest is ever involved.",
              ar: "ترتيب ألطف للسداد بناءً على ما تستطيع تخصيصه فعلًا كل شهر، وبلا أي فائدة إطلاقًا.",
              fr: "Un ordre plus doux pour rembourser, selon ce que vous pouvez réellement mettre de côté chaque mois. Jamais aucun intérêt."
            }
          },
          {
            k: {
              en: "Calm mode",
              ar: "وضع السكينة",
              fr: "Mode sérénité"
            },
            v: {
              en: "Hides all totals and shows one small step. For the evenings when the numbers are too loud.",
              ar: "يخفي كل الإجماليات ويعرض خطوة صغيرة واحدة. لليالي التي تصبح فيها الأرقام صاخبة.",
              fr: "Masque tous les totaux et montre une seule petite étape. Pour les soirs où les chiffres font trop de bruit."
            }
          },
          {
            k: {
              en: "Vault",
              ar: "الخزنة",
              fr: "Coffre"
            },
            v: {
              en: "Receipts and screenshots attached to records. Each file gets a fingerprint so you can prove it was not altered.",
              ar: "إيصالات ولقطات مرفقة بالسجلات. لكل ملف بصمة تثبت أنه لم يُعدَّل.",
              fr: "Reçus et captures d’écran joints aux notes. Chaque fichier reçoit une empreinte qui permet de prouver qu’il n’a pas été modifié."
            }
          },
          {
            k: {
              en: "Reports & Estate",
              ar: "التقارير والوصية",
              fr: "Rapports et succession"
            },
            v: {
              en: "Your own private statistics, and a printable sheet for your family in case something happens to you.",
              ar: "إحصاءاتك الخاصة، وورقة قابلة للطباعة لأهلك إن حدث لك شيء.",
              fr: "Vos statistiques privées, et une fiche imprimable pour votre famille au cas où il vous arriverait quelque chose."
            }
          },
          {
            k: {
              en: "Islamic corner",
              ar: "الركن الإسلامي",
              fr: "Espace islamique"
            },
            v: {
              en: "Optional. Verses, du'a, an intention pledge and a private spiritual ledger. Off unless you turn it on.",
              ar: "اختياري. آيات وأدعية وعهد نية وسجل روحي خاص. مغلق حتى تفتحه بنفسك.",
              fr: "Facultatif. Versets, du’a, engagement d’intention et registre spirituel privé. Désactivé tant que vous ne l’activez pas."
            }
          }
        ]
      }
    ]
  },
  {
    id: "dashboard",
    icon: "fa-gauge-high",
    title: {
      en: "Reading the Overview cards",
      ar: "قراءة بطاقات النظرة العامة",
      fr: "Lire les cartes de la vue d’ensemble"
    },
    lead: {
      en: "Each card answers one question. The small grey code (W-01, W-02…) is just a reference to the specification — ignore it.",
      ar: "كل بطاقة تجيب عن سؤال واحد. الرمز الرمادي الصغير (W-01، W-02…) مجرد إشارة إلى الوثيقة المرجعية، فتجاهله.",
      fr: "Chaque carte répond à une question. Le petit code gris (W-01, W-02…) renvoie simplement à la spécification — vous pouvez l’ignorer."
    },
    blocks: [
      {
        type: "defs",
        items: [
          {
            k: {
              en: "Net position",
              ar: "الموقف الصافي",
              fr: "Position nette"
            },
            v: {
              en: "\"Where do I actually stand?\" One row per currency. Riyals are never added to euros — mixing units would be a lie, so DYON refuses to do it unless you explicitly switch on the converted view.",
              ar: "«أين أقف فعلًا؟» صف لكل عملة. لا تُجمع الريالات مع اليوروات أبدًا، لأن خلط الوحدات كذب، فيرفضه ديون إلا إذا فعّلت العرض المحوَّل صراحةً.",
              fr: "« Où en suis-je vraiment ? » Une ligne par devise. Les riyals ne sont jamais additionnés aux euros — mélanger les unités serait mentir ; DYON s’y refuse, sauf si vous activez explicitement la vue convertie."
            }
          },
          {
            k: {
              en: "Clarity score",
              ar: "مؤشر الوضوح",
              fr: "Indice de clarté"
            },
            v: {
              en: "\"How complete are my records?\" NOT how good a person you are, and not a credit score. It counts missing dates, missing descriptions and approximate amounts. It is private and never leaves your device.",
              ar: "«ما مدى اكتمال سجلاتي؟» وليس مدى صلاحك، ولا هو تقييم ائتماني. يحصي المواعيد الناقصة والأوصاف الغائبة والمبالغ التقريبية، وهو خاص ولا يغادر جهازك.",
              fr: "« Mes notes sont-elles complètes ? » Il ne dit PAS quelle personne vous êtes, et ce n’est pas un score de crédit. Il compte les dates manquantes, les descriptions absentes et les montants approximatifs. Il reste privé et ne quitte jamais votre appareil."
            }
          },
          {
            k: {
              en: "Needs your response",
              ar: "ما يحتاج ردّك",
              fr: "En attente de votre réponse"
            },
            v: {
              en: "\"Who is waiting on me?\" This is the only card that cannot be hidden, because someone else is on the other end of it.",
              ar: "«من ينتظرني؟» البطاقة الوحيدة التي لا يمكن إخفاؤها، لأن في الطرف الآخر إنسانًا ينتظر.",
              fr: "« Qui attend après moi ? » C’est la seule carte qu’on ne peut pas masquer, parce que quelqu’un se trouve à l’autre bout."
            }
          },
          {
            k: {
              en: "Next due",
              ar: "الاستحقاق القادم",
              fr: "Prochaine échéance"
            },
            v: {
              en: "\"What is closest?\" One item with its buttons right there, so you can act without hunting for it.",
              ar: "«ما الأقرب؟» بند واحد وأزراره بجانبه، فتتصرف دون بحث.",
              fr: "« Qu’est-ce qui arrive en premier ? » Un élément avec ses boutons sous la main, pour agir sans chercher."
            }
          },
          {
            k: {
              en: "Upcoming 30 days",
              ar: "الثلاثون يومًا القادمة",
              fr: "Les 30 prochains jours"
            },
            v: {
              en: "\"What is about to land?\" Overdue items are amber. Nothing here is ever red — debt is not an emergency siren.",
              ar: "«ما الذي يقترب؟» المتأخر بالكهرماني. ولا شيء هنا بالأحمر أبدًا، فالدَّين ليس صفارة إنذار.",
              fr: "« Qu’est-ce qui approche ? » Les échéances passées sont en ambre. Rien n’est jamais en rouge ici — une dette n’est pas une sirène d’alarme."
            }
          },
          {
            k: {
              en: "Fulfilled & released",
              ar: "ما وُفّي وما أُبرئ",
              fr: "Honorés et libérés"
            },
            v: {
              en: "\"What have I closed?\" Deliberately placed as prominently as what is overdue, because closure deserves to be seen.",
              ar: "«ماذا أغلقت؟» وُضعت عمدًا بوضوح يوازي المتأخرات، لأن الإغلاق يستحق أن يُرى.",
              fr: "« Qu’ai-je clos ? » Placé exprès aussi en vue que ce qui est en retard, parce qu’un engagement clos mérite d’être vu."
            }
          },
          {
            k: {
              en: "How do your debts feel?",
              ar: "كيف تشعر تجاه ديونك؟",
              fr: "Comment vivez-vous vos dettes ?"
            },
            v: {
              en: "A weekly 1–5 tap. If this number gets worse while you use DYON, the app is failing you — that is written into its design, not hidden.",
              ar: "ضغطة أسبوعية من ١ إلى ٥. إن ساء هذا الرقم مع استخدامك للتطبيق فالتطبيق يخذلك، وهذا مكتوب في تصميمه لا مخفيّ.",
              fr: "Une note de 1 à 5 chaque semaine. Si ce chiffre empire pendant que vous utilisez DYON, l’application vous fait défaut — c’est écrit dans sa conception, pas caché."
            }
          },
          {
            k: {
              en: "Insights",
              ar: "إضاءات",
              fr: "Pistes"
            },
            v: {
              en: "One gentle tip per day, maximum. Never nagging, always dismissible.",
              ar: "نصيحة لطيفة واحدة يوميًا بحد أقصى. بلا إلحاح، ويمكن صرفها دائمًا.",
              fr: "Une suggestion douce par jour, au maximum. Jamais insistante, toujours ignorable."
            }
          }
        ]
      },
      {
        type: "tip",
        body: {
          en: "Sections like \"Progress & wellbeing\" start collapsed. Press \"Show\" to open them; DYON remembers your choice.",
          ar: "أقسام مثل «التقدم والعافية» تبدأ مطوية. اضغط «إظهار» لفتحها، ويتذكر ديون اختيارك.",
          fr: "Des sections comme « Avancées et bien-être » sont repliées au départ. Appuyez sur « Afficher » pour les ouvrir ; DYON se souvient de votre choix."
        }
      }
    ]
  },
  {
    id: "actions",
    icon: "fa-wand-magic-sparkles",
    title: {
      en: "The actions on a record",
      ar: "الإجراءات على كل سجل",
      fr: "Les actions sur une note"
    },
    lead: {
      en: "Tap any commitment to open it. These buttons appear — here is exactly what each one does.",
      ar: "اضغط أي التزام لفتحه، فتظهر هذه الأزرار. وإليك ما يفعله كل واحد بالضبط.",
      fr: "Touchez n’importe quel engagement pour l’ouvrir. Ces boutons apparaissent — voici exactement ce que fait chacun."
    },
    blocks: [
      {
        type: "defs",
        items: [
          {
            k: {
              en: "Record a payment",
              ar: "سجّل دفعة",
              fr: "Enregistrer un paiement"
            },
            v: {
              en: "Log part or all of what was handed over. DYON refuses an amount larger than what remains, so the maths can never go wrong.",
              ar: "سجّل ما سُلِّم كله أو بعضه. يرفض ديون أي مبلغ أكبر من المتبقي، فلا يختل الحساب أبدًا.",
              fr: "Notez une partie ou la totalité de ce qui a été remis. DYON refuse un montant supérieur au reste, pour que le calcul ne puisse jamais dérailler."
            }
          },
          {
            k: {
              en: "Send a reminder",
              ar: "أرسل تذكيرًا",
              fr: "Envoyer un rappel"
            },
            v: {
              en: "Writes the message for you in the tone you pick, then YOU send it via WhatsApp, SMS or email. Capped at one per record per week, and three per person per month — a hard limit you cannot override, because it protects the friendship.",
              ar: "يكتب الرسالة لك بالنبرة التي تختارها، ثم ترسلها أنت عبر واتساب أو رسالة أو بريد. الحد تذكير واحد لكل سجل أسبوعيًا، وثلاثة لكل شخص شهريًا، وهو حد صارم لا يمكن تجاوزه لأنه يحمي العلاقة.",
              fr: "Rédige le message dans le ton que vous choisissez, puis c’est VOUS qui l’envoyez par WhatsApp, SMS ou e-mail. Limité à un par note et par semaine, et trois par personne et par mois — une limite ferme, impossible à contourner, parce qu’elle protège l’amitié."
            }
          },
          {
            k: {
              en: "Remind myself",
              ar: "ذكّرني أنا",
              fr: "Me le rappeler"
            },
            v: {
              en: "The better path when you are the debtor: remember before the other person has to ask. Stays entirely private.",
              ar: "الطريق الأفضل حين تكون المدين: تذكَّر قبل أن يضطر الآخر للسؤال. ويبقى خاصًا تمامًا.",
              fr: "La meilleure voie quand vous êtes le débiteur : y penser avant que l’autre ait à demander. Reste entièrement privé."
            }
          },
          {
            k: {
              en: "Request respite (inẓār)",
              ar: "اطلب إنظارًا",
              fr: "Demander un délai de grâce (inẓār)"
            },
            v: {
              en: "You are struggling and need more time. This exists so you never have to invent an excuse or avoid someone. Asking honestly is treated as the respectable act it is.",
              ar: "أنت في ضيق وتحتاج وقتًا. وُجد هذا كي لا تضطر لاختلاق عذر أو تجنُّب أحد. والطلب الصادق يُعامَل كما هو: فعل محترم.",
              fr: "Vous traversez une passe difficile et avez besoin de plus de temps. Cette action existe pour que vous n’ayez jamais à inventer une excuse ni à éviter quelqu’un. Demander honnêtement est traité comme l’acte respectable qu’il est."
            }
          },
          {
            k: {
              en: "Grant respite",
              ar: "امنح إنظارًا",
              fr: "Accorder un délai de grâce"
            },
            v: {
              en: "You are the creditor, giving more time. Sets a new date by agreement.",
              ar: "أنت الدائن وتمنح وقتًا. يحدد موعدًا جديدًا بالاتفاق.",
              fr: "Vous êtes le créancier et vous donnez plus de temps. Fixe une nouvelle date d’un commun accord."
            }
          },
          {
            k: {
              en: "Promise a date",
              ar: "حدّد موعدًا للسداد",
              fr: "Fixer une date"
            },
            v: {
              en: "Your own word on when you will pay — kept separate from the official due date, because what you promised matters on its own.",
              ar: "كلمتك أنت عن موعد السداد، منفصلة عن تاريخ الاستحقاق الرسمي، لأن ما وعدتَ به له وزنه الخاص.",
              fr: "Votre propre parole sur la date à laquelle vous paierez — distincte de l’échéance officielle, parce que ce que vous avez promis compte en soi."
            }
          },
          {
            k: {
              en: "Release (ibrāʾ)",
              ar: "أبرئ ذمته",
              fr: "Libérer (ibrāʾ)"
            },
            v: {
              en: "You forgive the debt. It is wiped and the other person owes nothing. You must tick a box to confirm, and you get 24 hours to undo it — after that it is final.",
              ar: "تُسقط الدَّين مسامحةً، فلا يبقى عليه شيء. عليك تعليم مربع التأكيد، ولك ٢٤ ساعة للتراجع، وبعدها يصبح نهائيًا.",
              fr: "Vous remettez la dette. Elle est effacée et l’autre personne ne doit plus rien. Vous devez cocher une case pour confirmer, et vous avez 24 heures pour annuler — ensuite, c’est définitif."
            }
          },
          {
            k: {
              en: "Write off",
              ar: "أسقِط المطالبة",
              fr: "Ne plus attendre"
            },
            v: {
              en: "Different from release: you stop expecting the money, but you have NOT forgiven it. Two different things, kept honestly separate.",
              ar: "يختلف عن الإبراء: تتوقف عن انتظار المال لكنك لم تسامح. أمران مختلفان يُفصل بينهما بصدق.",
              fr: "Différent de la libération : vous cessez d’attendre l’argent, mais vous ne l’avez PAS remis. Deux choses différentes, honnêtement séparées."
            }
          },
          {
            k: {
              en: "Propose a settlement (ṣulḥ)",
              ar: "اقترح صلحًا",
              fr: "Proposer un règlement amiable (ṣulḥ)"
            },
            v: {
              en: "Change the amount, currency or date by mutual agreement. If you change the currency you must record the rate you agreed — DYON will not let that detail go missing.",
              ar: "غيّر المبلغ أو العملة أو الموعد بالتراضي. وإن غيّرت العملة فسجّل السعر المتفق عليه، فلن يدع ديون هذه التفصيلة تضيع.",
              fr: "Changer le montant, la devise ou la date d’un commun accord. Si vous changez de devise, vous devez noter le taux convenu — DYON ne laisse pas ce détail se perdre."
            }
          },
          {
            k: {
              en: "I see this differently",
              ar: "لديّ رأي مختلف",
              fr: "Je vois les choses autrement"
            },
            v: {
              en: "Opens a dispute. It records both views side by side and writes a neutral summary. It never escalates, and the tone switches to Neutral automatically.",
              ar: "يفتح نزاعًا يسجل وجهتي النظر جنبًا إلى جنب مع ملخص محايد. ولا يُصعِّد أبدًا، وتتحول النبرة إلى المحايدة تلقائيًا.",
              fr: "Ouvre un désaccord. Les deux points de vue sont notés côte à côte, avec un résumé neutre. Rien n’est jamais aggravé, et le ton passe automatiquement en Neutre."
            }
          },
          {
            k: {
              en: "Transfer (ḥawālah)",
              ar: "حوالة الدَّين",
              fr: "Transfert (ḥawālah)"
            },
            v: {
              en: "Move the debt to a different debtor. Requires you to confirm all three parties agreed.",
              ar: "نقل الدَّين إلى مدين آخر. يتطلب تأكيدك أن الأطراف الثلاثة موافقون.",
              fr: "Transférer la dette à un autre débiteur. Vous devez confirmer que les trois parties sont d’accord."
            }
          },
          {
            k: {
              en: "Add a witness",
              ar: "أضف شاهدًا",
              fr: "Ajouter un témoin"
            },
            v: {
              en: "Name someone who saw the agreement. They are read-only and can never change anything.",
              ar: "سمِّ من شهد الاتفاق. صلاحيته قراءة فقط ولا يستطيع تغيير شيء.",
              fr: "Nommez quelqu’un qui a vu l’accord. Il peut consulter, jamais modifier."
            }
          }
        ]
      }
    ]
  },
  {
    id: "statuses",
    icon: "fa-circle-half-stroke",
    title: {
      en: "What each status means",
      ar: "ماذا تعني كل حالة",
      fr: "Ce que signifie chaque statut"
    },
    lead: {
      en: "The coloured chip on every record is its status. It moves through a fixed life cycle.",
      ar: "الشارة الملونة على كل سجل هي حالته، وهي تتحرك في دورة حياة محددة.",
      fr: "La pastille de couleur sur chaque note est son statut. Il suit un cycle de vie fixe."
    },
    blocks: [
      {
        type: "defs",
        items: [
          {
            k: {
              en: "Awaiting confirmation",
              ar: "مقترح",
              fr: "En attente de confirmation"
            },
            v: {
              en: "You shared it; the other person has not confirmed yet.",
              ar: "شاركته ولم يؤكده الطرف الآخر بعد.",
              fr: "Vous l’avez partagée ; l’autre personne n’a pas encore confirmé."
            }
          },
          {
            k: {
              en: "Confirmed by both",
              ar: "مُقَرّ به من الطرفين",
              fr: "Confirmé par les deux"
            },
            v: {
              en: "Both of you agree on the terms. This is what prevents arguments later.",
              ar: "كلاكما متفق على الشروط، وهذا ما يمنع الخلاف لاحقًا.",
              fr: "Vous êtes tous les deux d’accord sur les conditions. C’est ce qui évite les disputes plus tard."
            }
          },
          {
            k: {
              en: "Active",
              ar: "قائم",
              fr: "En cours"
            },
            v: {
              en: "In force and running.",
              ar: "ساري المفعول.",
              fr: "En vigueur."
            }
          },
          {
            k: {
              en: "Partially fulfilled",
              ar: "وُفّي جزئيًا",
              fr: "Honoré en partie"
            },
            v: {
              en: "Some has been paid or delivered; a balance remains.",
              ar: "سُدِّد بعضه وبقي رصيد.",
              fr: "Une partie a été payée ou remise ; il reste un solde."
            }
          },
          {
            k: {
              en: "In respite",
              ar: "في مهلة إنظار",
              fr: "En délai de grâce"
            },
            v: {
              en: "Extra time was granted. No pressure applies during it.",
              ar: "مُنح وقت إضافي، ولا ضغط خلاله.",
              fr: "Un temps supplémentaire a été accordé. Aucune pression ne s’applique pendant ce délai."
            }
          },
          {
            k: {
              en: "Under discussion",
              ar: "قيد التفاهم",
              fr: "En discussion"
            },
            v: {
              en: "A disagreement is recorded. Notice the word: discussion, not dispute-as-war.",
              ar: "خلاف مسجَّل. ولاحظ الكلمة: تفاهم، لا حرب.",
              fr: "Un désaccord est noté. Remarquez le mot : discussion, pas conflit."
            }
          },
          {
            k: {
              en: "Settled",
              ar: "تم الصلح",
              fr: "Réglé à l’amiable"
            },
            v: {
              en: "New terms were agreed by both sides.",
              ar: "اتُّفق على شروط جديدة من الطرفين.",
              fr: "De nouvelles conditions ont été convenues par les deux parties."
            }
          },
          {
            k: {
              en: "Fulfilled",
              ar: "تم الوفاء",
              fr: "Honoré"
            },
            v: {
              en: "Completely honoured. Done.",
              ar: "وُفِّي كاملًا. انتهى.",
              fr: "Entièrement honoré. C’est fait."
            }
          },
          {
            k: {
              en: "Released",
              ar: "أُبرئت الذمة",
              fr: "Libéré"
            },
            v: {
              en: "Forgiven by the creditor.",
              ar: "سامح به الدائن.",
              fr: "Remis par le créancier."
            }
          },
          {
            k: {
              en: "Written off",
              ar: "مُسقَط",
              fr: "N’est plus attendu"
            },
            v: {
              en: "The creditor stopped expecting it, without forgiving it.",
              ar: "توقف الدائن عن انتظاره دون أن يسامح.",
              fr: "Le créancier a cessé de l’attendre, sans pour autant le remettre."
            }
          },
          {
            k: {
              en: "Archived",
              ar: "مؤرشف",
              fr: "Archivé"
            },
            v: {
              en: "Closed and filed away. Still searchable under \"Closed\".",
              ar: "مغلق ومحفوظ، ويبقى قابلًا للبحث تحت «المغلقة».",
              fr: "Clos et rangé. Toujours consultable dans « Clos »."
            }
          }
        ]
      }
    ]
  },
  {
    id: "words",
    icon: "fa-book-quran",
    title: {
      en: "The Arabic words, explained",
      ar: "الكلمات العربية، موضَّحة",
      fr: "Les mots arabes, expliqués"
    },
    lead: {
      en: "DYON uses a few classical terms because they carry meanings English does not. You never need to know them to use the app — but here they are.",
      ar: "يستخدم ديون بعض المصطلحات الكلاسيكية لأنها تحمل معاني لا تؤديها الإنجليزية. لست مضطرًا لمعرفتها لاستخدام التطبيق، لكنها هنا.",
      fr: "DYON emploie quelques termes classiques parce qu’ils portent des sens que le français n’a pas. Vous n’avez pas besoin de les connaître pour utiliser l’application — mais les voici."
    },
    blocks: [
      {
        type: "defs",
        items: [
          {
            k: {
              en: "Dayn (دَيْن)",
              ar: "دَيْن",
              fr: "Dayn (دَيْن)"
            },
            v: {
              en: "A debt or liability — something owed that is expected to be fulfilled. The app's name.",
              ar: "ما يثبت في الذمة ويُنتظر أداؤه. وهو اسم التطبيق.",
              fr: "Une dette, une obligation — quelque chose de dû qu’on s’attend à voir honoré. Le nom de l’application."
            }
          },
          {
            k: {
              en: "Qarḍ ḥasan (قرض حسن)",
              ar: "قرض حسن",
              fr: "Qarḍ ḥasan (قرض حسن)"
            },
            v: {
              en: "A benevolent loan repaid without any increase. This is the only loan model DYON has — which is why no interest field exists anywhere.",
              ar: "قرض يُردّ بلا زيادة. وهو نموذج القرض الوحيد في ديون، ولهذا لا يوجد حقل فائدة في أي مكان.",
              fr: "Un prêt bienveillant, remboursé sans aucune majoration. C’est le seul modèle de prêt de DYON — c’est pourquoi aucun champ d’intérêt n’existe nulle part."
            }
          },
          {
            k: {
              en: "Amānah (أمانة)",
              ar: "أمانة",
              fr: "Amānah (أمانة)"
            },
            v: {
              en: "A trust: something you hold on someone else's behalf and must return — their savings, their laptop.",
              ar: "شيء تحفظه لغيرك ويجب ردّه: مدخراته أو حاسوبه.",
              fr: "Un dépôt confié : ce que vous gardez pour le compte de quelqu’un et devez lui rendre — ses économies, son ordinateur."
            }
          },
          {
            k: {
              en: "Waʿd (وعد)",
              ar: "وعد",
              fr: "Waʿd (وعد)"
            },
            v: {
              en: "A promise you made. Scholars differ on whether it binds legally; many hold it binding morally.",
              ar: "ما قطعته على نفسك. يختلف العلماء في إلزامه قضاءً، ويرى كثيرون أنه مُلزم ديانةً.",
              fr: "Une promesse que vous avez faite. Les savants divergent sur sa force juridique ; beaucoup la tiennent pour moralement contraignante."
            }
          },
          {
            k: {
              en: "Inẓār (إنظار)",
              ar: "إنظار",
              fr: "Inẓār (إنظار)"
            },
            v: {
              en: "Granting more time to someone in hardship. In the Qur'an this is an instruction, not a favour (2:280).",
              ar: "إمهال المعسر. وهو في القرآن أمر لا تفضُّل ﴿فَنَظِرَةٌ إِلَىٰ مَيْسَرَةٍ﴾.",
              fr: "Accorder plus de temps à quelqu’un en difficulté. Dans le Coran, c’est une instruction, pas une faveur (2:280)."
            }
          },
          {
            k: {
              en: "Ibrāʾ (إبراء)",
              ar: "إبراء",
              fr: "Ibrāʾ (إبراء)"
            },
            v: {
              en: "Releasing someone from a debt entirely — forgiving it.",
              ar: "إسقاط الدَّين عن المدين مسامحةً.",
              fr: "Libérer entièrement quelqu’un d’une dette — la lui remettre."
            }
          },
          {
            k: {
              en: "Ṣulḥ (صلح)",
              ar: "صلح",
              fr: "Ṣulḥ (صلح)"
            },
            v: {
              en: "An amicable settlement when two people see things differently. \"And settlement is better\" (4:128).",
              ar: "تسوية ودية عند اختلاف الرؤية ﴿وَالصُّلْحُ خَيْرٌ﴾.",
              fr: "Un règlement amiable quand deux personnes voient les choses différemment. « Et la conciliation est meilleure » (4:128)."
            }
          },
          {
            k: {
              en: "Ḥawālah (حوالة)",
              ar: "حوالة",
              fr: "Ḥawālah (حوالة)"
            },
            v: {
              en: "Transferring a debt to a different debtor, with everyone's consent.",
              ar: "نقل الدَّين إلى مدين آخر برضا الجميع.",
              fr: "Transférer une dette à un autre débiteur, avec l’accord de tous."
            }
          },
          {
            k: {
              en: "Kafālah / kafīl (كفالة / كفيل)",
              ar: "كفالة / كفيل",
              fr: "Kafālah / kafīl (كفالة / كفيل)"
            },
            v: {
              en: "A guarantee: a third person who joins in the responsibility.",
              ar: "ضمان: ثالث يشارك في المسؤولية.",
              fr: "Une garantie : une tierce personne qui s’associe à la responsabilité."
            }
          },
          {
            k: {
              en: "Maṭl (مَطْل)",
              ar: "مَطْل",
              fr: "Maṭl (مَطْل)"
            },
            v: {
              en: "Delaying payment when you are actually able to pay. DYON never labels anyone with this — only you can say whether you are able or in hardship.",
              ar: "التأخر مع القدرة. ولا يصف ديون أحدًا بهذا أبدًا، فأنت وحدك من يقرر أأنت قادر أم في عُسرة.",
              fr: "Retarder un paiement alors qu’on est en mesure de payer. DYON n’attribue jamais cette étiquette à qui que ce soit — vous seul pouvez dire si vous en êtes capable ou en difficulté."
            }
          },
          {
            k: {
              en: "ʿUsrah (عُسرة)",
              ar: "عُسرة",
              fr: "ʿUsrah (عُسرة)"
            },
            v: {
              en: "Hardship. You declare it yourself in Settings; reminders then soften to a respite framing.",
              ar: "الضيق. تعلنها بنفسك من الإعدادات، فتلين التذكيرات إلى نبرة الإنظار.",
              fr: "La difficulté. Vous la déclarez vous-même dans les Réglages ; les rappels s’adoucissent alors pour parler de délai de grâce."
            }
          },
          {
            k: {
              en: "Ribā (ربا)",
              ar: "ربا",
              fr: "Ribā (ربا)"
            },
            v: {
              en: "Interest or usury — forbidden. DYON has no field, no formula and no feature for it, anywhere.",
              ar: "الزيادة المحرَّمة. لا حقل لها ولا معادلة ولا خاصية في ديون، في أي مكان.",
              fr: "L’intérêt ou l’usure — interdit. DYON n’a pour cela aucun champ, aucune formule, aucune fonction, nulle part."
            }
          },
          {
            k: {
              en: "Waṣiyyah (وصية)",
              ar: "وصية",
              fr: "Waṣiyyah (وصية)"
            },
            v: {
              en: "A will. Debts are settled before any inheritance is divided (4:11–12), which is why the Estate sheet exists.",
              ar: "العهد لما بعد الموت. وتُقضى الديون قبل قسمة الميراث، ولهذا وُجدت ورقة الوصية.",
              fr: "Un testament. Les dettes sont réglées avant tout partage de l’héritage (4:11–12) ; c’est pourquoi la fiche de succession existe."
            }
          },
          {
            k: {
              en: "Sidq (صدق)",
              ar: "صدق",
              fr: "Sidq (صدق)"
            },
            v: {
              en: "Truthfulness. In this app it means the history can never be edited silently — every change is kept with its trace.",
              ar: "الصدق. ويعني هنا أن السجل لا يُعدَّل في الخفاء، فكل تغيير محفوظ بأثره.",
              fr: "La sincérité. Dans cette application, cela signifie que l’historique ne peut jamais être modifié en silence — chaque changement garde sa trace."
            }
          }
        ]
      },
      {
        type: "tip",
        body: {
          en: "All religious content here is educational and carries its source. It is not a fatwa — for a ruling, ask a qualified scholar.",
          ar: "كل محتوى ديني هنا تعليمي ومذكور مصدره، وليس فتوى. وللحكم ارجع إلى أهل العلم.",
          fr: "Tout le contenu religieux est ici éducatif et cite sa source. Ce n’est pas une fatwa — pour un avis juridique religieux, adressez-vous à un savant qualifié."
        }
      }
    ]
  },
  {
    id: "units",
    icon: "fa-coins",
    title: {
      en: "Money, units and currencies",
      ar: "المال والوحدات والعملات",
      fr: "Argent, unités et devises"
    },
    lead: {
      en: "One rule governs everything here: a debt is owed in the unit it was created in.",
      ar: "قاعدة واحدة تحكم كل شيء هنا: الدَّين يُردّ بالوحدة التي نشأ بها.",
      fr: "Une seule règle gouverne tout : une dette est due dans l’unité où elle a été créée."
    },
    blocks: [
      {
        type: "list",
        title: {
          en: "What that means in practice",
          ar: "ماذا يعني هذا عمليًا",
          fr: "Ce que cela veut dire concrètement"
        },
        items: [
          {
            en: "If you borrowed 2,000 SAR, you owe 2,000 SAR — never a figure recalculated by an exchange rate.",
            ar: "إن اقترضت ٢٠٠٠ ريال فأنت مدين بـ٢٠٠٠ ريال، لا برقم أُعيد حسابه بسعر صرف.",
            fr: "Si vous avez emprunté 2 000 SAR, vous devez 2 000 SAR — jamais un chiffre recalculé par un taux de change."
          },
          {
            en: "Converted totals are display-only and OFF by default. When on, the rate and its date are always shown.",
            ar: "الإجماليات المحوَّلة للعرض فقط ومغلقة افتراضيًا، وعند تفعيلها يُعرض السعر وتاريخه دائمًا.",
            fr: "Les totaux convertis servent uniquement à l’affichage et sont DÉSACTIVÉS par défaut. Une fois activés, le taux et sa date sont toujours indiqués."
          },
          {
            en: "Changing a debt's currency only happens through an explicit settlement that records the agreed rate.",
            ar: "تغيير عملة الدَّين لا يتم إلا بصلح صريح يسجَّل فيه السعر المتفق عليه.",
            fr: "Changer la devise d’une dette ne se fait que par un règlement amiable explicite qui note le taux convenu."
          },
          {
            en: "Amounts are stored as whole numbers of the smallest unit (fils, cents), so rounding errors cannot creep in.",
            ar: "تُخزَّن المبالغ كأعداد صحيحة من أصغر وحدة (فلس، سنت)، فلا تتسلل أخطاء التقريب.",
            fr: "Les montants sont enregistrés en nombres entiers de la plus petite unité (fils, centimes), pour qu’aucune erreur d’arrondi ne s’y glisse."
          }
        ]
      },
      {
        type: "defs",
        title: {
          en: "Units you can use",
          ar: "الوحدات المتاحة",
          fr: "Les unités disponibles"
        },
        items: [
          {
            k: {
              en: "Currencies",
              ar: "العملات",
              fr: "Devises"
            },
            v: {
              en: "Standard world currencies, each with its correct number of decimals — JPY has none, KWD has three.",
              ar: "عملات العالم القياسية، لكل منها عدد خاناتها العشرية الصحيح: الين بلا خانات والدينار الكويتي بثلاث.",
              fr: "Les devises du monde, chacune avec son nombre exact de décimales — le JPY n’en a aucune, le KWD en a trois."
            }
          },
          {
            k: {
              en: "Gold & silver",
              ar: "الذهب والفضة",
              fr: "Or et argent"
            },
            v: {
              en: "In grams, with purity (24k, 21k, 18k). Useful where inflation makes a currency figure meaningless.",
              ar: "بالغرام مع العيار (٢٤، ٢١، ١٨)، ومفيدة حيث يُفقد التضخم معنى الرقم النقدي.",
              fr: "En grammes, avec le titre (24 carats, 21 carats, 18 carats). Utile là où l’inflation vide un montant de son sens."
            }
          },
          {
            k: {
              en: "Hours, days, shifts",
              ar: "ساعات وأيام وورديات",
              fr: "Heures, jours, gardes"
            },
            v: {
              en: "For owed work and covered shifts.",
              ar: "للعمل المستحق والورديات المغطاة.",
              fr: "Pour un travail dû ou des gardes remplacées."
            }
          },
          {
            k: {
              en: "Items, tasks, occasions",
              ar: "قطع ومهام ومناسبات",
              fr: "Objets, tâches, occasions"
            },
            v: {
              en: "For a borrowed drill, an unfinished job, a wedding gift owed in return.",
              ar: "لمثقاب مستعار، أو عمل لم يكتمل، أو هدية عرس لم تُردّ.",
              fr: "Pour une perceuse empruntée, un travail inachevé, un cadeau de mariage à rendre."
            }
          },
          {
            k: {
              en: "Promise",
              ar: "وعد",
              fr: "Promesse"
            },
            v: {
              en: "No number at all — just done or not done.",
              ar: "بلا رقم: تمّ أو لم يتم.",
              fr: "Aucun chiffre — simplement fait ou pas fait."
            }
          }
        ]
      },
      {
        type: "tip",
        title: {
          en: "High inflation",
          ar: "التضخم العالي",
          fr: "Forte inflation"
        },
        body: {
          en: "Whether a debt should be adjusted for severe inflation is a genuinely contested question among scholars and lawyers. DYON refuses to decide it for you: it records what you both agreed and never adjusts anything automatically. You can add a gold reference note at creation as a shared memory of value.",
          ar: "هل يُعدَّل الدَّين عند التضخم الشديد؟ مسألة خلافية حقًا بين العلماء والقانونيين، ويرفض ديون أن يحسمها عنك: يسجل ما اتفقتما عليه ولا يعدّل شيئًا تلقائيًا. ويمكنك إضافة مرجع ذهبي عند الإنشاء كذاكرة مشتركة للقيمة.",
          fr: "Faut-il ajuster une dette en cas de forte inflation ? La question est réellement débattue entre savants et juristes. DYON refuse de trancher à votre place : il note ce que vous avez convenu tous les deux et n’ajuste jamais rien automatiquement. Vous pouvez ajouter, à la création, une note de référence en or comme mémoire commune de la valeur."
        }
      }
    ]
  },
  {
    id: "sharing",
    icon: "fa-user-group",
    title: {
      en: "Sharing, reminders and asking without shame",
      ar: "المشاركة والتذكير والطلب بلا حرج",
      fr: "Partager, rappeler, demander sans honte"
    },
    lead: {
      en: "The hardest part of lending is asking for it back. These tools exist for exactly that moment.",
      ar: "أصعب ما في الإقراض هو طلب الاسترداد، ولهذه اللحظة بالذات وُجدت هذه الأدوات.",
      fr: "Le plus dur quand on prête, c’est de demander qu’on nous rende. Ces outils existent précisément pour ce moment-là."
    },
    blocks: [
      {
        type: "steps",
        items: [
          {
            k: {
              en: "Save & share",
              ar: "حفظ ومشاركة",
              fr: "Enregistrer et partager"
            },
            v: {
              en: "Writes a polite summary of the record. You send it through your own WhatsApp, SMS or email. DYON has no contact list and messages nobody.",
              ar: "يكتب ملخصًا مهذبًا للسجل، وترسله أنت من واتسابك أو رسائلك أو بريدك. لا يملك ديون قائمة جهات اتصال ولا يراسل أحدًا.",
              fr: "Rédige un résumé courtois de la note. Vous l’envoyez par votre propre WhatsApp, SMS ou e-mail. DYON n’a aucune liste de contacts et n’écrit à personne."
            }
          },
          {
            k: {
              en: "Record their reply",
              ar: "سجّل ردّهم",
              fr: "Noter sa réponse"
            },
            v: {
              en: "When they answer, press Confirmed, Requested an edit, or I see this differently. The record now reflects both of you.",
              ar: "حين يجيبون اضغط: تأكيد، أو طلب تعديل، أو رأي مختلف. فيصير السجل معبّرًا عنكما معًا.",
              fr: "Quand l’autre répond, appuyez sur Confirmé, A demandé une modification, ou Je vois les choses autrement. La note reflète désormais vos deux points de vue."
            }
          },
          {
            k: {
              en: "The four tones",
              ar: "النبرات الأربع",
              fr: "Les quatre tons"
            },
            v: {
              en: "Gentle, Neutral, Formal, or Islamic-gentle. Pick what fits the relationship, not what applies the most pressure.",
              ar: "لطيفة، محايدة، رسمية، أو لطيفة إسلامية. اختر ما يناسب العلاقة لا ما يضغط أكثر.",
              fr: "Doux, Neutre, Formel, ou Doux en registre islamique. Choisissez ce qui convient à la relation, pas ce qui met le plus de pression."
            }
          },
          {
            k: {
              en: "\"Ask for me\"",
              ar: "قوالب «اطلب عني»",
              fr: "« Demander pour moi »"
            },
            v: {
              en: "Frames the ask as routine bookkeeping — \"I'm tidying my records and it shows…\" — which removes the sting without deceiving anyone. You still send it yourself.",
              ar: "يجعل الطلب يبدو ترتيبًا روتينيًا للسجلات — «أرتّب سجلاتي وظهر عندي…» — فيزول الحرج دون خداع، وتبقى أنت المرسل.",
              fr: "Présente la demande comme une simple mise en ordre des comptes — « Je range mes notes et j’y vois… » — ce qui enlève la gêne sans tromper personne. C’est toujours vous qui l’envoyez."
            }
          }
        ]
      },
      {
        type: "list",
        title: {
          en: "Protections you cannot switch off",
          ar: "حمايات لا يمكن إيقافها",
          fr: "Des protections impossibles à désactiver"
        },
        items: [
          {
            en: "One reminder per record per week; three per person per month. Hard limits.",
            ar: "تذكير واحد لكل سجل أسبوعيًا، وثلاثة لكل شخص شهريًا. حدود صارمة.",
            fr: "Un rappel par note et par semaine ; trois par personne et par mois. Des limites fermes."
          },
          {
            en: "Reminders go only to the other party — never to their family, employer or anyone else.",
            ar: "تذهب التذكيرات إلى الطرف نفسه فقط، لا إلى أهله ولا عمله ولا أي أحد.",
            fr: "Les rappels ne vont qu’à l’autre partie — jamais à sa famille, à son employeur ni à qui que ce soit d’autre."
          },
          {
            en: "Threatening or shaming wording is blocked from being sent, in Arabic and English.",
            ar: "الصياغات المهدِّدة أو المخجِلة ممنوعة من الإرسال، بالعربية والإنجليزية.",
            fr: "Les formulations menaçantes ou humiliantes sont bloquées avant l’envoi."
          },
          {
            en: "If someone declares hardship, reminders automatically soften to talk about timing, not payment.",
            ar: "إن أعلن أحدهم العُسرة تلين التذكيرات تلقائيًا لتتحدث عن التوقيت لا عن الدفع.",
            fr: "Si quelqu’un déclare une difficulté, les rappels s’adoucissent automatiquement pour parler de délai, pas de paiement."
          }
        ]
      }
    ]
  },
  {
    id: "privacy",
    icon: "fa-shield-halved",
    title: {
      en: "Privacy, safety and your data",
      ar: "الخصوصية والأمان وبياناتك",
      fr: "Vie privée, sécurité et vos données"
    },
    lead: {
      en: "Honest answers about where your information lives and what protects it.",
      ar: "إجابات صريحة عن مكان معلوماتك وما يحميها.",
      fr: "Des réponses honnêtes sur l’endroit où vivent vos informations et ce qui les protège."
    },
    blocks: [
      {
        type: "defs",
        items: [
          {
            k: {
              en: "Where is my data?",
              ar: "أين بياناتي؟",
              fr: "Où sont mes données ?"
            },
            v: {
              en: "In this browser on this device, in a local database. It is never uploaded, because there is no server to upload it to.",
              ar: "في هذا المتصفح على هذا الجهاز داخل قاعدة بيانات محلية. لا تُرفع أبدًا لأنه لا يوجد خادم تُرفع إليه.",
              fr: "Dans ce navigateur, sur cet appareil, dans une base de données locale. Elles ne sont envoyées nulle part."
            }
          },
          {
            k: {
              en: "Blur amounts",
              ar: "طمس المبالغ",
              fr: "Flouter les montants"
            },
            v: {
              en: "Hides every figure behind a blur; tap one to reveal it. For buses, cafés and shared desks.",
              ar: "يخفي كل رقم خلف ضبابية، واضغط لكشفه. للحافلات والمقاهي والمكاتب المشتركة.",
              fr: "Cache chaque chiffre derrière un flou ; touchez-en un pour le révéler. Pour le bus, le café ou un bureau partagé."
            }
          },
          {
            k: {
              en: "Discreet mode",
              ar: "الوضع الكتوم",
              fr: "Mode discret"
            },
            v: {
              en: "Renames the app to a neutral \"Notes\". Intended for people who are not safe to be seen tracking debts.",
              ar: "يغيّر اسم التطبيق إلى «Notes» المحايد، لمن ليس آمنًا أن يُرى وهو يتابع ديونه.",
              fr: "Renomme l’application en « Notes », un nom neutre. Pensé pour les personnes qui ne sont pas en sécurité si on les voit suivre des dettes."
            }
          },
          {
            k: {
              en: "PIN lock — read this honestly",
              ar: "قفل الرقم السري — اقرأ هذا بصراحة",
              fr: "Verrou par code — à lire honnêtement"
            },
            v: {
              en: "It stops a casual glance, nothing more. The data sits unencrypted in your browser, so anyone with your unlocked device and a little knowledge can read it. A page like this genuinely cannot provide real security, and pretending otherwise would be dishonest.",
              ar: "يمنع النظرة العابرة لا أكثر. البيانات غير مشفرة في متصفحك، فمن يملك جهازك مفتوحًا وشيئًا من المعرفة يستطيع قراءتها. صفحة كهذه لا تستطيع حقًا توفير حماية حقيقية، وادعاء غير ذلك خداع.",
              fr: "Il arrête un coup d’œil, rien de plus. Les données sont stockées sans chiffrement dans votre navigateur ; quiconque a votre appareil déverrouillé et quelques connaissances peut les lire. Une page comme celle-ci ne peut pas offrir une vraie sécurité, et prétendre le contraire serait malhonnête."
            }
          },
          {
            k: {
              en: "Other people's data",
              ar: "بيانات الآخرين",
              fr: "Les données des autres"
            },
            v: {
              en: "People who do not use DYON are stored as the bare minimum: a name or alias. You can erase a person's details at any time and keep your own record under an alias.",
              ar: "من لا يستخدم ديون يُحفظ بالحد الأدنى: اسم أو كنية. ويمكنك محو تفاصيل أي شخص وقتما شئت مع إبقاء سجلك تحت كنية.",
              fr: "Les personnes qui n’utilisent pas DYON sont enregistrées avec le strict minimum : un nom ou un surnom. Vous pouvez effacer les informations d’une personne à tout moment et garder votre propre note sous un surnom."
            }
          },
          {
            k: {
              en: "Backups",
              ar: "النسخ الاحتياطية",
              fr: "Sauvegardes"
            },
            v: {
              en: "Settings → Export everything gives you a JSON file. Keep it somewhere safe; it is your only copy.",
              ar: "الإعدادات ← صدّر كل شيء يعطيك ملف JSON. احفظه في مكان آمن فهو نسختك الوحيدة.",
              fr: "Réglages → Tout exporter vous donne un fichier JSON. Gardez-le en lieu sûr ; c’est votre seule copie."
            }
          },
          {
            k: {
              en: "The spiritual ledger",
              ar: "السجل الروحي",
              fr: "Le registre spirituel"
            },
            v: {
              en: "Missed fasts and similar. It is off by default, never counted in any total, and excluded from exports unless you opt in item by item.",
              ar: "الصيام الفائت ونحوه. مغلق افتراضيًا، ولا يدخل أي إجمالي، ويُستثنى من التصدير إلا إن اخترت ذلك بندًا بندًا.",
              fr: "Jeûnes manqués et autres. Désactivé par défaut, jamais compté dans un total, et exclu des exports sauf accord explicite, élément par élément."
            }
          }
        ]
      }
    ]
  },
  {
    id: "habits",
    icon: "fa-seedling",
    title: {
      en: "A gentle routine, and what to do when it feels heavy",
      ar: "روتين لطيف، وماذا تفعل حين يثقل الأمر",
      fr: "Une routine douce, et quoi faire quand c’est lourd"
    },
    lead: {
      en: "DYON is not trying to keep you here. It is trying to make a hard thing lighter, then let you leave.",
      ar: "لا يحاول ديون إبقاءك هنا، بل يحاول تخفيف أمر ثقيل ثم يدعك تنصرف.",
      fr: "DYON ne cherche pas à vous retenir. Il cherche à alléger une chose difficile, puis à vous laisser partir."
    },
    blocks: [
      {
        type: "steps",
        items: [
          {
            k: {
              en: "Day one",
              ar: "اليوم الأول",
              fr: "Le premier jour"
            },
            v: {
              en: "Do the brain dump. Ten categories, rough numbers, no judgment. Most people are surprised by how much they were carrying unwritten.",
              ar: "افعل تفريغ الذاكرة: عشر فئات وأرقام تقريبية وبلا أحكام. ويُفاجأ أكثر الناس بحجم ما كانوا يحملونه دون كتابة.",
              fr: "Videz votre tête. Dix catégories, des chiffres approximatifs, aucun jugement. La plupart des gens sont surpris de tout ce qu’ils portaient sans l’avoir écrit."
            }
          },
          {
            k: {
              en: "Each morning, one minute",
              ar: "كل صباح، دقيقة",
              fr: "Chaque matin, une minute"
            },
            v: {
              en: "Open the Overview. Do the one suggested step. Close the app. That is the whole discipline.",
              ar: "افتح النظرة العامة، ونفّذ الخطوة المقترحة الواحدة، وأغلق التطبيق. هذا كل الانضباط المطلوب.",
              fr: "Ouvrez la vue d’ensemble. Faites l’étape suggérée. Fermez l’application. C’est toute la discipline."
            }
          },
          {
            k: {
              en: "Each week",
              ar: "كل أسبوع",
              fr: "Chaque semaine"
            },
            v: {
              en: "Answer the 1–5 check-in truthfully. It is private, and it is how you find out whether this is actually helping.",
              ar: "أجب عن سؤال ١–٥ بصدق. فهو خاص، وبه تعرف إن كان هذا يساعدك فعلًا.",
              fr: "Répondez sincèrement au point de 1 à 5. C’est privé, et c’est ainsi que vous saurez si cela vous aide vraiment."
            }
          },
          {
            k: {
              en: "When it gets heavy",
              ar: "حين يثقل الأمر",
              fr: "Quand cela devient lourd"
            },
            v: {
              en: "Turn on Calm mode. Totals vanish, one kind step remains, and there is a 30-second breathing prompt. Nothing is deleted — it is just out of sight until you are ready.",
              ar: "شغّل وضع السكينة: تختفي الإجماليات وتبقى خطوة لطيفة واحدة، مع تنفُّس ٣٠ ثانية. لا يُحذف شيء، بل يغيب عن العين حتى تستعد.",
              fr: "Activez le mode sérénité. Les totaux disparaissent, il reste un petit pas bienveillant et une invitation à respirer 30 secondes. Rien n’est supprimé — c’est simplement hors de vue jusqu’à ce que vous soyez prêt."
            }
          }
        ]
      },
      {
        type: "tip",
        title: {
          en: "If it is more than heavy",
          ar: "وإن تجاوز الثِّقَل حدّه",
          fr: "Si c’est plus que lourd"
        },
        body: {
          en: "This app is not therapy and not legal advice. If debt is affecting your sleep, health or safety, please speak to a person — the Calm screen lists international helpline directories.",
          ar: "هذا التطبيق ليس علاجًا نفسيًا ولا استشارة قانونية. إن كان الدَّين يؤثر في نومك أو صحتك أو أمانك فتحدث إلى إنسان، وفي شاشة السكينة أدلة دولية لخطوط الدعم.",
          fr: "Cette application n’est ni une thérapie ni un conseil juridique. Si la dette affecte votre sommeil, votre santé ou votre sécurité, parlez-en à une personne — l’écran Sérénité donne des annuaires internationaux de lignes d’écoute."
        }
      },
      {
        type: "list",
        title: {
          en: "Keyboard shortcuts",
          ar: "اختصارات لوحة المفاتيح",
          fr: "Raccourcis clavier"
        },
        items: [
          {
            en: "N — add a new commitment",
            ar: "N — إضافة التزام جديد",
            fr: "N — ajouter un engagement"
          },
          {
            en: "C — toggle Calm mode",
            ar: "C — تبديل وضع السكينة",
            fr: "C — activer ou désactiver le mode sérénité"
          },
          {
            en: "/ — jump to search in the Ledger",
            ar: "/ — الانتقال إلى البحث في السجل",
            fr: "/ — aller à la recherche du registre"
          }
        ]
      }
    ]
  },
  {
    id: "account",
    icon: "fa-user-shield",
    title: {
      en: "Accounts: when DYON asks you to sign in",
      ar: "الحساب: متى يطلب ديون تسجيل الدخول",
      fr: "Comptes : quand DYON vous demande de vous connecter"
    },
    lead: {
      en: "DYON starts with no account at all. It only asks you to link a social account when something you do reaches another person.",
      ar: "يبدأ ديون بلا حساب إطلاقًا، ولا يطلب ربط حساب اجتماعي إلا حين يصل ما تفعله إلى شخص آخر.",
      fr: "DYON commence sans aucun compte. Il ne vous demande d’associer un compte que lorsqu’une de vos actions touche une autre personne."
    },
    blocks: [
      {
        type: "defs",
        title: {
          en: "The two stages",
          ar: "المرحلتان",
          fr: "Les deux étapes"
        },
        items: [
          {
            k: {
              en: "Stage 1 · on this device",
              ar: "المرحلة ١ · على هذا الجهاز",
              fr: "Étape 1 · sur cet appareil"
            },
            v: {
              en: "Adding, editing, paying, releasing, plans, calm mode, the vault, export and delete. Stored in this browser (IndexedDB). No sign-in, ever.",
              ar: "الإضافة والتعديل والسداد والإبراء والخطط ووضع السكينة والخزنة والتصدير والحذف. محفوظة في هذا المتصفح (IndexedDB). بلا تسجيل دخول أبدًا.",
              fr: "Ajouter, modifier, payer, libérer, les plans, le mode sérénité, le coffre, l’export et la suppression. Stocké dans ce navigateur (IndexedDB). Jamais de connexion."
            }
          },
          {
            k: {
              en: "Stage 2 · linked",
              ar: "المرحلة ٢ · مربوط",
              fr: "Étape 2 · compte associé"
            },
            v: {
              en: "Sharing a record for confirmation, sending a reminder or a thank-you, inviting a witness, proposing a settlement (ṣulḥ) or a transfer (ḥawālah). These involve someone else, so DYON asks who you are.",
              ar: "مشاركة سجل للتأكيد، وإرسال تذكير أو شكر، ودعوة شاهد، واقتراح صلح أو حوالة. هذه تشمل غيرك، فيسألك ديون من أنت.",
              fr: "Partager une note pour confirmation, envoyer un rappel ou un remerciement, inviter un témoin, proposer un règlement amiable (ṣulḥ) ou un transfert (ḥawālah). Cela concerne quelqu’un d’autre ; DYON vous demande donc qui vous êtes."
            }
          },
          {
            k: {
              en: "Social only",
              ar: "اجتماعي فقط",
              fr: "Comptes existants uniquement"
            },
            v: {
              en: "Google, Apple or Microsoft. There are no DYON passwords to create, forget or leak.",
              ar: "Google أو Apple أو Microsoft. لا كلمات مرور لديون تُنشأ أو تُنسى أو تتسرّب.",
              fr: "Google, Apple ou Microsoft. Aucun mot de passe DYON à créer, à oublier ou à voir fuiter."
            }
          },
          {
            k: {
              en: "What is read",
              ar: "ما يُقرأ",
              fr: "Ce qui est lu"
            },
            v: {
              en: "Your name and email from the provider. Nothing is posted, no contacts are read, and your records are not uploaded.",
              ar: "اسمك وبريدك من المزوّد. لا يُنشر شيء ولا تُقرأ جهات الاتصال ولا تُرفع سجلاتك.",
              fr: "Votre nom et votre e-mail, fournis par le fournisseur. Rien n’est publié, aucun contact n’est lu, et vos notes ne sont pas envoyées."
            }
          },
          {
            k: {
              en: "Preview sign-in",
              ar: "الدخول التجريبي",
              fr: "Connexion d’aperçu"
            },
            v: {
              en: "On a copy where no provider is set up yet, sign-in runs as a clearly labelled preview. It lets you try the flows but is never a verified identity.",
              ar: "في نسخة لم يُعدّ فيها مزوّد بعد، يعمل الدخول تجريبيًا وبوسم واضح. يتيح لك تجربة الخطوات لكنه ليس هوية موثّقة أبدًا.",
              fr: "Sur une copie où aucun fournisseur n’est encore configuré, la connexion fonctionne en aperçu, clairement signalé. Elle permet d’essayer les parcours mais n’est jamais une identité vérifiée."
            }
          },
          {
            k: {
              en: "QR code for a request",
              ar: "رمز QR للطلب",
              fr: "Code QR d’une demande"
            },
            v: {
              en: "Every request you send — confirm, reminder, respite, settlement, witness, thank-you — has a \"QR code\" button. It shows a code with the DYON mark in the middle that the other person scans with their camera. It opens that one request only, and they can add it to their own ledger after checking it. Nothing is uploaded.",
              ar: "لكل طلب ترسله — تأكيد أو تذكير أو إنظار أو صلح أو شهادة أو شكر — زر «رمز QR». يعرض رمزًا في وسطه شعار ديون يمسحه الطرف الآخر بكاميرته، فيفتح هذا الطلب وحده، ويمكنه إضافته إلى سجله بعد مراجعته. ولا يُرفع شيء.",
              fr: "Chaque demande que vous envoyez — confirmation, rappel, délai de grâce, règlement, témoin, remerciement — a un bouton « Code QR ». Il affiche un code avec la marque DYON au centre, que l’autre personne scanne avec son appareil photo. Il n’ouvre que cette demande, et elle peut l’ajouter à son propre registre après vérification. Rien n’est envoyé sur un serveur."
            }
          },
          {
            k: {
              en: "Sign out",
              ar: "تسجيل الخروج",
              fr: "Se déconnecter"
            },
            v: {
              en: "Settings → Account → Sign out. Your ledger stays exactly where it is.",
              ar: "الإعدادات ← الحساب ← تسجيل الخروج. يبقى سجلك كما هو.",
              fr: "Réglages → Compte → Se déconnecter. Votre registre reste exactement où il est."
            }
          }
        ]
      },
      {
        type: "tip",
        body: {
          en: "If you tap Share while signed out, DYON explains why, lets you sign in, and then brings you straight back to what you were doing.",
          ar: "إن ضغطت «مشاركة» دون تسجيل دخول، يشرح لك ديون السبب، ويتيح لك الدخول، ثم يعيدك مباشرة إلى ما كنت تفعله.",
          fr: "Si vous touchez Partager sans être connecté, DYON explique pourquoi, vous laisse vous connecter, puis vous ramène directement à ce que vous faisiez."
        }
      }
    ]
  },
  {
    id: "settings",
    icon: "fa-gear",
    title: {
      en: "Every setting, and what it changes",
      ar: "كل إعداد وما يغيّره",
      fr: "Chaque réglage, et ce qu’il change"
    },
    lead: {
      en: "Settings are grouped in the order you are likely to need them. Nothing here is required to start.",
      ar: "الإعدادات مرتبة بحسب ما ستحتاجه غالبًا، ولا شيء منها مطلوب للبدء.",
      fr: "Les réglages sont regroupés dans l’ordre où vous en aurez probablement besoin. Aucun n’est nécessaire pour commencer."
    },
    blocks: [
      {
        type: "defs",
        title: {
          en: "Language & display",
          ar: "اللغة والعرض",
          fr: "Langue et affichage"
        },
        items: [
          {
            k: {
              en: "Your name",
              ar: "اسمك",
              fr: "Votre nom"
            },
            v: {
              en: "Used only in the greeting. Stays on this device.",
              ar: "يُستخدم في التحية فقط، ويبقى على جهازك.",
              fr: "Utilisé seulement pour le message d’accueil. Reste sur cet appareil."
            }
          },
          {
            k: {
              en: "Language",
              ar: "اللغة",
              fr: "Langue"
            },
            v: {
              en: "English, Arabic or French. Arabic mirrors the whole layout right-to-left.",
              ar: "العربية أو الإنجليزية أو الفرنسية. العربية تقلب الواجهة كلها من اليمين إلى اليسار.",
              fr: "Français, anglais ou arabe. L’arabe inverse toute la mise en page, de droite à gauche."
            }
          },
          {
            k: {
              en: "Digits",
              ar: "الأرقام",
              fr: "Chiffres"
            },
            v: {
              en: "Western (123), Arabic-Indic (١٢٣) or Persian (۱۲۳). Display only — input accepts all three.",
              ar: "غربية أو عربية هندية أو فارسية. للعرض فقط — الإدخال يقبل الثلاثة.",
              fr: "Occidentaux (123), arabes orientaux (١٢٣) ou persans (۱۲۳). Pour l’affichage seulement — la saisie accepte les trois."
            }
          },
          {
            k: {
              en: "Calendar & second calendar",
              ar: "التقويم والتقويم الثاني",
              fr: "Calendrier et second calendrier"
            },
            v: {
              en: "Show dates in Gregorian, Hijri (Umm al-Qura or civil) or Persian, optionally with a second one beside it. The second list hides whatever the first already uses.",
              ar: "اعرض التواريخ ميلاديًا أو هجريًا أو فارسيًا، مع تقويم ثانٍ اختياري بجانبه. القائمة الثانية تُخفي ما اخترته في الأولى.",
              fr: "Affichez les dates en grégorien, en hégirien (Umm al-Qura ou tabulaire) ou en persan, éventuellement avec un second calendrier à côté. La seconde liste masque celui déjà choisi en premier."
            }
          },
          {
            k: {
              en: "Week starts on / Theme",
              ar: "بداية الأسبوع / المظهر",
              fr: "Début de semaine / Thème"
            },
            v: {
              en: "Shapes the calendar grid; light, dark or follow the system.",
              ar: "تحدد شبكة التقويم؛ فاتح أو داكن أو حسب النظام.",
              fr: "Organise la grille du calendrier ; clair, sombre ou selon le système."
            }
          }
        ]
      },
      {
        type: "defs",
        title: {
          en: "Currencies & units",
          ar: "العملات والوحدات",
          fr: "Devises et unités"
        },
        items: [
          {
            k: {
              en: "Base currency",
              ar: "العملة الأساسية",
              fr: "Devise de base"
            },
            v: {
              en: "The default for new entries, and the target of the optional converted view.",
              ar: "الافتراضية للإدخالات الجديدة، وهدف العرض المحوَّل الاختياري.",
              fr: "Celle proposée par défaut pour les nouvelles notes, et la cible de la vue convertie facultative."
            }
          },
          {
            k: {
              en: "Converted totals",
              ar: "الإجماليات المحوَّلة",
              fr: "Totaux convertis"
            },
            v: {
              en: "Off by default. When on, adds an indicative total in the base currency. It never changes a debt.",
              ar: "مغلق افتراضيًا. حين يُفتح يضيف إجماليًا إرشاديًا بالعملة الأساسية، ولا يغيّر دينًا أبدًا.",
              fr: "Désactivés par défaut. Une fois activés, ajoutent un total indicatif dans la devise de base. Ils ne changent jamais une dette."
            }
          }
        ]
      },
      {
        type: "defs",
        title: {
          en: "Reminders",
          ar: "التذكيرات",
          fr: "Rappels"
        },
        items: [
          {
            k: {
              en: "Default tone",
              ar: "النبرة الافتراضية",
              fr: "Ton par défaut"
            },
            v: {
              en: "Gentle, neutral, formal (or Islamic when that mode is on) for message templates.",
              ar: "لطيفة أو محايدة أو رسمية (أو إسلامية حين يُفعَّل وضعها) لقوالب الرسائل.",
              fr: "Doux, neutre, formel (ou islamique quand ce mode est activé) pour les modèles de messages."
            }
          },
          {
            k: {
              en: "Quiet hours",
              ar: "ساعات الهدوء",
              fr: "Heures calmes"
            },
            v: {
              en: "No reminder suggestions between these times. The end time must differ from the start.",
              ar: "لا اقتراحات تذكير بين هذين الوقتين. يجب أن يختلف وقت النهاية عن البداية.",
              fr: "Aucune suggestion de rappel entre ces heures. L’heure de fin doit différer de l’heure de début."
            }
          },
          {
            k: {
              en: "Self-reminders",
              ar: "التذكيرات الذاتية",
              fr: "Rappels pour moi"
            },
            v: {
              en: "Nudges to yourself only, never to anyone else.",
              ar: "تنبيهات لك وحدك، لا لأحد غيرك.",
              fr: "Des rappels pour vous seul, jamais pour quelqu’un d’autre."
            }
          }
        ]
      },
      {
        type: "defs",
        title: {
          en: "Privacy & modes",
          ar: "الخصوصية والأوضاع",
          fr: "Confidentialité et modes"
        },
        items: [
          {
            k: {
              en: "Islamic mode → Spiritual ledger",
              ar: "الوضع الإسلامي ← السجل الروحي",
              fr: "Mode islamique → Registre spirituel"
            },
            v: {
              en: "The spiritual ledger is part of Islamic mode, so its switch only appears once Islamic mode is on.",
              ar: "السجل الروحي جزء من الوضع الإسلامي، فلا يظهر مفتاحه إلا بعد تفعيله.",
              fr: "Le registre spirituel fait partie du mode islamique ; son interrupteur n’apparaît donc qu’une fois ce mode activé."
            }
          },
          {
            k: {
              en: "PIN lock",
              ar: "قفل الرقم السري",
              fr: "Verrou par code"
            },
            v: {
              en: "A local convenience to keep casual eyes out — not real security.",
              ar: "راحة محلية لإبعاد العيون العابرة، وليست حماية حقيقية.",
              fr: "Un confort local pour écarter les regards curieux — pas une vraie sécurité."
            }
          }
        ]
      }
    ]
  }
];

/* Coach-mark tours, one per screen. Each step: a CSS selector and a
   trilingual title/body. */
export const TOURS = {
  "": [
    {
      sel: "[data-tour=\"add\"]",
      title: {
        en: "Everything starts here",
        ar: "كل شيء يبدأ هنا",
        fr: "Tout commence ici"
      },
      body: {
        en: "Press + to write down anything owed — money, an item, an hour, a promise. On a keyboard you can also press N.",
        ar: "اضغط + لتكتب أي التزام: مالًا أو شيئًا أو ساعة أو وعدًا. ويمكنك أيضًا ضغط حرف N.",
        fr: "Appuyez sur + pour noter tout ce qui est dû — de l’argent, un objet, une heure, une promesse. Au clavier, vous pouvez aussi appuyer sur N."
      }
    },
    {
      sel: "[data-tour=\"net\"]",
      title: {
        en: "Your honest position",
        ar: "موقفك بصدق",
        fr: "Votre position, honnêtement"
      },
      body: {
        en: "One row per currency or unit. Riyals are never secretly added to euros — mixing units would be a lie. Tap a row to see those records.",
        ar: "صف لكل عملة أو وحدة. ولا تُجمع الريالات مع اليوروات سرًّا، فخلط الوحدات كذب. اضغط صفًا لترى سجلاته.",
        fr: "Une ligne par devise ou unité. Les riyals ne sont jamais additionnés en douce aux euros — mélanger les unités serait mentir. Touchez une ligne pour voir les notes concernées."
      }
    },
    {
      sel: "[data-tour=\"clarity\"]",
      title: {
        en: "Clarity, not judgment",
        ar: "وضوح لا حُكم",
        fr: "De la clarté, pas un jugement"
      },
      body: {
        en: "This measures how complete your records are — never how good you are. It is private and never leaves this device.",
        ar: "يقيس هذا اكتمال سجلاتك لا صلاحك أنت. وهو خاص ولا يغادر هذا الجهاز.",
        fr: "Mesure à quel point vos notes sont complètes — jamais votre valeur. C’est privé et cela ne quitte jamais cet appareil."
      }
    },
    {
      sel: "[data-tour=\"queue\"]",
      title: {
        en: "Who is waiting on you",
        ar: "من ينتظر ردّك",
        fr: "Qui attend après vous"
      },
      body: {
        en: "The one card that can never be hidden, because a real person is on the other end of each item.",
        ar: "البطاقة الوحيدة التي لا تُخفى أبدًا، لأن خلف كل بند إنسانًا حقيقيًا.",
        fr: "La seule carte qu’on ne peut jamais masquer, parce qu’il y a une vraie personne derrière chaque élément."
      }
    },
    {
      sel: ".zone-toggle",
      title: {
        en: "Fold what you do not need",
        ar: "اطوِ ما لا تحتاجه",
        fr: "Repliez ce dont vous n’avez pas besoin"
      },
      body: {
        en: "Each band of cards can be hidden or shown. DYON remembers your choice on this device.",
        ar: "كل شريط من البطاقات يمكن إخفاؤه أو إظهاره، ويتذكر ديون اختيارك على هذا الجهاز.",
        fr: "Chaque bande de cartes peut être masquée ou affichée. DYON se souvient de votre choix sur cet appareil."
      }
    },
    {
      sel: "[data-tour=\"calm\"]",
      title: {
        en: "When it feels too loud",
        ar: "حين يعلو الضجيج",
        fr: "Quand c’est trop bruyant"
      },
      body: {
        en: "Calm mode hides every total and leaves one kind step. Nothing is deleted; it just waits for you.",
        ar: "يخفي وضع السكينة كل إجمالي ويترك خطوة لطيفة واحدة. لا يُحذف شيء، بل ينتظرك.",
        fr: "Le mode sérénité masque tous les totaux et ne laisse qu’un petit pas bienveillant. Rien n’est supprimé ; tout vous attend."
      }
    },
    {
      sel: "[data-tour=\"lang\"]",
      title: {
        en: "Your language",
        ar: "لغتك",
        fr: "Votre langue"
      },
      body: {
        en: "Switch language any time (press L). The whole layout mirrors for Arabic, and you can use Arabic-Indic digits and Hijri dates.",
        ar: "بدّل اللغة متى شئت (اضغط L). تنعكس الواجهة كاملة للعربية، ويمكنك استخدام الأرقام العربية والتاريخ الهجري.",
        fr: "Changez de langue à tout moment (touche L). La mise en page s’inverse entièrement pour l’arabe, et vous pouvez utiliser les chiffres arabes orientaux et les dates hégiriennes."
      }
    },
    {
      sel: "#account-btn",
      title: {
        en: "No account needed — until you share",
        ar: "لا حساب — حتى تشارك",
        fr: "Aucun compte — jusqu’à ce que vous partagiez"
      },
      body: {
        en: "Your ledger lives in this browser. You only link a Google, Apple or Microsoft account when you share, remind or invite someone.",
        ar: "سجلك يعيش في هذا المتصفح. لا تربط حساب Google أو Apple أو Microsoft إلا حين تشارك أو تذكّر أو تدعو أحدًا.",
        fr: "Votre registre vit dans ce navigateur. Vous n’associez un compte Google, Apple ou Microsoft que pour partager, envoyer un rappel ou inviter quelqu’un."
      }
    },
    {
      sel: "#more-btn",
      title: {
        en: "Every other screen",
        ar: "بقية الشاشات",
        fr: "Tous les autres écrans"
      },
      body: {
        en: "On a phone, More holds every screen plus quick switches for theme, calm mode, the tour and your account.",
        ar: "في الهاتف، «المزيد» يضم كل الشاشات مع مفاتيح سريعة للمظهر ووضع السكينة والجولة وحسابك.",
        fr: "Sur téléphone, « Plus » regroupe tous les écrans, ainsi que des raccourcis pour le thème, le mode sérénité, la visite et votre compte."
      }
    },
    {
      sel: "[data-tour=\"guide\"]",
      title: {
        en: "Help is always one tap away",
        ar: "المساعدة على بُعد ضغطة",
        fr: "L’aide est à portée de doigt"
      },
      body: {
        en: "The ? button explains the screen you are on, starts its tour, and opens the full guide and A–Z glossary.",
        ar: "زر ؟ يشرح الشاشة التي أنت فيها، ويبدأ جولتها، ويفتح الدليل الكامل والمسرد الأبجدي.",
        fr: "Le bouton ? explique l’écran où vous êtes, lance sa visite et ouvre le guide complet et le glossaire de A à Z."
      }
    }
  ],
  onboarding: [
    {
      sel: "[data-tour=\"onb-lang\"]",
      title: {
        en: "Language and Islamic mode",
        ar: "اللغة والوضع الإسلامي",
        fr: "Langue et mode islamique"
      },
      body: {
        en: "Pick your language first. Islamic mode is optional and off by default; you can change both later in Settings.",
        ar: "اختر لغتك أولًا. الوضع الإسلامي اختياري ومطفأ افتراضيًا، ويمكنك تغيير الاثنين لاحقًا من الإعدادات.",
        fr: "Choisissez d’abord votre langue. Le mode islamique est facultatif et désactivé par défaut ; vous pourrez changer les deux plus tard dans les Réglages."
      }
    },
    {
      sel: "[data-tour=\"onb-guide\"]",
      title: {
        en: "Help while you set up",
        ar: "مساعدة أثناء الإعداد",
        fr: "De l’aide pendant la configuration"
      },
      body: {
        en: "The guide and glossary explain every word. Open them any time and come back here.",
        ar: "الدليل والمسرد يشرحان كل كلمة. افتحهما متى شئت ثم عد إلى هنا.",
        fr: "Le guide et le glossaire expliquent chaque mot. Ouvrez-les quand vous voulez, puis revenez ici."
      }
    },
    {
      sel: "[data-tour=\"onb-start\"]",
      title: {
        en: "Empty your head, roughly",
        ar: "أفرغ ذهنك تقريبيًا",
        fr: "Videz votre tête, à peu près"
      },
      body: {
        en: "Start writes down what you remember, one category at a time. Rough is fine — you can fix details later. Or skip and add things one by one.",
        ar: "زر البدء يكتب ما تتذكره فئةً فئة. التقريب يكفي، والتفاصيل تُصحَّح لاحقًا. أو تخطَّ وأضف الأشياء واحدًا واحدًا.",
        fr: "« Vider sa tête » note ce dont vous vous souvenez, une catégorie à la fois. L’approximation suffit — les détails se corrigent plus tard. Ou passez, et ajoutez les choses une par une."
      }
    }
  ],
  ledger: [
    {
      sel: "#search-input",
      title: {
        en: "Find anything",
        ar: "ابحث عن أي شيء",
        fr: "Tout retrouver"
      },
      body: {
        en: "Search by person, description or type. Press / anywhere to jump here.",
        ar: "ابحث بالاسم أو الوصف أو النوع. اضغط / من أي مكان للوصول هنا.",
        fr: "Cherchez par personne, description ou type. Appuyez sur / n’importe où pour venir ici."
      }
    },
    {
      sel: "[data-tour=\"ledger-dir\"]",
      title: {
        en: "Which way it goes",
        ar: "في أي اتجاه",
        fr: "Dans quel sens"
      },
      body: {
        en: "Filter to what you owe, what you are owed, or mutual arrangements.",
        ar: "صفِّ لما عليك أو ما لك أو الترتيبات المتبادلة.",
        fr: "Filtrez ce que vous devez, ce qu’on vous doit, ou les arrangements réciproques."
      }
    },
    {
      sel: "[data-tour=\"ledger-tools\"]",
      title: {
        en: "Unit, order and closed records",
        ar: "الوحدة والترتيب والمغلقة",
        fr: "Unité, ordre et notes closes"
      },
      body: {
        en: "Narrow to one unit, change the order, or show records that are already fulfilled or released.",
        ar: "اقصر العرض على وحدة واحدة، أو غيّر الترتيب، أو اعرض السجلات المُوفّاة أو المُبرأة.",
        fr: "Limitez à une unité, changez l’ordre, ou affichez les notes déjà honorées ou libérées."
      }
    },
    {
      sel: "[data-tour=\"ledger-list\"]",
      title: {
        en: "Open a record",
        ar: "افتح سجلًا",
        fr: "Ouvrir une note"
      },
      body: {
        en: "Tap any row to see its terms, progress, witnesses, evidence, history — and every action you can take on it.",
        ar: "اضغط أي صف لترى شروطه وتقدّمه وشهوده وأدلته وتاريخه، وكل إجراء متاح عليه.",
        fr: "Touchez une ligne pour voir ses conditions, son avancement, ses témoins, ses preuves, son historique — et toutes les actions possibles."
      }
    }
  ],
  people: [
    {
      sel: "[data-tour=\"people-new\"]",
      title: {
        en: "Add a person",
        ar: "أضف شخصًا",
        fr: "Ajouter une personne"
      },
      body: {
        en: "People are created automatically when you add a record, but you can add one here with a relationship label.",
        ar: "يُنشأ الأشخاص تلقائيًا حين تضيف سجلًا، ويمكنك إضافة شخص هنا مع وصف العلاقة.",
        fr: "Les personnes sont créées automatiquement quand vous ajoutez une note, mais vous pouvez en ajouter une ici avec un lien de relation."
      }
    },
    {
      sel: "[data-tour=\"people-list\"]",
      title: {
        en: "Balances per person",
        ar: "الأرصدة لكل شخص",
        fr: "Le solde par personne"
      },
      body: {
        en: "Each person shows what is open between you, per unit. Tap to see everything with them and settle together.",
        ar: "يُظهر كل شخص ما هو مفتوح بينكما لكل وحدة. اضغط لترى كل شيء معه وتسوّيه دفعة واحدة.",
        fr: "Chaque personne montre ce qui reste ouvert entre vous, par unité. Touchez pour tout voir et régler ensemble."
      }
    }
  ],
  settings: [
    {
      sel: "#account-card",
      title: {
        en: "Your account (optional)",
        ar: "حسابك (اختياري)",
        fr: "Votre compte (facultatif)"
      },
      body: {
        en: "Stage 1 is on-device only. Linking a social account (stage 2) unlocks sharing and reminders. You can sign out any time.",
        ar: "المرحلة ١ على الجهاز فقط. ربط حساب اجتماعي (المرحلة ٢) يفتح المشاركة والتذكير. ويمكنك الخروج متى شئت.",
        fr: "L’étape 1 reste sur l’appareil. Associer un compte (étape 2) débloque le partage et les rappels. Vous pouvez vous déconnecter à tout moment."
      }
    },
    {
      sel: "[data-tour=\"set-data\"]",
      title: {
        en: "Back up your ledger",
        ar: "احفظ نسخة من سجلك",
        fr: "Sauvegardez votre registre"
      },
      body: {
        en: "Everything lives in this browser. Export a backup now and then — export never needs an account.",
        ar: "كل شيء في هذا المتصفح. صدِّر نسخة احتياطية بين حين وآخر، والتصدير لا يحتاج حسابًا أبدًا.",
        fr: "Tout vit dans ce navigateur. Exportez une sauvegarde de temps en temps — l’export ne demande jamais de compte."
      }
    }
  ]
};
/* Back-compat: the original single Overview tour. */
export const TOUR = TOURS[''];

/* What each screen is for — shown by the ? button, with the chapter that
   explains it in depth. */
export const SCREEN_HELP = {
  "": {
    chapter: "dashboard",
    en: "Overview: your whole picture, one row per unit, and the one thing that most needs you.",
    ar: "النظرة العامة: صورتك كاملة، صف لكل وحدة، وأكثر ما يحتاجك الآن.",
    fr: "Vue d’ensemble : votre situation complète, une ligne par unité, et ce qui a le plus besoin de vous."
  },
  ledger: {
    chapter: "screens",
    en: "Ledger: every commitment in one searchable list.",
    ar: "السجل: كل الالتزامات في قائمة واحدة قابلة للبحث.",
    fr: "Registre : tous les engagements dans une seule liste où l’on peut chercher."
  },
  people: {
    chapter: "screens",
    en: "People: the same records seen as relationships.",
    ar: "الأشخاص: السجلات نفسها لكن كعلاقات.",
    fr: "Personnes : les mêmes notes, vues comme des relations."
  },
  inbox: {
    chapter: "actions",
    en: "Inbox: only what needs a decision from you.",
    ar: "الوارد: ما يحتاج قرارًا منك فقط.",
    fr: "À traiter : uniquement ce qui demande une décision de votre part."
  },
  calendar: {
    chapter: "screens",
    en: "Calendar: due dates on a month grid; tap a day with a name to open it.",
    ar: "التقويم: المواعيد على شبكة شهرية؛ اضغط يومًا فيه اسم لفتحه.",
    fr: "Calendrier : les échéances sur une grille mensuelle ; touchez un jour avec un nom pour l’ouvrir."
  },
  promises: {
    chapter: "units",
    en: "Promises: commitments counted in words, not money.",
    ar: "الوعود: التزامات تُعدّ بالكلمات لا بالمال.",
    fr: "Promesses : des engagements qui se comptent en mots, pas en argent."
  },
  services: {
    chapter: "units",
    en: "Services & time: hours, days and shifts owed.",
    ar: "الخدمات والوقت: ساعات وأيام ونوبات مستحقة.",
    fr: "Services et temps : heures, jours et gardes dus."
  },
  trusts: {
    chapter: "words",
    en: "Trusts (amānah): things held for someone else.",
    ar: "الأمانات: أشياء محفوظة لغيرك.",
    fr: "Dépôts confiés (amānah) : ce que l’on garde pour quelqu’un d’autre."
  },
  plans: {
    chapter: "habits",
    en: "Plans: a kinder order for paying off, from what you can really set aside.",
    ar: "الخطط: ترتيب ألطف للسداد بحسب ما تستطيع تخصيصه فعلًا.",
    fr: "Plans : un ordre plus doux pour rembourser, selon ce que vous pouvez vraiment mettre de côté."
  },
  calm: {
    chapter: "habits",
    en: "Calm mode: totals hidden, one small step shown.",
    ar: "وضع السكينة: الإجماليات مخفية وخطوة صغيرة واحدة ظاهرة.",
    fr: "Mode sérénité : totaux masqués, un seul petit pas visible."
  },
  vault: {
    chapter: "privacy",
    en: "Vault: receipts with a fingerprint that proves they were not altered.",
    ar: "الخزنة: إيصالات ببصمة تثبت أنها لم تُعدَّل.",
    fr: "Coffre : des reçus avec une empreinte qui prouve qu’ils n’ont pas été modifiés."
  },
  reports: {
    chapter: "screens",
    en: "Reports: your private statistics and the estate sheet.",
    ar: "التقارير: إحصاءاتك الخاصة وورقة الوصية.",
    fr: "Rapports : vos statistiques privées et la fiche de succession."
  },
  islamic: {
    chapter: "words",
    en: "Islamic corner: verses, du'a and a private spiritual ledger.",
    ar: "الركن الإسلامي: آيات وأدعية وسجل روحي خاص.",
    fr: "Espace islamique : versets, du’a et registre spirituel privé."
  },
  settings: {
    chapter: "settings",
    en: "Settings: every switch, with what it changes.",
    ar: "الإعدادات: كل مفتاح وما يغيّره.",
    fr: "Réglages : chaque interrupteur, et ce qu’il change."
  },
  about: {
    chapter: "start",
    en: "About: what DYON is, is not, and its red lines.",
    ar: "عن التطبيق: ما هو ديون وما ليس عليه وخطوطه الحمراء.",
    fr: "À propos : ce qu’est DYON, ce qu’il n’est pas, et ses lignes rouges."
  },
  guide: {
    chapter: "start",
    en: "Guide: short chapters and an A–Z glossary.",
    ar: "الدليل: فصول قصيرة ومسرد أبجدي.",
    fr: "Guide : de courts chapitres et un glossaire de A à Z."
  },
  onboarding: {
    chapter: "first-entry",
    en: "Getting started: empty your head, roughly, in a few minutes.",
    ar: "البداية: أفرغ ذهنك تقريبيًا في دقائق.",
    fr: "Pour commencer : videz votre tête, à peu près, en quelques minutes."
  }
};
