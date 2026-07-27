from __future__ import annotations

from typing import Any

from src.services.company_graph_importer import import_company_profiles_to_neo4j
from src.services.neo4j_client import Neo4jClient


class KnowledgeGraphService:
    """Owns the small, read-optimized graph projection exposed to the workbench."""

    def __init__(self, client: Neo4jClient) -> None:
        self._client = client

    async def initialize(self) -> None:
        await self._client.connect()
        await self._client.run_cypher(
            "CREATE CONSTRAINT graph_entity_id IF NOT EXISTS FOR (entity:GraphEntity) REQUIRE entity.id IS UNIQUE",
            {},
        )
        await self._seed_demo_graph()

    async def close(self) -> None:
        await self._client.close()

    async def snapshot(self) -> dict[str, object]:
        rows = await self._client.run_cypher(
            """
            MATCH (source:GraphEntity)-[relationship]->(target:GraphEntity)
            RETURN source, coalesce(relationship.type, type(relationship)) AS relationship_type, target
            ORDER BY source.name, target.name
            LIMIT $limit
            """,
            {"limit": 500},
        )
        nodes: dict[str, dict[str, object]] = {}
        edges: list[dict[str, str]] = []
        for row in rows:
            source = row["source"]
            target = row["target"]
            source_id = str(source["id"])
            target_id = str(target["id"])
            relationship_type = str(row["relationship_type"])
            nodes[source_id] = self._node(source)
            nodes[target_id] = self._node(target)
            edges.append(
                {
                    "id": f"{source_id}:{relationship_type}:{target_id}",
                    "source": source_id,
                    "target": target_id,
                    "type": relationship_type,
                }
            )
        return {
            "nodes": list(nodes.values()),
            "edges": edges,
            "meta": {"node_count": len(nodes), "edge_count": len(edges)},
        }

    async def import_company_profiles(self, profiles: list[dict[str, Any]], source: str) -> dict[str, Any]:
        return await import_company_profiles_to_neo4j(self._client, profiles, source=source)

    @staticmethod
    def _node(node: Any) -> dict[str, object]:
        properties = dict(node)
        return {
            "id": str(properties.pop("id")),
            "label": str(properties.pop("name")),
            "type": str(properties.pop("type")),
            "properties": properties,
        }

    async def _seed_demo_graph(self) -> None:
        entities = [
            {"id": "account:huadong", "name": "华东智造", "type": "Account", "industry": "人形机器人", "tier": "KA", "routing_policy": "HUMAN_REQUIRED"},
            {"id": "account:xinghai", "name": "星海装备", "type": "Account", "industry": "医疗器械", "tier": "LA", "routing_policy": "HUMAN_APPROVAL"},
            {"id": "contact:li", "name": "李工", "type": "Contact", "role": "设备平台主管"},
            {"id": "product:fx-brushed-coreless", "name": "自超滑有刷空心杯电机平台", "type": "Product", "source": "已审核产品目录", "selection_note": "按项目选型确认"},
            {"id": "product:fx-integrated-solution", "name": "电机 + 齿轮箱 + FOC 控制器整体方案", "type": "Product", "source": "已审核产品目录", "selection_note": "按项目选型确认"},
            {"id": "scenario:robotics", "name": "人形机器人关节/灵巧手", "type": "Scenario", "need": "微型驱动与项目选型确认"},
            {"id": "scenario:medical", "name": "医疗器械微型驱动", "type": "Scenario", "need": "寿命、噪声与工况问诊"},
        ]
        relationships = [
            {"source": "account:huadong", "target": "contact:li", "type": "HAS_CONTACT"},
            {"source": "account:huadong", "target": "scenario:robotics", "type": "HAS_SCENARIO"},
            {"source": "scenario:robotics", "target": "product:fx-integrated-solution", "type": "MATCHES"},
            {"source": "account:xinghai", "target": "scenario:medical", "type": "HAS_SCENARIO"},
            {"source": "scenario:medical", "target": "product:fx-brushed-coreless", "type": "MATCHES"},
        ]
        await self._client.run_cypher(
            """
            UNWIND $entities AS entity
            MERGE (node:GraphEntity {id: entity.id})
            SET node += entity
            """,
            {"entities": entities},
        )
        for relationship in relationships:
            await self._client.run_cypher(
                """
                MATCH (source:GraphEntity {id: $source}), (target:GraphEntity {id: $target})
                MERGE (source)-[relation:RELATED {type: $type}]->(target)
                """,
                relationship,
            )
