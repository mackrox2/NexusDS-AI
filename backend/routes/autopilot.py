from fastapi import APIRouter, HTTPException, Depends

from fastapi.responses import FileResponse

from pydantic import BaseModel

from pathlib import Path

from collections import Counter

import uuid


import pandas as pd

import numpy as np


from sklearn.model_selection import train_test_split

from sklearn.preprocessing import OneHotEncoder

from sklearn.compose import ColumnTransformer

from sklearn.pipeline import Pipeline

from sklearn.impute import SimpleImputer

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor

from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor

from sklearn.linear_model import LogisticRegression, LinearRegression

from sklearn.metrics import accuracy_score, f1_score, r2_score, mean_absolute_error


from reportlab.lib import colors

from reportlab.lib.pagesizes import A4

from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from reportlab.lib.enums import TA_CENTER

from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak


from database.mongodb import datasets_collection, db

from auth import get_current_user


router = APIRouter(prefix="/api/autopilot", tags=["Autonomous Analyst"])


BASE_DIR = Path(__file__).resolve().parent.parent

UPLOAD_DIR = BASE_DIR / "uploads"


class AutopilotRequest(BaseModel):

          datasetId: str

          runML: bool = True


def normalize(value):

          return str(value).replace("\ufeff", "").replace("\u200b", "").strip()


def get_document(dataset_id, current_user=None):

          from bson import ObjectId


          try:

                    oid = ObjectId(dataset_id)

          except Exception:

                    raise HTTPException(status_code=400, detail="Invalid dataset ID.")


          query = {"_id": oid}


          if current_user is not None:

                    query["ownerId"] = str(current_user["_id"])


          doc = datasets_collection.find_one(query)


          if not doc:

                    raise HTTPException(status_code=404, detail="Dataset not found.")


          return doc


def read_file(doc):

          # Universal uploads preserve the original source in storedName and create

          # an analysis-ready XLSX in analysisStoredName. Autopilot must analyze

          # the generated XLSX for PDF/DOCX/images instead of the original file.

          stored = doc.get("analysisStoredName") or doc.get("storedName")


          if not stored:

                    raise HTTPException(

                              status_code=404,

                              detail="Dataset analysis/storage name is missing."

                    )


          path = (UPLOAD_DIR / Path(stored).name).resolve()

          root = UPLOAD_DIR.resolve()


          if root not in path.parents or not path.exists():

                    raise HTTPException(

                              status_code=404,

                              detail="Dataset analysis file was not found. Please upload the dataset again."

                    )


          ext = path.suffix.lower()

          try:

                    if ext == ".csv":

                              df = pd.read_csv(path)

                    elif ext in (".xlsx", ".xls"):

                              preview = pd.read_excel(path, header=None, nrows=15)

                              if preview.empty:

                                        raise HTTPException(status_code=400, detail="Excel file is empty.")


                              keywords = [

                                        "s.no", "sr.no", "date", "city", "name", "id", "total",

                                        "amount", "value", "status", "approved", "approval",

                                        "pending", "cancel", "customer", "product", "price",

                                        "sales", "profit", "target", "category", "availability"

                              ]

                              best_row, best_score = 0, -1

                              for i in range(len(preview)):

                                        values = []

                                        keyword_score = 0

                                        for v in preview.iloc[i]:

                                                  if pd.isna(v):

                                                            continue

                                                  text = normalize(v)

                                                  if not text or text.lower().startswith("unnamed"):

                                                            continue

                                                  values.append(text)

                                                  if any(k in text.lower() for k in keywords):

                                                            keyword_score += 2

                                        score = len(values) + len(set(x.lower() for x in values)) * 0.25 + keyword_score

                                        if score > best_score:

                                                  best_row, best_score = i, score

                              df = pd.read_excel(path, header=best_row)

                    else:

                              raise HTTPException(status_code=400, detail="Only CSV and Excel files are supported.")

          except HTTPException:

                    raise

          except Exception as exc:

                    raise HTTPException(status_code=400, detail=f"Unable to read dataset: {exc}")


          df.columns = [normalize(c) for c in df.columns]

          df = df.dropna(axis=0, how="all").dropna(axis=1, how="all")

          df = df[[c for c in df.columns if c and not str(c).lower().startswith("unnamed")]]

          if df.empty or df.shape[1] == 0:

                    raise HTTPException(status_code=400, detail="Dataset contains no usable data.")

          return df


