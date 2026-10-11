from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta, timezone
from database.mongodb import users_collection, datasets_collection
from bson import ObjectId
from email.message import EmailMessage
import hashlib
import hmac
import os
import secrets
import smtplib
import ssl
import requests
import html
import bcrypt
import jwt
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)

# IMPORTANT: keep this value permanent in backend/.env.
# Do NOT generate a random JWT secret on every backend restart, otherwise
# every existing token becomes invalid after a restart.
JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
if not JWT_SECRET:
    raise RuntimeError(
        "JWT_SECRET is missing. Add a permanent JWT_SECRET value to your backend .env file."
    )

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))

# Email / OTP configuration.
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USER).strip()
APP_NAME = os.getenv("APP_NAME", "NexusDS AI").strip() or "NexusDS AI"
OTP_EXPIRE_MINUTES = int(os.getenv("OTP_EXPIRE_MINUTES", "10"))
OTP_RESEND_SECONDS = int(os.getenv("OTP_RESEND_SECONDS", "60"))
OTP_MAX_ATTEMPTS = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))
OTP_SECRET = os.getenv("OTP_SECRET", JWT_SECRET).strip()


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp: str


class ResendOTPRequest(BaseModel):
    email: EmailStr


def utc_now():
    return datetime.now(timezone.utc)


def public_user(document):
    return {
        "id": str(document["_id"]),
        "name": document.get("name", ""),
        "email": document.get("email", ""),
        "emailVerified": document.get("emailVerified", True),
    }


def create_token(user_id):
    now = utc_now()
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Authentication required.")

    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("Missing subject")
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None

    if not user:
        raise HTTPException(status_code=401, detail="User account not found.")

    return user


def hash_otp(otp: str, salt: str):
    raw = f"{salt}:{otp}:{OTP_SECRET}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def generate_otp():
    return f"{secrets.randbelow(1_000_000):06d}"


def send_verification_email(email: str, name: str, otp: str):
    if not SMTP_USER or not SMTP_PASSWORD or not FROM_EMAIL:
        raise RuntimeError(
            "Email service is not configured. Set SMTP_USER, SMTP_PASSWORD and FROM_EMAIL in .env."
        )

    message = EmailMessage()
    message["Subject"] = f"{APP_NAME} - Email verification code"
    message["From"] = FROM_EMAIL
    message["To"] = email
    message.set_content(
        f"Hello {name},\n\n"
        f"Your {APP_NAME} email verification code is: {otp}\n\n"
        f"This code expires in {OTP_EXPIRE_MINUTES} minutes.\n"
        "If you did not request this, you can safely ignore this email.\n\n"
        f"Regards,\n{APP_NAME}"
    )
    message.add_alternative(
        f"""
        <html>
          <body style="margin:0;background:#020617;font-family:Arial,sans-serif;color:#e2e8f0;">
            <div style="max-width:560px;margin:40px auto;padding:32px;background:#0f172a;border:1px solid #1e293b;border-radius:18px;">
              <h2 style="margin:0 0 10px;color:#67e8f9;">{APP_NAME}</h2>
              <p style="color:#cbd5e1;">Hello {name},</p>
              <p style="color:#94a3b8;">Use the verification code below to verify your email address.</p>
              <div style="margin:28px 0;padding:18px;text-align:center;background:#020617;border:1px solid #164e63;border-radius:14px;">
                <span style="font-size:34px;letter-spacing:10px;font-weight:800;color:#67e8f9;">{otp}</span>
              </div>
              <p style="font-size:13px;color:#64748b;">This code expires in {OTP_EXPIRE_MINUTES} minutes.</p>
              <p style="font-size:13px;color:#64748b;">If you did not request this, you can safely ignore this email.</p>
            </div>
          </body>
        </html>
        """,
        subtype="html",
    )

    context = ssl.create_default_context()
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
        server.starttls(context=context)
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(message)


