from pathlib import Path

import pandas as pd
from pptx import Presentation

from universal import extract_dataframe, read_tabular


def test_csv_and_tsv_ingestion(tmp_path: Path):
    csv_file = tmp_path / "sample.csv"
    csv_file.write_text("name,score\nAsha,91\nRavi,84\n", encoding="utf-8")
    csv_df = read_tabular(csv_file)
    assert list(csv_df.columns) == ["name", "score"]
    assert len(csv_df) == 2

    tsv_file = tmp_path / "sample.tsv"
    tsv_file.write_text("name\tscore\nAsha\t91\n", encoding="utf-8")
    tsv_df = read_tabular(tsv_file)
    assert list(tsv_df.columns) == ["name", "score"]
    assert int(tsv_df.loc[0, "score"]) == 91


def test_json_and_jsonl_ingestion(tmp_path: Path):
    json_file = tmp_path / "sample.json"
    json_file.write_text(
        '{"records":[{"user":{"name":"Asha"},"score":91},{"user":{"name":"Ravi"},"score":84}]}',
        encoding="utf-8",
    )
    json_df = read_tabular(json_file)
    assert "user.name" in json_df.columns
    assert len(json_df) == 2

    jsonl_file = tmp_path / "sample.jsonl"
    jsonl_file.write_text('{"name":"Asha","score":91}\n{"name":"Ravi","score":84}\n', encoding="utf-8")
    assert len(read_tabular(jsonl_file)) == 2


def test_text_and_html_ingestion(tmp_path: Path):
    text_file = tmp_path / "notes.txt"
    text_file.write_text("First line\nSecond line\n", encoding="utf-8")
    text_df, method = extract_dataframe(text_file)
    assert method == "text-extraction"
    assert len(text_df) == 2

    html_file = tmp_path / "table.html"
    html_file.write_text(
        "<table><tr><th>name</th><th>score</th></tr><tr><td>Asha</td><td>91</td></tr></table>",
        encoding="utf-8",
    )
    html_df, _ = extract_dataframe(html_file)
    assert list(html_df.columns) == ["name", "score"]
    assert len(html_df) == 1


def test_powerpoint_text_ingestion(tmp_path: Path):
    presentation = Presentation()
    slide = presentation.slides.add_slide(presentation.slide_layouts[5])
    box = slide.shapes.add_textbox(100000, 100000, 5000000, 500000)
    box.text = "Quarterly sales"
    file_path = tmp_path / "slides.pptx"
    presentation.save(file_path)

    frame, method = extract_dataframe(file_path)
    assert method == "presentation-extraction"
    assert "Quarterly sales" in frame["Content"].tolist()
