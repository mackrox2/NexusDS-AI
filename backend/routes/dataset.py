from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import FileResponse
from pathlib import Path
from bson import ObjectId
from datetime import datetime
from dotenv import load_dotenv

import os
import pandas as pd
import numpy as np
import math
import shutil
import uuid

import time
from google import genai

from database.mongodb import datasets_collection, db, fs
from auth import get_current_user
from universal import (
    supported_extension,
    file_category,
    convert_to_analysis_files,
)


# =========================================================
# ENVIRONMENT
# =========================================================

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()

gemini_client = None

if GEMINI_API_KEY:
    gemini_client = genai.Client(
        api_key=GEMINI_API_KEY
    )


# =========================================================
# ROUTER
# =========================================================

router = APIRouter(
    prefix="/api/dataset",
    tags=["Dataset"]
)

# GridFS is shared from database.mongodb so every module uses one bucket.


# =========================================================
# PATHS
# =========================================================

BASE_DIR = Path(__file__).resolve().parent.parent

UPLOAD_DIR = BASE_DIR / "uploads"
CLEANED_DIR = BASE_DIR / "cleaned"
CACHE_DIR = BASE_DIR / "cache"

UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)

CLEANED_DIR.mkdir(
    parents=True,
    exist_ok=True
)

CACHE_DIR.mkdir(
    parents=True,
    exist_ok=True
)

ALLOWED_EXTENSIONS = {
    ".csv",
    ".xlsx",
    ".xls",
    ".pdf",
    ".docx",
    ".doc",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
    ".tsv",
    ".json",
    ".jsonl",
    ".ndjson",
    ".parquet",
    ".pptx",
    ".txt",
    ".md",
    ".log",
    ".html",
    ".htm",
}


# =========================================================
# SAFE JSON
# =========================================================

def safe(value):

    if value is None:
        return None

    if isinstance(value, dict):
        return {
            str(k): safe(v)
            for k, v in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [
            safe(v)
            for v in value
        ]

    if isinstance(value, np.integer):
        return int(value)

    if isinstance(value, np.floating):
        value = float(value)

        return (
            value
            if math.isfinite(value)
            else None
        )

    if isinstance(value, float):

        return (
            value
            if math.isfinite(value)
            else None
        )

    if isinstance(value, pd.Timestamp):

        return (
            None
            if pd.isna(value)
            else value.isoformat()
        )

    if isinstance(value, np.ndarray):
        return safe(
            value.tolist()
        )

    return value


# =========================================================
# HEADER CLEANING
# =========================================================

def clean_header_name(value, index):

    if value is None:
        return f"Column_{index + 1}"

    try:
        if pd.isna(value):
            return f"Column_{index + 1}"
    except Exception:
        pass

    text = str(value).strip()

    if (
        not text
        or text.lower().startswith("unnamed")
    ):
        return f"Column_{index + 1}"

    return text


# =========================================================
# EXCEL HEADER DETECTION
# =========================================================

def detect_excel_header(file_path):

    try:
        raw = pd.read_excel(
            file_path,
            header=None,
            nrows=20
        )
    except Exception:
        return 0

    best_row = 0
    best_score = -999999

    header_words = [
        "s.no",
        "s no",
        "serial",
        "id",
        "name",
        "city",
        "date",
        "total",
        "amount",
        "status",
        "approval",
        "pending",
        "completed",
        "cancel",
        "remarks",
        "value",
        "count",
        "number"
    ]

    for i in range(len(raw)):

        values = raw.iloc[i].tolist()

        non_empty = [
            str(v).strip()
            for v in values
            if (
                v is not None
                and not pd.isna(v)
                and str(v).strip()
            )
        ]

        if not non_empty:
            continue

        unique_count = len(
            set(non_empty)
        )

        score = (
            len(non_empty)
            + unique_count * 0.5
        )

        joined = " ".join(
            non_empty
        ).lower()

        for word in header_words:

            if word in joined:
                score += 5

        if len(non_empty) <= 2:
            score -= 5

        if score > best_score:

            best_score = score
            best_row = i

    return best_row


# =========================================================
# NORMALIZE DATAFRAME
# =========================================================

def normalize_dataframe(df):

    df = df.copy()

    # Remove completely empty rows/columns.
    df = df.dropna(
        axis=0,
        how="all"
    )

    df = df.dropna(
        axis=1,
        how="all"
    )

    # Clean column names.
    new_columns = []
    used = {}

    for index, column in enumerate(
        df.columns
    ):

        name = clean_header_name(
            column,
            index
        )

        if name in used:

            used[name] += 1

            name = (
                f"{name}_{used[name]}"
            )

        else:

            used[name] = 1

        new_columns.append(name)

    df.columns = new_columns

    # Clean string values.
    for column in df.columns:

        if df[column].dtype == object:

            df[column] = df[column].map(
                lambda x:
                    x.strip()
                    if isinstance(x, str)
                    else x
            )

    # Convert common missing tokens.
    missing_tokens = {
        "",
        "na",
        "n/a",
        "null",
        "none",
        "nan",
        "-",
        "--",
        "missing",
        "not available",
        "not applicable"
    }

    for column in df.columns:

        if df[column].dtype == object:

            df[column] = df[column].map(
                lambda x:
                    np.nan
                    if (
                        isinstance(x, str)
                        and x.strip().lower()
                        in missing_tokens
                    )
                    else x
            )

    return df


# =========================================================
# READ EXCEL
# =========================================================

def read_excel_file(file_path, sheet_name=None):

    # Read a specific sheet when requested. If no sheet is
    # supplied, use the first sheet.
    excel_file = pd.ExcelFile(file_path)
    sheets = excel_file.sheet_names

    if not sheets:
        raise HTTPException(
            status_code=400,
            detail="The Excel workbook does not contain any sheets."
        )

    selected_sheet = (
        sheet_name
        if sheet_name in sheets
        else sheets[0]
    )

    header_row = detect_excel_header(
        file_path
    ) if selected_sheet == sheets[0] else detect_excel_header_for_sheet(
        file_path,
        selected_sheet
    )

    df = pd.read_excel(
        file_path,
        sheet_name=selected_sheet,
        header=header_row,
        dtype=object
    )

    return normalize_dataframe(
        df
    )


def detect_excel_header_for_sheet(file_path, sheet_name):

    try:
        raw = pd.read_excel(
            file_path,
            sheet_name=sheet_name,
            header=None,
            nrows=20
        )
    except Exception:
        return 0

    best_row = 0
    best_score = -999999

    header_words = [
        "s.no", "s no", "serial", "id", "name", "city",
        "date", "total", "amount", "status", "approval",
        "pending", "completed", "cancel", "remarks",
        "value", "count", "number", "price", "quantity",
        "category", "department", "email", "phone"
    ]

    for i in range(len(raw)):
        values = raw.iloc[i].tolist()
        non_empty = [
            str(v).strip()
            for v in values
            if v is not None
            and not pd.isna(v)
            and str(v).strip()
        ]

        if not non_empty:
            continue

        unique_count = len(set(non_empty))
        score = len(non_empty) + unique_count * 0.5
        joined = " ".join(non_empty).lower()

        for word in header_words:
            if word in joined:
                score += 5

        if len(non_empty) <= 2:
            score -= 5

        if score > best_score:
            best_score = score
            best_row = i

    return best_row


# =========================================================
# READ DATASET
# =========================================================

def read_dataset(file_path, sheet_name=None):

    extension = file_path.suffix.lower()

    if extension == ".csv":

        df = pd.read_csv(
            file_path,
            dtype=object
        )

        return normalize_dataframe(
            df
        )

    if extension in {
        ".xlsx",
        ".xls"
    }:

        return read_excel_file(
            file_path,
            sheet_name=sheet_name
        )

    raise HTTPException(
        status_code=400,
        detail=(
            "Only CSV, XLSX and XLS "
            "files are supported."
        )
    )


# =========================================================
# DATABASE HELPERS
# =========================================================

def get_document(dataset_id, current_user=None):

    try:
        object_id = ObjectId(dataset_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid dataset ID."
        )

    query = {"_id": object_id}

    # Every authenticated request is scoped to its owner.
    if current_user is not None:
        query["ownerId"] = str(current_user["_id"])

    document = datasets_collection.find_one(query)

    if not document:
        # Do not reveal whether another user's dataset exists.
        raise HTTPException(
            status_code=404,
            detail="Dataset not found."
        )

    return document


def _gridfs_cached_path(document, id_field, name, directory):
    """Return an owner-verified, uniquely cached GridFS working copy."""
    file_id = document.get(id_field)
    if not file_id:
        return None

    owner_id = str(document.get("ownerId", ""))
    if not owner_id:
        raise HTTPException(status_code=403, detail="Dataset owner is missing.")

    try:
        object_id = ObjectId(str(file_id))
    except Exception:
        raise HTTPException(status_code=404, detail="Stored file not found.")

    # Verify the GridFS metadata before opening the file. A dataset record
    # belonging to one user must never resolve another user's GridFS object.
    file_record = db["dataset_files.files"].find_one({"_id": object_id})
    metadata = (file_record or {}).get("metadata") or {}
    if not file_record:
        raise HTTPException(
            status_code=404,
            detail="Dataset file is missing from persistent storage. Please re-upload the original file."
        )
    if str(metadata.get("ownerId", "")) != owner_id:
        raise HTTPException(
            status_code=404,
            detail="Dataset file ownership metadata is missing or does not match. Please re-upload the original file."
        )

    metadata_dataset_id = metadata.get("datasetId")
    document_id = str(document.get("_id", ""))
    if metadata_dataset_id is not None and str(metadata_dataset_id) != document_id:
        raise HTTPException(
            status_code=404,
            detail="Dataset file reference does not match its storage record. Please re-upload the original file."
        )

    safe_name = Path(str(name or "dataset.bin")).name
    directory = CACHE_DIR.resolve()
    directory.mkdir(parents=True, exist_ok=True)
    # Include the immutable GridFS ID so equal filenames never collide and
    # replacing a file cannot accidentally reuse stale cached bytes.
    path = (directory / f"{object_id}_{safe_name}").resolve()
    if directory not in path.parents:
        raise HTTPException(status_code=400, detail="Invalid stored filename.")

    if not path.exists():
        try:
            with fs.open_download_stream(object_id) as stream:
                data = stream.read()
            path.write_bytes(data)
        except Exception as error:
            raise HTTPException(
                status_code=404,
                detail="Persistent dataset file could not be loaded."
            ) from error
    return path


def _save_gridfs_file(path, filename, owner_id=None, dataset_id=None, role=None):
    """Persist a local working file to GridFS and return its file ID string."""
    metadata = {
        "ownerId": str(owner_id) if owner_id is not None else None,
        "datasetId": str(dataset_id) if dataset_id is not None else None,
        "role": role or "dataset",
    }
    with open(path, "rb") as source:
        with fs.open_upload_stream(
            Path(filename).name,
            metadata=metadata
        ) as target:
            shutil.copyfileobj(source, target)
            return str(target._id)


def _delete_gridfs_file(file_id, owner_id, dataset_id=None):
    """Delete a GridFS object only when its owner (and optional dataset) match."""
    if not file_id or not owner_id:
        return False
    try:
        object_id = ObjectId(str(file_id))
        query = {"_id": object_id, "metadata.ownerId": str(owner_id)}
        if dataset_id is not None:
            # New uploads are dataset-bound. Also allow older owner-bound
            # files with no datasetId so legacy cleanup remains possible.
            query["$or"] = [
                {"metadata.datasetId": str(dataset_id)},
                {"metadata.datasetId": {"$exists": False}},
                {"metadata.datasetId": None},
            ]
        if not db["dataset_files.files"].find_one(query, {"_id": 1}):
            print("GRIDFS DELETE BLOCKED: ownership metadata did not match")
            return False
        fs.delete(object_id)
        return True
    except Exception as error:
        print("GRIDFS DELETE WARNING:", repr(error))
        return False


def get_file_path(document):
    """Get original upload from GridFS, falling back to legacy local files."""
    persistent_path = _gridfs_cached_path(
        document,
        "gridfsFileId",
        document.get("storedName") or document.get("fileName"),
        UPLOAD_DIR
    )
    if persistent_path is not None:
        return persistent_path

    stored_name = document.get("storedName")
    if stored_name:
        path = UPLOAD_DIR / Path(str(stored_name)).name
    else:
        raw_path = document.get("filePath")
        if not raw_path:
            raise HTTPException(status_code=404, detail="Dataset file path is missing.")
        path = Path(raw_path)
        if not path.is_absolute():
            path = BASE_DIR / path

    path = path.resolve()
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="Dataset file is not available in persistent storage or legacy uploads. Please re-upload the original file."
        )
    return path


