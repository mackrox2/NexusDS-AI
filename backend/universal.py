"""
NexusDS AI - Universal File Ingestion Engine

Converts heterogeneous user files into analysis-ready tabular data.
Supported:
- CSV / XLSX / XLS
- PDF (including scanned PDFs through Gemini vision)
- DOCX / DOC (DOCX tables/text; legacy DOC requires optional textract)
- JPG / JPEG / PNG / WEBP / BMP / TIFF (Gemini vision)

The engine deliberately keeps the original uploaded file untouched.
It produces normalized XLSX + CSV outputs for every successful upload.
"""

from __future__ import annotations

import io
import json
import math
import os
import re
import time
from pathlib import Path
from typing import Any

import pandas as pd
import numpy as np
from dotenv import load_dotenv

load_dotenv()

try:
    from google import genai
except Exception:
    genai = None

try:
    from docx import Document
except Exception:
    Document = None

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()

_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
_PDF_EXTENSIONS = {".pdf"}
_WORD_EXTENSIONS = {".docx"}
_PRESENTATION_EXTENSIONS = {".pptx"}
_TEXT_EXTENSIONS = {".txt", ".md", ".log", ".html", ".htm"}
_TABULAR_EXTENSIONS = {".csv", ".tsv", ".xlsx", ".xls", ".json", ".jsonl", ".ndjson", ".parquet"}

MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".pdf": "application/pdf",
}

_client = None
if genai is not None and GEMINI_API_KEY:
    try:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception:
        _client = None


def supported_extension(extension: str) -> bool:
    return extension.lower() in (
        _TABULAR_EXTENSIONS
        | _PDF_EXTENSIONS
        | _WORD_EXTENSIONS
        | _IMAGE_EXTENSIONS
        | _PRESENTATION_EXTENSIONS
        | _TEXT_EXTENSIONS
    )


def file_category(extension: str) -> str:
    ext = extension.lower()
    if ext in _TABULAR_EXTENSIONS:
        return "tabular"
    if ext in _PDF_EXTENSIONS:
        return "pdf"
    if ext in _WORD_EXTENSIONS:
        return "word"
    if ext in _IMAGE_EXTENSIONS:
        return "image"
    if ext in _PRESENTATION_EXTENSIONS:
        return "presentation"
    if ext in _TEXT_EXTENSIONS:
        return "text"
    return "unknown"


def _clean_cell(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        value = float(value)
        return value if math.isfinite(value) else None
    if isinstance(value, pd.Timestamp):
        return None if pd.isna(value) else value.isoformat()
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, str):
        return value.strip()
    return value


def normalize_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    if df is None:
        return pd.DataFrame()

    result = df.copy()

    # Remove completely blank rows/columns.
    result = result.dropna(axis=0, how="all")
    result = result.dropna(axis=1, how="all")

    # Normalize headers and guarantee uniqueness.
    headers = []
    used = {}
    for index, raw in enumerate(result.columns):
        text = "" if raw is None else str(raw).strip()
        if not text or text.lower().startswith("unnamed"):
            text = f"Column_{index + 1}"

        base = text
        count = used.get(base, 0)
        if count:
            text = f"{base}_{count + 1}"
        used[base] = count + 1
        headers.append(text)

    result.columns = headers

    # Remove accidental fully blank strings.
    result = result.replace(r"^\s*$", np.nan, regex=True)

    # Convert obvious numeric/date values while preserving meaningful text.
    for column in result.columns:
        series = result[column]
        non_null = series.dropna()
        if non_null.empty:
            continue

        as_text = non_null.astype(str).str.strip()
        numeric = pd.to_numeric(
            as_text.str.replace(",", "", regex=False)
            .str.replace("%", "", regex=False),
            errors="coerce",
        )

        numeric_ratio = float(numeric.notna().mean())
        if numeric_ratio >= 0.90:
            result[column] = pd.to_numeric(
                result[column].astype(str)
                .str.replace(",", "", regex=False)
                .str.replace("%", "", regex=False),
                errors="coerce",
            )
            continue

        parsed_dates = pd.to_datetime(
            series,
            errors="coerce",
            format="mixed",
        )
        date_ratio = float(parsed_dates.notna().mean())
        if date_ratio >= 0.90:
            result[column] = parsed_dates

    return result.reset_index(drop=True)