def issue_otp(document_id, email, name, existing_document=None):
    otp = generate_otp()
    salt = secrets.token_urlsafe(16)
    now = utc_now()

    users_collection.update_one(
        {"_id": document_id},
        {
            "$set": {
                "emailVerified": False,
                "emailVerification.otpHash": hash_otp(otp, salt),
                "emailVerification.otpSalt": salt,
                "emailVerification.expiresAt": now + timedelta(minutes=OTP_EXPIRE_MINUTES),
                "emailVerification.lastSentAt": now,
                "emailVerification.attempts": 0,
            }
        },
    )

def send_verification_email(email: str, name: str, otp: str):
    api_key = os.getenv("RESEND_API_KEY", "").strip()
    sender = os.getenv("RESEND_FROM_EMAIL", "").strip()

    if not api_key:
        raise RuntimeError("RESEND_API_KEY is missing in Render Environment.")

    if not sender:
        raise RuntimeError(
            "RESEND_FROM_EMAIL is missing. Set a verified sender in Resend."
        )

    safe_name = html.escape(name)
    safe_app_name = html.escape(APP_NAME)

    payload = {
        "from": f"{safe_app_name} <{sender}>",
        "to": [email],
        "subject": f"{APP_NAME} - Email verification code",
        "html": f"""
            <div style="font-family:Arial,sans-serif;padding:24px">
                <h2>{safe_app_name}</h2>
                <p>Hello {safe_name},</p>
                <p>Your email verification code is:</p>
                <h1 style="letter-spacing:8px">{otp}</h1>
                <p>This code expires in {OTP_EXPIRE_MINUTES} minutes.</p>
                <p>If you did not request this, ignore this email.</p>
            </div>
        """,
    }

    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=20,
        )
    except requests.RequestException as error:
        raise RuntimeError(f"Resend connection failed: {error}") from error

    if not response.ok:
        raise RuntimeError(
            f"Resend API returned {response.status_code}: {response.text}"
        )



@router.post("/register")
def register(data: RegisterRequest):
    name = data.name.strip()
    email = str(data.email).strip().lower()
    password = data.password

    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Please enter a valid name.")

    if len(password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 6 characters.",
        )

    existing = users_collection.find_one({"email": email})
    if existing:
        # Allow an unfinished registration to request a fresh OTP instead of
        # forcing the user to create another email/account.
        if existing.get("emailVerified", True) is False:
            verification = existing.get("emailVerification") or {}
            last_sent = verification.get("lastSentAt")
            if last_sent:
                if last_sent.tzinfo is None:
                    last_sent = last_sent.replace(tzinfo=timezone.utc)
                elapsed = (utc_now() - last_sent).total_seconds()
                if elapsed < OTP_RESEND_SECONDS:
                    remaining = max(1, int(OTP_RESEND_SECONDS - elapsed))
                    raise HTTPException(
                        status_code=429,
                        detail=f"Please wait {remaining} seconds before requesting another code.",
                    )

            password_hash = bcrypt.hashpw(
                password.encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8")
            users_collection.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "name": name,
                        "passwordHash": password_hash,
                    }
                },
            )
            try:
                issue_otp(existing["_id"], email, name, existing_document=existing)
            except Exception as error:
                raise HTTPException(
                    status_code=503,
                    detail=f"Unable to send verification email: {error}",
                )

            return {
                "success": True,
                "verificationRequired": True,
                "message": "A new verification code has been sent to your email.",
            }

        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")

    document = {
        "name": name,
        "email": email,
        "passwordHash": password_hash,
        "emailVerified": False,
        "emailVerification": {},
        "createdAt": utc_now(),
    }

    result = users_collection.insert_one(document)

    try:
        issue_otp(result.inserted_id, email, name)
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail=f"Unable to send verification email: {error}",
        )

    return {
        "success": True,
        "verificationRequired": True,
        "message": "Account created. A verification code has been sent to your email.",
    }


