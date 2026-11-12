from fastapi import APIRouter, HTTPException, Depends
from pathlib import Path
from bson import ObjectId
import pandas as pd
import numpy as np


from database.mongodb import datasets_collection
from auth import get_current_user


router = APIRouter(
    prefix="/api/ai",
    tags=["AI Agents"]
)


# =====================================================
# PATH
# =====================================================

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"


# =====================================================
# READ DATASET
# =====================================================

def read_dataset(file_path: Path):

    extension = file_path.suffix.lower()

    try:

        if extension == ".csv":

            try:
                return pd.read_csv(
                    file_path,
                    low_memory=False
                )

            except UnicodeDecodeError:

                return pd.read_csv(
                    file_path,
                    encoding="latin1",
                    low_memory=False
                )

        if extension in [".xlsx", ".xls"]:

            return pd.read_excel(file_path)

    except Exception as error:

        raise HTTPException(
            status_code=400,
            detail=f"Unable to read dataset: {error}"
        )

    raise HTTPException(
        status_code=400,
        detail="Only CSV and Excel files are supported."
    )


# =====================================================
# FIND DATASET FILE
# =====================================================

def find_dataset_file(dataset):

    stored_name = dataset.get("storedName")

    if stored_name:

        file_path = UPLOAD_DIR / stored_name

        if file_path.exists():
            return file_path


    # -------------------------------------------------
    # Fallback for old records
    # -------------------------------------------------

    file_path_value = dataset.get(
        "filePath",
        ""
    )

    if file_path_value:

        old_path = Path(
            file_path_value
        )

        if old_path.exists():
            return old_path


        filename = old_path.name

        backend_path = (
            UPLOAD_DIR / filename
        )

        if backend_path.exists():
            return backend_path


    return None


# =====================================================
# SAFE VALUE
# =====================================================

def safe_value(value):

    if pd.isna(value):
        return None

    if isinstance(
        value,
        (np.integer,)
    ):
        return int(value)

    if isinstance(
        value,
        (np.floating,)
    ):
        return float(value)

    if isinstance(
        value,
        (np.bool_,)
    ):
        return bool(value)

    return value


# =====================================================
# COLUMN TYPE DETECTION
# =====================================================

def detect_column_type(series):

    # -------------------------------------------------
    # Numeric
    # -------------------------------------------------

    if pd.api.types.is_numeric_dtype(series):

        return "numeric"


    # -------------------------------------------------
    # Boolean
    # -------------------------------------------------

    if pd.api.types.is_bool_dtype(series):

        return "boolean"


    # -------------------------------------------------
    # Datetime already detected by pandas
    # -------------------------------------------------

    if pd.api.types.is_datetime64_any_dtype(
        series
    ):

        return "datetime"


    # -------------------------------------------------
    # Try datetime detection for object columns
    # -------------------------------------------------

    if series.dtype == "object":

        non_null = series.dropna()

        if len(non_null) > 0:

            sample = non_null.astype(str)

            converted = pd.to_datetime(
                sample,
                errors="coerce"
            )

            valid_ratio = (
                converted.notna().mean()
            )

            if valid_ratio >= 0.80:

                return "datetime"


    # -------------------------------------------------
    # Categorical / text
    # -------------------------------------------------

    unique_count = (
        series.nunique(
            dropna=True
        )
    )

    total_count = len(
        series.dropna()
    )

    if total_count > 0:

        unique_ratio = (
            unique_count /
            total_count
        )

        if (
            unique_ratio <= 0.20
            or unique_count <= 50
        ):

            return "categorical"


    return "text"


# =====================================================
# DATA HEALTH SCORE
# =====================================================

def calculate_health_score(
    df,
    total_missing,
    duplicate_rows
):

    rows = len(df)

    total_cells = (
        df.shape[0] *
        df.shape[1]
    )

    # -------------------------------------------------
    # Completeness
    # -------------------------------------------------

    if total_cells > 0:

        completeness = (
            1 -
            (
                total_missing /
                total_cells
            )
        ) * 100

    else:

        completeness = 100


    # -------------------------------------------------
    # Uniqueness
    # -------------------------------------------------

    if rows > 0:

        duplicate_ratio = (
            duplicate_rows /
            rows
        )

        uniqueness = (
            1 -
            duplicate_ratio
        ) * 100

    else:

        uniqueness = 100


    # -------------------------------------------------
    # Final score
    # -------------------------------------------------

    score = (
        completeness * 0.65
        +
        uniqueness * 0.35
    )

    score = max(
        0,
        min(
            100,
            round(score)
        )
    )

    return score


# =====================================================
# MISSING VALUE RECOMMENDATION
# =====================================================