def numeric_series(s):

          converted = pd.to_numeric(s, errors="coerce")

          valid = s.notna().sum()

          return converted if valid and converted.notna().sum() / valid >= 0.8 else None


def detect_target(df):

          candidates = []

          target_words = (

                    "target", "outcome", "result", "status", "category", "class",

                    "label", "approved", "approval", "churn", "default", "response",

                    "score", "rating", "price", "sales", "profit", "revenue", "availability"

          )


          for col in df.columns:

                    s = df[col]

                    non_null = s.dropna()

                    if len(non_null) < 10:

                              continue


                    unique = non_null.nunique()

                    ratio = unique / len(non_null)

                    score = 0

                    reasons = []


                    name = str(col).lower()

                    if any(word in name for word in target_words):

                              score += 4

                              reasons.append("column name suggests an outcome/target")


                    if 2 <= unique <= min(20, max(2, int(len(non_null) * 0.25))):

                              score += 2

                              reasons.append("manageable number of classes")


                    if ratio > 0.95:

                              score -= 3

                              reasons.append("very high cardinality")


                    if unique <= 1:

                              score -= 5

                              reasons.append("constant column")


                    if col.lower().endswith(("id", "_id")) or "internal id" in name:

                              score -= 4

                              reasons.append("identifier-like column")


                    if numeric_series(s) is not None and unique >= 10:

                              score += 1

                              reasons.append("numeric values can support regression")


                    candidates.append({

                              "column": str(col),

                              "score": max(score, 0),

                              "reason": "; ".join(reasons) or "usable candidate based on data availability",

                              "uniqueValues": int(unique)

                    })


          candidates.sort(key=lambda x: x["score"], reverse=True)

          return candidates[:5]


