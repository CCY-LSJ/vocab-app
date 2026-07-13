// Deno Deploy - 考研单词本 (前端 + OCR代理)
import { serveDir } from "jsr:@std/http/file-server";

const API_KEY = "UIvmY7Qbb5HDpjl4t1yCO6H6";
const SECRET_KEY = "r7ARzJbV60FyKtvGeE7jzJ7RJCAeYWiY";

// 考研核心词典 - 用于过滤和上下文匹配
const VOCAB_DICT = new Set([
  "abandon","abstract","academic","accelerate","access","accommodate","accompany","accomplish",
  "accumulate","accurate","achieve","acknowledge","acquire","adapt","adequate","adjust",
  "administration","adopt","advance","advantage","advocate","affect","aggressive","allocate",
  "alter","alternative","ambiguous","analyze","annual","anticipate","apparent","approach",
  "appropriate","approximate","arbitrary","aspect","assemble","assess","assign","assist",
  "associate","assume","atmosphere","attach","attain","attribute","authority","available",
  "aware","barrier","benefit","bias","bond","brief","budget","capable","capacity","category",
  "cease","challenge","channel","chapter","characteristic","circumstance","cite","civil",
  "claim","classic","clause","coincidence","collapse","colleague","comment","commission",
  "commit","commodity","communicate","community","compatible","compensate","compile",
  "complement","complex","component","comprehensive","comprise","concentrate","concept",
  "conclude","conduct","conference","confine","confirm","conflict","conform","confront",
  "conscious","consent","consequence","conservative","considerable","consistent","constant",
  "constitute","construct","consume","contact","contemporary","context","contract",
  "contradict","contrary","contrast","contribute","controversial","convention","convince",
  "cooperate","coordinate","core","corporate","correspond","counsel","counter","counterpart",
  "crucial","currency","cycle","debate","decade","decline","dedicate","define","definite",
  "demonstrate","deny","deposit","depress","derive","deserve","despite","detect","device",
  "devote","dimension","diminish","discipline","discriminate","dispose","dispute","dissolve",
  "distinct","distinguish","distribute","diverse","document","domestic","dominate","draft",
  "drama","dramatic","dynamic","economy","edition","efficient","elaborate","element",
  "eliminate","emerge","emphasis","enable","encounter","enforce","enhance","enormous",
  "ensure","enterprise","environment","equation","equivalent","error","essential",
  "establish","estate","estimate","evaluate","eventually","evidence","evolution","evolve",
  "exceed","exception","exclude","exclusive","execute","exhibit","expand","expert",
  "exploit","export","expose","extend","external","extract","extreme","facilitate","factor",
  "federal","feedback","figure","finance","flexible","forecast","formal","format","formula",
  "foundation","framework","function","fund","fundamental","furthermore","gender","generate",
  "global","grant","guarantee","guideline","hence","highlight","hypothesis","identical",
  "identify","ideology","ignorance","illustrate","image","immigrant","impact","implement",
  "implication","implicit","imply","impose","incentive","incident","incorporate","index",
  "indicate","individual","inevitable","infrastructure","initial","initiative","innovation",
  "insert","insight","inspect","instance","institute","integrate","intellectual",
  "intelligence","intense","interact","interfere","internal","interpret","interval",
  "intervene","invest","investigate","involve","isolate","issue","item","journal",
  "justify","label","labor","layer","lecture","legal","legislation","liberal","license",
  "likewise","link","literary","loan","locate","logic","maintain","major","manifest",
  "manipulate","margin","measure","mechanism","medium","mental","military","minimal",
  "minimum","ministry","minor","mode","modify","monitor","motive","mutual","negative",
  "neglect","network","nevertheless","norm","notion","nuclear","objective","obtain",
  "obvious","occupy","occur","odd","offend","option","outcome","output","overall",
  "overcome","overlap","overseas","panel","paradigm","paragraph","parallel","participate",
  "partner","passive","perceive","period","persist","perspective","phase","phenomenon",
  "philosophy","physical","policy","portion","pose","positive","potential","poverty",
  "precise","predict","prejudice","preserve","previous","primary","principal","principle",
  "prior","priority","procedure","proceed","process","professional","profit","prohibit",
  "project","promote","proportion","prospect","protein","protest","provision",
  "psychological","publish","purchase","pursue","qualify","quote","radical","random",
  "range","ratio","rational","react","recover","register","regulate","reinforce","reject",
  "release","relevant","reluctant","rely","remove","render","represent","require",
  "reserve","resident","resolve","resource","respond","restore","restrain","restrict",
  "retain","reveal","revenue","reverse","revolution","rigid","role","route","scenario",
  "schedule","scheme","scope","section","sector","secure","seek","select","senior",
  "sequence","series","shift","significant","similar","site","sole","somewhat","source",
  "specific","sphere","stable","statistics","status","strategy","stress","structure",
  "submit","subsequent","substitute","sufficient","sum","summary","superior","supplement",
  "survey","survive","suspend","sustain","symbol","target","task","technique","technology",
  "temporary","tend","tense","terminal","text","theme","theory","thereby","topic","trace",
  "tradition","transfer","transform","transmit","trend","trigger","ultimate","undergo",
  "underline","undertake","unique","utilize","valid","vary","vehicle","version","via",
  "virtual","visible","vision","visual","volume","voluntary","welfare","whereas",
  "widespread","yield",
  "the","and","for","are","but","not","you","all","can","had","her","was","one","our",
  "out","has","have","been","some","them","than","then","its","also","very","much",
  "research","study","data","model","system","design","method","result","analysis",
  "social","public","science","education","language","culture","history","subject",
  "example","problem","solution","reason","knowledge","information","development",
  "political","economic","international","national","government","business","technology",
  "experience","experiment","influence","effective","activity","environment","movement",
  "organization","competition","production","population","democracy","philosophy",
  "responsibility","opportunity","relationship","determine","contribute","describe",
  "provide","support","involve","consider","discuss","explain","compare","argue","suggest",
  "increase","decrease","improve","change","create","develop","produce","require",
  "include","continue","receive","believe","decide","control","protect","recognize",
  "represent","understand","express","contain","reflect","perform","reduce","expand",
  "operate","transform","separate","identify","observe","display","communicate","connect",
  "prevent","generate","maintain","achieve","combine","promote","enable","establish",
  "addition","attention","condition","definition","direction","difference","discussion",
  "expression","application","association","combination","construction","contribution",
  "conclusion","introduction","observation","investment","measurement","publication",
  "recommendation","relationship","requirement","significance","transportation","complexity"
]);

