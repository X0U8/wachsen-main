import os
import sys
import json
import tempfile
import base64
from pathlib import Path
from google.cloud import texttospeech
from google.cloud import speech_v1 as speech
from genblaze_core import ObjectStorageSink, KeyStrategy, Pipeline, Asset, Modality
from genblaze_s3 import S3StorageBackend
from google.oauth2 import service_account

def get_gcp_credentials():
    """
    Load GCP credentials from environment variable GOOGLE_SERVICE_ACCOUNT_JSON.
    """
    gcp_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    if gcp_json:
        try:
            info = json.loads(gcp_json)
            if "private_key" in info:
                info["private_key"] = info["private_key"].replace("\\n", "\n")
            return service_account.Credentials.from_service_account_info(info)
        except Exception as e:
            print(f"Error loading credentials from GOOGLE_SERVICE_ACCOUNT_JSON: {e}", file=sys.stderr)
    return None

def get_google_tts_client():
    """
    Load Google Cloud TTS client dynamically.
    """
    credentials = get_gcp_credentials()
    if credentials:
        return texttospeech.TextToSpeechClient(credentials=credentials)  # type: ignore
    return texttospeech.TextToSpeechClient()

def get_proxy_url(b2_url, bucket_name):
    """
    Convert raw S3 URL to your local authenticated B2 proxy URL.
    Example: https://s3.us-east-005.backblazeb2.com/Wachsen/genblaze/assets/file.mp3
             -> /api/upload-to-b2?path=genblaze/assets/file.mp3
    """
    token = f"/{bucket_name}/"
    if token in b2_url:
        path = b2_url.split(token, 1)[1]
        return f"/api/upload-to-b2?path={path}"
    return b2_url

def handle_generate_tts(text, userId, examId, index, storage, bucket_name, gender="female"):
    """
    Generate professional TTS audio for a question or feedback and upload it via Genblaze.
    """
    client = get_google_tts_client()
    synthesis_input = texttospeech.SynthesisInput(text=text)

    # Use premium Chirp3 HD voices
    voice_name = "en-US-Chirp3-HD-Achernar" # Friendly US Female Voice
    if gender == "male":
        voice_name = "en-US-Chirp3-HD-Algenib"  # Friendly US Male Voice

    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US",
        name=voice_name
    )
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3,
        speaking_rate=0.88 # 12% slower, highly understandable for oral exams (default is 1.0)
    )

    response = client.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )
    audio_content = response.audio_content

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
        tmp.write(audio_content)
        tmp_path = tmp.name

    try:
        remote_prefix = f"viva/{userId}/{examId}"
        asset_uri = Path(tmp_path).as_uri()
        asset = Asset(url=asset_uri, media_type="audio/mp3")

        result = Pipeline.ingest(
            assets=[asset],
            source="google-cloud-tts",
            sink=storage,
            name=f"viva-tts-q-{index}"
        )

        b2_url = result.run.steps[0].assets[0].url
        proxy_url = get_proxy_url(b2_url, bucket_name)
        manifest_url = result.manifest.manifest_uri

        return {
            "success": True,
            "url": proxy_url,
            "manifestUrl": manifest_url
        }
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def transcribe_audio_content(audio_bytes, retries=3, backoff=2):
    """
    Transcribe raw webm/opus audio using Google Cloud Speech-to-Text v1.
    Audio is capped at 55s so synchronous recognize() is used.
    Retries up to `retries` times with exponential backoff on transient errors.
    """
    import time

    credentials = get_gcp_credentials()
    if credentials:
        client = speech.SpeechClient(credentials=credentials)  # type: ignore
    else:
        client = speech.SpeechClient()

    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
        language_code="en-US",
        enable_automatic_punctuation=True
    )
    audio = speech.RecognitionAudio(content=audio_bytes)

    last_error = None
    for attempt in range(1, retries + 1):
        try:
            operation = client.long_running_recognize(config=config, audio=audio)
            response = operation.result(timeout=300)  # wait up to 5 minutes

            transcript = ""
            for result in response.results:
                transcript += result.alternatives[0].transcript + " "
            return transcript.strip()
        except Exception as e:
            last_error = e
            print(f"[STT] Attempt {attempt}/{retries} failed: {type(e).__name__}: {e}", file=sys.stderr)
            if attempt < retries:
                wait = backoff ** attempt
                print(f"[STT] Retrying in {wait}s...", file=sys.stderr)
                time.sleep(wait)

    print(f"[STT] All {retries} attempts failed. Last error: {last_error}", file=sys.stderr)
    return ""