def analyze_data(df):

          rows, cols = df.shape

          missing = df.isna().sum()

          duplicate_rows = int(df.duplicated().sum())


          numeric_cols, categorical_cols, date_cols = [], [], []

          column_info = []

          insights = []

          cleaning = []


          for col in df.columns:

                    s = df[col]

                    num = numeric_series(s)


                    if num is not None:

                              numeric_cols.append(col)

                              info_type = "numeric"

                              skew = float(num.dropna().skew()) if num.dropna().shape[0] > 2 else 0.0

                              outliers = 0

                              q1 = num.quantile(0.25)

                              q3 = num.quantile(0.75)

                              iqr = q3 - q1

                              if pd.notna(iqr) and iqr > 0:

                                        outliers = int(((num < q1 - 1.5 * iqr) | (num > q3 + 1.5 * iqr)).sum())

                              column_info.append({

                                        "column": str(col),

                                        "type": info_type,

                                        "missing": int(s.isna().sum()),

                                        "missingPercent": round(float(s.isna().mean() * 100), 2),

                                        "unique": int(s.nunique(dropna=True)),

                                        "mean": round(float(num.mean()), 4) if num.notna().any() else None,

                                        "median": round(float(num.median()), 4) if num.notna().any() else None,

                                        "min": round(float(num.min()), 4) if num.notna().any() else None,

                                        "max": round(float(num.max()), 4) if num.notna().any() else None,

                                        "outliers": outliers,

                                        "skewness": round(skew, 4),

                              })

                              if outliers:

                                        insights.append(f"{col} contains {outliers} potential outlier values.")

                                        cleaning.append({"column": str(col), "issue": "Potential outliers", "action": "Review IQR outliers before removal", "priority": "medium"})

                    else:

                              parsed = pd.to_datetime(s, errors="coerce", format="mixed", dayfirst=True)

                              if s.notna().sum() >= 10 and parsed.notna().sum() / s.notna().sum() >= 0.8:

                                        date_cols.append(col)

                                        info_type = "date"

                              else:

                                        categorical_cols.append(col)

                                        info_type = "categorical"


                              column_info.append({

                                        "column": str(col),

                                        "type": info_type,

                                        "missing": int(s.isna().sum()),

                                        "missingPercent": round(float(s.isna().mean() * 100), 2),

                                        "unique": int(s.nunique(dropna=True)),

                                        "topValue": str(s.mode(dropna=True).iloc[0]) if not s.mode(dropna=True).empty else None,

                              })


                    pct = float(s.isna().mean() * 100)

                    if pct >= 20:

                              cleaning.append({"column": str(col), "issue": f"{pct:.1f}% missing", "action": "Review column before imputation", "priority": "high"})

                              insights.append(f"{col} has high missingness ({pct:.1f}%).")

                    elif pct > 0:

                              cleaning.append({"column": str(col), "issue": f"{pct:.1f}% missing", "action": "Consider median/mode imputation", "priority": "low"})


                    if s.nunique(dropna=True) == 1:

                              cleaning.append({"column": str(col), "issue": "Constant value", "action": "Consider removing from analysis/ML", "priority": "high"})

                              insights.append(f"{col} is constant and adds little analytical value.")


                    if rows and s.nunique(dropna=True) / rows > 0.9:

                              cleaning.append({"column": str(col), "issue": "Very high cardinality", "action": "Review identifier/text-like usage", "priority": "medium"})


          missing_ratio = float(missing.sum()) / max(1, rows * cols)

          constant_count = sum(1 for col in df.columns if df[col].nunique(dropna=True) <= 1)

          high_cardinality_count = sum(1 for col in df.columns if df[col].nunique(dropna=True) / max(1, rows) > 0.9)

          duplicate_ratio = duplicate_rows / max(1, rows)


          # Health score reflects multiple quality dimensions, not only missing cells.

          penalty = 0

          penalty += min(35, round(missing_ratio * 100 * 1.5))

          penalty += min(20, round(duplicate_ratio * 100))

          penalty += min(15, constant_count * 5)

          penalty += min(15, high_cardinality_count * 2)

          health = max(0, min(100, 100 - penalty))


          correlations = []

          if len(numeric_cols) >= 2:

                    corr = df[numeric_cols].corr(numeric_only=True)

                    for i, a in enumerate(corr.columns):

                              for b in corr.columns[i + 1:]:

                                        value = corr.loc[a, b]

                                        if pd.notna(value) and abs(value) >= 0.6:

                                                  correlations.append({"columnA": str(a), "columnB": str(b), "correlation": round(float(value), 4)})

                                                  insights.append(f"{a} and {b} show a strong correlation of {value:.2f}.")


          if duplicate_rows:

                    insights.append(f"{duplicate_rows} duplicate rows were detected.")

                    cleaning.append({"column": "Dataset", "issue": f"{duplicate_rows} duplicate rows", "action": "Review and remove exact duplicates", "priority": "medium"})


          if not insights:

                    insights.append("No major structural anomalies were detected by the automatic checks.")


          return {

                    "summary": {

                              "rows": int(rows),

                              "columns": int(cols),

                              "numericColumns": len(numeric_cols),

                              "categoricalColumns": len(categorical_cols),

                              "dateColumns": len(date_cols),

                              "missingCells": int(missing.sum()),

                              "duplicateRows": duplicate_rows,

                              "dataHealthScore": health,

                    },

                    "columns": column_info,

                    "strongRelationships": correlations[:15],

                    "insights": list(dict.fromkeys(insights))[:15],

                    "cleaningRecommendations": cleaning[:25],

                    "targetCandidates": detect_target(df),

          }


def build_models(problem):

          if problem == "classification":

                    return {

                              "Decision Tree": DecisionTreeClassifier(random_state=42, max_depth=8),

                              "Random Forest": RandomForestClassifier(n_estimators=150, random_state=42, n_jobs=-1),

                              "Logistic Regression": LogisticRegression(max_iter=2000),

                    }

          return {

                    "Decision Tree": DecisionTreeRegressor(random_state=42, max_depth=8),

                    "Random Forest": RandomForestRegressor(n_estimators=150, random_state=42, n_jobs=-1),

                    "Linear Regression": LinearRegression(),

          }


