import unittest
from pathlib import Path

from openpyxl import Workbook


class XiaohongshuGraphImporterTests(unittest.TestCase):
    def test_build_payload_uses_hyperlinks_and_maps_scenario_to_product(self) -> None:
        from src.services.xiaohongshu_graph_importer import build_xiaohongshu_graph_payload

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "公开线索表"
        sheet.append(
            [
                "线索ID",
                "账号昵称",
                "账号类型",
                "应用场景",
                "信号类型",
                "意向等级",
                "跟进状态",
                "笔记标题",
                "公开证据摘要",
                "判断理由",
                "推荐跟进动作",
                "笔记链接",
                "主页链接",
                "笔记/采集时间",
            ]
        )
        sheet.append(
            [
                "lead-1",
                "Kobe",
                "待核验",
                "机器人/灵巧手",
                "竞品评论",
                "高",
                "待联系",
                "竞品评论",
                "可以送个样吗",
                "明确需求",
                "优先人工核验",
                "查看笔记",
                "查看主页",
                "2026-07-16T01:46:04+00:00",
            ]
        )
        sheet["L2"].hyperlink = "https://www.xiaohongshu.com/explore/note"
        sheet["M2"].hyperlink = "https://www.xiaohongshu.com/user/profile/user"
        path = Path(self._testMethodName).with_suffix(".xlsx")
        workbook.save(path)
        self.addCleanup(lambda: path.unlink(missing_ok=True))

        payload = build_xiaohongshu_graph_payload(path)
        evidence = next(entity for entity in payload.entities if entity["id"] == "evidence:xhs:lead-1")
        self.assertEqual(evidence["note_url"], "https://www.xiaohongshu.com/explore/note")
        self.assertIn(
            {"source": "scenario:robotics", "target": "product:fx-integrated-solution", "type": "MATCHES"},
            payload.relationships,
        )
        self.assertTrue(
            any(
                relationship["target"] == "evidence:xhs:lead-1"
                and relationship["type"] == "PROVIDES_SIGNAL"
                and relationship["source"].startswith("contact:xhs:")
                for relationship in payload.relationships
            )
        )


if __name__ == "__main__":
    unittest.main()