def get_analysis_file_path(document):
    """Get the normalized analysis file from GridFS or legacy local storage."""
    persistent_path = _gridfs_cached_path(
        document,
        "analysisGridFsId",
        document.get("analysisStoredName") or "analysis.xlsx",
        UPLOAD_DIR
    )
    if persistent_path is not None:
        return persistent_path

    stored_name = document.get("analysisStoredName")
    if stored_name:
        path = (UPLOAD_DIR / Path(str(stored_name)).name).resolve()
        if path.exists() and UPLOAD_DIR.resolve() in path.parents:
            return path
    return get_file_path(document)


def get_generated_file_path(document, id_field, name_field, default_name, directory=UPLOAD_DIR):
    """Get a generated/converted file from GridFS, with legacy local fallback."""
    filename = document.get(name_field) or default_name
    persistent_path = _gridfs_cached_path(
        document,
        id_field,
        document.get(name_field + "StoredName") or filename,
        directory
    )
    if persistent_path is not None:
        return persistent_path

    stored_name_fields = {
        "convertedExcelGridFsId": "convertedExcelStoredName",
        "convertedCsvGridFsId": "convertedCsvStoredName",
    }
    stored_name = document.get(stored_name_fields.get(id_field, name_field + "StoredName"))
    if stored_name:
        path = (Path(directory) / Path(str(stored_name)).name).resolve()
        if Path(directory).resolve() in path.parents and path.exists():
            return path
    raise HTTPException(status_code=404, detail=f"Stored file '{filename}' was not found.")


def load_dataset(dataset_id, current_user=None):
    document = get_document(dataset_id, current_user)
    file_path = get_analysis_file_path(document)
    try:
        df = read_dataset(file_path)
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail=f"Unable to read dataset: {error}")
    if df.empty:
        raise HTTPException(status_code=400, detail="Dataset is empty.")
    return document, file_path, df


# =========================================================
# PREVIEW
# =========================================================

def preview(
    df,
    limit=10
):

    temp = (
        df.head(limit)
        .copy()
        .astype(object)
    )

    temp = temp.where(
        pd.notna(temp),
        None
    )

    return safe(
        temp.to_dict(
            orient="records"
        )
    )


# =========================================================
# COLUMN TYPE DETECTION
# =========================================================

def numeric_series(series):

    return pd.to_numeric(
        series.astype(str)
        .str.replace(
            ",",
            "",
            regex=False
        )
        .str.replace(
            "%",
            "",
            regex=False
        )
        .str.strip(),
        errors="coerce"
    )


def column_kind(series):

    if pd.api.types.is_datetime64_any_dtype(series):
        return "date"

    if pd.api.types.is_numeric_dtype(series):
        return "numeric"

    non_null = series.dropna()

    if len(non_null) == 0:
        return "categorical"

    sample = non_null.astype(str).head(100)

    numeric_values = pd.to_numeric(
        sample.str.replace(",", "", regex=False)
        .str.replace("%", "", regex=False)
        .str.strip(),
        errors="coerce"
    )

    if (
        len(sample) >= 3
        and numeric_values.notna().mean() >= 0.80
    ):
        return "numeric"

    # Avoid pandas' format inference warning by using
    # format="mixed" when supported.
    try:
        date_values = pd.to_datetime(
            sample,
            errors="coerce",
            format="mixed"
        )
    except TypeError:
        date_values = pd.to_datetime(
            sample,
            errors="coerce"
        )

    if (
        len(sample) >= 3
        and date_values.notna().mean() >= 0.80
    ):
        return "date"

    return "categorical"

# =========================================================
# OUTLIERS
# =========================================================

def outlier_info(series):

    values = (
        numeric_series(series)
        .dropna()
    )

    if len(values) < 4:

        return {
            "count": 0,
            "low": None,
            "high": None
        }

    q1 = values.quantile(
        0.25
    )

    q3 = values.quantile(
        0.75
    )

    iqr = q3 - q1

    if (
        pd.isna(iqr)
        or iqr == 0
    ):

        return {
            "count": 0,
            "low": None,
            "high": None
        }

    low = q1 - (
        1.5 * iqr
    )

    high = q3 + (
        1.5 * iqr
    )

    count = int(
        (
            (values < low)
            | (values > high)
        ).sum()
    )

    return safe({
        "count": count,
        "low": low,
        "high": high
    })


# =========================================================
# CHARTS
# =========================================================

def build_charts(df):

    charts = []

    for column in df.columns:

        name = str(column)
        kind = column_kind(df[column])

        if kind == "numeric":

            values = numeric_series(
                df[column]
            ).dropna()

            if len(values) >= 2:

                # Histogram gives an actual distribution rather than
                # plotting row number against value.
                bin_count = min(
                    10,
                    max(4, int(np.sqrt(len(values))))
                )

                counts, edges = np.histogram(
                    values.to_numpy(dtype=float),
                    bins=bin_count
                )

                labels = []
                for i in range(len(counts)):
                    labels.append(
                        f"{edges[i]:.2f}–{edges[i + 1]:.2f}"
                    )

                charts.append({
                    "type": "histogram",
                    "title": f"{name} - Distribution",
                    "column": name,
                    "labels": labels,
                    "values": [int(x) for x in counts]
                })

        elif kind == "categorical":

            counts = (
                df[column]
                .fillna("Missing")
                .astype(str)
                .value_counts()
                .head(10)
            )

            if len(counts) > 0:

                charts.append({
                    "type": "category",
                    "title": f"{name} - Top Categories",
                    "column": name,
                    "labels": [str(x) for x in counts.index],
                    "values": [int(x) for x in counts.values]
                })

        elif kind == "date":

            dates = pd.to_datetime(
                df[column],
                errors="coerce",
                format="mixed"
            )

            temp = pd.DataFrame({
                "date": dates
            }).dropna()

            if not temp.empty:

                grouped = (
                    temp["date"]
                    .dt.to_period("M")
                    .value_counts()
                    .sort_index()
                )

                charts.append({
                    "type": "line",
                    "title": f"{name} - Records Over Time",
                    "column": name,
                    "labels": [str(x) for x in grouped.index],
                    "values": [int(x) for x in grouped.values]
                })

    numeric_columns = [
        c for c in df.columns
        if column_kind(df[c]) == "numeric"
    ]

    if len(numeric_columns) >= 2:

        numeric_df = pd.DataFrame()

        for column in numeric_columns:
            numeric_df[column] = numeric_series(df[column])

        correlation = numeric_df.corr().round(3)

        charts.append({
            "type": "correlation",
            "title": "Numeric Feature Correlation",
            "columns": [str(c) for c in correlation.columns],
            "data": [
                {
                    "row": str(row),
                    "values": [
                        {
                            "column": str(col),
                            "value": safe(correlation.loc[row, col])
                        }
                        for col in correlation.columns
                    ]
                }
                for row in correlation.index
            ]
        })

    return safe(charts[:30])

# =========================================================
# SMART CLEANING RECOMMENDATIONS
# =========================================================

def build_recommendations(df):

    recommendations = []

    rows = max(
        len(df),
        1
    )

    duplicate_count = int(
        df.duplicated().sum()
    )

    if duplicate_count > 0:

        recommendations.append({
            "id": "duplicates",
            "issue": "Duplicate rows",
            "column": None,
            "method": "duplicates",
            "payload": {
                "method": "remove"
            },
            "priority": "HIGH",
            "reason": (
                f"{duplicate_count} duplicate "
                "rows were detected."
            ),
            "action": (
                "Remove duplicate rows"
            )
        })

    for column in df.columns:

        name = str(column)
        series = df[column]

        missing = int(
            series.isna().sum()
        )

        if missing == 0:
            continue

        percentage = (
            missing / rows
        ) * 100

        kind = column_kind(
            series
        )

        # Very high missingness.
        if percentage >= 60:

            recommendations.append({
                "id": (
                    f"review-{name}"
                ),
                "issue": (
                    "Very high missingness"
                ),
                "column": name,
                "method": "review",
                "payload": {},
                "priority": "REVIEW",
                "reason": (
                    f"{percentage:.1f}% of "
                    "values are missing. "
                    "Automatic filling may "
                    "create misleading data."
                ),
                "action": (
                    "Review column manually"
                )
            })

        elif kind == "numeric":

            recommendations.append({
                "id": (
                    f"missing-{name}"
                ),
                "issue": (
                    "Missing numeric values"
                ),
                "column": name,
                "method": "missing_values",
                "payload": {
                    "column": name,
                    "method": "median"
                },
                "priority": "MEDIUM",
                "reason": (
                    f"{missing} values are "
                    f"missing ({percentage:.1f}%). "
                    "Median is a robust "
                    "default for numeric data."
                ),
                "action": (
                    "Fill with median"
                )
            })

        elif kind == "categorical":

            recommendations.append({
                "id": (
                    f"missing-{name}"
                ),
                "issue": (
                    "Missing categorical values"
                ),
                "column": name,
                "method": "missing_values",
                "payload": {
                    "column": name,
                    "method": "mode"
                },
                "priority": "MEDIUM",
                "reason": (
                    f"{missing} values are "
                    f"missing ({percentage:.1f}%). "
                    "Mode is suitable for "
                    "categorical data."
                ),
                "action": (
                    "Fill with most frequent value"
                )
            })

        else:

            recommendations.append({
                "id": (
                    f"missing-{name}"
                ),
                "issue": (
                    "Missing date values"
                ),
                "column": name,
                "method": "missing_values",
                "payload": {
                    "column": name,
                    "method": "ffill"
                },
                "priority": "LOW",
                "reason": (
                    f"{missing} date values "
                    "are missing. Forward fill "
                    "is offered cautiously when "
                    "row order is meaningful."
                ),
                "action": (
                    "Forward fill"
                )
            })

    # Outliers.
    for column in df.columns:

        if (
            column_kind(
                df[column]
            )
            != "numeric"
        ):
            continue

        info = outlier_info(
            df[column]
        )

        if info["count"] > 0:

            recommendations.append({
                "id": (
                    f"outlier-{column}"
                ),
                "issue": (
                    "Potential outliers"
                ),
                "column": str(column),
                "method": "review_outliers",
                "payload": {},
                "priority": "REVIEW",
                "reason": (
                    f"{info['count']} possible "
                    "outliers detected using "
                    "the IQR rule."
                ),
                "action": (
                    "Review before removing"
                )
            })

    return recommendations[:50]


