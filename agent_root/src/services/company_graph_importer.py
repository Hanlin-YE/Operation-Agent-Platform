from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

from src.services.neo4j_client import Neo4jClient


SCENARIO_PRODUCT = {
    "人形机器人与灵巧手": "product:fx-integrated-solution",
    "医疗机器人与精密医疗设备": "product:fx-brushed-coreless",
    "实验室自动化与精密工业设备": "product:fx-integrated-solution",
    "汽车电子执行器": "product:fx-integrated-solution",
    "无人机与航空航天微驱动": "product:fx-brushed-coreless",
}


def _clean(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().split())


def _stable_hash(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:16]


def _company_id(profile: dict[str, Any]) -> str:
    credit_code = _clean(profile.get("creditCode"))
    if credit_code:
        return f"company:{credit_code}"
    return f"company:{_stable_hash(_clean(profile.get('companyName')))}"


def _scenario_id(name: str) -> str:
    mapping = {
        "人形机器人与灵巧手": "scenario:robotics",
        "医疗机器人与精密医疗设备": "scenario:medical",
        "实验室自动化与精密工业设备": "scenario:industrial-automation",
        "汽车电子执行器": "scenario:automotive-electronics",
        "无人机与航空航天微驱动": "scenario:drone-aerospace",
    }
    return mapping.get(name, f"scenario:{_stable_hash(name)}")


def build_company_graph_import_preview(profiles: list[dict[str, Any]]) -> dict[str, Any]:
    nodes: dict[str, dict[str, Any]] = {
        "product:fx-brushed-coreless": {
            "id": "product:fx-brushed-coreless",
            "type": "GraphEntity",
            "label": "自超滑有刷空心杯电机平台",
            "action": "create_or_update",
            "properties": {"name": "自超滑有刷空心杯电机平台", "type": "Product", "source": "已审核产品目录"},
        },
        "product:fx-integrated-solution": {
            "id": "product:fx-integrated-solution",
            "type": "GraphEntity",
            "label": "电机 + 齿轮箱 + FOC 控制器整体方案",
            "action": "create_or_update",
            "properties": {"name": "电机 + 齿轮箱 + FOC 控制器整体方案", "type": "Product", "source": "已审核产品目录"},
        },
    }
    relationships: set[tuple[str, str, str]] = set()
    conflicts: list[dict[str, Any]] = []
    seen_companies: dict[str, str] = {}

    for profile in profiles:
        company_name = _clean(profile.get("companyName")) or "未命名企业"
        company_id = _company_id(profile)
        previous_name = seen_companies.get(company_id)
        if previous_name and previous_name != company_name:
            conflicts.append({"id": company_id, "field": "companyName", "existing": previous_name, "incoming": company_name, "resolution": "manual_review"})
        seen_companies[company_id] = previous_name or company_name
        nodes[company_id] = {
            "id": company_id,
            "type": "GraphEntity",
            "label": company_name,
            "action": "create_or_update",
            "properties": {
                "id": company_id,
                "name": company_name,
                "type": "Company",
                "credit_code": _clean(profile.get("creditCode")),
                "registration_status": _clean(profile.get("registrationStatus")),
                "location": _clean(profile.get("location")),
                "risk_summary": _clean(profile.get("riskSummary")),
                "verification_status": _clean(profile.get("verificationStatus")) or "待人工核验",
            },
        }

        for scenario in profile.get("applicationScenarios") or []:
            scenario_name = _clean(scenario)
            if not scenario_name:
                continue
            scenario_id = _scenario_id(scenario_name)
            nodes[scenario_id] = {
                "id": scenario_id,
                "type": "GraphEntity",
                "label": scenario_name,
                "action": "create_or_update",
                "properties": {"id": scenario_id, "name": scenario_name, "type": "Scenario", "need": "企业画像命中的应用场景"},
            }
            relationships.add((company_id, scenario_id, "HAS_SCENARIO"))
            product_id = SCENARIO_PRODUCT.get(scenario_name)
            if product_id:
                relationships.add((scenario_id, product_id, "MATCHES"))

        for signal in (profile.get("painSignals") or []) + (profile.get("procurementSignals") or []):
            signal_name = _clean(signal)
            if not signal_name:
                continue
            signal_id = f"signal:company:{_stable_hash(signal_name)}"
            nodes[signal_id] = {
                "id": signal_id,
                "type": "GraphEntity",
                "label": signal_name,
                "action": "create_or_update",
                "properties": {"id": signal_id, "name": signal_name, "type": "SignalType"},
            }
            relationships.add((company_id, signal_id, "HAS_SIGNAL"))

        for index, evidence in enumerate(profile.get("evidenceLinks") or []):
            if not isinstance(evidence, dict):
                continue
            title = _clean(evidence.get("title")) or f"{company_name}证据 {index + 1}"
            url = _clean(evidence.get("url"))
            evidence_id = f"evidence:company:{_stable_hash(url or company_id + title)}"
            nodes[evidence_id] = {
                "id": evidence_id,
                "type": "GraphEntity",
                "label": title[:72],
                "action": "create_or_update",
                "properties": {
                    "id": evidence_id,
                    "name": title[:72],
                    "type": "Evidence",
                    "source": _clean(evidence.get("source")) or "手动导入",
                    "url": url,
                    "excerpt": _clean(evidence.get("excerpt")),
                    "verification_status": _clean(evidence.get("verificationStatus")) or "待人工核验",
                },
            }
            relationships.add((company_id, evidence_id, "HAS_EVIDENCE"))

    relationship_payload = [
        {"source": source, "target": target, "type": relationship_type, "action": "create_or_update"}
        for source, target, relationship_type in sorted(relationships)
    ]
    return {
        "nodes": list(nodes.values()),
        "relationships": relationship_payload,
        "conflicts": conflicts,
        "summary": {
            "company_count": len(seen_companies),
            "new_node_count": len(nodes),
            "new_relationship_count": len(relationship_payload),
            "conflict_count": len(conflicts),
        },
    }


async def import_company_profiles_to_neo4j(client: Neo4jClient, profiles: list[dict[str, Any]], source: str = "company-profile-import") -> dict[str, Any]:
    preview = build_company_graph_import_preview(profiles)
    imported_at = datetime.now(timezone.utc).isoformat()
    await client.run_cypher(
        "CREATE CONSTRAINT graph_entity_id IF NOT EXISTS FOR (entity:GraphEntity) REQUIRE entity.id IS UNIQUE",
        {},
    )
    entities = [dict(node["properties"]) for node in preview["nodes"]]
    await client.run_cypher(
        """
        UNWIND $entities AS entity
        MERGE (node:GraphEntity {id: entity.id})
        SET node += entity
        """,
        {"entities": entities},
    )
    await client.run_cypher(
        """
        UNWIND $relationships AS relationship
        MATCH (source:GraphEntity {id: relationship.source}), (target:GraphEntity {id: relationship.target})
        MERGE (source)-[relation:RELATED {type: relationship.type}]->(target)
        SET relation.imported_at = $imported_at,
            relation.source = $source
        """,
        {"relationships": preview["relationships"], "imported_at": imported_at, "source": source},
    )
    return preview
