把你从 `XHS_ALL_IN_ONE` 或其他授权工具导出的原始小红书数据文件放到这个目录。

推荐文件名：

- `xhs-export.json`
- `xhs-export.jsonl`

然后在项目根目录执行：

```bash
python3 ~/.codex/skills/xiaohongshu-lead-finder/scripts/xhs_collect_and_score.py run-export \
  --input ./raw/xhs-export.json \
  --normalized-output ./xiaohongshu-results.jsonl \
  --db ./xiaohongshu_leads.sqlite3 \
  --report ./potential_customers.csv
```

说明：

- 输出的 `potential_customers.csv` 默认不脱敏，用户名原样保留。
- 如果你的原始文件是 `jsonl`，只需要把 `--input` 改成对应文件名。