# =========================================================
# DATASET ANALYSIS
# =========================================================

def analyze_dataframe(
    df,
    document=None,
    sheet_name=None,
    available_sheets=None
):

    rows = int(len(df))
    cols = int(len(df.columns))

    missing = {
        str(column): int(df[column].isna().sum())
        for column in df.columns
    }

    percentages = {
        str(column): round(
            missing[str(column)] / max(rows, 1) * 100,
            2
        )
        for column in df.columns
    }

    data_types = {
        str(column): str(df[column].dtype)
        for column in df.columns
    }

    kinds = {
        str(column): column_kind(df[column])
        for column in df.columns
    }

    statistics = {}
    distributions = {}
    column_profiles = []
    outliers = {}
    unique_counts = {}

    for column in df.columns:

        name = str(column)
        series = df[column]
        kind = kinds[name]

        non_null = series.dropna()
        unique_count = int(non_null.nunique())
        unique_counts[name] = unique_count

        profile = {
            "column": name,
            "detectedType": kind,
            "rawType": data_types[name],
            "missing": missing[name],
            "missingPercentage": percentages[name],
            "unique": unique_count,
            "uniquePercentage": round(
                unique_count / max(len(non_null), 1) * 100,
                2
            )
        }

        if kind == "numeric":

            values = numeric_series(series).dropna()

            if len(values) > 0:

                skew = values.skew()

                statistics[name] = {
                    "count": int(len(values)),
                    "mean": safe(values.mean()),
                    "median": safe(values.median()),
                    "min": safe(values.min()),
                    "max": safe(values.max()),
                    "std": safe(values.std()),
                    "q1": safe(values.quantile(0.25)),
                    "q3": safe(values.quantile(0.75)),
                    "skewness": safe(skew)
                }

                outliers[name] = outlier_info(series)

                # Compact distribution summary for the UI.
                counts, edges = np.histogram(
                    values.to_numpy(dtype=float),
                    bins=min(10, max(4, int(np.sqrt(len(values)))))
                )

                distributions[name] = {
                    "labels": [
                        f"{edges[i]:.2f}–{edges[i + 1]:.2f}"
                        for i in range(len(counts))
                    ],
                    "values": [int(x) for x in counts]
                }

                profile["min"] = safe(values.min())
                profile["max"] = safe(values.max())
                profile["mean"] = safe(values.mean())
                profile["median"] = safe(values.median())
                profile["skewness"] = safe(skew)
                profile["outliers"] = int(
                    outliers[name]["count"]
                )

        elif kind == "categorical":

            top = (
                series
                .fillna("Missing")
                .astype(str)
                .value_counts()
                .head(10)
            )

            distributions[name] = {
                "labels": [str(x) for x in top.index],
                "values": [int(x) for x in top.values]
            }

            profile["topValue"] = (
                str(top.index[0])
                if len(top) > 0
                else None
            )
            profile["topValueCount"] = (
                int(top.iloc[0])
                if len(top) > 0
                else 0
            )

        elif kind == "date":

            dates = pd.to_datetime(
                series,
                errors="coerce",
                format="mixed"
            )

            valid_dates = dates.dropna()

            if len(valid_dates) > 0:

                profile["minDate"] = safe(valid_dates.min())
                profile["maxDate"] = safe(valid_dates.max())

                monthly = (
                    valid_dates
                    .dt.to_period("M")
                    .value_counts()
                    .sort_index()
                )

                distributions[name] = {
                    "labels": [str(x) for x in monthly.index],
                    "values": [int(x) for x in monthly.values]
                }

        column_profiles.append(profile)

    duplicate_count = int(df.duplicated().sum())
    constant_columns = [
        str(c)
        for c in df.columns
        if df[c].nunique(dropna=False) <= 1
    ]

    high_missing_columns = [
        {
            "column": str(c),
            "missing": missing[str(c)],
            "percentage": percentages[str(c)]
        }
        for c in df.columns
        if percentages[str(c)] >= 30
    ]

    high_cardinality_columns = [
        str(c)
        for c in df.columns
        if kinds[str(c)] == "categorical"
        and unique_counts[str(c)] >= max(20, int(rows * 0.5))
    ]

    outlier_total = int(
        sum(
            item.get("count", 0)
            for item in outliers.values()
        )
    )

    # A transparent health score based on measurable data-quality issues.
    total_cells = max(rows * max(cols, 1), 1)
    missing_ratio = sum(missing.values()) / total_cells
    duplicate_ratio = duplicate_count / max(rows, 1)
    constant_penalty = min(
        len(constant_columns) / max(cols, 1),
        1
    )

    score = 100
    score -= min(40, missing_ratio * 100)
    score -= min(25, duplicate_ratio * 100)
    score -= min(15, constant_penalty * 30)
    score = max(0, min(100, round(score)))

    insights = []

    if rows == 0 or cols == 0:
        insights.append({
            "type": "warning",
            "title": "Dataset is empty",
            "message": "No usable rows or columns were found."
        })
    else:
        insights.append({
            "type": "info",
            "title": "Dataset structure",
            "message": (
                f"The dataset contains {rows:,} rows and {cols} columns."
            )
        })

    if missing_ratio == 0:
        insights.append({
            "type": "positive",
            "title": "No missing cells",
            "message": "All cells contain values after normalization."
        })
    elif high_missing_columns:
        worst = max(
            high_missing_columns,
            key=lambda x: x["percentage"]
        )
        insights.append({
            "type": "warning",
            "title": "Missing-data risk",
            "message": (
                f"'{worst['column']}' has "
                f"{worst['percentage']}% missing values. "
                "Review whether the missingness has business meaning."
            )
        })

    if duplicate_count > 0:
        insights.append({
            "type": "warning",
            "title": "Duplicate records",
            "message": (
                f"{duplicate_count:,} exact duplicate rows were detected."
            )
        })
    else:
        insights.append({
            "type": "positive",
            "title": "No exact duplicates",
            "message": "No identical rows were detected."
        })

    for column, info in outliers.items():
        if info["count"] > 0:
            insights.append({
                "type": "warning",
                "title": f"Outliers in {column}",
                "message": (
                    f"{info['count']} potential outliers were detected "
                    "using the IQR rule."
                )
            })

    for column, stat in statistics.items():
        skew = stat.get("skewness")
        if skew is not None and abs(float(skew)) >= 1:
            direction = "right-skewed" if float(skew) > 0 else "left-skewed"
            insights.append({
                "type": "info",
                "title": f"Distribution shape: {column}",
                "message": (
                    f"The numeric distribution appears {direction} "
                    f"(skewness {float(skew):.2f}). "
                    "Consider robust statistics or transformation if appropriate."
                )
            })

    if constant_columns:
        insights.append({
            "type": "warning",
            "title": "Constant columns",
            "message": (
                "These columns contain one unique value and may add little "
                f"analytical value: {', '.join(constant_columns[:8])}."
            )
        })

    # Strong numeric relationships.
    correlations = []
    numeric_columns = list(statistics.keys())

    if len(numeric_columns) >= 2:
        numeric_df = pd.DataFrame({
            c: numeric_series(df[c])
            for c in numeric_columns
        })

        corr = numeric_df.corr()

        for i, left in enumerate(corr.columns):
            for j, right in enumerate(corr.columns):
                if j <= i:
                    continue

                value = corr.loc[left, right]
                if pd.notna(value) and abs(float(value)) >= 0.70:
                    correlations.append({
                        "feature1": str(left),
                        "feature2": str(right),
                        "correlation": safe(value),
                        "strength": (
                            "strong positive"
                            if value > 0
                            else "strong negative"
                        )
                    })

        correlations = sorted(
            correlations,
            key=lambda x: abs(float(x["correlation"])),
            reverse=True
        )[:10]

        if correlations:
            top = correlations[0]
            insights.append({
                "type": "relationship",
                "title": "Strong feature relationship",
                "message": (
                    f"{top['feature1']} and {top['feature2']} show a "
                    f"{top['strength']} correlation of "
                    f"{float(top['correlation']):.2f}."
                )
            })

    # Simple ML-readiness candidates; this does not train a model.
    target_candidates = []
    for profile in column_profiles:
        name = profile["column"]
        kind = profile["detectedType"]
        unique = profile["unique"]

        if kind == "categorical" and 2 <= unique <= min(20, max(rows - 1, 2)):
            target_candidates.append({
                "column": name,
                "reason": "Categorical column with a manageable number of classes.",
                "type": "classification_candidate"
            })
        elif kind == "numeric" and unique >= 5:
            target_candidates.append({
                "column": name,
                "reason": "Numeric column with sufficient distinct values for regression analysis.",
                "type": "regression_candidate"
            })

    return safe({

        "success": True,

        "dataset": {
            "id": str(document["_id"]) if document else None,
            "fileName": (
                document.get("fileName")
                if document
                else None
            ),
            "sheetName": sheet_name,
            "rows": rows,
            "columns": cols
        },

        "availableSheets": (
            available_sheets
            if available_sheets is not None
            else []
        ),

        "summary": {
            "rows": rows,
            "columns": cols,
            "totalMissingValues": int(sum(missing.values())),
            "duplicateRows": duplicate_count,
            "dataQualityScore": score,
            "outlierValues": outlier_total,
            "constantColumns": len(constant_columns),
            "highMissingColumns": len(high_missing_columns)
        },

        "columns": [str(c) for c in df.columns],
        "dataTypes": data_types,
        "columnKinds": kinds,
        "missingValues": missing,
        "missingPercentage": percentages,
        "uniqueValues": unique_counts,

        "statistics": statistics,
        "columnProfiles": column_profiles,
        "distributions": distributions,
        "outliers": outliers,
        "correlations": correlations,
        "insights": insights[:20],

        "mlReadiness": {
            "numericFeatures": [
                str(c) for c in df.columns
                if kinds[str(c)] == "numeric"
            ],
            "categoricalFeatures": [
                str(c) for c in df.columns
                if kinds[str(c)] == "categorical"
            ],
            "dateFeatures": [
                str(c) for c in df.columns
                if kinds[str(c)] == "date"
            ],
            "targetCandidates": target_candidates[:10]
        },

        "preview": preview(df),
        "charts": build_charts(df),

        "cleaningRecommendations":
            build_recommendations(df)
    })

# =========================================================
# UPLOAD
# =========================================================

