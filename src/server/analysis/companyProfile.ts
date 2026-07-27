import { CompanyEvidence, CompanyProfile } from "@/server/data/types";
import { makeId } from "@/server/data/store";
import { TianyanMarketProfile } from "@/server/sources/tianyanAi";

type RawCompanyRecord = Record<string, unknown>;

const scenarioRules = [
  { scenario: "人形机器人与灵巧手", keywords: ["机器人", "灵巧手", "关节", "伺服"] },
  { scenario: "医疗机器人与精密医疗设备", keywords: ["医疗", "手术", "微泵", "检测"] },
  { scenario: "实验室自动化与精密工业设备", keywords: ["自动化", "半导体", "精密", "实验室"] },
  { scenario: "汽车电子执行器", keywords: ["汽车", "车载", "执行器", "尾门"] },
  { scenario: "无人机与航空航天微驱动", keywords: ["无人机", "航空", "航天", "云台"] }
];

const productKeywords = ["电机", "空心杯", "齿轮箱", "FOC", "执行器", "微型驱动", "控制器"];
const painKeywords = ["温升", "噪声", "寿命", "磨损", "维护", "稳定性", "一致性", "空间受限"];
const techKeywords = ["专利", "软著", "研发", "算法", "控制", "模组", "测试", "精密"];
const procurementKeywords = ["招标", "中标", "采购", "询价", "打样", "样品", "供应商"];

function clean(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value).replace(/\s+/g, " ").trim();
  return "";
}

function unique(values: string[]) {
  return Array.from(new Set(values.map(clean).filter(Boolean)));
}

function includesAny(text: string, keywords: string[]) {
  return keywords.filter((keyword) => text.includes(keyword));
}

function stableCompanyId(companyName: string, creditCode?: string) {
  if (creditCode) return `company:${creditCode}`;
  let hash = 0;
  for (const char of companyName) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `company:${hash.toString(36)}`;
}

function evidence(input: Partial<CompanyEvidence>): CompanyEvidence {
  return {
    title: input.title || "企业情报记录",
    source: input.source || "手动导入",
    url: input.url,
    excerpt: input.excerpt,
    collectedAt: input.collectedAt || new Date().toISOString(),
    verificationStatus: input.verificationStatus || "待人工核验"
  };
}

function deriveProfile(input: {
  companyName: string;
  aliases?: string[];
  creditCode?: string;
  registrationStatus?: string;
  registeredCapital?: string;
  location?: string;
  businessScope?: string;
  riskSummary?: string;
  evidenceLinks?: CompanyEvidence[];
}): CompanyProfile {
  const now = new Date().toISOString();
  const companyName = clean(input.companyName) || "未命名企业";
  const text = [
    companyName,
    input.businessScope,
    input.riskSummary,
    ...(input.aliases || []),
    ...(input.evidenceLinks || []).map((item) => `${item.title} ${item.excerpt || ""}`)
  ].join(" ");
  const scenarios = scenarioRules.filter((rule) => rule.keywords.some((keyword) => text.includes(keyword))).map((rule) => rule.scenario);
  const risks = input.riskSummary || "暂无风险摘要，需人工核验";

  return {
    id: stableCompanyId(companyName, clean(input.creditCode) || undefined),
    companyName,
    aliases: unique(input.aliases || []),
    creditCode: clean(input.creditCode) || undefined,
    registrationStatus: clean(input.registrationStatus) || undefined,
    registeredCapital: clean(input.registeredCapital) || undefined,
    location: clean(input.location) || undefined,
    industryTags: unique(scenarios.map((item) => item.replace("与", "/"))),
    productKeywords: unique(includesAny(text, productKeywords)),
    applicationScenarios: unique(scenarios),
    painSignals: unique(includesAny(text, painKeywords)),
    technologySignals: unique(includesAny(text, techKeywords)),
    procurementSignals: unique(includesAny(text, procurementKeywords)),
    riskSummary: risks,
    evidenceLinks: input.evidenceLinks?.length ? input.evidenceLinks : [evidence({ title: "手动企业记录" })],
    verificationStatus: "待人工核验",
    createdAt: now,
    updatedAt: now
  };
}