def get_missing_recommendation(
    series,
    column_type,
    missing_count,
    total_rows
):

    missing_percentage = (
        missing_count /
        total_rows *
        100
    ) if total_rows else 0


    # -------------------------------------------------
    # Numeric
    # -------------------------------------------------

    if column_type == "numeric":

        numeric_series = pd.to_numeric(
            series,
            errors="coerce"
        )

        if numeric_series.notna().sum() == 0:

            return {
                "method": "drop_column",
                "action": "review",
                "reason": (
                    "Column contains no reliable "
                    "numeric values."
                )
            }


        # High missing ratio
        if missing_percentage >= 50:

            return {
                "method": "drop_column",
                "action": "review",
                "reason": (
                    "More than 50% values are missing. "
                    "Dropping the column should be "
                    "reviewed before applying."
                )
            }


        # Check skewness
        try:

            skewness = (
                numeric_series
                .dropna()
                .skew()
            )

        except Exception:

            skewness = 0


        if abs(skewness) > 1:

            return {
                "method": "median",
                "action": "fill",
                "reason": (
                    "Numeric column is strongly "
                    "skewed, so median imputation "
                    "is safer than mean."
                )
            }


        return {
            "method": "mean",
            "action": "fill",
            "reason": (
                "Numeric column has a suitable "
                "distribution for mean imputation."
            )
        }


    # -------------------------------------------------
    # Categorical
    # -------------------------------------------------

    if column_type == "categorical":

        if missing_percentage >= 50:

            return {
                "method": "drop_column",
                "action": "review",
                "reason": (
                    "More than 50% categorical values "
                    "are missing."
                )
            }


        return {
            "method": "mode",
            "action": "fill",
            "reason": (
                "Categorical values are best filled "
                "using the most frequent category."
            )
        }


    # -------------------------------------------------
    # Datetime
    # -------------------------------------------------

    if column_type == "datetime":

        return {
            "method": "datetime",
            "action": "review",
            "reason": (
                "Date columns require date-aware "
                "handling instead of numeric imputation."
            )
        }


    # -------------------------------------------------
    # Text
    # -------------------------------------------------

    if column_type == "text":

        if missing_percentage >= 50:

            return {
                "method": "drop_column",
                "action": "review",
                "reason": (
                    "Most values are missing from "
                    "this text column."
                )
            }


        return {
            "method": "mode",
            "action": "fill",
            "reason": (
                "Text column has missing values. "
                "The most frequent value is the "
                "safest automatic replacement."
            )
        }


    return {
        "method": "review",
        "action": "review",
        "reason": (
            "Column requires manual inspection."
        )
    }


# =====================================================
# ANALYZE CLEANING
# =====================================================