@router.post("/upload")
async def upload_dataset(
    dataset: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    """
    Universal ingestion endpoint.

    Any supported input is preserved as the original file and converted into
    a normalized analysis dataset. Every successful upload gets downloadable
    XLSX + CSV outputs.
    """
    if not dataset.filename:
        raise HTTPException(400, "No file selected.")

    original_name = Path(dataset.filename).name
    extension = Path(original_name).suffix.lower()

    if not supported_extension(extension):
        raise HTTPException(
            400,
            (
                "Unsupported file type. Supported formats: "
                "CSV, TSV, XLSX, XLS, JSON, JSONL, Parquet, PDF, DOCX, DOC, "
                "PPTX, TXT, Markdown, HTML, JPG, JPEG, PNG, WEBP, BMP, TIF and TIFF."
            ),
        )

    original_stored_name = f"{uuid.uuid4().hex}{extension}"
    original_path = UPLOAD_DIR / original_stored_name

    # Converted files are also kept inside uploads so existing download
    # infrastructure can safely serve them.
    converted_dir = UPLOAD_DIR / "converted"
    converted_dir.mkdir(parents=True, exist_ok=True)

    try:
        max_upload_bytes = 100 * 1024 * 1024
        total_bytes = 0
        with open(original_path, "wb") as buffer:
            while True:
                chunk = dataset.file.read(1024 * 1024)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > max_upload_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail="File is larger than the 100 MB upload limit.",
                    )
                buffer.write(chunk)

        if total_bytes == 0:
            raise HTTPException(status_code=400, detail="The uploaded file is empty.")

        conversion = convert_to_analysis_files(
            original_path=original_path,
            output_dir=converted_dir,
        )

        analysis_path = conversion["excelPath"]
        csv_path = conversion["csvPath"]

        # Move/copy the generated XLSX into the normal uploads directory so
        # get_analysis_file_path can resolve it with the same storage rules.
        analysis_stored_name = f"{uuid.uuid4().hex}.xlsx"
        csv_stored_name = f"{uuid.uuid4().hex}.csv"

        final_analysis_path = UPLOAD_DIR / analysis_stored_name
        final_csv_path = UPLOAD_DIR / csv_stored_name

        shutil.move(str(analysis_path), str(final_analysis_path))
        shutil.move(str(csv_path), str(final_csv_path))

        # Keep conversion directory tidy.
        try:
            converted_dir.rmdir()
        except OSError:
            pass

        # Allocate the dataset ID before writing files so every GridFS
        # object is linked to this exact dataset from the moment it is stored.
        dataset_object_id = ObjectId()
        dataset_id = str(dataset_object_id)
        gridfs_ids = []

        # Save original + normalized outputs in persistent MongoDB GridFS.
        # Local files are only working copies/cache; GridFS is the source of truth.
        original_gridfs_id = _save_gridfs_file(
            original_path, original_stored_name,
            owner_id=current_user["_id"], dataset_id=dataset_id, role="original"
        )
        gridfs_ids.append(original_gridfs_id)
        analysis_gridfs_id = _save_gridfs_file(
            final_analysis_path, analysis_stored_name,
            owner_id=current_user["_id"], dataset_id=dataset_id, role="analysis"
        )
        gridfs_ids.append(analysis_gridfs_id)
        csv_gridfs_id = _save_gridfs_file(
            final_csv_path, csv_stored_name,
            owner_id=current_user["_id"], dataset_id=dataset_id, role="converted_csv"
        )
        gridfs_ids.append(csv_gridfs_id)

        df = conversion["dataframe"]
        now = datetime.utcnow()

        document = {
            "_id": dataset_object_id,
            "ownerId": str(current_user["_id"]),
            "ownerEmail": current_user.get("email", ""),
            "fileName": original_name,
            "storedName": original_stored_name,
            "gridfsFileId": original_gridfs_id,
            "filePath": str(Path("uploads") / original_stored_name),
            "fileType": dataset.content_type or "application/octet-stream",
            "uploadedAt": now,
            "rows": int(len(df)),
            "columns": int(len(df.columns)),

            # Universal ingestion metadata.
            "sourceFormat": extension.lstrip(".").lower(),
            "sourceCategory": file_category(extension),
            "extractionMethod": conversion["extractionMethod"],
            "converted": True,
            "analysisStoredName": analysis_stored_name,
            "analysisGridFsId": analysis_gridfs_id,
            "analysisFilePath": str(Path("uploads") / analysis_stored_name),
            "convertedExcelName": (
                f"{Path(original_name).stem}_NexusDS_Converted.xlsx"
            ),
            "convertedCsvName": (
                f"{Path(original_name).stem}_NexusDS_Converted.csv"
            ),
            "convertedExcelStoredName": analysis_stored_name,
            "convertedExcelGridFsId": analysis_gridfs_id,
            "convertedCsvStoredName": csv_stored_name,
            "convertedCsvGridFsId": csv_gridfs_id,
        }

        datasets_collection.insert_one(document)

        return safe({
            "success": True,
            "message": (
                "File processed successfully. "
                "A normalized Excel and CSV dataset were created automatically."
            ),
            "dataset": {
                "id": dataset_id,
                "fileName": original_name,
                "sourceFormat": extension.lstrip(".").lower(),
                "sourceCategory": file_category(extension),
                "extractionMethod": conversion["extractionMethod"],
                "rows": int(len(df)),
                "columns": int(len(df.columns)),
            },
            "conversion": {
                "created": True,
                "excel": {
                    "fileName": document["convertedExcelName"],
                    "downloadEndpoint": (
                        f"/api/dataset/datasets/{dataset_id}/converted-excel"
                    ),
                },
                "csv": {
                    "fileName": document["convertedCsvName"],
                    "downloadEndpoint": (
                        f"/api/dataset/datasets/{dataset_id}/converted-csv"
                    ),
                },
            },
        })

    except HTTPException:
        # Roll back any GridFS objects created before the failure.
        for file_id in locals().get("gridfs_ids", []):
            _delete_gridfs_file(file_id, current_user["_id"])
        for path in [
            original_path,
            locals().get("final_analysis_path"),
            locals().get("final_csv_path"),
        ]:
            if path and Path(path).exists():
                try:
                    Path(path).unlink()
                except OSError:
                    pass
        raise

    except Exception as error:
        # Best-effort rollback keeps failed uploads from leaving orphaned data.
        for file_id in locals().get("gridfs_ids", []):
            _delete_gridfs_file(file_id, current_user["_id"])
        for path in [
            original_path,
            locals().get("final_analysis_path"),
            locals().get("final_csv_path"),
        ]:
            if path and Path(path).exists():
                try:
                    Path(path).unlink()
                except OSError:
                    pass

        for candidate in converted_dir.glob("*") if converted_dir.exists() else []:
            try:
                candidate.unlink()
            except OSError:
                pass

        print("UNIVERSAL UPLOAD ERROR:", repr(error))
        raise HTTPException(
            500,
            "File processing failed. Check the backend logs for the request details.",
        ) from error


# =========================================================
# DOWNLOAD CONVERTED EXCEL
# =========================================================

@router.get(
    "/datasets/{dataset_id}/converted-excel"
)
def download_converted_excel(
    dataset_id: str,
    current_user=Depends(get_current_user)
):
    document = get_document(dataset_id, current_user)

    stored_name = document.get("convertedExcelStoredName")
    if not stored_name:
        # Legacy datasets can still be downloaded as their original file.
        stored_name = document.get("analysisStoredName")

    if not stored_name:
        raise HTTPException(
            404,
            "No converted Excel file is available for this dataset."
        )

    path = get_generated_file_path(
        document, "convertedExcelGridFsId", "convertedExcelName",
        f"{Path(document.get('fileName', 'dataset')).stem}_NexusDS_Converted.xlsx",
        UPLOAD_DIR
    )

    return FileResponse(
        path=str(path),
        filename=document.get(
            "convertedExcelName",
            f"{Path(document.get('fileName', 'dataset')).stem}_NexusDS_Converted.xlsx",
        ),
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
    )


# =========================================================
# DOWNLOAD CONVERTED CSV
# =========================================================

@router.get(
    "/datasets/{dataset_id}/converted-csv"
)
def download_converted_csv(
    dataset_id: str,
    current_user=Depends(get_current_user)
):
    document = get_document(dataset_id, current_user)

    stored_name = document.get("convertedCsvStoredName")
    if not stored_name:
        raise HTTPException(
            404,
            "No converted CSV file is available for this dataset."
        )

    path = get_generated_file_path(
        document, "convertedCsvGridFsId", "convertedCsvName",
        f"{Path(document.get('fileName', 'dataset')).stem}_NexusDS_Converted.csv",
        UPLOAD_DIR
    )

    return FileResponse(
        path=str(path),
        filename=document.get(
            "convertedCsvName",
            f"{Path(document.get('fileName', 'dataset')).stem}_NexusDS_Converted.csv",
        ),
        media_type="text/csv",
    )


# =========================================================
# DATASET LIST
# =========================================================

@router.get("/datasets")
def get_datasets(current_user=Depends(get_current_user)):

    try:

        documents = list(
            datasets_collection
            .find({"ownerId": str(current_user["_id"])})
            .sort(
                "uploadedAt",
                -1
            )
        )

        return safe({

            "success": True,

            "count":
                len(documents),

            "datasets": [

                {

                    "id":
                        str(
                            document["_id"]
                        ),

                    "fileName":
                        document.get(
                            "fileName",
                            "Unknown"
                        ),

                    "filePath":
                        document.get(
                            "filePath",
                            ""
                        ),

                    "fileType":
                        document.get(
                            "fileType",
                            ""
                        ),

                    "uploadedAt":
                        document.get(
                            "uploadedAt"
                        ),

                    "rows":
                        int(
                            document.get(
                                "rows",
                                0
                            ) or 0
                        ),

                    "columns":
                        int(
                            document.get(
                                "columns",
                                0
                            ) or 0
                        ),

                    "cleaned":
                        bool(
                            document.get(
                                "cleanedFileName"
                            )
                        )
                }

                for document
                in documents
            ]
        })

    except Exception as error:

        raise HTTPException(
            500,
            str(error)
        )


# =========================================================
# DOWNLOAD ORIGINAL DATASET
# =========================================================

@router.get(
    "/datasets/{dataset_id}/download"
)
def download_dataset(
    dataset_id: str,
    current_user=Depends(get_current_user)
):
    """
    Download the original uploaded dataset.
    """
    document = get_document(dataset_id, current_user)
    file_path = get_file_path(document)

    extension = file_path.suffix.lower()

    media_type = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if extension == ".xlsx"
        else (
            "application/vnd.ms-excel"
            if extension == ".xls"
            else "text/csv"
        )
    )

    return FileResponse(
        path=str(file_path),
        filename=document.get(
            "fileName",
            file_path.name
        ),
        media_type=media_type
    )


# =========================================================
# DELETE DATASET
# =========================================================

