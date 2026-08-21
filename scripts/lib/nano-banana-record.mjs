const ALLOWED_MEDIA_HOSTS = new Set([
  "cms-assets.youmind.com",
  "pbs.twimg.com",
  "raw.githubusercontent.com",
]);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function truncate(value, length) {
  return [...value].slice(0, length).join("");
}

function validHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validSourceMediaUrl(value) {
  if (!validHttpUrl(value)) return false;
  return ALLOWED_MEDIA_HOSTS.has(new URL(value).hostname.toLowerCase());
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function xProfileFromSource(sourceUrl) {
  if (!validHttpUrl(sourceUrl)) return "";
  const url = new URL(sourceUrl);
  const handle = url.pathname.split("/").filter(Boolean)[0];
  return handle ? `https://x.com/${handle}` : "";
}

const categoryRules = [
  ["infographic", /\b(infographic|diagram|flowchart|chart|timeline|dashboard|schematic|data visualization|mind map)\b|信息图|流程图|图表/i],
  ["graphic-design", /\b(poster|cover|logo|branding|typography|flyer|banner|card design|menu|packaging|mockup|sticker|collage)\b|海报|封面|标志|排版|拼贴|贴纸/i],
  ["illustration", /\b(illustration|drawing|anime|manga|cartoon|comic|watercolor|crayon|pixel art|isometric|vector art|3d render)\b|插画|绘画|动漫|漫画|水彩|蜡笔/i],
  ["environment", /\b(interior|architecture|room|building|landscape|cityscape|environment|garden|street scene)\b|室内|建筑|空间|景观|城市|场景/i],
  ["portrait", /\b(portrait|woman|man|person|people|model|selfie|girl|boy|couple|family|face|fashion model)\b|人像|人物|女性|男性|女孩|男孩/i],
  ["photography", /\b(photo|photograph|photography|camera|shot|cinematic still|editorial photography)\b|照片|摄影|镜头/i],
];

const tagRules = [
  ["cinematic", /\b(cinematic|movie|film still|cinematography)\b|电影感|电影级/i],
  ["fashion", /\b(fashion|outfit|clothing|apparel|dress|editorial model|runway)\b|时尚|服装|穿搭/i],
  ["macro", /\b(macro|extreme close[- ]?up|microscopic)\b|微距/i],
  ["character", /\b(character|warrior|samurai|hero|villain|knight|wizard)\b|角色|武士|战士/i],
  ["three-d", /\b(3d|cgi|octane|blender|c4d|rendered)\b/i],
  ["nature", /\b(nature|forest|mountain|ocean|river|flower|wildlife|landscape)\b|自然|森林|山脉|海洋/i],
  ["product", /\b(product|commercial|advertising|packaging|bottle|watch|shoe|cosmetic)\b|产品|商品|包装/i],
  ["anime", /\b(anime|manga|ghibli)\b|动漫|漫画/i],
  ["realistic", /\b(realistic|photorealistic|hyperreal|lifelike|realism)\b|写实|真实感/i],
  ["hand-drawn", /\b(hand[- ]?drawn|sketch|doodle|line art|pencil drawing)\b|手绘|素描|涂鸦|线稿/i],
  ["minimal", /\b(minimal|minimalist|clean layout|simple design)\b|极简|简约/i],
  ["vintage", /\b(vintage|retro|nostalgic|old photo|film grain)\b|复古|怀旧/i],
  ["watercolor", /\bwatercolou?r\b|水彩/i],
  ["crayon", /\bcrayon\b|蜡笔/i],
  ["ukiyo-e", /\b(ukiyo[- ]?e|woodblock print)\b|浮世绘/i],
  ["liquid-glass", /\b(liquid glass|glassmorphism)\b|液态玻璃/i],
  ["photo-edit", /\b(edit (?:this|the) (?:photo|image)|image edit|photo edit|replace|change clothing|reference image|uploaded (?:photo|image))\b|照片改造|修改照片|参考图/i],
  ["poster-cover", /\b(poster|cover|flyer|key visual|album art)\b|海报|封面/i],
  ["infographic", /\b(infographic|diagram|flowchart|chart|timeline|data visualization)\b|信息图|流程图|图表/i],
  ["collage", /\b(collage|moodboard|contact sheet|photo grid)\b|拼图|拼贴/i],
  ["quote-card", /\b(quote card|quotation|inspirational quote)\b|引言卡|语录/i],
  ["map", /\b(map|cartography|geographic)\b|地图/i],
  ["panorama-360", /\b(360|panorama|equirectangular|vr scene)\b|全景/i],
  ["portrait", /\b(portrait|headshot|selfie|face|woman|man|person|model)\b|人像|人物/i],
  ["travel", /\b(travel|tourism|vacation|destination|journey)\b|旅行|旅游/i],
  ["lifestyle", /\b(lifestyle|daily life|home life|cafe|cozy)\b|生活方式|日常/i],
  ["interior", /\b(interior|room|living room|bedroom|kitchen|office space)\b|室内|房间/i],
  ["architecture", /\b(architecture|building|facade|house|skyscraper)\b|建筑/i],
  ["festival", /\b(christmas|halloween|new year|festival|holiday|valentine)\b|节日|圣诞|新年/i],
  ["technology", /\b(technology|futuristic|cyberpunk|robot|computer|digital interface|sci-fi)\b|科技|未来|机器人/i],
  ["food", /\b(food|drink|coffee|dessert|restaurant|dish|fruit|cake)\b|美食|饮品|咖啡|甜点/i],
];

const categoryDefaults = {
  portrait: "portrait",
  photography: "realistic",
  illustration: "hand-drawn",
  "graphic-design": "poster-cover",
  infographic: "infographic",
  environment: "nature",
};

export function classifyPrompt(title, description, content) {
  const summary = `${title}\n${description}`;
  const fullText = `${summary}\n${content}`;
  const category =
    categoryRules.find(([, pattern]) => pattern.test(summary))?.[0] ??
    categoryRules.find(([, pattern]) => pattern.test(fullText))?.[0] ??
    "photography";
  const tagScores = tagRules
    .map(([key, pattern], priority) => {
      const summaryHit = pattern.test(summary);
      pattern.lastIndex = 0;
      const contentHit = pattern.test(content);
      pattern.lastIndex = 0;
      return { key, priority, score: Number(summaryHit) * 2 + Number(contentHit) };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.priority - right.priority);
  const tags = [...new Set(tagScores.map(({ key }) => key))];
  const fallback = categoryDefaults[category];
  if (!tags.includes(fallback)) tags.push(fallback);
  return { categoryKey: category, tagKeys: tags.slice(0, 6) };
}

export function normalizeRecord(row) {
  const externalId = clean(row.id);
  if (!externalId || !/^[a-zA-Z0-9_-]{1,80}$/.test(externalId)) {
    throw new Error(`无效外部 ID：${externalId || "<empty>"}`);
  }

  const title = truncate(clean(row.title), 120);
  const prompt = truncate(clean(row.content), 20_000);
  if (!title || !prompt) throw new Error(`${externalId} 缺少标题或提示词`);

  const description = truncate(clean(row.description), 2_000);
  const rawAuthor = parseJson(row.author, {});
  const rawSourceUrl = clean(row.sourceLink);
  const derivedAuthorUrl = xProfileFromSource(rawSourceUrl);
  const notes = [];
  let authorUrl = validHttpUrl(clean(rawAuthor.link))
    ? clean(rawAuthor.link)
    : derivedAuthorUrl;
  if (!authorUrl) {
    authorUrl = "https://x.com";
    notes.push("原始作者链接缺失或无效");
  }
  const handle = new URL(authorUrl).pathname.split("/").filter(Boolean)[0];
  let authorName = truncate(clean(rawAuthor.name), 80);
  if (!authorName) {
    authorName = handle ? `@${handle}` : "未知作者";
    notes.push("原始作者名称缺失");
  }
  const sourceUrl = validHttpUrl(rawSourceUrl) ? rawSourceUrl : authorUrl;
  if (!validHttpUrl(rawSourceUrl)) notes.push("原始内容链接缺失或无效");

  const parsedMedia = parseJson(row.sourceMedia, []);
  const rawMediaUrls = Array.isArray(parsedMedia)
    ? [...new Set(parsedMedia.map(clean).filter(Boolean))]
    : [];
  const mediaUrls = rawMediaUrls.filter(validSourceMediaUrl).slice(0, 8);
  if (rawMediaUrls.length !== mediaUrls.length) {
    notes.push("源数据包含不受信任或无效的图片地址");
  }
  if (!mediaUrls.length) notes.push("源数据没有可用图片");
  const { categoryKey, tagKeys } = classifyPrompt(title, description, prompt);
  const sourcePublishedAt = Number.isNaN(Date.parse(row.sourcePublishedAt))
    ? null
    : new Date(row.sourcePublishedAt).toISOString();

  return {
    authorName,
    authorUrl,
    categoryKey,
    description,
    externalId,
    mediaUrls,
    notes,
    prompt,
    sourcePublishedAt,
    sourceUrl,
    tagKeys,
    title,
  };
}
