from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime, timezone

from database.mongodb import db
from auth import get_current_user

router = APIRouter(prefix="/api/history", tags=["History"])

history_collection = db["history"]


def _owner_id(current_user):
    return str(current_user["_id"])


def _safe_datetime(value):
    if isinstance(value, datetime):
        return value
    return datetime.now(timezone.utc)


def create_history_entry(
    current_user,
    activity_type,
    title,
    dataset_id=None,
    dataset_name=None,
    summary=None,
    result=None,
    metadata=None,
    source_id=None,
):
    """
    Internal helper used by other backend modules.

    Every history record is scoped to the authenticated owner.
    result is optional and should contain the actual reusable output
    of the operation, not fabricated values.
    """
    owner_id = _owner_id(current_user)
    now = datetime.now(timezone.utc)

    document = {
        "ownerId": owner_id,
        "type": str(activity_type),
        "title": str(title),
        "datasetId": str(dataset_id) if dataset_id else None,
        "datasetName": dataset_name,
        "summary": summary or "",
        "result": result if result is not None else {},
        "metadata": metadata if metadata is not None else {},
        "sourceId": source_id,
        "createdAt": now,
    }

    inserted = history_collection.insert_one(document)
    document["_id"] = inserted.inserted_id
    return document


def _public_history(document):
    return {
        "id": str(document["_id"]),
        "type": document.get("type", "activity"),
        "title": document.get("title", "NexusDS Activity"),
        "datasetId": document.get("datasetId"),
        "datasetName": document.get("datasetName"),
        "summary": document.get("summary", ""),
        "result": document.get("result", {}),
        "metadata": document.get("metadata", {}),
        "sourceId": document.get("sourceId"),
        "createdAt": document.get("createdAt"),
    }


@router.post("")
def add_history(
    payload: dict,
    current_user=Depends(get_current_user),
):
    """
    Create a history item from an authenticated frontend module.

    This endpoint is intentionally generic so Visualization, Cleaning,
    AI analysis and future agents can save their actual results without
    duplicating history-specific backend routes.
    """
    activity_type = str(payload.get("type", "")).strip().lower()
    title = str(payload.get("title", "")).strip()

    allowed_types = {
        "dataset_upload",
        "analysis",
        "ml_training",
        "visualization",
        "data_cleaning",
        "ai_analysis",
        "autopilot",
        "report",
    }

    if activity_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Invalid history activity type.",
        )

    if not title:
        raise HTTPException(
            status_code=400,
            detail="History title is required.",
        )

    dataset_id = payload.get("datasetId")
    dataset_name = payload.get("datasetName")

    # If a dataset is supplied, verify ownership. This prevents a user
    # from creating history records that point at another user's dataset.
    if dataset_id:
        try:
            dataset = db["datasets"].find_one({
                "_id": ObjectId(str(dataset_id)),
                "ownerId": _owner_id(current_user),
            })
        except Exception:
            dataset = None

        # Reports can be recorded even when their dataset was later deleted,
        # but when a dataset still exists, the ownership check must pass.
        if not dataset and activity_type != "report":
            raise HTTPException(
                status_code=404,
                detail="Dataset not found.",
            )

        if dataset and not dataset_name:
            dataset_name = dataset.get("fileName")

    document = create_history_entry(
        current_user=current_user,
        activity_type=activity_type,
        title=title,
        dataset_id=dataset_id,
        dataset_name=dataset_name,
        summary=str(payload.get("summary", "") or ""),
        result=payload.get("result", {}),
        metadata=payload.get("metadata", {}),
        source_id=payload.get("sourceId"),
    )

    return {
        "success": True,
        "history": _public_history(document),
    }


@router.get("")
def list_history(
    type: str = "",
    datasetId: str = "",
    q: str = "",
    limit: int = 100,
    current_user=Depends(get_current_user),
):
    owner_id = _owner_id(current_user)
    limit = max(1, min(int(limit), 200))

    query = {"ownerId": owner_id}

    if type.strip():
        query["type"] = type.strip().lower()

    if datasetId.strip():
        query["datasetId"] = datasetId.strip()

    if q.strip():
        pattern = q.strip()
        query["$or"] = [
            {"title": {"$regex": pattern, "$options": "i"}},
            {"datasetName": {"$regex": pattern, "$options": "i"}},
            {"summary": {"$regex": pattern, "$options": "i"}},
        ]

    documents = list(
        history_collection.find(query)
        .sort("createdAt", -1)
        .limit(limit)
    )

    return {
        "success": True,
        "count": len(documents),
        "history": [_public_history(d) for d in documents],
    }


@router.get("/{history_id}")
def get_history_item(
    history_id: str,
    current_user=Depends(get_current_user),
):
    try:
        object_id = ObjectId(history_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid history ID.",
        )

    document = history_collection.find_one({
        "_id": object_id,
        "ownerId": _owner_id(current_user),
    })

    if not document:
        raise HTTPException(
            status_code=404,
            detail="History item not found.",
        )

    return {
        "success": True,
        "history": _public_history(document),
    }


@router.delete("/{history_id}")
def delete_history_item(
    history_id: str,
    current_user=Depends(get_current_user),
):
    try:
        object_id = ObjectId(history_id)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Invalid history ID.",
        )

    result = history_collection.delete_one({
        "_id": object_id,
        "ownerId": _owner_id(current_user),
    })

    if result.deleted_count != 1:
        raise HTTPException(
            status_code=404,
            detail="History item not found.",
        )

    return {
        "success": True,
        "message": "History item deleted successfully.",
        "historyId": history_id,
    }


@router.delete("")
def clear_history(
    type: str = "",
    current_user=Depends(get_current_user),
):
    query = {"ownerId": _owner_id(current_user)}

    if type.strip():
        query["type"] = type.strip().lower()

    result = history_collection.delete_many(query)

    return {
        "success": True,
        "deleted": int(result.deleted_count),
        "message": (
            "Selected history was cleared successfully."
            if type.strip()
            else "All history was cleared successfully."
        ),
    }