@router.delete(
    "/datasets/{dataset_id}"
)
def delete_dataset(
    dataset_id: str,
    current_user=Depends(get_current_user)
):
    """
    Permanently delete an authenticated user's dataset.

    Important:
    - Ownership is checked BEFORE any deletion.
    - Database deletion is attempted even if a physical file is already
      missing or cannot be removed.
    - Original, converted, cleaned and related report files are removed
      on a best-effort basis.
    - Related report DB records are removed owner-scoped.
    """
    document = get_document(dataset_id, current_user)
    owner_id = str(current_user["_id"])

    deleted_files = []
    file_delete_errors = []

    def safe_unlink(path, label, root):
        """
        Safely remove a dataset-related file, retrying temporary Windows
        file-lock errors. Deletion is restricted to the expected directory.
        """
        try:
            path = Path(path).resolve()
            root = Path(root).resolve()
            path.relative_to(root)
        except ValueError:
            message = "File path is outside the allowed directory."
            file_delete_errors.append({"file": label, "error": message})
            print(f"DATASET FILE DELETE ERROR [{label}]: {message}")
            return False
        except Exception as error:
            file_delete_errors.append({"file": label, "error": str(error)})
            print(f"DATASET FILE DELETE ERROR [{label}]:", repr(error))
            return False

        # Missing files are already effectively deleted.
        if not path.exists():
            return False

        last_error = None

        # Retry temporary file locks/access errors up to five attempts.
        for attempt in range(5):
            try:
                path.unlink()
                deleted_files.append(label)
                print(f"DATASET FILE DELETED [{label}]: {path.name}")
                return True
            except FileNotFoundError:
                return False
            except PermissionError as error:
                last_error = error
                if attempt < 4:
                    time.sleep(0.5)
            except OSError as error:
                last_error = error
                break

        error_message = str(last_error or "File could not be deleted.")
        file_delete_errors.append({
            "file": label,
            "error": error_message
        })
        print(f"DATASET FILE DELETE ERROR [{label}]:", repr(last_error))
        return False

    # -----------------------------------------------------
    # ORIGINAL UPLOADED FILE
    # -----------------------------------------------------
    try:
        original_path = get_file_path(document)
        safe_unlink(
            original_path,
            "original",
            UPLOAD_DIR
        )
    except HTTPException as error:
        # The DB record can still be deleted if the physical
        # original file is already missing.
        print(
            "DATASET ORIGINAL FILE NOT AVAILABLE:",
            repr(error)
        )
    except Exception as error:
        file_delete_errors.append({
            "file": "original",
            "error": str(error)
        })
        print(
            "DATASET ORIGINAL FILE DELETE ERROR:",
            repr(error)
        )

    # -----------------------------------------------------
    # UNIVERSAL CONVERTED EXCEL / CSV
    # -----------------------------------------------------
    #
    # Some fields may point to the same physical file
    # (analysisStoredName can equal the converted Excel file).
    # safe_unlink() handles an already-deleted file safely.
    # -----------------------------------------------------
    generated_files = [
        (
            document.get("convertedExcelStoredName"),
            "converted_excel"
        ),
        (
            document.get("convertedCsvStoredName"),
            "converted_csv"
        ),
        (
            document.get("analysisStoredName"),
            "analysis"
        ),
    ]

    for generated_name, label in generated_files:
        if not generated_name:
            continue

        generated_path = (
            UPLOAD_DIR / Path(str(generated_name)).name
        )

        safe_unlink(
            generated_path,
            label,
            UPLOAD_DIR
        )

    # -----------------------------------------------------
    # CLEANED FILE
    # -----------------------------------------------------
    cleaned_name = document.get("cleanedFileName")

    if cleaned_name:
        cleaned_path = (
            CLEANED_DIR / Path(str(cleaned_name)).name
        )

        safe_unlink(
            cleaned_path,
            "cleaned",
            CLEANED_DIR
        )

    # -----------------------------------------------------
    # RELATED REPORTS + REPORT PDF FILES
    # -----------------------------------------------------
    reports_collection = db["reports"]

    related_reports = list(
        reports_collection.find({
            "datasetId": dataset_id,
            "ownerId": owner_id
        })
    )

    deleted_report_files = 0
    report_root = (
        UPLOAD_DIR / "reports"
    ).resolve()

    for report in related_reports:
        report_id = str(
            report.get("reportId", "")
        ).strip()

        if not report_id:
            continue

        # Only use the generated report naming convention.
        report_path = (
            report_root /
            f"nexusds_report_{Path(report_id).name}.pdf"
        )

        if safe_unlink(
            report_path,
            f"report:{report_id}",
            report_root
        ):
            deleted_report_files += 1

    report_delete_result = reports_collection.delete_many({
        "datasetId": dataset_id,
        "ownerId": owner_id
    })

    deleted_reports = int(
        report_delete_result.deleted_count
    )

    # -----------------------------------------------------
    # DELETE PERSISTENT GRIDFS FILES
    # -----------------------------------------------------
    for id_field in (
        "gridfsFileId",
        "analysisGridFsId",
        "convertedExcelGridFsId",
        "convertedCsvGridFsId",
        "cleanedGridFsId",
    ):
        file_id = document.get(id_field)
        if file_id:
            _delete_gridfs_file(file_id, owner_id=owner_id)

    # -----------------------------------------------------
    # DELETE DATASET DB RECORD
    # -----------------------------------------------------
    #
    # This is deliberately done AFTER file cleanup attempts.
    # File cleanup errors are non-fatal, so the dataset record
    # cannot remain in MongoDB just because a local file had a
    # permission/path problem.
    # -----------------------------------------------------
    result = datasets_collection.delete_one({
        "_id": document["_id"],
        "ownerId": owner_id
    })

    if result.deleted_count != 1:
        raise HTTPException(
            status_code=500,
            detail="Dataset record could not be deleted."
        )

    return safe({
        "success": True,
        "message": (
            "Dataset and all related database records "
            "were deleted successfully."
        ),
        "datasetId": dataset_id,
        "deletedFiles": deleted_files,
        "deletedReports": deleted_reports,
        "deletedReportFiles": deleted_report_files,
        "fileDeleteErrors": file_delete_errors
    })


# =========================================================
# STORAGE STATUS + TEMPORARY CACHE
# =========================================================

@router.get("/storage-stats")
def get_storage_stats(current_user=Depends(get_current_user)):
    """Return user-scoped dataset storage and temporary cache metrics."""
    owner_id = str(current_user["_id"])
    dataset_count = datasets_collection.count_documents({"ownerId": owner_id})

    # GridFS file metadata includes ownerId on files saved by this router.
    gridfs_files = db["dataset_files.files"]
    owned_file_docs = list(gridfs_files.find({"metadata.ownerId": owner_id}, {"length": 1}))
    user_files_bytes = sum(int(item.get("length", 0) or 0) for item in owned_file_docs)

    cache_bytes = 0
    cache_files_count = 0
    try:
        for item in CACHE_DIR.rglob("*"):
            if item.is_file():
                cache_files_count += 1
                try:
                    cache_bytes += item.stat().st_size
                except OSError:
                    pass
    except OSError:
        pass

    try:
        server_disk_free_bytes = int(shutil.disk_usage(BASE_DIR).free)
    except OSError:
        server_disk_free_bytes = None

    return {
        "success": True,
        "datasetCount": dataset_count,
        "userFilesBytes": user_files_bytes,
        "cacheBytes": cache_bytes,
        "cacheFilesCount": cache_files_count,
        "serverDiskFreeBytes": server_disk_free_bytes,
        "storageBackend": "MongoDB Atlas GridFS",
    }


@router.post("/clear-cache")
def clear_temporary_cache(current_user=Depends(get_current_user)):
    """Clear only disposable GridFS working copies; never delete saved files."""
    deleted_files = 0
    freed_bytes = 0
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    for item in CACHE_DIR.rglob("*"):
        if not item.is_file():
            continue
        try:
            size = item.stat().st_size
            item.unlink()
            deleted_files += 1
            freed_bytes += size
        except OSError as error:
            print("CACHE CLEANUP WARNING:", str(item), repr(error))

    # Remove empty subdirectories without touching the cache root.
    for item in sorted(CACHE_DIR.rglob("*"), key=lambda value: len(value.parts), reverse=True):
        if item.is_dir():
            try:
                item.rmdir()
            except OSError:
                pass

    return {
        "success": True,
        "deletedFiles": deleted_files,
        "freedBytes": freed_bytes,
        "message": "Temporary cache cleared. Persistent GridFS datasets were not deleted.",
    }


# =========================================================
# DATASET SUMMARY / DASHBOARD STATS
# =========================================================

@router.get("/dashboard-stats")
def get_dashboard_stats(current_user=Depends(get_current_user)):
    """
    Return real dashboard statistics for the logged-in user.
    No fake accuracy/report/training values are generated.
    """
    owner_id = str(current_user["_id"])

    # -----------------------------------------------------
    # DATASETS
    # -----------------------------------------------------
    documents = list(
        datasets_collection.find(
            {"ownerId": owner_id}
        ).sort("uploadedAt", -1)
    )

    total_datasets = len(documents)

    total_rows = sum(
        int(d.get("rows", 0) or 0)
        for d in documents
    )

    cleaned_count = sum(
        1
        for d in documents
        if d.get("cleanedFileName")
    )

    # -----------------------------------------------------
    # REAL DATA QUALITY
    # -----------------------------------------------------
    quality_scores = []

    for document in documents:
        try:
            # Universal uploads (PDF/DOCX/images) keep the original file,
            # but analysis must always use the normalized XLSX/CSV.
            file_path = get_analysis_file_path(document)
            df = read_dataset(file_path)

            if df.empty:
                continue

            rows = len(df)
            cols = len(df.columns)

            missing_total = int(
                df.isna().sum().sum()
            )
            duplicate_count = int(
                df.duplicated().sum()
            )

            constant_count = sum(
                1
                for column in df.columns
                if df[column].nunique(dropna=False) <= 1
            )

            total_cells = max(
                rows * max(cols, 1),
                1
            )

            missing_ratio = missing_total / total_cells
            duplicate_ratio = duplicate_count / max(rows, 1)
            constant_ratio = min(
                constant_count / max(cols, 1),
                1
            )

            score = 100
            score -= min(40, missing_ratio * 100)
            score -= min(25, duplicate_ratio * 100)
            score -= min(15, constant_ratio * 30)

            score = max(
                0,
                min(100, round(score))
            )

            quality_scores.append(score)

        except Exception as error:
            print("DASHBOARD QUALITY ERROR:", repr(error))

    average_quality = (
        round(sum(quality_scores) / len(quality_scores))
        if quality_scores
        else None
    )

    # -----------------------------------------------------
    # REAL REPORT COUNT
    # -----------------------------------------------------
    # This collection will be populated by the Reports/Autopilot
    # backend. Until then, count is correctly 0.
    reports_collection = db["reports"]

    report_count = reports_collection.count_documents({
        "ownerId": owner_id
    })

    # -----------------------------------------------------
    # REAL ML TRAINING DATA
    # -----------------------------------------------------
    trained_datasets = [
        d for d in documents
        if isinstance(d.get("lastMLTraining"), dict)
    ]

    trained_count = len(trained_datasets)
    latest_training = None

    if trained_datasets:
        def training_sort_key(document):
            training = document.get("lastMLTraining", {})
            return (
                training.get("trainedAt")
                or training.get("completedAt")
                or training.get("createdAt")
                or document.get("uploadedAt")
                or datetime.min
            )

        latest_document = max(
            trained_datasets,
            key=training_sort_key
        )

        latest_training = dict(
            latest_document.get(
                "lastMLTraining",
                {}
            )
        )

        latest_training["datasetId"] = str(
            latest_document["_id"]
        )

        latest_training["datasetName"] = (
            latest_document.get(
                "fileName",
                "Unknown"
            )
        )

    # -----------------------------------------------------
    # ACTUAL MODEL PERFORMANCE
    # -----------------------------------------------------
    performance_value = None
    performance_metric = None

    if latest_training:
        metrics = latest_training.get("metrics", {})

        if not isinstance(metrics, dict):
            metrics = {}

        problem_type = str(
            latest_training.get(
                "problemType",
                ""
            )
        ).lower()

        if "classification" in problem_type:
            performance_value = metrics.get("accuracy")
            if performance_value is not None:
                performance_metric = "Accuracy"

        elif "regression" in problem_type:
            performance_value = metrics.get("r2Score")

            if performance_value is None:
                performance_value = metrics.get("r2")

            if performance_value is not None:
                performance_metric = "R²"

        # Compatibility fallback for existing training metadata.
        if performance_value is None:
            for key, label in [
                ("accuracy", "Accuracy"),
                ("r2Score", "R²"),
                ("r2", "R²"),
                ("f1Score", "F1 Score"),
                ("f1", "F1 Score"),
                ("precision", "Precision"),
                ("recall", "Recall"),
                ("rmse", "RMSE"),
                ("mae", "MAE")
            ]:
                if metrics.get(key) is not None:
                    performance_value = metrics.get(key)
                    performance_metric = label
                    break

    # -----------------------------------------------------
    # TRAINING STATUS
    # -----------------------------------------------------
    training_progress = 100 if latest_training else 0

    # -----------------------------------------------------
    # RECENT DATASETS
    # -----------------------------------------------------
    recent = []

    for document in documents[:8]:
        recent.append({
            "id": str(document["_id"]),
            "fileName": document.get("fileName", "Unknown"),
            "rows": int(document.get("rows", 0) or 0),
            "columns": int(document.get("columns", 0) or 0),
            "uploadedAt": document.get("uploadedAt"),
            "cleaned": bool(
                document.get("cleanedFileName")
            ),
            "trained": isinstance(
                document.get("lastMLTraining"),
                dict
            )
        })

    return safe({
        "success": True,

        # Existing dashboard fields.
        "totalDatasets": total_datasets,
        "totalRows": total_rows,
        "cleanedDatasets": cleaned_count,
        "recentDatasets": recent,

        # Platform-level agent count.
        "activeAgents": 6,

        # Real report information.
        "reports": {
            "count": int(report_count)
        },

        # Real ML information.
        "model": {
            "trained": bool(latest_training),
            "trainingProgress": training_progress,
            "performance": safe(performance_value),
            "performanceMetric": performance_metric,
            "trainingCount": trained_count,
            "latestTraining": safe(latest_training)
        },

        # Real quality calculation.
        "dataQuality": {
            "averageScore": average_quality,
            "datasetsAnalyzed": len(quality_scores)
        }
    })