def run_ml(df, target):

          if not target or target not in df.columns:

                    return {"status": "skipped", "reason": "No reliable target candidate was found."}


          y_raw = df[target].dropna()

          if len(y_raw) < 20:

                    return {"status": "skipped", "reason": f"Only {len(y_raw)} valid target rows are available; at least 20 are recommended for autonomous training."}


          num_target = numeric_series(df[target])

          if num_target is not None and y_raw.nunique() > 10:

                    problem = "regression"

                    work = df.dropna(subset=[target]).copy()

                    y = pd.to_numeric(work[target], errors="coerce")

                    work = work.loc[y.notna()]

                    y = y.loc[y.notna()]

          else:

                    problem = "classification"

                    work = df.dropna(subset=[target]).copy()

                    y = work[target].astype(str).str.strip()

                    if y.nunique() < 2 or y.nunique() > max(20, len(y) // 2):

                              return {"status": "skipped", "reason": "The suggested target does not have a stable class structure for autonomous classification."}


          X = work.drop(columns=[target])

          if X.shape[1] == 0:

                    return {"status": "skipped", "reason": "No feature columns are available."}


          numeric, categorical = [], []

          for col in X.columns:

                    if numeric_series(X[col]) is not None:

                              numeric.append(col)

                    else:

                              categorical.append(col)


          transformers = []

          if numeric:

                    transformers.append(("num", Pipeline([("imputer", SimpleImputer(strategy="median"))]), numeric))

          if categorical:

                    transformers.append(("cat", Pipeline([

                              ("imputer", SimpleImputer(strategy="most_frequent")),

                              ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False))

                    ]), categorical))


          if not transformers:

                    return {"status": "skipped", "reason": "No usable features remain after inspection."}


          preprocessor = ColumnTransformer(transformers=transformers)

          test_size = 0.2

          stratify = None

          if problem == "classification":

                    counts = y.value_counts()

                    if counts.min() >= 2 and y.nunique() <= 15:

                              stratify = y


          try:

                    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42, stratify=stratify)

          except Exception as exc:

                    return {"status": "skipped", "reason": f"Train/test split could not be created: {exc}"}


          results = []

          fitted = []


          for name, model in build_models(problem).items():

                    pipe = Pipeline([("preprocessor", preprocessor), ("model", model)])

                    try:

                              pipe.fit(X_train, y_train)

                              pred = pipe.predict(X_test)

                              if problem == "classification":

                                        score = float(accuracy_score(y_test, pred))

                                        f1 = float(f1_score(y_test, pred, average="weighted", zero_division=0))

                                        results.append({"model": name, "accuracy": round(score, 4), "f1": round(f1, 4)})

                                        rank = f1

                              else:

                                        score = float(r2_score(y_test, pred))

                                        mae = float(mean_absolute_error(y_test, pred))

                                        results.append({"model": name, "r2": round(score, 4), "mae": round(mae, 4)})

                                        rank = score

                              fitted.append((rank, name, pipe))

                    except Exception as exc:

                              results.append({"model": name, "status": "failed", "error": str(exc)})


          if not fitted:

                    return {"status": "failed", "reason": "All candidate models failed to train."}


          fitted.sort(reverse=True, key=lambda x: x[0])

          best_score, best_name, best_pipe = fitted[0]


          feature_importance = []

          try:

                    model = best_pipe.named_steps["model"]

                    prep = best_pipe.named_steps["preprocessor"]

                    names = prep.get_feature_names_out()

                    values = getattr(model, "feature_importances_", None)

                    if values is None and hasattr(model, "coef_"):

                              values = np.mean(np.abs(model.coef_), axis=0)

                    if values is not None:

                              pairs = sorted(zip(names, values), key=lambda x: float(x[1]), reverse=True)[:10]

                              feature_importance = [{"feature": str(n), "importance": round(float(v), 5)} for n, v in pairs]

          except Exception:

                    pass


          return {

                    "status": "completed",

                    "problemType": problem,

                    "target": target,

                    "bestModel": best_name,

                    "bestScore": round(float(best_score), 4),

                    "trainingRows": len(X_train),

                    "testingRows": len(X_test),

                    "comparison": results,

                    "featureImportance": feature_importance,

                    "targetClasses": sorted([str(v) for v in y.unique()]) if problem == "classification" else None,

          }


