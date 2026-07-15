import { Product } from "./types";

const catalogTimestamp = "2026-07-13T00:00:00.000Z";

/**
 * 唯一允许在前端展示和被话术检索的产品目录。
 * 事实来源：《自超滑技术与空心杯电机》2026-07-13，P14-P16。
 */
export const frictionXCatalog: Product[] = [
  {
    id: "fx-brushed-coreless-platform",
    name: "Friction X 自超滑有刷空心杯电机平台",
    model: "按项目选型",
    category: "自超滑有刷空心杯电机",
    powerRange: "直径 6 / 8 / 10 / 12 / 16 / 22 / 28 mm 平台",
    voltage: "资料未披露，按项目选型",
    speed: "资料未披露，按项目选型",
    torque: "资料未披露，按项目选型",
    protectionLevel: "资料未披露，按项目选型",
    useCases: ["人形机器人", "高端医疗设备", "消费无人机", "手持云台", "激光雷达"],
    sellingPoints: ["自超滑低摩擦技术", "有刷空心杯平台", "支持齿轮箱与 FOC 控制整体方案"],
    notes: "资料来源：自超滑技术与空心杯电机 P15。具体电气与机械参数须以项目选型及验证结果为准。",
    createdAt: catalogTimestamp,
    updatedAt: catalogTimestamp
  },
  {
    id: "fx-brushless-coreless-platform",
    name: "Friction X 自超滑无刷空心杯电机平台",
    model: "按项目选型",
    category: "自超滑无刷空心杯电机",
    powerRange: "直径 6 / 8 / 10 / 12 / 16 / 22 / 28 mm 平台",
    voltage: "资料未披露，按项目选型",
    speed: "资料未披露，按项目选型",
    torque: "资料未披露，按项目选型",
    protectionLevel: "资料未披露，按项目选型",
    useCases: ["人形机器人", "高端医疗设备", "消费无人机", "手持云台", "激光雷达"],
    sellingPoints: ["自超滑低摩擦技术", "无刷空心杯平台", "支持齿轮箱与 FOC 控制整体方案"],
    notes: "资料来源：自超滑技术与空心杯电机 P15。具体电气与机械参数须以项目选型及验证结果为准。",
    createdAt: catalogTimestamp,
    updatedAt: catalogTimestamp
  },
  {
    id: "fx-coreless-integrated-solution",
    name: "Friction X 自超滑空心杯电机整体解决方案",
    model: "电机 + 齿轮箱 + FOC 控制器",
    category: "自超滑微特电机整体解决方案",
    powerRange: "直径 6 / 8 / 10 / 12 / 16 / 22 / 28 mm 电机平台",
    voltage: "资料未披露，按项目选型",
    speed: "资料未披露，按项目选型",
    torque: "资料未披露，按项目选型",
    protectionLevel: "资料未披露，按项目选型",
    useCases: ["人形机器人", "高端医疗设备", "消费无人机", "手持云台", "激光雷达"],
    sellingPoints: ["电机、齿轮箱与 FOC 控制协同", "面向微特电机应用", "按项目提供整体方案"],
    notes: "资料来源：自超滑技术与空心杯电机 P15。该条目描述整体解决方案能力，不代表固定型号或已承诺性能。",
    createdAt: catalogTimestamp,
    updatedAt: catalogTimestamp
  }
];

export function getFrictionXCatalogProduct(id: string) {
  return frictionXCatalog.find((product) => product.id === id) ?? null;
}