# =========================================================
# DATASET SEARCH
# =========================================================

@router.get("/datasets/search")
def search_datasets(
    q: str = "",
    current_user=Depends(get_current_user)
):
    """
    Search uploaded datasets by filename.
    """
    query = q.strip()

    if not query:
        return get_datasets(current_user)

    documents = list(
        datasets_collection.find(
            {
                "ownerId": str(current_user["_id"]),
                "fileName": {
                    "$regex": query,
                    "$options": "i"
                }
            }
        ).sort(
            "uploadedAt",
            -1
        )
    )

    return safe({
        "success": True,
        "count": len(documents),
        "datasets": [
            {
                "id": str(document["_id"]),
                "fileName": document.get(
                    "fileName",
                    "Unknown"
                ),
                "filePath": document.get(
                    "filePath",
                    ""
                ),
                "fileType": document.get(
                    "fileType",
                    ""
                ),
                "uploadedAt": document.get(
                    "uploadedAt"
                ),
                "rows": int(
                    document.get("rows", 0) or 0
                ),
                "columns": int(
                    document.get("columns", 0) or 0
                ),
                "cleaned": bool(
                    document.get("cleanedFileName")
                )
            }
            for document in documents
        ]
    })


# =========================================================
# ANALYZE
# =========================================================

@router.get(
    "/datasets/{dataset_id}/analyze"
)
def analyze_dataset(
    dataset_id: str,
    sheet: str = "",
    current_user=Depends(get_current_user)
):

    document = get_document(dataset_id, current_user)
    file_path = get_analysis_file_path(document)

    try:
        extension = file_path.suffix.lower()

        available_sheets = []
        selected_sheet = None

        if extension in {".xlsx", ".xls"}:
            available_sheets = pd.ExcelFile(
                file_path
            ).sheet_names

            if available_sheets:
                selected_sheet = (
                    sheet
                    if sheet in available_sheets
                    else available_sheets[0]
                )

        df = read_dataset(
            file_path,
            sheet_name=selected_sheet
        )

    except Exception as error:

        raise HTTPException(
            status_code=400,
            detail=f"Unable to analyze dataset: {error}"
        )

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="Dataset is empty."
        )

    return analyze_dataframe(
        df,
        document,
        sheet_name=selected_sheet,
        available_sheets=available_sheets
    )


# =========================================================
# CLEANING ENGINE
# =========================================================

def apply_operation(
    df,
    operation,
    payload
):

    df = df.copy()

    # -----------------------------------------------------
    # MISSING VALUES
    # -----------------------------------------------------

    if operation == "missing_values":

        column = payload.get("column")
        method = payload.get("method", "mode")
        auto_fill_other = bool(
            payload.get("autoFillOtherMissing", False)
        )

        if column not in df.columns:
            raise HTTPException(
                400,
                f"Column '{column}' does not exist."
            )

        # The selected column always keeps the method chosen by the user.
        before_selected = int(df[column].isna().sum())
        kind = column_kind(df[column])

        if method in {"mean", "median", "zero"} and kind != "numeric":
            raise HTTPException(
                400,
                f"{method.title()} can only be used on numeric columns."
            )

        if method == "mean":
            values = numeric_series(df[column])
            fill_value = values.mean()
            if pd.isna(fill_value):
                raise HTTPException(400, f"No usable numeric value exists in '{column}'.")
            df[column] = values.fillna(fill_value)

        elif method == "median":
            values = numeric_series(df[column])
            fill_value = values.median()
            if pd.isna(fill_value):
                raise HTTPException(400, f"No usable numeric value exists in '{column}'.")
            df[column] = values.fillna(fill_value)

        elif method == "zero":
            values = numeric_series(df[column])
            df[column] = values.fillna(0)

        elif method == "mode":
            modes = df[column].mode(dropna=True)
            if modes.empty:
                raise HTTPException(400, f"No usable mode exists for '{column}'.")
            df[column] = df[column].fillna(modes.iloc[0])

        elif method == "ffill":
            df[column] = df[column].ffill()

        elif method == "bfill":
            df[column] = df[column].bfill()

        elif method == "drop":
            df = df.dropna(subset=[column])

        else:
            raise HTTPException(400, "Invalid missing-value method.")

        actions = []
        after_selected = int(df[column].isna().sum()) if column in df.columns else 0
        selected_filled = max(0, before_selected - after_selected)
        actions.append(
            f"'{column}': {selected_filled} of {before_selected} missing values filled with {method}"
        )

        # When enabled, every OTHER column with missing values is handled
        # independently. Numeric -> median; text/category/boolean -> mode.
        # The selected column is never overwritten by this automatic pass.
        if auto_fill_other:
            for other_column in df.columns:
                if other_column == column:
                    continue

                missing = int(df[other_column].isna().sum())
                if missing == 0:
                    continue

                other_kind = column_kind(df[other_column])

                if other_kind == "numeric":
                    values = numeric_series(df[other_column])
                    fill_value = values.median()
                    if not pd.isna(fill_value):
                        df[other_column] = values.fillna(fill_value)
                        actions.append(
                            f"'{other_column}': {missing} missing values filled with median"
                        )

                elif other_kind in {"categorical", "text", "boolean"}:
                    modes = df[other_column].mode(dropna=True)
                    if not modes.empty:
                        df[other_column] = df[other_column].fillna(modes.iloc[0])
                        actions.append(
                            f"'{other_column}': {missing} missing values filled with mode"
                        )

                elif other_kind == "date":
                    # Date columns are automatically forward-filled when
                    # another column is being cleaned. This is important
                    # when, for example, the user selects Fill with 0 for
                    # a numeric column: other missing dates must not be
                    # silently left blank.
                    try:
                        dates = pd.to_datetime(
                            df[other_column],
                            errors="coerce",
                            format="mixed"
                        )
                    except TypeError:
                        dates = pd.to_datetime(
                            df[other_column],
                            errors="coerce"
                        )

                    before_date_missing = int(dates.isna().sum())
                    filled_dates = dates.ffill()
                    after_date_missing = int(filled_dates.isna().sum())

                    if after_date_missing < before_date_missing:
                        df[other_column] = filled_dates
                        filled_count = before_date_missing - after_date_missing
                        actions.append(
                            f"'{other_column}': {filled_count} missing values filled with forward fill"
                        )
                    else:
                        actions.append(
                            f"'{other_column}': forward fill could not fill the missing value because no previous date value exists"
                        )

        remaining = int(df.isna().sum().sum())

        if auto_fill_other:
            return (
                df,
                "Missing-value cleaning completed. "
                + "; ".join(actions)
                + f". Total remaining missing values: {remaining}."
            )

        return (
            df,
            actions[0] + f". Remaining missing values: {after_selected}."
        )

    # -----------------------------------------------------
    # DUPLICATES
    # -----------------------------------------------------

    if operation == "duplicates":

        method = payload.get(
            "method",
            "remove"
        )

        before = len(df)

        if method == "keep_last":

            df = df.drop_duplicates(
                keep="last"
            )

        else:

            df = df.drop_duplicates(
                keep="first"
            )

        removed = (
            before - len(df)
        )

        return (
            df,
            (
                f"{removed} duplicate "
                "rows removed."
            )
        )

    # -----------------------------------------------------
    # DROP COLUMN
    # -----------------------------------------------------

    if operation == "drop_column":

        column = payload.get(
            "column"
        )

        if column not in df.columns:

            raise HTTPException(
                400,
                (
                    f"Column '{column}' "
                    "does not exist."
                )
            )

        df = df.drop(
            columns=[column]
        )

        return (
            df,
            f"Column '{column}' removed."
        )

    # -----------------------------------------------------
    # DATA TYPE
    # -----------------------------------------------------

    if operation == "data_type":

        column = payload.get(
            "column"
        )

        target = payload.get(
            "dataType"
        )

        if column not in df.columns:

            raise HTTPException(
                400,
                (
                    f"Column '{column}' "
                    "does not exist."
                )
            )

        if target == "string":

            df[column] = (
                df[column]
                .astype("string")
            )

        elif target == "integer":

            numeric = pd.to_numeric(
                df[column],
                errors="coerce"
            )

            df[column] = (
                numeric
                .round()
                .astype("Int64")
            )

        elif target == "float":

            df[column] = (
                pd.to_numeric(
                    df[column],
                    errors="coerce"
                )
            )

        elif target == "date":

            df[column] = (
                pd.to_datetime(
                    df[column],
                    errors="coerce"
                )
            )

        else:

            raise HTTPException(
                400,
                "Invalid target data type."
            )

        return (
            df,
            (
                f"'{column}' converted "
                f"to {target}."
            )
        )

    # -----------------------------------------------------
    # AUTO CLEAN
    # -----------------------------------------------------

    if operation == "auto_clean":

        actions = []

        # 1. Exact duplicates.
        before_rows = len(df)

        df = df.drop_duplicates()

        removed = (
            before_rows - len(df)
        )

        if removed > 0:

            actions.append(
                (
                    f"removed {removed} "
                    "duplicate rows"
                )
            )

        # 2. Safe missing-value filling.
        for column in df.columns:

            missing = int(
                df[column].isna().sum()
            )

            if missing == 0:
                continue

            percentage = (
                missing
                / max(len(df), 1)
                * 100
            )

            # Do not blindly fill
            # mostly-empty columns.
            if percentage >= 60:
                continue

            kind = column_kind(
                df[column]
            )

            if kind == "numeric":

                values = numeric_series(
                    df[column]
                )

                median = values.median()

                if not pd.isna(median):

                    df[column] = (
                        values.fillna(
                            median
                        )
                    )

                    actions.append(
                        (
                            f"filled {missing} "
                            f"missing values in "
                            f"'{column}' with "
                            "median"
                        )
                    )

            elif kind == "categorical":

                modes = (
                    df[column]
                    .mode(
                        dropna=True
                    )
                )

                if not modes.empty:

                    df[column] = (
                        df[column]
                        .fillna(
                            modes.iloc[0]
                        )
                    )

                    actions.append(
                        (
                            f"filled {missing} "
                            f"missing values in "
                            f"'{column}' with "
                            "mode"
                        )
                    )

            elif kind == "date":

                # Date columns with missing values are filled
                # using forward fill so the existing row order
                # is preserved. This also matches the manual
                # "ffill" cleaning operation used by the UI.
                try:
                    dates = pd.to_datetime(
                        df[column],
                        errors="coerce",
                        format="mixed"
                    )
                except TypeError:
                    dates = pd.to_datetime(
                        df[column],
                        errors="coerce"
                    )

                before_date_missing = int(
                    dates.isna().sum()
                )

                if before_date_missing > 0:
                    filled_dates = dates.ffill()

                    # Only update the column when forward fill
                    # actually filled at least one missing value.
                    if int(filled_dates.isna().sum()) < before_date_missing:
                        df[column] = filled_dates

                        filled_count = (
                            before_date_missing
                            - int(filled_dates.isna().sum())
                        )

                        actions.append(
                            (
                                f"filled {filled_count} "
                                f"missing values in "
                                f"'{column}' with "
                                "forward fill"
                            )
                        )

        if not actions:

            return (
                df,
                (
                    "No safe automatic "
                    "changes were required."
                )
            )

        return (
            df,
            (
                "Auto-clean completed: "
                + "; ".join(actions)
                + "."
            )
        )

    raise HTTPException(
        400,
        "Invalid cleaning operation."
    )