def generate_pdf_report(doc, analysis, ml):

          report_dir = UPLOAD_DIR / "reports"

          report_dir.mkdir(parents=True, exist_ok=True)

          report_id = uuid.uuid4().hex

          report_path = report_dir / f"nexusds_report_{report_id}.pdf"


          styles = getSampleStyleSheet()

          title_style = ParagraphStyle(

                    "NexusTitle", parent=styles["Title"], alignment=TA_CENTER,

                    fontSize=20, leading=24, spaceAfter=12

          )

          heading_style = ParagraphStyle(

                    "NexusHeading", parent=styles["Heading2"], fontSize=13,

                    leading=16, spaceBefore=10, spaceAfter=7

          )

          body_style = ParagraphStyle(

                    "NexusBody", parent=styles["BodyText"], fontSize=9.5,

                    leading=14, spaceAfter=5

          )

          small_style = ParagraphStyle(

                    "NexusSmall", parent=styles["BodyText"], fontSize=8,

                    leading=11

          )


          story = []

          dataset_name = doc.get("fileName", "Dataset")

          summary = analysis["summary"]


          story.append(Paragraph("NexusDS AI", title_style))

          story.append(Paragraph("Autonomous Data Science Analysis Report", heading_style))

          story.append(Paragraph(f"<b>Dataset:</b> {dataset_name}", body_style))

          story.append(Spacer(1, 8))


          story.append(Paragraph("Executive Summary", heading_style))

          story.append(Paragraph(

                    f"The dataset contains {summary['rows']} rows and {summary['columns']} columns. "

                    f"The autonomous analysis identified {len(analysis['insights'])} key insights and "

                    f"{len(analysis['cleaningRecommendations'])} data-quality recommendations. "

                    f"The calculated data-health score is {summary['dataHealthScore']}%. ", body_style

          ))


          metrics = [

                    ["Rows", str(summary["rows"]), "Columns", str(summary["columns"])],

                    ["Numeric", str(summary["numericColumns"]), "Categorical", str(summary["categoricalColumns"])],

                    ["Missing Cells", str(summary["missingCells"]), "Duplicate Rows", str(summary["duplicateRows"])],

                    ["Data Health", f"{summary['dataHealthScore']}%", "Date Columns", str(summary["dateColumns"])],

          ]

          table = Table(metrics, colWidths=[90, 90, 90, 90])

          table.setStyle(TableStyle([

                    ("GRID", (0,0), (-1,-1), 0.4, colors.grey),

                    ("BACKGROUND", (0,0), (0,-1), colors.HexColor("#eaf7fb")),

                    ("BACKGROUND", (2,0), (2,-1), colors.HexColor("#eaf7fb")),

                    ("FONTNAME", (0,0), (-1,-1), "Helvetica"),

                    ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),

                    ("FONTNAME", (2,0), (2,-1), "Helvetica-Bold"),

                    ("FONTSIZE", (0,0), (-1,-1), 9),

                    ("VALIGN", (0,0), (-1,-1), "MIDDLE"),

                    ("TOPPADDING", (0,0), (-1,-1), 7),

                    ("BOTTOMPADDING", (0,0), (-1,-1), 7),

          ]))

          story.append(table)


          story.append(Paragraph("Key Insights", heading_style))

          for item in analysis["insights"]:

                    story.append(Paragraph(f"• {item}", body_style))


          story.append(Paragraph("Cleaning Recommendations", heading_style))

          for item in analysis["cleaningRecommendations"]:

                    story.append(Paragraph(

                              f"<b>{item.get('column', 'Dataset')}</b>: {item.get('issue', '')} — "

                              f"{item.get('action', '')} (Priority: {item.get('priority', 'medium')})",

                              body_style

                    ))


          if analysis["strongRelationships"]:

                    story.append(Paragraph("Strong Numeric Relationships", heading_style))

                    rel_data = [["Column A", "Column B", "Correlation"]]

                    for item in analysis["strongRelationships"]:

                              rel_data.append([item["columnA"], item["columnB"], str(item["correlation"])])

                    rel_table = Table(rel_data, colWidths=[150, 150, 90], repeatRows=1)

                    rel_table.setStyle(TableStyle([

                              ("GRID", (0,0), (-1,-1), 0.4, colors.grey),

                              ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#eaf7fb")),

                              ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),

                              ("FONTSIZE", (0,0), (-1,-1), 8.5),

                              ("TOPPADDING", (0,0), (-1,-1), 5),

                              ("BOTTOMPADDING", (0,0), (-1,-1), 5),

                    ]))

                    story.append(rel_table)


          story.append(Paragraph("Machine Learning Evaluation", heading_style))

          if ml.get("status") == "completed":

                    story.append(Paragraph(

                              f"<b>Target:</b> {ml.get('target')} &nbsp;&nbsp; "

                              f"<b>Problem Type:</b> {ml.get('problemType')} &nbsp;&nbsp; "

                              f"<b>Best Model:</b> {ml.get('bestModel')}", body_style

                    ))

                    story.append(Paragraph(

                              f"Training rows: {ml.get('trainingRows')} | Testing rows: {ml.get('testingRows')} | "

                              f"Best score: {ml.get('bestScore')}", body_style

                    ))

                    if ml.get("comparison"):

                              ml_rows = [["Model", "Accuracy/R2", "F1/MAE"]]

                              for item in ml["comparison"]:

                                        if "accuracy" in item:

                                                  ml_rows.append([item["model"], str(item.get("accuracy", "-")), str(item.get("f1", "-"))])

                                        else:

                                                  ml_rows.append([item["model"], str(item.get("r2", "-")), str(item.get("mae", "-"))])

                              ml_table = Table(ml_rows, colWidths=[170, 100, 100], repeatRows=1)

                              ml_table.setStyle(TableStyle([

                                        ("GRID", (0,0), (-1,-1), 0.4, colors.grey),

                                        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#eaf7fb")),

                                        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),

                                        ("FONTSIZE", (0,0), (-1,-1), 8.5),

                                        ("TOPPADDING", (0,0), (-1,-1), 5),

                                        ("BOTTOMPADDING", (0,0), (-1,-1), 5),

                              ]))

                              story.append(ml_table)

          else:

                    story.append(Paragraph(

                              f"Machine learning was not completed: {ml.get('reason', 'No suitable configuration was found.')}",

                              body_style

                    ))


          story.append(Spacer(1, 12))

          story.append(Paragraph(

                    "Generated automatically by NexusDS AI. Model metrics and data-quality findings are based on the selected dataset.",

                    small_style

          ))


          SimpleDocTemplate(

                    str(report_path), pagesize=A4, rightMargin=36, leftMargin=36,

                    topMargin=36, bottomMargin=36

          ).build(story)


          return report_id, report_path.name