def read_tabular(file_path: Path) -> pd.DataFrame:
    """Read common structured formats with encoding and schema fallbacks."""
    ext = file_path.suffix.lower()

    if ext in {".csv", ".tsv"}:
        separator = "\\t" if ext == ".tsv" else None
        last_error = None
        for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin1"):
            try:
                options = {"encoding": encoding, "low_memory": False}
                if separator:
                    options["sep"] = separator
                else:
                    options.update({"sep": None, "engine": "python"})
                return normalize_dataframe(pd.read_csv(file_path, **options))
            except Exception as error:
                last_error = error
        raise ValueError(f"Unable to parse delimited file: {last_error}")

    if ext in {".xlsx", ".xls"}:
        return normalize_dataframe(pd.read_excel(file_path, sheet_name=0))

    if ext in {".json", ".jsonl", ".ndjson"}:
        if ext in {".jsonl", ".ndjson"}:
            frame = pd.read_json(file_path, lines=True)
        else:
            with open(file_path, "r", encoding="utf-8-sig") as source:
                payload = json.load(source)
            if isinstance(payload, list):
                frame = pd.json_normalize(payload, sep=".")
            elif isinstance(payload, dict):
                records = next(
                    (value for value in payload.values()
                     if isinstance(value, list) and value
                     and all(isinstance(item, dict) for item in value)),
                    None,
                )
                frame = pd.json_normalize(records, sep=".") if records is not None else pd.json_normalize(payload, sep=".")
            else:
                raise ValueError("JSON must contain an object or an array of records.")
        return normalize_dataframe(frame)

    if ext == ".parquet":
        return normalize_dataframe(pd.read_parquet(file_path))

    raise ValueError(f"Unsupported tabular extension: {ext}")


def _extract_docx_tables(file_path: Path) -> list[pd.DataFrame]:
    if Document is None:
        raise RuntimeError(
            "python-docx is required for DOCX processing. "
            "Install it with: pip install python-docx"
        )

    document = Document(str(file_path))
    tables = []

    for table in document.tables:
        rows = []
        for row in table.rows:
            rows.append([cell.text.strip() for cell in row.cells])

        if not rows:
            continue

        width = max(len(row) for row in rows)
        rows = [row + [""] * (width - len(row)) for row in rows]

        if len(rows) >= 2:
            header = rows[0]
            data = rows[1:]
            frame = pd.DataFrame(data, columns=header)
        else:
            frame = pd.DataFrame(rows)

        frame = normalize_dataframe(frame)
        if not frame.empty:
            tables.append(frame)

    return tables


def _extract_docx_text(file_path: Path) -> str:
    if Document is None:
        return ""

    document = Document(str(file_path))
    lines = []

    for paragraph in document.paragraphs:
        text = paragraph.text.strip()
        if text:
            lines.append(text)

    return "\n".join(lines)


def _is_transient_gemini_error(error: Exception) -> bool:
    message = str(error).lower()
    return any(
        token in message
        for token in (
            "429",
            "500",
            "502",
            "503",
            "504",
            "unavailable",
            "high demand",
            "overloaded",
            "resource exhausted",
            "temporarily",
        )
    )


def _gemini_generate(contents, config=None):
    """
    Central Gemini caller for this ingestion engine.

    Existing extraction behavior is preserved. Transient provider failures
    are retried and, when configured, a fallback model is attempted.
    """
    if _client is None:
        raise RuntimeError(
            "Gemini is required for image/scanned-PDF extraction. "
            "Set GEMINI_API_KEY in backend/.env."
        )

    configured_model = GEMINI_MODEL or "gemini-3.8-flash"
    fallback_model = os.getenv("GEMINI_FALLBACK_MODEL", "").strip()

    models = []
    for model_name in (configured_model, fallback_model, "gemini-3.5-flash-lite"):
        if model_name and model_name not in models:
            models.append(model_name)

    last_error = None

    for model_name in models:
        for attempt in range(3):
            try:
                return _client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=config or {},
                )
            except Exception as error:
                last_error = error

                model_error = any(token in str(error).lower() for token in ("404", "not found", "unknown model", "unsupported model", "invalid model"))
                if not _is_transient_gemini_error(error) and not model_error:
                    raise

                if attempt < 2:
                    time.sleep(1.5 * (attempt + 1))

    raise RuntimeError(
        "Gemini is temporarily unavailable after retries and fallback. "
        f"Last error: {last_error}"
    )


