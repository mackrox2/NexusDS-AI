import os
import gridfs
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import PyMongoError


# =====================================================
# LOAD ENVIRONMENT
# =====================================================

BASE_DIR = Path(__file__).resolve().parent.parent

ENV_FILE = BASE_DIR / ".env"

load_dotenv(ENV_FILE)


# =====================================================
# MONGODB URL
# =====================================================

MONGO_URL = os.getenv("MONGO_URL")

if not MONGO_URL:
    raise RuntimeError(
        f"MONGO_URL not found.\n"
        f"Please add MONGO_URL to:\n{ENV_FILE}"
    )


# =====================================================
# MONGODB CLIENT
# =====================================================

client = MongoClient(
    MONGO_URL,

    # Fast connection failure
    serverSelectionTimeoutMS=5000,

    # Fast TCP connection failure
    connectTimeoutMS=5000,

    # Prevent requests from hanging forever
    socketTimeoutMS=10000,

    # Keep connections alive
    maxPoolSize=20,
    minPoolSize=1,

    # Retry temporary MongoDB errors
    retryWrites=True,
    retryReads=True,
)


# =====================================================
# DATABASE
# =====================================================

db = client["NexusDSAI"]

# Persistent dataset file storage in MongoDB Atlas
fs = gridfs.GridFSBucket(db, bucket_name="dataset_files")
# =====================================================
# COLLECTIONS
# =====================================================

datasets_collection = db["datasets"]

users_collection = db["users"]


# =====================================================
# CONNECTION CHECK
# =====================================================

def check_mongodb_connection():
    """
    Check whether MongoDB Atlas is reachable.
    Returns True/False instead of allowing the
    application to hang indefinitely.
    """

    try:

        client.admin.command(
            "ping"
        )

        return True

    except PyMongoError as error:

        print(
            "\n❌ MongoDB CONNECTION FAILED"
        )

        print(
            f"Reason: {error}"
        )

        return False

    except Exception as error:

        print(
            "\n❌ MongoDB UNKNOWN ERROR"
        )

        print(
            f"Reason: {error}"
        )

        return False


# =====================================================
# STARTUP CONNECTION TEST
# =====================================================

if check_mongodb_connection():

    print(
        "✅ MongoDB Connected Successfully"
    )

    print(
        "📦 Database: NexusDSAI"
    )

    print(
        "📁 Collections: datasets, users"
    )

else:

    print(
        "\n⚠️ MongoDB is currently unavailable."
    )

    print(
        "⚠️ Check MONGO_URL, MongoDB Atlas network access,"
        " and internet/DNS connection."
    )
    print("📊 DATASET COUNT:", datasets_collection.count_documents({}))