@router.get("/reports")

def list_reports(current_user=Depends(get_current_user)):

          """Return only reports owned by the authenticated user."""

          owner_id = str(current_user["_id"])

          reports_collection = db["reports"]


          documents = list(

                    reports_collection.find(

                              {"ownerId": owner_id}

                    ).sort("generatedAt", -1)

          )


          reports = []

          for document in documents:

                    reports.append({

                              "reportId": document.get("reportId"),

                              "fileName": document.get("fileName"),

                              "title": document.get("title", "NexusDS AI Report"),

                              "datasetId": document.get("datasetId"),

                              "datasetName": document.get("datasetName", "Dataset"),

                              "generatedAt": document.get("generatedAt"),

                              "status": document.get("status", "completed"),

                              "mlStatus": document.get("mlStatus"),

                              "mlProblemType": document.get("mlProblemType"),

                              "mlBestModel": document.get("mlBestModel"),

                              "mlBestScore": document.get("mlBestScore"),

                              "dataHealthScore": document.get("dataHealthScore"),

                    })


          return {

                    "success": True,

                    "count": len(reports),

                    "reports": reports,

          }


@router.get("/report/{report_id}")

def download_report(

          report_id: str,

          current_user=Depends(get_current_user)

):

          if not report_id or "/" in report_id or "\\\\" in report_id:

                    raise HTTPException(

                              status_code=400,

                              detail="Invalid report ID."

                    )


          reports_collection = db["reports"]


          report_document = reports_collection.find_one({

                    "reportId": report_id,

                    "ownerId": str(current_user["_id"])

          })


          if not report_document:

                    raise HTTPException(

                              status_code=404,

                              detail="Report not found."

                    )


          report_path = (

                    UPLOAD_DIR / "reports" /

                    f"nexusds_report_{report_id}.pdf"

          ).resolve()


          report_root = (

                    UPLOAD_DIR / "reports"

          ).resolve()


          if (

                    report_root not in report_path.parents

                    or not report_path.exists()

          ):

                    raise HTTPException(

                              status_code=404,

                              detail="Report file not found."

                    )


          return FileResponse(

                    path=str(report_path),

                    media_type="application/pdf",

                    filename="NexusDS_AI_Autonomous_Report.pdf"

          )