def _gemini_json_from_file(file_path: Path, instruction: str) -> list[dict]:
    if _client is None:
        raise RuntimeError(
            "Gemini is required for image/scanned-PDF extraction. "
            "Set GEMINI_API_KEY in backend/.env."
        )

    data = file_path.read_bytes()
    ext = file_path.suffix.lower()
    mime_type = MIME_TYPES.get(ext)

    if not mime_type:
        raise RuntimeError(f"Gemini file MIME type is not configured for {ext}.")

    prompt = f"""
You are the structured-data extraction engine inside NexusDS AI.

TASK:
{instruction}

Return ONLY valid JSON.
The JSON must be an array of objects.
Each object is one logical table row.
Use the most meaningful column names available from the source.
If a value is missing, use null.
Do not invent values.
Preserve numbers, dates, IDs, names and labels as faithfully as possible.
If the source contains multiple tables with compatible columns, combine them.
Ignore decorative text unless it is clearly part of a data field.
If there is no tabular data, create a sensible key/value table from clearly
structured information. If extraction is genuinely impossible, return [].
"""

    try:
        from google.genai import types

        contents = [
            types.Part.from_bytes(
                data=data,
                mime_type=mime_type,
            ),
            prompt,
        ]

        response = _gemini_generate(
            contents=contents,
            config={
                "response_mime_type": "application/json",
                "max_output_tokens": 12000,
                "temperature": 0.0,
            },
        )
    except Exception as error:
        raise RuntimeError(f"Gemini extraction failed: {error}") from error

    raw = (response.text or "").strip()
    if not raw:
        return []

    # Be tolerant if the model surrounds JSON with markdown despite the
    # response MIME request.
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.I)
    raw = re.sub(r"\s*```$", "", raw)

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as error:
        raise RuntimeError("Gemini returned invalid structured JSON.") from error

    if isinstance(parsed, dict):
        # Allow {"rows": [...]} as a fallback.
        parsed = parsed.get("rows", [])

    if not isinstance(parsed, list):
        return []

    return [
        {str(k): _clean_cell(v) for k, v in row.items()}
        for row in parsed
        if isinstance(row, dict)
    ]


def _extract_pdf(file_path: Path) -> pd.DataFrame:
    """Prefer native PDF text; use Gemini for structured/scanned extraction."""
    extracted_text = ""
    try:
        from pypdf import PdfReader
        reader = PdfReader(str(file_path))
        extracted_text = "\n".join((page.extract_text() or "") for page in reader.pages)
    except Exception:
        extracted_text = ""

    if _client is not None:
        try:
            rows = _gemini_json_from_file(
                file_path,
                "Extract meaningful tables from this PDF. Preserve headers and row relationships. Never invent values.",
            )
            if rows:
                return normalize_dataframe(pd.DataFrame(rows))
        except Exception as error:
            print("PDF GEMINI EXTRACTION WARNING:", repr(error))

    if extracted_text.strip():
        lines = [line.strip() for line in extracted_text.splitlines() if line.strip()]
        try:
            frame = pd.read_csv(io.StringIO("\n".join(lines)), sep=None, engine="python")
            if frame.shape[1] > 1:
                return normalize_dataframe(frame)
        except Exception:
            pass
        return normalize_dataframe(pd.DataFrame({"Extracted_Text": lines}))

    if _client is None:
        raise RuntimeError("This PDF appears scanned or image-only. Set GEMINI_API_KEY to enable OCR extraction.")
    rows = _gemini_json_from_file(
        file_path,
        "Extract readable tables and structured information from this scanned PDF. Do not guess unclear values.",
    )
    return normalize_dataframe(pd.DataFrame(rows))


def _extract_image(file_path: Path) -> pd.DataFrame:
    rows = _gemini_json_from_file(
        file_path,
        """
Read the image as an OCR + table understanding task.
Detect printed or handwritten tabular information when legible.
Preserve the visual row/column relationships.
Do not guess unclear characters; use null for genuinely unreadable cells.
""",
    )
    return normalize_dataframe(pd.DataFrame(rows))


def _extract_word(file_path: Path) -> pd.DataFrame:
    ext = file_path.suffix.lower()

    if ext == ".docx":
        tables = _extract_docx_tables(file_path)
        if tables:
            # Combine compatible tables, otherwise keep them in a single
            # rectangular representation with a table marker.
            same_schema = len({tuple(map(str, frame.columns)) for frame in tables}) == 1
            if same_schema:
                return normalize_dataframe(pd.concat(tables, ignore_index=True))

            chunks = []
            for index, frame in enumerate(tables, start=1):
                frame = frame.copy()
                frame.insert(0, "Source_Table", index)
                chunks.append(frame)

            max_columns = max(len(frame.columns) for frame in chunks)
            padded = []
            for frame in chunks:
                frame = frame.reindex(columns=list(frame.columns) + [
                    f"Column_{i}" for i in range(max_columns - len(frame.columns))
                ])
                padded.append(frame)

            return normalize_dataframe(pd.concat(padded, ignore_index=True, sort=False))

        # No tables: turn meaningful paragraphs into a two-column dataset.
        text = _extract_docx_text(file_path)
        if text.strip():
            return normalize_dataframe(
                pd.DataFrame(
                    [{"Content": line.strip()} for line in text.splitlines() if line.strip()]
                )
            )

    # Legacy .doc is not reliably readable by python-docx.
    # If textract is installed, use it; otherwise return a precise error.
    try:
        import textract

        raw = textract.process(str(file_path))
        text = raw.decode("utf-8", errors="ignore")
        return normalize_dataframe(
            pd.DataFrame(
                [{"Content": line.strip()} for line in text.splitlines() if line.strip()]
            )
        )
    except Exception as error:
        raise RuntimeError(
            "Legacy .doc files need an extractor such as textract. "
            "DOCX is supported natively."
        ) from error