@router.get(
    "/clean/{dataset_id}"
)
def analyze_cleaning(
    dataset_id: str,
    current_user=Depends(get_current_user)
):

    # Resolve the user's own dataset from persistent GridFS storage.
    # Local Render uploads are only caches and may disappear after a restart.
    from routes.dataset import get_document, get_analysis_file_path, read_dataset as read_normalized_dataset

    dataset = get_document(dataset_id, current_user)
    file_path = get_analysis_file_path(dataset)
    df = read_normalized_dataset(file_path)

    # =================================================
    # BASIC INFORMATION
    # =================================================

    total_rows = int(
        df.shape[0]
    )

    total_columns = int(
        df.shape[1]
    )


    # =================================================
    # MISSING VALUES
    # =================================================

    missing_values = {}

    missing_percentages = {}

    total_missing = 0

    for column in df.columns:

        count = int(
            df[column].isna().sum()
        )

        percentage = (
            count /
            total_rows *
            100
        ) if total_rows else 0


        missing_values[
            str(column)
        ] = count


        missing_percentages[
            str(column)
        ] = round(
            percentage,
            2
        )


        total_missing += count


    # =================================================
    # DUPLICATES
    # =================================================

    duplicate_rows = int(
        df.duplicated().sum()
    )


    # =================================================
    # COLUMN INFORMATION
    # =================================================

    columns = []

    data_types = {}

    numeric_columns = []

    categorical_columns = []

    datetime_columns = []

    text_columns = []


    for column in df.columns:

        series = df[column]

        column_name = str(
            column
        )

        detected_type = (
            detect_column_type(
                series
            )
        )

        unique_values = int(
            series.nunique(
                dropna=True
            )
        )

        missing_count = int(
            series.isna().sum()
        )

        missing_percentage = (
            missing_count /
            total_rows *
            100
        ) if total_rows else 0


        data_types[
            column_name
        ] = str(
            series.dtype
        )


        # -------------------------------------------------
        # Type lists
        # -------------------------------------------------

        if detected_type == "numeric":

            numeric_columns.append(
                column_name
            )

        elif detected_type == "categorical":

            categorical_columns.append(
                column_name
            )

        elif detected_type == "datetime":

            datetime_columns.append(
                column_name
            )

        elif detected_type == "text":

            text_columns.append(
                column_name
            )


        # -------------------------------------------------
        # Column information
        # -------------------------------------------------

        columns.append({

            "name": column_name,

            "dtype": str(
                series.dtype
            ),

            "detectedType":
                detected_type,

            "missing":
                missing_count,

            "missingPercentage":
                round(
                    missing_percentage,
                    2
                ),

            "unique":
                unique_values,

            "isConstant":
                unique_values <= 1

        })


    # =================================================
    # SMART SUGGESTIONS
    # =================================================

    suggestions = []


    # -------------------------------------------------
    # Missing values
    # -------------------------------------------------

    for column in df.columns:

        column_name = str(
            column
        )

        missing_count = int(
            df[column].isna().sum()
        )

        if missing_count <= 0:
            continue


        detected_type = (
            detect_column_type(
                df[column]
            )
        )


        recommendation = (
            get_missing_recommendation(
                df[column],
                detected_type,
                missing_count,
                total_rows
            )
        )


        suggestions.append({

            "id": (
                f"missing_{column_name}"
            ),

            "type":
                "missing_values",

            "column":
                column_name,

            "columnType":
                detected_type,

            "issue":
                f"{missing_count} missing values",

            "missingCount":
                missing_count,

            "missingPercentage":
                round(
                    (
                        missing_count /
                        total_rows *
                        100
                    ) if total_rows else 0,
                    2
                ),

            "method":
                recommendation["method"],

            "action":
                recommendation["action"],

            "recommendation":
                recommendation["reason"],

            "autoApplicable":
                recommendation["action"] == "fill"

        })


    # =================================================
    # DUPLICATE RECOMMENDATION
    # =================================================

    if duplicate_rows > 0:

        suggestions.append({

            "id":
                "remove_duplicates",

            "type":
                "duplicates",

            "column":
                None,

            "columnType":
                "row",

            "issue":
                f"{duplicate_rows} duplicate rows",

            "duplicateCount":
                duplicate_rows,

            "method":
                "drop_duplicates",

            "action":
                "remove",

            "recommendation":
                (
                    "Remove exact duplicate rows "
                    "to improve dataset uniqueness."
                ),

            "autoApplicable":
                True

        })


    # =================================================
    # CONSTANT COLUMNS
    # =================================================

    constant_columns = []

    for column in df.columns:

        unique_count = int(
            df[column].nunique(
                dropna=True
            )
        )

        if unique_count <= 1:

            constant_columns.append(
                str(column)
            )

            suggestions.append({

                "id":
                    f"constant_{column}",

                "type":
                    "constant_column",

                "column":
                    str(column),

                "columnType":
                    "unknown",

                "issue":
                    "Column contains only one unique value.",

                "method":
                    "drop_column",

                "action":
                    "review",

                "recommendation":
                    (
                        "This column provides little "
                        "information and may be removed "
                        "after review."
                    ),

                "autoApplicable":
                    False

            })


    # =================================================
    # HIGH MISSING COLUMNS
    # =================================================

    high_missing_columns = []

    for column in df.columns:

        missing_count = int(
            df[column].isna().sum()
        )

        if total_rows > 0:

            percentage = (
                missing_count /
                total_rows *
                100
            )

            if percentage >= 50:

                high_missing_columns.append(
                    str(column)
                )


    # =================================================
    # HEALTH SCORE
    # =================================================

    health_score = (
        calculate_health_score(
            df,
            total_missing,
            duplicate_rows
        )
    )


    # =================================================
    # STATUS
    # =================================================

    if health_score >= 90:

        health_status = "excellent"

    elif health_score >= 75:

        health_status = "good"

    elif health_score >= 50:

        health_status = "needs_attention"

    else:

        health_status = "poor"


    # =================================================
    # OVERALL STATUS
    # =================================================

    if len(suggestions) == 0:

        overall_status = "clean"

    else:

        overall_status = "needs_cleaning"


    # =================================================
    # DATASET PREVIEW
    # =================================================

    preview_records = []

    try:

        preview_df = df.head(10)

        preview_records = [

            {
                str(key):
                    safe_value(value)

                for key, value
                in row.items()
            }

            for row in
            preview_df.to_dict(
                orient="records"
            )

        ]

    except Exception:

        preview_records = []


    # =================================================
    # FINAL RESPONSE
    # =================================================

    return {

        "success": True,

        "agent":
            "Data Cleaning Agent",

        "dataset": {

            "id":
                str(dataset["_id"]),

            "fileName":
                dataset.get(
                    "fileName",
                    file_path.name
                ),

            "rows":
                total_rows,

            "columns":
                total_columns

        },

        "health": {

            "score":
                health_score,

            "status":
                health_status

        },

        "summary": {

            "status":
                overall_status,

            "totalMissingValues":
                total_missing,

            "duplicateRows":
                duplicate_rows,

            "issuesFound":
                len(suggestions),

            "constantColumns":
                len(constant_columns),

            "highMissingColumns":
                len(high_missing_columns)

        },

        "missingValues":
            missing_values,

        "missingPercentages":
            missing_percentages,

        "dataTypes":
            data_types,

        "columnTypes": {

            "numeric":
                numeric_columns,

            "categorical":
                categorical_columns,

            "datetime":
                datetime_columns,

            "text":
                text_columns

        },

        "columns":
            columns,

        "constantColumns":
            constant_columns,

        "highMissingColumns":
            high_missing_columns,

        "preview":
            preview_records,

        "suggestions":
            suggestions

    }