# =========================================================
# EXCEL FORMATTING
# =========================================================

def format_excel_file(
    path,
    df
):

    from openpyxl import (
        load_workbook
    )

    from openpyxl.styles import (
        Font,
        PatternFill,
        Alignment
    )

    workbook = load_workbook(
        path
    )

    sheet = workbook.active

    sheet.freeze_panes = "A2"

    sheet.auto_filter.ref = (
        sheet.dimensions
    )

    header_fill = PatternFill(
        fill_type="solid",
        fgColor="0F172A"
    )

    for cell in sheet[1]:

        cell.font = Font(
            bold=True,
            color="FFFFFF"
        )

        cell.fill = header_fill

        cell.alignment = Alignment(
            horizontal="center",
            vertical="center"
        )

    for column_cells in sheet.columns:

        letter = (
            column_cells[0]
            .column_letter
        )

        max_length = 0

        for cell in column_cells[:100]:

            value = (
                ""
                if cell.value is None
                else str(cell.value)
            )

            max_length = max(
                max_length,
                len(value)
            )

        sheet.column_dimensions[
            letter
        ].width = min(
            max(
                max_length + 2,
                12
            ),
            35
        )

    workbook.save(path)


# =========================================================
# SAVE CLEANED FILE
# =========================================================

def save_cleaned(
    document,
    original_path,
    df
):

    extension = (
        original_path
        .suffix
        .lower()
    )

    base_name = Path(
        document.get(
            "fileName",
            "dataset"
        )
    ).stem

    if extension in {
        ".xlsx",
        ".xls"
    }:

        filename = (
            f"cleaned_{base_name}_"
            f"{uuid.uuid4().hex[:8]}.xlsx"
        )

        path = (
            CLEANED_DIR
            / filename
        )

        df.to_excel(
            path,
            index=False,
            engine="openpyxl"
        )

        format_excel_file(
            path,
            df
        )

        return (
            path,
            "xlsx"
        )

    filename = (
        f"cleaned_{base_name}_"
        f"{uuid.uuid4().hex[:8]}.csv"
    )

    path = (
        CLEANED_DIR
        / filename
    )

    df.to_csv(
        path,
        index=False
    )

    return (
        path,
        "csv"
    )


# =========================================================
# CLEAN ENDPOINT
# =========================================================

@router.post(
    "/clean/{dataset_id}"
)
def clean_dataset(
    dataset_id: str,
    payload: dict,
    current_user=Depends(get_current_user)
):

    document, original_path, df = (
        load_dataset(
            dataset_id,
            current_user
        )
    )

    operation = payload.get(
        "operation"
    )

    # -----------------------------------------------------
    # PREVIEW ONLY
    # -----------------------------------------------------

    if operation == "preview":

        target = payload.get(
            "previewOperation",
            "auto_clean"
        )

        if target == "review_outliers":

            return safe({

                "success": True,

                "previewOnly": True,

                "message":
                    (
                        "Outliers require "
                        "review and were not "
                        "removed."
                    ),

                "before":
                    preview(df),

                "after":
                    preview(df),

                "beforeRows":
                    len(df),

                "afterRows":
                    len(df),

                "beforeMissing":
                    int(
                        df.isna()
                        .sum()
                        .sum()
                    ),

                "afterMissing":
                    int(
                        df.isna()
                        .sum()
                        .sum()
                    ),

                "beforeDuplicates":
                    int(
                        df.duplicated()
                        .sum()
                    ),

                "afterDuplicates":
                    int(
                        df.duplicated()
                        .sum()
                    )
            })

        simulated, message = (
            apply_operation(
                df,
                target,
                payload
            )
        )

        return safe({

            "success": True,

            "previewOnly": True,

            "message":
                message,

            "before":
                preview(df),

            "after":
                preview(simulated),

            "beforeRows":
                len(df),

            "afterRows":
                len(simulated),

            "beforeMissing":
                int(
                    df.isna()
                    .sum()
                    .sum()
                ),

            "afterMissing":
                int(
                    simulated.isna()
                    .sum()
                    .sum()
                ),

            "beforeDuplicates":
                int(
                    df.duplicated()
                    .sum()
                ),

            "afterDuplicates":
                int(
                    simulated
                    .duplicated()
                    .sum()
                )
        })

    # -----------------------------------------------------
    # REAL CLEANING
    # -----------------------------------------------------

    new_df, message = (
        apply_operation(
            df,
            operation,
            payload
        )
    )

    cleaned_path, output_type = (
        save_cleaned(
            document,
            original_path,
            new_df
        )
    )
    cleaned_gridfs_id = _save_gridfs_file(
        cleaned_path,
        cleaned_path.name,
        owner_id=current_user["_id"],
        dataset_id=document["_id"],
        role="cleaned"
    )

    # Remove the previous persistent cleaned version only after the new one
    # has been stored successfully.
    previous_cleaned_id = document.get("cleanedGridFsId")
    if previous_cleaned_id:
        _delete_gridfs_file(previous_cleaned_id, owner_id=str(current_user["_id"]), dataset_id=document["_id"])

    datasets_collection.update_one(

        {
            "_id": document["_id"],
            "ownerId": str(current_user["_id"])
        },

        {
            "$set": {

                "cleanedFileName":
                    cleaned_path.name,

                "cleanedGridFsId":
                    cleaned_gridfs_id,

                "cleanedFilePath":
                    str(
                        Path("cleaned")
                        / cleaned_path.name
                    ),

                "cleanedAt":
                    datetime.utcnow(),

                "cleanedRows":
                    int(
                        len(new_df)
                    ),

                "cleanedColumns":
                    int(
                        len(new_df.columns)
                    )
            }
        }
    )

    return safe({

        "success": True,

        "message":
            message,

        "operation":
            operation,

        "rows":
            int(
                len(new_df)
            ),

        "columns":
            int(
                len(new_df.columns)
            ),

        "preview":
            preview(new_df),

        "cleanedFile":
            cleaned_path.name,

        "outputType":
            output_type
    })


# =========================================================
# DOWNLOAD CLEANED DATASET
# =========================================================

@router.get(
    "/clean/{dataset_id}/download"
)
def download_cleaned_dataset(
    dataset_id: str,
    current_user=Depends(get_current_user)
):

    document = get_document(
        dataset_id,
        current_user
    )

    filename = document.get(
        "cleanedFileName"
    )

    if not filename:

        raise HTTPException(
            404,
            (
                "No cleaned dataset exists. "
                "Apply a cleaning operation first."
            )
        )

    path = _gridfs_cached_path(
        document,
        "cleanedGridFsId",
        filename,
        CLEANED_DIR
    )
    if path is None:
        path = (CLEANED_DIR / Path(filename).name).resolve()
        if CLEANED_DIR.resolve() not in path.parents or not path.exists():
            raise HTTPException(404, "Cleaned dataset file not found.")

    media_type = (

        "application/vnd.openxmlformats-"
        "officedocument.spreadsheetml.sheet"

        if path.suffix.lower()
        == ".xlsx"

        else "text/csv"
    )

    return FileResponse(

        path=str(path),

        filename=path.name,

        media_type=media_type
    )


# =========================================================
# AI DATASET FACTS
# =========================================================

def dataset_facts(df):

    facts = {

        "rows":
            int(len(df)),

        "columns":
            int(len(df.columns)),

        "column_names":
            [
                str(c)
                for c in df.columns
            ],

        "missing_values":
            {
                str(c):
                    int(
                        df[c]
                        .isna()
                        .sum()
                    )
                for c in df.columns
            },

        "total_missing":
            int(
                df.isna()
                .sum()
                .sum()
            ),

        "duplicate_rows":
            int(
                df.duplicated()
                .sum()
            ),

        "column_types":
            {
                str(c):
                    column_kind(
                        df[c]
                    )
                for c in df.columns
            },

        "numeric_statistics":
            {}
    }

    for column in df.columns:

        if (
            column_kind(
                df[column]
            )
            != "numeric"
        ):
            continue

        values = (
            numeric_series(
                df[column]
            )
            .dropna()
        )

        if values.empty:
            continue

        facts[
            "numeric_statistics"
        ][
            str(column)
        ] = {

            "count":
                int(
                    len(values)
                ),

            "sum":
                safe(
                    values.sum()
                ),

            "mean":
                safe(
                    values.mean()
                ),

            "median":
                safe(
                    values.median()
                ),

            "min":
                safe(
                    values.min()
                ),

            "max":
                safe(
                    values.max()
                ),

            "std":
                safe(
                    values.std()
                )
        }

    return safe(
        facts
    )