def _extract_text_file(file_path: Path) -> pd.DataFrame:
    ext = file_path.suffix.lower()
    if ext in {".html", ".htm"}:
        try:
            tables = pd.read_html(file_path)
            if tables:
                return normalize_dataframe(pd.concat(tables, ignore_index=True, sort=False))
        except ValueError:
            pass
        except Exception as error:
            raise ValueError(f"Unable to parse HTML: {error}") from error
        try:
            from bs4 import BeautifulSoup
            html = file_path.read_text(encoding="utf-8", errors="replace")
            text = BeautifulSoup(html, "html.parser").get_text("\n", strip=True)
        except Exception as error:
            raise ValueError(f"Unable to extract HTML text: {error}") from error
    else:
        text = file_path.read_text(encoding="utf-8-sig", errors="replace")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        raise ValueError("The text document is empty.")
    try:
        frame = pd.read_csv(io.StringIO("\n".join(lines)), sep=None, engine="python")
        if frame.shape[1] > 1:
            return normalize_dataframe(frame)
    except Exception:
        pass
    return normalize_dataframe(pd.DataFrame({"Content": lines}))


def _extract_presentation(file_path: Path) -> pd.DataFrame:
    try:
        from pptx import Presentation
    except ImportError as error:
        raise RuntimeError("PPTX support requires python-pptx. Install backend requirements.") from error
    presentation = Presentation(str(file_path))
    records = []
    for slide_number, slide in enumerate(presentation.slides, start=1):
        for shape in slide.shapes:
            if getattr(shape, "has_table", False):
                table = shape.table
                if len(table.rows) > 1:
                    headers = [cell.text.strip() or f"Column_{i + 1}" for i, cell in enumerate(table.rows[0].cells)]
                    for row in table.rows[1:]:
                        records.append({"Slide": slide_number, **{
                            headers[i]: row.cells[i].text.strip()
                            for i in range(min(len(headers), len(row.cells)))
                        }})
                else:
                    records.append({"Slide": slide_number, "Content": " | ".join(cell.text.strip() for cell in table.rows[0].cells)})
            elif getattr(shape, "has_text_frame", False):
                value = shape.text.strip()
                if value:
                    records.append({"Slide": slide_number, "Content": value})
    if not records:
        raise ValueError("No readable text or tables were found in this PowerPoint.")
    return normalize_dataframe(pd.DataFrame(records))


def extract_dataframe(file_path: Path) -> tuple[pd.DataFrame, str]:
    ext = file_path.suffix.lower()
    category = file_category(ext)

    if category == "tabular":
        return read_tabular(file_path), "native"

    if category == "text":
        return _extract_text_file(file_path), "text-extraction"

    if category == "presentation":
        return _extract_presentation(file_path), "presentation-extraction"

    if category == "image":
        return _extract_image(file_path), "ocr"

    if category == "pdf":
        return _extract_pdf(file_path), "pdf-extraction"

    if category == "word":
        return _extract_word(file_path), "document-extraction"

    raise ValueError(f"Unsupported file type: {ext}")


def write_outputs(
    df: pd.DataFrame,
    output_dir: Path,
    base_name: str,
) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)

    safe_base = re.sub(r"[^A-Za-z0-9._-]+", "_", base_name).strip("._")
    if not safe_base:
        safe_base = "NexusDS_Converted_Dataset"

    xlsx_path = output_dir / f"{safe_base}.xlsx"
    csv_path = output_dir / f"{safe_base}.csv"

    export_df = df.copy()

    # Excel handles timezone-naive timestamps more reliably.
    for column in export_df.columns:
        if pd.api.types.is_datetime64_any_dtype(export_df[column]):
            export_df[column] = export_df[column].dt.tz_localize(None)

    export_df.to_excel(xlsx_path, index=False, engine="openpyxl")
    export_df.to_csv(csv_path, index=False, encoding="utf-8-sig")

    return xlsx_path, csv_path


def convert_to_analysis_files(
    original_path: Path,
    output_dir: Path,
) -> dict:
    df, extraction_method = extract_dataframe(original_path)

    if df.empty or len(df.columns) == 0:
        raise ValueError(
            "No structured data could be extracted from this file. "
            "Please upload a clearer document/image or a file containing a table."
        )

    base = f"{original_path.stem}_NexusDS"
    xlsx_path, csv_path = write_outputs(df, output_dir, base)

    return {
        "dataframe": df,
        "extractionMethod": extraction_method,
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "excelPath": xlsx_path,
        "csvPath": csv_path,
    }
