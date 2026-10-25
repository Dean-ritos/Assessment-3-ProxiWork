import base64
import json
import os

import httpx
from fastapi import FastAPI, File, Header, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

app = FastAPI(title="ProxiWork API")

# Vite's local development server is permitted. Production requests are same-origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_CV_SIZE_BYTES = 5 * 1024 * 1024
ACCEPTED_CV_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


class ExtractedProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: str = ""
    last_name: str = ""
    phone: str = ""
    suburb: str = ""
    state: str = ""
    postcode: str = ""


class ExtractedExperience(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company_name: str = ""
    position_title: str = ""
    start_date: str = ""
    end_date: str | None = None
    is_current: bool = False
    description: str | None = None


class ExtractedEducation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    certification_level: str = ""
    course_name: str = ""
    institution: str = ""
    start_date: str | None = None
    end_date: str | None = None
    is_currently_studying: bool = False


class CvExtraction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile: ExtractedProfile
    skills: list[str] = Field(default_factory=list)
    experiences: list[ExtractedExperience] = Field(default_factory=list)
    education: list[ExtractedEducation] = Field(default_factory=list)


def make_strict_schema(value: object) -> object:
    """Adapt Pydantic's schema to the strict Structured Outputs subset."""
    if isinstance(value, list):
        return [make_strict_schema(item) for item in value]
    if not isinstance(value, dict):
        return value

    strict_value = {
        key: make_strict_schema(item)
        for key, item in value.items()
        if key != "default"
    }
    properties = strict_value.get("properties")
    if isinstance(properties, dict):
        strict_value["additionalProperties"] = False
        strict_value["required"] = list(properties)
    return strict_value


CV_EXTRACTION_SCHEMA = make_strict_schema(CvExtraction.model_json_schema())


async def verify_supabase_access_token(access_token: str) -> None:
    """Reject CV extraction requests that do not come from a signed-in user."""
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    if not supabase_url or not supabase_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CV extraction is not configured on the server.",
        )

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{supabase_url.rstrip('/')}/auth/v1/user",
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {access_token}",
                },
            )
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to verify your sign-in session. Please try again.",
        ) from error

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your sign-in session has expired. Please sign in again.",
        )


async def extract_cv_details(
    *, filename: str, content_type: str, file_bytes: bytes
) -> CvExtraction:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CV extraction is not configured on the server.",
        )

    encoded_file = base64.b64encode(file_bytes).decode("ascii")
    payload = {
        "model": os.environ.get("OPENAI_CV_EXTRACTION_MODEL", "gpt-4.1-mini"),
        "input": [
            {
                "role": "developer",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "Extract only details explicitly supported by the candidate CV. "
                            "Return blank strings or null for unavailable values; never infer or "
                            "invent details. Dates must be YYYY-MM-DD when a month is known, using "
                            "the first day of that month. Use an empty string when a work start date "
                            "is unknown. Keep descriptions concise and factual. Australian state values "
                            "should use their standard abbreviation when present in the CV."
                        ),
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_file",
                        "filename": filename,
                        "file_data": encoded_file,
                    },
                    {
                        "type": "input_text",
                        "text": "Extract profile suggestions from this CV for the candidate to review.",
                    },
                ],
            },
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "cv_profile_suggestions",
                "strict": True,
                "schema": CV_EXTRACTION_SCHEMA,
            }
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CV extraction is temporarily unavailable. Please try again.",
        ) from error

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="CV extraction could not be completed. You can still enter your details manually.",
        )

    response_data = response.json()
    output_text = response_data.get("output_text")
    if not isinstance(output_text, str):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="CV extraction returned an invalid response. Please enter your details manually.",
        )

    try:
        return CvExtraction.model_validate(json.loads(output_text))
    except (json.JSONDecodeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="CV extraction returned invalid suggestions. Please enter your details manually.",
        ) from error


@app.get("/api/health")
def health() -> dict[str, str]:
    """Return a stable health contract for local and Vercel checks."""
    return {"status": "ok"}


@app.post("/api/cv/extract", response_model=CvExtraction)
async def extract_cv(
    file: UploadFile | None = File(default=None),
    authorization: str | None = Header(default=None),
) -> CvExtraction:
    """Return unpersisted CV suggestions for an authenticated profile editor."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in before extracting CV details.",
        )
    if file is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Choose a CV file to extract.",
        )
    if file.content_type not in ACCEPTED_CV_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Choose a PDF or DOCX file.",
        )

    file_bytes = await file.read(MAX_CV_SIZE_BYTES + 1)
    if len(file_bytes) > MAX_CV_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Your CV must be 5 MB or smaller.",
        )
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The selected CV is empty.",
        )

    await verify_supabase_access_token(authorization.removeprefix("Bearer "))
    return await extract_cv_details(
        filename=file.filename or "cv",
        content_type=file.content_type,
        file_bytes=file_bytes,
    )