# =========================================================
# GEMINI PROMPT
# =========================================================

def build_ai_prompt(question, df):

    facts = dataset_facts(df)

    # Keep only the most useful recommendations.
    recommendations = build_recommendations(df)
    compact_recommendations = [
        {
            "column": r.get("column"),
            "issue": r.get("issue"),
            "method": r.get("method"),
            "priority": r.get("priority"),
            "reason": r.get("reason")
        }
        for r in recommendations[:20]
    ]

    prompt = f"""
You are NexusDS AI, a fast professional Data Science assistant.

Use ONLY the dataset facts supplied below. Never invent values.

Rules:
- Do not claim a cleaning operation was completed unless the backend did it.
- Explain actual missing values, duplicates, data types and outliers when relevant.
- Numeric missing values: median/mean may be suitable.
- Categorical missing values: mode may be suitable.
- Very high missingness should be reviewed instead of blindly filled.
- Outliers should normally be reviewed before deletion.
- Answer in the same language as the user's question.
- Be concise, practical and dataset-specific.
- Do not expose API keys, secrets or internal implementation details.

DATASET FACTS:
{facts}

CLEANING RECOMMENDATIONS:
{compact_recommendations}

USER QUESTION:
{question}

Give a direct answer in short bullets or a short paragraph.
"""

    return prompt


def _gemini_generate(contents, config=None):
    """Fast Gemini call: try the primary once, then one configured fallback."""
    if gemini_client is None:
        raise RuntimeError("Gemini client could not be initialized.")

    configured = GEMINI_MODEL or "gemini-3.8-flash-lite"
    fallback = os.getenv("GEMINI_FALLBACK_MODEL", "").strip()

    models = []
    for name in (configured, fallback):
        if name and name not in models:
            models.append(name)

    last_error = None
    for index, model_name in enumerate(models):
        try:
            return gemini_client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config or {},
            )
        except Exception as error:
            last_error = error
            message = str(error).lower()
            transient = any(
                token in message
                for token in (
                    "429", "500", "502", "503", "504",
                    "unavailable", "high demand", "overloaded",
                    "resource exhausted", "temporarily",
                )
            )

            # Do not wait through repeated retries: switch to the fallback
            # immediately for transient provider errors.
            if not transient or index == len(models) - 1:
                raise RuntimeError(
                    f"Gemini request failed on model {model_name}: {error}"
                ) from error

    raise RuntimeError(f"Gemini is temporarily unavailable: {last_error}")

# =========================================================
# GEMINI AI
# =========================================================

def ask_gemini(question, df):

    if not GEMINI_API_KEY:
        raise HTTPException(
            status_code=500,
            detail=(
                "GEMINI_API_KEY is missing. "
                "Add it to the backend .env file."
            )
        )

    if gemini_client is None:
        raise HTTPException(
            status_code=500,
            detail="Gemini client could not be initialized."
        )

    prompt = build_ai_prompt(question, df)

    try:
        response = _gemini_generate(
            contents=prompt,
            config={
                "max_output_tokens": 1000,
                "temperature": 0.2
            }
        )

        answer = (response.text or "").strip()

        if not answer:
            raise Exception(
                "Gemini returned an empty response."
            )

        return answer

    except Exception as error:
        print("GEMINI ERROR:", repr(error))

        raise HTTPException(
            status_code=502,
            detail=f"Gemini AI request failed: {error}"
        )


# =========================================================
# AI CHAT
# =========================================================

@router.post("/chat")
def chat_with_dataset(
    payload: dict,
    current_user=Depends(get_current_user)
):

    dataset_id = payload.get("datasetId")

    question = str(
        payload.get("question", "")
    ).strip()

    if not dataset_id:
        raise HTTPException(
            status_code=400,
            detail="Dataset ID is required."
        )

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Please enter a question."
        )

    document, _, df = load_dataset(dataset_id, current_user)

    answer = ask_gemini(question, df)

    return safe({
        "success": True,
        "dataset": {
            "id": str(document["_id"]),
            "fileName": document.get("fileName"),
            "rows": int(len(df)),
            "columns": int(len(df.columns))
        },
        "question": question,
        "answer": answer,
        "ai": {
            "provider": "Google Gemini",
            "model": GEMINI_MODEL
        }
    })

# =========================================================
# AI DATA SCIENTIST
# =========================================================

def build_ai_scientist_report(df, document, sheet_name=None):
    """
    Build a deterministic, dataset-grounded AI Data Scientist report.
    Gemini is used only for the narrative layer; measurable facts always
    come from the local analysis engine.
    """
    analysis = analyze_dataframe(
        df,
        document=document,
        sheet_name=sheet_name,
        available_sheets=[]
    )

    summary = analysis.get("summary", {})
    quality_score = int(summary.get("dataQualityScore", 100) or 100)
    rows = int(summary.get("rows", len(df)) or len(df))
    columns = int(summary.get("columns", len(df.columns)) or len(df.columns))

    risks = []
    actions = []

    high_missing = int(summary.get("highMissingColumns", 0) or 0)
    duplicate_rows = int(summary.get("duplicateRows", 0) or 0)
    outlier_values = int(summary.get("outlierValues", 0) or 0)
    constant_columns = int(summary.get("constantColumns", 0) or 0)

    if high_missing:
        risks.append(f"{high_missing} column(s) have high missingness and need manual review.")
        actions.append("Review high-missingness columns before automatic imputation.")
    if duplicate_rows:
        risks.append(f"{duplicate_rows:,} duplicate row(s) were detected.")
        actions.append("Review and remove duplicate rows if they are not intentional.")
    if outlier_values:
        risks.append(f"{outlier_values:,} potential outlier value(s) were detected using the IQR rule.")
        actions.append("Inspect outliers before deciding whether to cap, transform or remove them.")
    if constant_columns:
        risks.append(f"{constant_columns} constant column(s) may add little analytical value.")
        actions.append("Review constant columns and exclude them from modeling when appropriate.")

    for item in (analysis.get("insights") or [])[:6]:
        message = str(item.get("message", "")).strip()
        if item.get("type") == "warning" and message and message not in risks:
            risks.append(message)

    recommendations = analysis.get("cleaningRecommendations") or []
    for item in recommendations[:8]:
        action = str(item.get("action", "")).strip()
        if action and action not in actions:
            actions.append(action)

    target_candidates = (analysis.get("mlReadiness") or {}).get("targetCandidates") or []
    numeric_features = len((analysis.get("mlReadiness") or {}).get("numericFeatures") or [])
    categorical_features = len((analysis.get("mlReadiness") or {}).get("categoricalFeatures") or [])
    date_features = len((analysis.get("mlReadiness") or {}).get("dateFeatures") or [])

    if target_candidates:
        best = target_candidates[0]
        ml_recommendation = (
            f"Start by validating '{best.get('column')}' as a "
            f"{best.get('type', 'candidate').replace('_', ' ')}. "
            "Then use AutoML to compare suitable algorithms."
        )
    elif numeric_features + categorical_features > 0:
        ml_recommendation = "No single target is confidently identified. Choose a business outcome manually before training."
    else:
        ml_recommendation = "The dataset does not currently expose a clear modeling target."

    if quality_score < 60:
        next_step = "Fix the highest-impact data-quality issues before modeling."
    elif high_missing or duplicate_rows or outlier_values:
        next_step = "Review the flagged data-quality issues, then move to Data Cleaning."
    elif target_candidates:
        next_step = f"Validate '{target_candidates[0].get('column')}' as the target, then run AutoML."
    else:
        next_step = "Explore the dataset further and define the business target before modeling."

    executive_summary = (
        f"The dataset contains {rows:,} rows and {columns} columns with a "
        f"data health score of {quality_score}%. It has {numeric_features} numeric, "
        f"{categorical_features} categorical and {date_features} date feature(s)."
    )

    facts = {
        "dataset": {
            "fileName": document.get("fileName") if document else None,
            "sheet": sheet_name,
            "rows": rows,
            "columns": columns,
        },
        "summary": summary,
        "targetCandidates": target_candidates[:10],
        "topInsights": (analysis.get("insights") or [])[:10],
        "correlations": (analysis.get("correlations") or [])[:10],
        "recommendations": recommendations[:10],
    }

    narrative = ""
    if GEMINI_API_KEY and gemini_client is not None:
        prompt = f"""
You are the AI Data Scientist inside NexusDS AI.

Use ONLY the verified dataset facts below. Never invent numbers, trends, causes,
correlations, business outcomes or completed actions.

Write a concise professional assessment with these headings:
1. What the data says
2. What needs attention
3. What to do next
4. ML opportunity

Be practical and dataset-specific. If evidence is insufficient, say so.
Do not claim that cleaning or modeling has already happened.

VERIFIED FACTS:
{facts}

DETERMINISTIC NEXT STEP:
{next_step}
"""
        try:
            response = _gemini_generate(
                contents=prompt,
                config={
                    "max_output_tokens": 500,
                    "temperature": 0.2
                }
            )
            narrative = (response.text or "").strip()
        except Exception as error:
            print("AI DATA SCIENTIST GEMINI ERROR:", repr(error))
            # The deterministic report remains usable even if the narrative call fails.

    return safe({
        "datasetId": str(document["_id"]) if document else None,
        "fileName": document.get("fileName") if document else None,
        "sheet": sheet_name,
        "rows": rows,
        "columns": columns,
        "healthScore": quality_score,
        "executiveSummary": executive_summary,
        "narrative": narrative,
        "risks": risks[:10],
        "actions": actions[:12],
        "targetCandidates": target_candidates[:10],
        "mlRecommendation": ml_recommendation,
        "nextStep": next_step,
        "featureSummary": {
            "numeric": numeric_features,
            "categorical": categorical_features,
            "date": date_features,
        },
        "insights": (analysis.get("insights") or [])[:10],
        "correlations": (analysis.get("correlations") or [])[:10],
        "source": "NexusDS AI analysis engine",
        "aiNarrativeProvider": "Google Gemini" if narrative else "NexusDS deterministic analysis",
        "aiNarrativeModel": GEMINI_MODEL if narrative else None,
    })


@router.post("/ai-scientist")
def ai_data_scientist(
    payload: dict,
    current_user=Depends(get_current_user)
):
    """Generate a dataset-grounded AI Data Scientist report."""
    dataset_id = payload.get("datasetId")
    sheet = str(payload.get("sheet", "")).strip()

    if not dataset_id:
        raise HTTPException(
            status_code=400,
            detail="Dataset ID is required."
        )

    document = get_document(dataset_id, current_user)
    file_path = get_analysis_file_path(document)

    try:
        extension = file_path.suffix.lower()
        available_sheets = []
        selected_sheet = None

        if extension in {".xlsx", ".xls"}:
            available_sheets = pd.ExcelFile(file_path).sheet_names
            if available_sheets:
                selected_sheet = sheet if sheet in available_sheets else available_sheets[0]

        df = read_dataset(file_path, sheet_name=selected_sheet)
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Unable to read dataset for AI Scientist: {error}"
        )

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="Dataset is empty."
        )

    report = build_ai_scientist_report(
        df,
        document,
        sheet_name=selected_sheet
    )

    return safe({
        "success": True,
        "report": report
    })