// 核心分词函数 - 多种策略并行
function extractWords(lines: string[]): string[] {
  const results = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 策略1: 自然分词（按空格/标点拆分）- 大部分正常情况
    const tokens = line.split(/[\s,.;:!?()\[\]{}""''<>\/\\|@#$%^&*+=~—–\u3000-\u303F\u2000-\u206F]+/);
    for (const token of tokens) {
      const t = token.trim();
      if (/^[a-zA-Z][a-zA-Z-]*[a-zA-Z]$/.test(t) && t.length >= 2) {
        results.add(t);
      }
    }

    // 策略2: 去除所有空格后词典匹配（处理碎片化：h e l l o → hello）
    if (line.length < 80 && line.replace(/\s/g, "").length >= 3) {
      const noSpace = line.replace(/\s/g, "").toLowerCase();
      for (const word of VOCAB_DICT) {
        if (word.length >= 3 && noSpace.includes(word)) {
          results.add(word);
        }
      }
    }

    // 策略3: 提取连字符词（如 self-esteem, well-being）
    const hyphenMatches = line.match(/[a-zA-Z]+-[a-zA-Z]+/g);
    if (hyphenMatches) {
      for (const m of hyphenMatches) results.add(m);
    }
  }

  return Array.from(results);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (url.pathname === "/api/ocr") {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "POST only" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const { image } = await req.json();
      if (!image) throw new Error("No image data");

      // 1. 获取百度 access_token
      const tokenRes = await fetch(
        `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${API_KEY}&client_secret=${SECRET_KEY}`
      );
      const tokenJson = await tokenRes.json();
      if (!tokenJson.access_token) {
        throw new Error(tokenJson.error_description || "获取百度token失败");
      }

      // 2. 调用百度 OCR
      const cleanB64 = image.replace(/^data:image\/\w+;base64,/, "");
      const ocrRes = await fetch("https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `access_token=${tokenJson.access_token}&image=${encodeURIComponent(cleanB64)}&language_type=CHN_ENG&detect_direction=false&paragraph=false&probability=false`,
      });
      const result = await ocrRes.json();
      if (result.error_code) throw new Error(result.error_msg || `百度OCR错误: ${result.error_code}`);

      // 3. 提取所有文本行
      const allLines: string[] = [];
      const rawTexts: string[] = [];
      const seen = new Set<string>();

      (result.words_result || []).forEach((item: any) => {
        const text = (item.words || "").trim();
        if (text) {
          rawTexts.push(text);
          allLines.push(text);
        }
      });

      // 4. 智能提取单词
      const extractedWords = extractWords(allLines);

      // 5. 给单词分类：词典匹配 vs 陌生词
      const words = [];
      for (const w of extractedWords) {
        const lower = w.toLowerCase();
        if (seen.has(lower)) continue;
        seen.add(lower);
        const inDict = VOCAB_DICT.has(lower);
        words.push({
          word: w,
          selected: inDict,
          meaning: "",
          inDict: inDict,
        });
      }

      // 词典词排前面，非词典词排后面
      words.sort((a, b) => {
        if (a.inDict && !b.inDict) return -1;
        if (!a.inDict && b.inDict) return 1;
        return a.word.length - b.word.length;
      });

      return new Response(JSON.stringify({
        success: true,
        words,
        rawTexts,
        totalFound: extractedWords.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (e: any) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      });
    }
  }

  return serveDir(req, { fsRoot: ".", urlRoot: "" });
});
