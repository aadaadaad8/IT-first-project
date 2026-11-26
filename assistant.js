document.addEventListener("DOMContentLoaded", () => {
  const log = document.getElementById("assistantLog");
  const input = document.getElementById("assistantInput");
  const sendButton = document.getElementById("assistantSend");
  const chipsBox = document.getElementById("assistantChips");
  const searchInput = document.getElementById("searchInput");

  if (!log || !input || !sendButton || typeof books === "undefined") return;

  // ---------------------------------------------------------------------------
  // Extra topic tags for books whose "genre" is empty in data.js.
  // They are only used by this assistant (data.js is not changed).
  // Each row: [field to search in, text to find, tags]
  // ---------------------------------------------------------------------------
  const EXTRA_TAGS = [
    ["book", "Bermuda Triangle", "paranormal, mystery, non-fiction"],
    ["book", "Horse Whisperer", "romance, novel"],
    ["book", "The Outsiders", "young adult, coming-of-age, novel"],
    ["book", "Guess How Much I Love You", "children's picture book"],
    ["authors", "Clavell", "historical novel, adventure"],
    ["book", "Poky Little Puppy", "children's picture book"],
    ["book", "Perfume", "crime novel, historical novel"],
    ["book", "Grapes of Wrath", "novel, classic"],
    ["book", "Shadow of the Wind", "mystery, gothic, novel"],
    ["book", "Interpreter of Maladies", "short stories, fiction"],
    ["authors", "Michelle Obama", "memoir, autobiography"],
    ["book", "Tuesdays with Morrie", "memoir, inspirational, non-fiction"],
    ["book", "God's Little Acre", "novel, classic"],
    ["book", "Follow Your Heart", "novel, inspirational"],
    ["book", "A Wrinkle in Time", "science fantasy, fantasy, science fiction, children's, young adult"],
    ["book", "Long Walk to Freedom", "autobiography, memoir, political, history"],
    ["book", "Old Man and the Sea", "novella, classic, adventure"],
    ["book", "Life After Life", "non-fiction, spiritual"],
    ["book", "Peyton Place", "novel, drama"],
    ["book", "Me Before You", "romance, novel"],
    ["book", "Norwegian Wood", "novel, romance, coming-of-age"],
    ["book", "The Plague", "philosophical novel, classic, novel"],
    ["book", "No Longer Human", "novel, psychological"],
    ["book", "Man's Search for Meaning", "memoir, psychology, philosophy, war"],
    ["book", "Divine Comedy", "epic poem, classic, spiritual"],
    ["book", "The Prophet", "philosophy, spiritual"],
    ["book", "Striped Pyjamas", "historical novel, war, young adult"],
    ["book", "The Gruffalo", "children's picture book"],
    ["book", "Tobacco Road", "novel, classic"],
    ["book", "Ronia", "children's fantasy, adventure, children's novel"],
    ["book", "Cat in the Hat", "children's picture book"],
    ["book", "Diana: Her True Story", "biography, non-fiction"],
    ["book", "The Help", "historical novel, fiction"],
    ["book", "Catch-22", "satire, war, novel, classic"],
    ["book", "The Stranger", "philosophical novel, classic, novel"],
    ["book", "Eye of the Needle", "thriller, war, spy"],
    ["book", "Lovely Bones", "novel, mystery"],
    ["book", "Wild Swans", "autobiography, memoir, history, family saga"],
    ["book", "Santa Evita", "novel, historical novel"],
    ["book", "Un di Velt", "memoir, autobiography, war, history"],
    ["book", "Confucius from the Heart", "philosophy, self-help"],
    ["book", "The Total Woman", "self-help, relationships, marriage"],
    ["book", "Knowledge-value Revolution", "economics, business, non-fiction"],
    ["book", "Problems in China", "economics, non-fiction"],
    ["book", "What Color Is Your Parachute", "career, self-help, business, non-fiction"],
    ["book", "Dukan Diet", "diet, health, non-fiction"],
    ["book", "Joy of Sex", "sexology, manual, relationships"],
    ["book", "Gospel According to Peanuts", "religion, christian"],
    ["book", "Subtle Art of Not Giving", "self-help, non-fiction"],
    ["book", "Life of Pi", "adventure, philosophical novel, novel"],
    ["book", "The Front Runner", "romance, novel"],
    ["book", "The Goal", "business, business fable, management"],
    ["book", "Fahrenheit 451", "dystopian, science fiction, novel"],
    ["book", "Angela's Ashes", "memoir, autobiography"],
    ["book", "Experiments with Truth", "autobiography, memoir, political, spiritual"],
    ["book", "Bridget Jones", "romance, humor, comedy, novel"]
  ];

  // ---------------------------------------------------------------------------
  // Topics the assistant understands (Persian + English words)
  // field: "meta" = genre + tags, "lang" = original language, "year" = custom test
  // ---------------------------------------------------------------------------
  const CONCEPTS = [
    { id: "fantasy", w: 3, labelFa: "فانتزی", labelEn: "fantasy", re: /fantasy/,
      fa: ["فانتزی", "جادو", "جادویی", "افسانه", "افسانه ای"], en: ["fantasy", "magic", "wizard", "wizards"] },
    { id: "mystery", w: 3, labelFa: "معمایی و جنایی", labelEn: "mystery / crime", re: /mystery|crime|detective/,
      fa: ["معمایی", "معما", "جنایی", "کارآگاه", "کارآگاهی", "پلیسی", "رازآلود"], en: ["mystery", "crime", "detective", "whodunit"] },
    { id: "thriller", w: 3, labelFa: "هیجانی و تعلیقی", labelEn: "thriller", re: /thriller|spy/,
      fa: ["هیجانی", "هیجان", "تعلیق", "تعلیقی", "تریلر", "دلهره", "جاسوسی"], en: ["thriller", "suspense", "spy"] },
    { id: "romance", w: 3, labelFa: "عاشقانه", labelEn: "romance", re: /romanc/,
      fa: ["عاشقانه", "عشق", "رمانتیک", "عاشقی"], en: ["romance", "romantic"] },
    { id: "scifi", w: 3, labelFa: "علمی تخیلی", labelEn: "science fiction", re: /science fiction|science fantasy|sci-?fi/,
      fa: ["علمی تخیلی", "علمی تخیلی", "تخیلی", "فضایی"], en: ["science fiction", "sci-fi", "scifi", "sci fi"] },
    { id: "dystopia", w: 3, labelFa: "ضدآرمان‌شهری (دیستوپیا)", labelEn: "dystopia", re: /dystopi/,
      fa: ["دیستوپیا", "دیستوپیایی", "ضد آرمانشهر", "ضد آرمان شهر", "آخرالزمانی"], en: ["dystopia", "dystopian"] },
    { id: "historical", w: 3, labelFa: "تاریخی", labelEn: "historical", re: /histor/,
      fa: ["تاریخی", "تاریخ"], en: ["historical", "history"] },
    { id: "children", w: 3, labelFa: "کودکان", labelEn: "children's books", re: /child|picture book/,
      fa: ["کودک", "کودکان", "بچه", "بچه ها", "کودکانه", "تصویری", "بچگانه"], en: ["children", "childrens", "kids", "kid", "child", "picture book"] },
    { id: "ya", w: 3, labelFa: "نوجوانان", labelEn: "young adult", re: /young adult/,
      fa: ["نوجوان", "نوجوانان", "نوجوانانه"], en: ["young adult", "teen", "teens", "teenager", "ya"] },
    { id: "comingofage", w: 3, labelFa: "دوران بلوغ و رشد", labelEn: "coming of age", re: /coming-of-age|coming of age|bildungsroman/,
      fa: ["بلوغ", "دوران بلوغ", "نوجوان", "نوجوانان"], en: ["coming of age", "coming-of-age", "bildungsroman"] },
    { id: "selfhelp", w: 3, labelFa: "خودیاری و انگیزشی", labelEn: "self-help / motivational", re: /self-help|motivational|inspirational/,
      fa: ["خودیاری", "انگیزشی", "انگیزه", "موفقیت", "توسعه فردی", "رشد فردی", "خودسازی", "الهام بخش"], en: ["self-help", "self help", "selfhelp", "motivational", "motivation", "inspirational", "success"] },
    { id: "psychology", w: 3, labelFa: "روانشناسی", labelEn: "psychology", re: /psycholog/,
      fa: ["روانشناسی", "روان", "ذهن", "روانشناختی"], en: ["psychology", "psychological", "mind"] },
    { id: "business", w: 3, labelFa: "کسب‌وکار و مدیریت", labelEn: "business / management", re: /business|leadership|management|economy|economic|career/,
      fa: ["کسب و کار", "کسبوکار", "بیزینس", "مدیریت", "رهبری", "اقتصاد", "اقتصادی", "شغل", "شغلی", "صنعتی"], en: ["business", "management", "leadership", "economy", "economics", "career"] },
    { id: "science", w: 3, guards: { science: /science fiction|science fantasy/ }, labelFa: "علمی و کیهان‌شناسی", labelEn: "popular science", re: /popular science|astrophys|cosmolog|anthropolog|social science(?! fiction)/,
      fa: ["علم", "علمی", "علوم", "فیزیک", "نجوم", "کیهان", "فضا", "اخترفیزیک", "انسان شناسی"], en: ["science", "scientific", "physics", "astronomy", "cosmos", "cosmology", "space", "universe", "anthropology"] },
    { id: "philosophy", w: 3, labelFa: "فلسفه و معنویت", labelEn: "philosophy / spirituality", re: /philosoph|spiritual|new-age/,
      fa: ["فلسفه", "فلسفی", "معنوی", "معنویت", "عرفان", "عرفانی"], en: ["philosophy", "philosophical", "spiritual", "spirituality"] },
    { id: "religion", w: 3, labelFa: "دین و مذهب", labelEn: "religion", re: /christian|jewish|religio/,
      fa: ["مذهبی", "دین", "دینی", "مسیحی", "یهودی"], en: ["religion", "religious", "christian", "jewish"] },
    { id: "memoir", w: 3, labelFa: "خاطرات و زندگینامه", labelEn: "memoir / biography", re: /memoir|autobiograph|biograph/,
      fa: ["خاطرات", "خاطره", "زندگینامه", "خودزندگینامه", "بیوگرافی", "شرح حال", "زندگی نامه"], en: ["memoir", "memoirs", "autobiography", "biography"] },
    { id: "war", w: 3, labelFa: "جنگ", labelEn: "war", re: /\bwar\b/,
      fa: ["جنگ", "جنگی"], en: ["war"] },
    { id: "horror", w: 3, labelFa: "ترسناک", labelEn: "horror", re: /horror/,
      fa: ["ترسناک", "وحشت", "ترس"], en: ["horror", "scary"] },
    { id: "gothic", w: 2, labelFa: "گوتیک", labelEn: "gothic", re: /gothic/,
      fa: ["گوتیک"], en: ["gothic"] },
    { id: "adventure", w: 3, labelFa: "ماجراجویی", labelEn: "adventure", re: /adventure|robinsonade|travel/,
      fa: ["ماجراجویی", "ماجراجویانه", "ماجرا", "سفر", "سفرنامه"], en: ["adventure", "adventures", "travel", "journey"] },
    { id: "satire", w: 3, labelFa: "طنز و سیاسی", labelEn: "satire / political", re: /satir|political|comedy|humor/,
      fa: ["طنز", "طنزآمیز", "سیاسی", "سیاست", "کمدی", "خنده دار"], en: ["satire", "satirical", "political", "politics", "humor", "comedy", "funny"] },
    { id: "family", w: 3, labelFa: "خانوادگی", labelEn: "family", re: /family|saga/,
      fa: ["خانواده", "خانوادگی"], en: ["family", "saga"] },
    { id: "health", w: 3, labelFa: "سلامت و رژیم", labelEn: "health / diet", re: /diet|health|pregnan|guide|manual/,
      fa: ["سلامت", "رژیم", "تغذیه", "بارداری", "پزشکی", "لاغری", "راهنما"], en: ["health", "diet", "pregnancy", "medical", "guide"] },
    { id: "relationships", w: 3, labelFa: "روابط", labelEn: "relationships", re: /relationship|marriage/,
      fa: ["رابطه", "روابط", "زناشویی", "ازدواج"], en: ["relationship", "relationships", "marriage"] },
    { id: "magicrealism", w: 3, labelFa: "رئالیسم جادویی", labelEn: "magic realism", re: /magic realism/,
      fa: ["رئالیسم جادویی", "رئالیسم جادویی"], en: ["magic realism", "magical realism"] },
    { id: "novel", w: 1, guards: { fiction: /science fiction|science fantasy|non fiction|non-fiction|nonfiction/ }, labelFa: "رمان", labelEn: "novel", re: /novel|fiction|novella/,
      fa: ["رمان", "داستان", "داستانی"], en: ["novel", "novels", "fiction", "story", "stories"] },
    { id: "nonfiction", w: 1, labelFa: "غیرداستانی", labelEn: "non-fiction", re: /non-fiction|memoir|autobiograph|biograph|popular science|psycholog|self-help|guide|manual|anthropolog|economy|economics|diet|essay|social science(?! fiction)|history/,
      fa: ["غیرداستانی", "واقعی", "حقیقی"], en: ["nonfiction", "non-fiction"] },
    { id: "classic", w: 1.5, labelFa: "کلاسیک (قدیمی)", labelEn: "classic", test: (e) => e.book.firstPublished < 1950 || /classic/.test(e.meta),
      fa: ["کلاسیک", "قدیمی", "قدیم"], en: ["classic", "classics", "old", "vintage"] },
    { id: "modern", w: 1.5, labelFa: "جدید و معاصر", labelEn: "modern", test: (e) => e.book.firstPublished >= 1990,
      fa: ["جدید", "مدرن", "امروزی", "معاصر", "تازه"], en: ["modern", "contemporary", "recent", "newer"] },

    // Languages (matched against the original language of the book)
    { id: "l-french", w: 2.5, labelFa: "زبان فرانسوی", labelEn: "French", field: "lang", re: /french/, fa: ["فرانسوی", "فرانسه"], en: ["french", "france"] },
    { id: "l-german", w: 2.5, labelFa: "زبان آلمانی", labelEn: "German", field: "lang", re: /german/, fa: ["آلمانی", "آلمان"], en: ["german", "germany"] },
    { id: "l-russian", w: 2.5, labelFa: "زبان روسی", labelEn: "Russian", field: "lang", re: /russian/, fa: ["روسی", "روسیه"], en: ["russian", "russia"] },
    { id: "l-japanese", w: 2.5, labelFa: "زبان ژاپنی", labelEn: "Japanese", field: "lang", re: /japanese/, fa: ["ژاپنی", "ژاپن"], en: ["japanese", "japan"] },
    { id: "l-chinese", w: 2.5, labelFa: "زبان چینی", labelEn: "Chinese", field: "lang", re: /chinese/, fa: ["چینی", "چین"], en: ["chinese", "china"] },
    { id: "l-italian", w: 2.5, labelFa: "زبان ایتالیایی", labelEn: "Italian", field: "lang", re: /italian/, fa: ["ایتالیایی", "ایتالیا"], en: ["italian", "italy"] },
    { id: "l-spanish", w: 2.5, labelFa: "زبان اسپانیایی", labelEn: "Spanish", field: "lang", re: /spanish/, fa: ["اسپانیایی", "اسپانیا"], en: ["spanish", "spain"] },
    { id: "l-hindi", w: 2.5, labelFa: "زبان هندی", labelEn: "Hindi", field: "lang", re: /hindi/, fa: ["هندی", "هند"], en: ["hindi", "india"] },
    { id: "l-swedish", w: 2.5, labelFa: "زبان سوئدی", labelEn: "Swedish", field: "lang", re: /swedish/, fa: ["سوئدی", "سوئد"], en: ["swedish", "sweden"] },
    { id: "l-norwegian", w: 2.5, labelFa: "زبان نروژی", labelEn: "Norwegian", field: "lang", re: /norwegian/, fa: ["نروژی", "نروژ"], en: ["norwegian", "norway"] }
  ];

  // Famous names written in Persian -> the English words used in data.js
  const NAMES_FA = {
    "تالکین": "tolkien", "هابیت": "hobbit", "هری پاتر": "harry potter", "رولینگ": "rowling",
    "آگاتا کریستی": "christie", "کریستی": "christie", "کوئیلو": "coelho", "پائولو کوئیلو": "coelho",
    "کیمیاگر": "alchemist", "کامو": "camus", "موراکامی": "murakami", "همینگوی": "hemingway",
    "اشتاین بک": "steinbeck", "دیکنز": "dickens", "تولستوی": "tolstoy", "آنه فرانک": "anne frank",
    "هسینی": "hosseini", "بادبادک باز": "kite runner", "کارنگی": "carnegie", "استیون کاوی": "covey",
    "هاوکینگ": "hawking", "کارل سیگان": "sagan", "سیگان": "sagan", "شازده کوچولو": "little prince",
    "جین آستن": "austen", "فیتزجرالد": "fitzgerald", "گتسبی": "gatsby", "ناباکوف": "nabokov",
    "نابوکوف": "nabokov", "دنیای سوفی": "sophie", "اورول": "orwell", "جرج اورول": "orwell",
    "بردبری": "bradbury", "دن براون": "dan brown", "مارک تواین": "twain", "رومن": "roald dahl",
    "رولد دال": "roald dahl", "دکتر سوس": "seuss", "جبران": "gibran", "پیامبر": "prophet",
    "فرانکل": "frankl", "رمارک": "remarque", "فرانک هربرت": "herbert", "تلماسه": "dune"
  };

  const STOP_EN = new Set(["i", "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "with", "about",
    "like", "love", "want", "need", "some", "something", "any", "me", "my", "am", "is", "are", "can", "you", "recommend",
    "suggest", "please", "book", "books", "read", "reading", "good", "great", "best", "interested", "interest", "that",
    "this", "what", "which", "your", "give", "show", "find", "tell", "hello", "hi", "hey", "also", "more", "very"]);

  const FA_SUFFIXES = ["", "ها", "های", "ی", "ای", "ان", "انه", "ه", "یی", "ات", "تر", "رو", "را", "هام", "مو"];

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function normalize(text) {
    return String(text ?? "")
      .toLowerCase()
      .replace(/ي/g, "ی")
      .replace(/ك/g, "ک")
      .replace(/ۀ/g, "ه")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[\u200c\u200f\u200e]/g, " ")
      .replace(/[^a-z0-9\u0600-\u06ff'\-\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isPersian(text) {
    return /[\u0600-\u06FF]/.test(text);
  }

  function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Does the (normalized) user text contain this keyword?
  function hasKeyword(normalized, tokens, keyword, persian) {
    const kw = normalize(keyword);
    if (!kw) return false;

    if (kw.includes(" ")) {
      return (" " + normalized + " ").includes(" " + kw + " ");
    }

    if (persian) {
      return tokens.some((tok) => {
        if (!tok.startsWith(kw)) return false;
        return FA_SUFFIXES.includes(tok.slice(kw.length));
      });
    }

    // English: allow simple plurals / endings (fantasy -> fantasies is not needed, books -> book)
    return tokens.some((tok) => tok === kw || (kw.length >= 4 && tok.startsWith(kw) && tok.length - kw.length <= 2));
  }

  // ---------------------------------------------------------------------------
  // Prepare books
  // ---------------------------------------------------------------------------
  const entries = books.map((book) => {
    const title = String(book.book ?? "");
    const authors = String(book.authors ?? "");
    let tags = "";

    EXTRA_TAGS.forEach(([field, find, extra]) => {
      if (String(book[field === "book" ? "book" : "authors"] ?? "").toLowerCase().includes(find.toLowerCase())) {
        tags += (tags ? ", " : "") + extra;
      }
    });

    return {
      book,
      meta: (String(book.genre ?? "") + " " + tags).toLowerCase(),
      text: (title + " " + authors).toLowerCase(),
      lang: String(book.originalLanguage ?? "").toLowerCase(),
      tags
    };
  });

  const topSellers = entries.slice().sort(
    (a, b) => (b.book.approximateSalesInMillions || 0) - (a.book.approximateSalesInMillions || 0)
  );

  function conceptMatches(concept, entry) {
    if (concept.test) return concept.test(entry);
    return concept.re.test(concept.field === "lang" ? entry.lang : entry.meta);
  }

  // ---------------------------------------------------------------------------
  // Understanding the message and scoring books
  // ---------------------------------------------------------------------------
  function analyze(message) {
    const persian = isPersian(message);
    const normalized = normalize(message);
    const tokens = normalized.split(" ").filter(Boolean);

    // Topics found in the message
    const concepts = CONCEPTS.filter((concept) => {
      const words = persian ? concept.fa.concat(concept.en) : concept.en;
      return words.some((word) => {
        // Some words mean something else inside a longer phrase (e.g. "science" in "science fiction")
        if (concept.guards && concept.guards[word] && concept.guards[word].test(normalized)) return false;
        return hasKeyword(normalized, tokens, word, isPersian(word));
      });
    });

    // Names / words to look for in title, author
    const nameTokens = [];
    Object.keys(NAMES_FA).forEach((faName) => {
      if ((" " + normalized + " ").includes(" " + normalize(faName) + " ")) {
        nameTokens.push(NAMES_FA[faName]);
      }
    });

    const conceptWords = new Set();
    concepts.forEach((c) => c.en.forEach((w) => w.split(" ").forEach((p) => conceptWords.add(p))));

    tokens.forEach((tok) => {
      if (/^[a-z][a-z'\-]{2,}$/.test(tok) && !STOP_EN.has(tok) && !conceptWords.has(tok)) {
        nameTokens.push(tok);
      }
    });

    return { persian, concepts, nameTokens: Array.from(new Set(nameTokens)) };
  }

  function recommend(info) {
    const scored = entries.map((entry) => {
      let score = 0;
      const reasons = [];
      let authorHit = false;

      info.concepts.forEach((concept) => {
        if (conceptMatches(concept, entry)) {
          score += concept.w;
          reasons.push(info.persian ? concept.labelFa : concept.labelEn);
        }
      });

      info.nameTokens.forEach((tok) => {
        const pattern = new RegExp("(^|[^a-z])" + escapeRegExp(tok));
        if (pattern.test(entry.text)) {
          score += 3.5;
          reasons.push(tok);
          if (pattern.test(entry.book.authors.toLowerCase())) authorHit = true;
        } else if (pattern.test(entry.meta)) {
          score += 2;
          reasons.push(tok);
        }
      });

      // Tiny popularity bonus, only used to break ties
      score += Math.min((entry.book.approximateSalesInMillions || 0) / 1000, 0.2);

      return { entry, score, reasons, authorHit };
    });

    const matched = scored
      .filter((item) => item.reasons.length > 0 && item.score >= 1)
      .sort((a, b) => b.score - a.score || (b.entry.book.approximateSalesInMillions || 0) - (a.entry.book.approximateSalesInMillions || 0));

    // At most one book per author (unless the user asked for that author)
    const picked = [];
    const perAuthor = {};
    matched.forEach((item) => {
      if (picked.length >= 3) return;
      const author = item.entry.book.authors;
      const limit = item.authorHit ? 3 : 1;
      perAuthor[author] = perAuthor[author] || 0;
      if (perAuthor[author] < limit) {
        perAuthor[author]++;
        picked.push(item);
      }
    });

    const threshold = picked.length > 0 && picked[0].score >= 3 ? 3 : 1;
    return { picked, totalMatches: matched.filter((item) => item.score >= threshold).length };
  }

  // ---------------------------------------------------------------------------
  // Chat UI (text is always inserted with textContent, never as HTML)
  // ---------------------------------------------------------------------------
  function addMessage(text, who, persian) {
    const bubble = document.createElement("div");
    bubble.className = "assistant-msg " + who;
    if (persian) bubble.dir = "rtl";
    bubble.textContent = text;
    log.appendChild(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  // Title without the text in parentheses, used as the search text in the table
  function searchText(book) {
    return String(book.book).replace(/\s*\(.*?\)\s*/g, " ").trim();
  }

  // Only used on a page that has its own search box and table
  function showInTable(book) {
    if (!searchInput) return;
    searchInput.value = searchText(book);
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    const table = document.getElementById("booksTable");
    if (table) table.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function addRecommendations(items, persian) {
    items.forEach((item) => {
      const book = item.entry.book;
      const card = document.createElement("div");
      card.className = "assistant-rec";
      if (persian) card.dir = "rtl";

      const title = document.createElement("div");
      title.className = "rec-title";
      title.textContent = book.book;

      const meta = document.createElement("div");
      meta.className = "rec-meta";
      const sales = book.approximateSalesInMillions;
      meta.textContent = persian
        ? `${book.authors} · ${book.firstPublished} · حدود ${sales} میلیون نسخه`
        : `${book.authors} · ${book.firstPublished} · about ${sales}M copies sold`;

      const why = document.createElement("div");
      why.className = "rec-why";
      const uniqueReasons = Array.from(new Set(item.reasons));
      if (item.fallback) {
        why.textContent = persian ? "جزو پرفروش‌ترین‌های این لیست" : "One of the best-selling books in this list";
      } else {
        why.textContent = persian
          ? "مرتبط با: " + uniqueReasons.join("، ")
          : "Matches: " + uniqueReasons.join(", ");
      }

      let button;
      if (searchInput) {
        button = document.createElement("button");
        button.type = "button";
        button.addEventListener("click", () => showInTable(book));
      } else {
        // No table on this page: open the Book List page with the title already searched
        button = document.createElement("a");
        button.href = "books.html?search=" + encodeURIComponent(searchText(book));
      }
      button.className = "rec-button";
      button.textContent = persian ? "نمایش در جدول" : "Show in table";

      card.append(title, meta, why, button);
      log.appendChild(card);
    });
    log.scrollTop = log.scrollHeight;
  }

  function reply(message) {
    const info = analyze(message);
    const persian = info.persian;

    // Nothing understood
    if (info.concepts.length === 0 && info.nameTokens.length === 0) {
      addMessage(
        persian
          ? "هنوز نفهمیدم چه نوع کتابی دوست داری. مثلاً بگو: فانتزی، معمایی، روانشناسی، تاریخی، کتاب کودک، رمان عاشقانه، یا اسم یک نویسنده."
          : "I couldn't tell what kind of book you like yet. Try a genre or topic (fantasy, mystery, psychology, history, children's books, romance) or an author's name.",
        "bot",
        persian
      );
      return;
    }

    const { picked, totalMatches } = recommend(info);

    // Nothing found in the list
    if (picked.length === 0) {
      addMessage(
        persian
          ? "کتابی با این مشخصات توی این لیست پیدا نکردم. این‌ها پرفروش‌ترین کتاب‌های لیست هستن، شاید خوشت بیاد:"
          : "I couldn't find a book with these details in this list. Here are the best-selling books in the list instead:",
        "bot",
        persian
      );
      const fallback = [];
      const seen = {};
      topSellers.forEach((entry) => {
        if (fallback.length >= 3 || seen[entry.book.authors]) return;
        seen[entry.book.authors] = true;
        fallback.push({ entry, reasons: [], fallback: true });
      });
      addRecommendations(fallback, persian);
      return;
    }

    const topics = Array.from(new Set(
      info.concepts.map((c) => (persian ? c.labelFa : c.labelEn)).concat(info.nameTokens)
    ));

    addMessage(
      persian
        ? `بر اساس علاقه‌ات (${topics.join("، ")}) این ${picked.length} کتاب رو از لیست پیشنهاد می‌کنم:`
        : `Based on your interests (${topics.join(", ")}), I picked ${picked.length} from the list:`,
      "bot",
      persian
    );
    addRecommendations(picked, persian);

    if (totalMatches > picked.length) {
      addMessage(
        persian
          ? `در کل ${totalMatches} کتاب مرتبط پیدا شد. اگه علایقت رو دقیق‌تر بگی (مثلاً زبان، دوره زمانی یا نویسنده)، پیشنهادها دقیق‌تر می‌شن.`
          : `There are ${totalMatches} related books in total. Add more detail (language, era, author) and I can narrow it down.`,
        "bot",
        persian
      );
    }
  }

  function handleSend() {
    const message = input.value.trim();
    if (!message) return;
    addMessage(message, "user", isPersian(message));
    input.value = "";
    reply(message);
  }

  sendButton.addEventListener("click", handleSend);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  });

  if (chipsBox) {
    chipsBox.querySelectorAll("button").forEach((chip) => {
      chip.addEventListener("click", () => {
        input.value = chip.dataset.text || chip.textContent;
        handleSend();
      });
    });
  }

  // Welcome message
  addMessage("Hi! Tell me what kind of books you like and I will pick some from the list. / سلام! بگو چه نوع کتابی دوست داری تا از بین کتاب‌های لیست پیشنهاد بدم.", "bot", false);
});