@router.post("/verify-email")
def verify_email(data: VerifyEmailRequest):
    email = str(data.email).strip().lower()
    otp = data.otp.strip()

    if not otp.isdigit() or len(otp) != 6:
        raise HTTPException(status_code=400, detail="Please enter the 6-digit verification code.")

    user = users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")

    if user.get("emailVerified", True) is True:
        return {"success": True, "message": "Email is already verified."}

    verification = user.get("emailVerification") or {}
    expires_at = verification.get("expiresAt")
    if not expires_at:
        raise HTTPException(status_code=400, detail="Verification code is missing. Please request a new code.")

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if utc_now() >= expires_at:
        raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new code.")

    salt = verification.get("otpSalt", "")
    stored_hash = verification.get("otpHash", "")
    attempts = int(verification.get("attempts", 0) or 0)

    if attempts >= OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many incorrect attempts. Please request a new code.")

    candidate_hash = hash_otp(otp, salt)
    if not hmac.compare_digest(candidate_hash, stored_hash):
        attempts += 1
        update = {"$set": {"emailVerification.attempts": attempts}}
        if attempts >= OTP_MAX_ATTEMPTS:
            update["$unset"] = {
                "emailVerification.otpHash": "",
                "emailVerification.otpSalt": "",
                "emailVerification.expiresAt": "",
            }
        users_collection.update_one({"_id": user["_id"]}, update)
        remaining = max(0, OTP_MAX_ATTEMPTS - attempts)
        suffix = f" {remaining} attempts remaining." if remaining else " Please request a new code."
        raise HTTPException(status_code=400, detail="Invalid verification code." + suffix)

    users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "emailVerified": True,
                "emailVerifiedAt": utc_now(),
            },
            "$unset": {"emailVerification": ""},
        },
    )

    return {
        "success": True,
        "message": "Email verified successfully. You can now login.",
    }


@router.post("/resend-otp")
def resend_otp(data: ResendOTPRequest):
    email = str(data.email).strip().lower()
    user = users_collection.find_one({"email": email})

    if not user:
        # Do not reveal whether an email is registered.
        return {"success": True, "message": "If the account exists, a verification code has been sent."}

    if user.get("emailVerified", True) is True:
        raise HTTPException(status_code=400, detail="This email is already verified.")

    verification = user.get("emailVerification") or {}
    last_sent = verification.get("lastSentAt")
    if last_sent:
        if last_sent.tzinfo is None:
            last_sent = last_sent.replace(tzinfo=timezone.utc)
        elapsed = (utc_now() - last_sent).total_seconds()
        if elapsed < OTP_RESEND_SECONDS:
            remaining = max(1, int(OTP_RESEND_SECONDS - elapsed))
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {remaining} seconds before requesting another code.",
            )

    try:
        issue_otp(user["_id"], email, user.get("name", "there"), existing_document=user)
    except Exception as error:
        raise HTTPException(status_code=503, detail=f"Unable to send verification email: {error}")

    return {
        "success": True,
        "message": "A new verification code has been sent to your email.",
    }


@router.post("/login")
def login(data: LoginRequest):
    email = str(data.email).strip().lower()
    user = users_collection.find_one({"email": email})

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    # New accounts must verify their email first. Existing accounts created
    # before this feature have no emailVerified field and remain compatible.
    if user.get("emailVerified", True) is False:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email address with the OTP before logging in.",
        )

    password_hash = user.get("passwordHash") or user.get("password") or ""

    if not isinstance(password_hash, str):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    try:
        valid = bcrypt.checkpw(
            data.password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except Exception:
        valid = False

    if not valid:
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_token(user["_id"])

    return {
        "success": True,
        "message": "Login successful.",
        "token": token,
        "user": public_user(user),
    }


@router.get("/me")
def me(current_user=Depends(get_current_user)):
    return {
        "success": True,
        "user": public_user(current_user),
    }


@router.post("/claim-legacy-datasets")
def claim_legacy_datasets(current_user=Depends(get_current_user)):
    """
    One-time migration helper for datasets created before user isolation.
    It only claims documents that have no ownerId, so datasets already
    assigned to another account are never reassigned.
    """
    result = datasets_collection.update_many(
        {
            "$or": [
                {"ownerId": {"$exists": False}},
                {"ownerId": None},
                {"ownerId": ""},
            ]
        },
        {
            "$set": {
                "ownerId": str(current_user["_id"]),
                "ownerEmail": current_user.get("email", ""),
                "migratedAt": utc_now(),
            }
        },
    )

    return {
        "success": True,
        "claimed": int(result.modified_count),
        "message": (
            f"{int(result.modified_count)} legacy dataset(s) "
            "are now linked to your account."
        ),
    }