def handle_upload_audio(audio_base64, userId, examId, index, storage, bucket_name):
    """
    Upload the user's recorded audio response via the Genblaze pipeline and transcribe it.
    Transcription and upload are independent — a transcription failure logs clearly
    but does not prevent the audio URL from being saved.
    """
    audio_bytes = base64.b64decode(audio_base64)

    # Transcribe via Google Cloud STT (with retry)
    transcript = transcribe_audio_content(audio_bytes)
    if not transcript:
        print(f"[STT] Warning: transcript is empty for question index {index}. Audio URL will still be saved.", file=sys.stderr)

    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        asset_uri = Path(tmp_path).as_uri()
        asset = Asset(url=asset_uri, media_type="audio/webm")

        result = Pipeline.ingest(
            assets=[asset],
            source="user-viva-recording",
            sink=storage,
            name=f"user-viva-a-{index}"
        )

        b2_url = result.run.steps[0].assets[0].url
        proxy_url = get_proxy_url(b2_url, bucket_name)
        manifest_url = result.manifest.manifest_uri

        return {
            "success": True,
            "url": proxy_url,
            "manifestUrl": manifest_url,
            "transcript": transcript
        }
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def main():
    try:
        # Read request payload from Express standard input
        input_data = json.loads(sys.stdin.read())
        body = input_data.get("body", {})
        
        action = body.get("action")
        userId = body.get("userId")
        examId = body.get("examId")
        index = body.get("index", 0)

        if not action or not userId or not examId:
            print(json.dumps({"status": 400, "body": {"error": "Missing action, userId, or examId."}}))
            return

        # Fetch environment configs
        b2_key_id = os.getenv("B2_KEY_ID")
        b2_app_key = os.getenv("B2_APPLICATION_KEY")
        b2_bucket_name = os.getenv("B2_BUCKET_NAME")

        if not b2_key_id or not b2_app_key or not b2_bucket_name:
            print(json.dumps({"status": 500, "body": {"error": "Backblaze B2 credentials missing in environment."}}))
            return

        # Initialize Genblaze S3 backend pointing to us-east-005 (where the bucket resides)
        backend = S3StorageBackend.for_backblaze(
            bucket=b2_bucket_name,
            key_id=b2_key_id,
            app_key=b2_app_key,
            region="us-east-005"
        )
        storage = ObjectStorageSink(backend, key_strategy=KeyStrategy.HIERARCHICAL)

        if action == "generate_tts":
            text = body.get("text")
            gender = body.get("gender", "female")
            if not text:
                print(json.dumps({"status": 400, "body": {"error": "Missing text parameter."}}))
                return
            result = handle_generate_tts(text, userId, examId, index, storage, b2_bucket_name, gender)
            print(json.dumps({"status": 200, "body": result}))

        elif action == "upload_audio":
            audio_base64 = body.get("audioBase64")
            if not audio_base64:
                print(json.dumps({"status": 400, "body": {"error": "Missing audioBase64 data."}}))
                return
            result = handle_upload_audio(audio_base64, userId, examId, index, storage, b2_bucket_name)
            print(json.dumps({"status": 200, "body": result}))

        else:
            print(json.dumps({"status": 400, "body": {"error": f"Invalid action: {action}"}}))

    except Exception as e:
        print(json.dumps({"status": 500, "body": {"error": str(e)}}))

if __name__ == "__main__":
    main()