@router.post("/run")

def run_autopilot(

          request: AutopilotRequest,

          current_user=Depends(get_current_user)

):

          doc = get_document(

                    request.datasetId,

                    current_user

          )

          df = read_file(doc)


          analysis = analyze_data(df)

          candidates = analysis["targetCandidates"]

          target = candidates[0]["column"] if candidates else None


          ml = (

                    run_ml(df, target)

                    if request.runML

                    else {

                              "status": "skipped",

                              "reason": "ML step disabled."

                    }

          )


          report_id, report_filename = generate_pdf_report(

                    doc,

                    analysis,

                    ml

          )


          report = {

                    "title": "NexusDS AI Autonomous Data Analysis",

                    "dataset": doc.get("fileName", "Dataset"),

                    "executiveSummary": (

                              f"The dataset contains {len(df)} rows and "

                              f"{len(df.columns)} columns. "

                              f"Automatic analysis found "

                              f"{len(analysis['insights'])} key insights and "

                              f"{len(analysis['cleaningRecommendations'])} "

                              f"data-quality recommendations."

                    ),

                    "nextActions": [

                              r["action"]

                              for r in analysis["cleaningRecommendations"][:5]

                    ],

                    "reportId": report_id,

                    "reportFilename": report_filename,

          }


          # Save a real report record for the authenticated user.

          # Dashboard uses this collection for the Reports count.

          reports_collection = db["reports"]

          generated_at = pd.Timestamp.utcnow().to_pydatetime()


          report_document = {

                    "reportId": report_id,

                    "fileName": report_filename,

                    "title": report["title"],

                    "datasetId": request.datasetId,

                    "datasetName": doc.get("fileName", "Dataset"),

                    "ownerId": str(current_user["_id"]),

                    "ownerEmail": current_user.get("email", ""),

                    "generatedAt": generated_at,

                    "status": "completed",

                    "mlStatus": ml.get("status", "unknown"),

                    "mlProblemType": ml.get("problemType"),

                    "mlBestModel": ml.get("bestModel"),

                    "mlBestScore": ml.get("bestScore"),

                    "dataHealthScore": analysis["summary"].get("dataHealthScore")

          }


          try:

                    reports_collection.insert_one(report_document)


                    datasets_collection.update_one(

                              {"_id": doc["_id"]},

                              {

                                        "$inc": {"reportCount": 1},

                                        "$set": {

                                                  "lastReport": {

                                                            "reportId": report_id,

                                                            "fileName": report_filename,

                                                            "generatedAt": generated_at

                                                  }

                                        }

                              }

                    )

          except Exception as error:

                    print("REPORT METADATA SAVE ERROR:", repr(error))

                    raise HTTPException(

                              status_code=500,

                              detail=(

                                        "PDF was generated, but its report record "

                                        "could not be saved. Please try again."

                              )

                    )


          return {

                    "success": True,

                    "datasetId": request.datasetId,

                    "datasetName": doc.get("fileName", "Dataset"),

                    "status": "completed",

                    "analysis": analysis,

                    "ml": ml,

                    "report": report,

          }