export function buildCompanyProfileFromTianyan(profile: TianyanMarketProfile): CompanyProfile {
  return deriveProfile({
    companyName: profile.companyName,
    registrationStatus: profile.registration.status,
    registeredCapital: profile.registration.registeredCapital,
    location: profile.registration.location,
    businessScope: profile.registration.businessScope,
    riskSummary: profile.risk.summary,
    evidenceLinks: [
      evidence({
        title: `${profile.companyName} 天眼 AI 企业情报`,
        source: "天眼 AI",
        excerpt: [profile.registration.businessScope, profile.risk.summary].filter(Boolean).join("；")
      })
    ]
  });
}

function profileFromRecord(record: RawCompanyRecord) {
  const companyName = clean(record.companyName ?? record.name ?? record.company_name);
  const aliases = Array.isArray(record.aliases) ? record.aliases.map(clean) : clean(record.aliases).split(/[、,，]/);
  const businessScope = clean(record.businessScope ?? record.business_scope ?? record.description ?? record.public_excerpt);
  const evidenceLinks = Array.isArray(record.evidenceLinks)
    ? record.evidenceLinks.filter((item): item is CompanyEvidence => Boolean(item && typeof item === "object"))
    : [
      evidence({
        title: clean(record.title ?? record.page_title) || `${companyName || "企业"}导入记录`,
        source: clean(record.source) === "小红书" ? "小红书" : clean(record.source) === "公开网页" ? "公开网页" : "手动导入",
        url: clean(record.url ?? record.source_url) || undefined,
        excerpt: businessScope || undefined
      })
    ];
  return deriveProfile({
    companyName,
    aliases,
    creditCode: clean(record.creditCode ?? record.credit_code),
    registrationStatus: clean(record.registrationStatus ?? record.status ?? record.regStatus),
    registeredCapital: clean(record.registeredCapital ?? record.regCapital),
    location: clean(record.location ?? record.region ?? record.address),
    businessScope,
    riskSummary: clean(record.riskSummary ?? record.risk),
    evidenceLinks
  });
}

function mergeProfiles(left: CompanyProfile, right: CompanyProfile): CompanyProfile {
  return {
    ...left,
    companyName: left.companyName.length >= right.companyName.length ? left.companyName : right.companyName,
    aliases: unique([...left.aliases, ...right.aliases, left.companyName, right.companyName].filter((name) => name !== left.companyName && name !== right.companyName)),
    registrationStatus: left.registrationStatus || right.registrationStatus,
    registeredCapital: left.registeredCapital || right.registeredCapital,
    location: left.location || right.location,
    industryTags: unique([...left.industryTags, ...right.industryTags]),
    productKeywords: unique([...left.productKeywords, ...right.productKeywords]),
    applicationScenarios: unique([...left.applicationScenarios, ...right.applicationScenarios]),
    painSignals: unique([...left.painSignals, ...right.painSignals]),
    technologySignals: unique([...left.technologySignals, ...right.technologySignals]),
    procurementSignals: unique([...left.procurementSignals, ...right.procurementSignals]),
    riskSummary: left.riskSummary === "暂无风险摘要，需人工核验" ? right.riskSummary : left.riskSummary,
    evidenceLinks: [...left.evidenceLinks, ...right.evidenceLinks],
    updatedAt: new Date().toISOString()
  };
}

export function buildCompanyProfilesFromRecords(records: RawCompanyRecord[]) {
  const profiles = new Map<string, CompanyProfile>();
  for (const record of records) {
    const profile = profileFromRecord(record);
    const key = profile.creditCode || profile.companyName;
    profiles.set(key, profiles.has(key) ? mergeProfiles(profiles.get(key)!, profile) : profile);
  }
  return Array.from(profiles.values());
}

export function cloneProfileWithNewId(profile: CompanyProfile) {
  return { ...profile, id: profile.id || makeId("company") };
}
