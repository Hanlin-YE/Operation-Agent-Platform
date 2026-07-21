import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type JsonRecord = Record<string, unknown>;

export type TianyanCompanyCandidate = {
  companyName: string;
  companyId?: string;
  creditCode?: string;
  status?: string;
  legalRepresentative?: string;
};

export type TianyanMarketProfile = {
  companyName: string;
  registration: {
    status?: string;
    legalRepresentative?: string;
    establishedAt?: string;
    registeredCapital?: string;
    location?: string;
    businessScope?: string;
  };
  risk: { summary: string };
  source: "天眼 AI";
};

type TianyanRunner = (args: string[]) => Promise<string>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value).trim() || undefined;
  return undefined;
}

function pick(record: JsonRecord, names: string[]) {
  for (const name of names) {
    const value = text(record[name]);
    if (value) return value;
  }
  return undefined;
}

function parseJson(output: string): unknown {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error("天眼 AI 返回了无法识别的数据。");
  }
}

function unwrap(value: unknown): JsonRecord {
  if (!isRecord(value)) return {};
  if (isRecord(value.data)) return value.data;
  if (isRecord(value.result)) return value.result;
  return value;
}

function records(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  for (const key of ["items", "list", "companies", "records"]) {
    if (Array.isArray(value[key])) return value[key].filter(isRecord);
  }
  if (isRecord(value.data) || isRecord(value.result)) return records(unwrap(value));
  return [];
}

function normalizeSearchKey(input: string) {
  const query = input.replace(/\s+/g, " ").trim();
  if (query.length < 2 || query.length > 120) throw new Error("请输入 2–120 个字符的企业名称、简称或统一社会信用代码。");
  return query;
}

async function runTyc(args: string[]) {
  const command = process.env.TYC_CLI_COMMAND?.trim() || "tyc";
  const { stdout } = await execFileAsync(command, [...args, "--compact"], {
    timeout: 20_000,
    maxBuffer: 1_000_000,
    windowsHide: true
  });
  return stdout;
}

function unavailableError() {
  return new Error("天眼 AI 本地服务不可用。请确认当前设备已完成 tyc CLI 配置。");
}

export class TianyanAiSource {
  private readonly runner: TianyanRunner;

  constructor({ runner = runTyc }: { runner?: TianyanRunner } = {}) {
    this.runner = runner;
  }

  private async call(args: string[]) {
    try {
      return parseJson(await this.runner(args));
    } catch (error) {
      if (error instanceof Error && error.message === "天眼 AI 返回了无法识别的数据。") throw error;
      throw unavailableError();
    }
  }

  async searchCompanies(input: string): Promise<TianyanCompanyCandidate[]> {
    const query = normalizeSearchKey(input);
    const payload = await this.call(["company", "companies", query]);
    return records(payload).map((item) => ({
      companyName: pick(item, ["name", "companyName", "company_name"]) || query,
      companyId: pick(item, ["id", "companyId", "company_id"]),
      creditCode: pick(item, ["creditCode", "credit_code", "creditcode"]),
      status: pick(item, ["regStatus", "status", "reg_status"]),
      legalRepresentative: pick(item, ["legalPersonName", "legalRepresentative", "legal_person_name"])
    })).filter((item) => item.companyName);
  }

  async getMarketProfile(input: string): Promise<TianyanMarketProfile> {
    const companyName = normalizeSearchKey(input);
    const [registrationPayload, riskPayload] = await Promise.all([
      this.call(["company", "registration-info", companyName]),
      this.call(["risk", "overview", companyName])
    ]);
    const registration = unwrap(registrationPayload);
    const risk = unwrap(riskPayload);
    const riskLevel = pick(risk, ["riskLevel", "risk_level", "level", "riskRank"]);
    const riskCount = pick(risk, ["riskCount", "risk_count", "totalCount", "total"]);
    const riskParts = [riskLevel ? `风险等级：${riskLevel}` : "已返回风险总览", riskCount ? `风险记录：${riskCount} 条` : "建议人工查看明细"];

    return {
      companyName: pick(registration, ["companyName", "name", "company_name"]) || companyName,
      registration: {
        status: pick(registration, ["regStatus", "status", "reg_status"]),
        legalRepresentative: pick(registration, ["legalPersonName", "legalRepresentative", "legal_person_name"]),
        establishedAt: pick(registration, ["establishTime", "establishedAt", "estiblishTime", "establish_time"]),
        registeredCapital: pick(registration, ["regCapital", "registeredCapital", "reg_capital"]),
        location: pick(registration, ["regLocation", "location", "reg_location", "address"]),
        businessScope: pick(registration, ["businessScope", "business_scope", "business"])
      },
      risk: { summary: riskParts.join("；") },
      source: "天眼 AI"
    };
  }
}