@router.delete("/report/{report_id}")

def delete_report(

          report_id: str,

          current_user=Depends(get_current_user)

):

          """Permanently delete an authenticated user's generated report and PDF."""

          if not report_id or "/" in report_id or "\\\\" in report_id:

                    raise HTTPException(

                              status_code=400,

                              detail="Invalid report ID."

                    )


          reports_collection = db["reports"]

          owner_id = str(current_user["_id"])


          report_document = reports_collection.find_one({

                    "reportId": report_id,

                    "ownerId": owner_id

          })


          if not report_document:

                    raise HTTPException(

                              status_code=404,

                              detail="Report not found."

                    )


          # Delete the database record first only after confirming ownership.

          delete_result = reports_collection.delete_one({

                    "_id": report_document["_id"],

                    "reportId": report_id,

                    "ownerId": owner_id

          })


          if delete_result.deleted_count != 1:

                    raise HTTPException(

                              status_code=500,

                              detail="Report could not be deleted."

                    )


          # Delete the generated PDF if it exists.

          report_path = (

                    UPLOAD_DIR / "reports" /

                    f"nexusds_report_{report_id}.pdf"

          ).resolve()


          report_root = (

                    UPLOAD_DIR / "reports"

          ).resolve()


          file_deleted = False


          if report_root in report_path.parents and report_path.exists():

                    try:

                              report_path.unlink()

                              file_deleted = True

                    except Exception as error:

                              print("REPORT PDF DELETE ERROR:", repr(error))


          # Keep dataset report metadata/count consistent.

          dataset_id = report_document.get("datasetId")


          if dataset_id:

                    try:

                              from bson import ObjectId


                              dataset_query = {"ownerId": owner_id}


                              try:

                                        dataset_query["_id"] = ObjectId(dataset_id)

                              except Exception:

                                        dataset_query["_id"] = dataset_id


                              dataset_document = datasets_collection.find_one(dataset_query)


                              if dataset_document:

                                        current_count = int(dataset_document.get("reportCount", 0) or 0)

                                        new_count = max(0, current_count - 1)


                                        update_fields = {

                                                  "reportCount": new_count

                                        }


                                        # If this deleted report was stored as lastReport,

                                        # replace it with the newest remaining report when possible.

                                        last_report = dataset_document.get("lastReport") or {}

                                        if last_report.get("reportId") == report_id:

                                                  newest = reports_collection.find_one(

                                                            {

                                                                      "datasetId": str(dataset_id),

                                                                      "ownerId": owner_id

                                                            },

                                                            sort=[("generatedAt", -1)]

                                                  )


                                                  if newest:

                                                            update_fields["lastReport"] = {

                                                                      "reportId": newest.get("reportId"),

                                                                      "fileName": newest.get("fileName"),

                                                                      "generatedAt": newest.get("generatedAt")

                                                            }

                                                  else:

                                                            update_fields["lastReport"] = None


                                        datasets_collection.update_one(

                                                  {"_id": dataset_document["_id"]},

                                                  {"$set": update_fields}

                                        )

                    except Exception as error:

                              # The report itself is already deleted. Log metadata-sync failure

                              # rather than falsely reporting that the deletion failed.

                              print("REPORT DATASET METADATA UPDATE ERROR:", repr(error))


          return {

                    "success": True,

                    "deleted": True,

                    "reportId": report_id,

                    "fileDeleted": file_deleted,

                    "message": "Report permanently deleted."

          }
