"""
CHC Intake API — Cloud Function (Gen2)
Mirrors wade.digital contact-form pattern:
  form submit → validate → Firestore → Discord webhook

Deployed to: us-central1, GCP project chc-260226-27954
"""
import functions_framework
import re
import json
import os
import sys
import urllib.request
from flask import jsonify
from google.cloud import firestore
from datetime import datetime, timezone

ALLOWED_ORIGINS = [
    "https://certaintyhomeconsulting.com",
    "https://www.certaintyhomeconsulting.com",
    "http://localhost:8080",  # dev
]

# Set via Secret Manager or env var at deploy time
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")


def _cors_headers(origin):
    if origin in ALLOWED_ORIGINS:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "3600",
        }
    return {}


def _validate_lead(data):
    """Validate against lead-intake-v1 contract."""
    errors = []
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    project = (data.get("project") or "").strip()
    stress = (data.get("stress") or "").strip()

    if not name:
        errors.append("Name is required")
    if not email or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        errors.append("Valid email is required")
    if not project:
        errors.append("Project description is required")
    if not stress:
        errors.append("Stress/concern field is required")

    return errors


def _notify_discord(lead):
    """Post lead notification to CHC Discord channel."""
    if not DISCORD_WEBHOOK_URL:
        print("DISCORD_WEBHOOK_URL not set, skipping notification", file=sys.stderr, flush=True)
        return

    try:
        fields = [
            {"name": "Name", "value": lead["name"], "inline": True},
            {"name": "Email", "value": lead["email"], "inline": True},
        ]
        if lead.get("phone"):
            fields.append({"name": "Phone", "value": lead["phone"], "inline": True})
        fields.append({"name": "Project", "value": lead["project"][:1024]})
        fields.append({"name": "What's Stressing Them", "value": lead["stress"][:1024]})
        if lead.get("timeline"):
            fields.append({"name": "Timeline", "value": lead["timeline"], "inline": True})

        embed = {
            "title": "\U0001f3e0 New CHC Lead",
            "color": 0x2D5016,  # CHC green
            "fields": fields,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "footer": {"text": "certaintyhomeconsulting.com intake form"},
        }
        payload = json.dumps({"embeds": [embed]}).encode("utf-8")
        req = urllib.request.Request(
            DISCORD_WEBHOOK_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        resp = urllib.request.urlopen(req, timeout=10)
        print(f"Discord webhook OK: status={resp.status}", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"Discord webhook FAILED: {e}", file=sys.stderr, flush=True)


@functions_framework.http
def intake(request):
    origin = request.headers.get("Origin", "")
    headers = _cors_headers(origin)

    if request.method == "OPTIONS":
        return ("", 204, headers)

    if request.method != "POST":
        return (jsonify({"error": "Method not allowed"}), 405, headers)

    try:
        data = request.get_json(silent=True) or {}
    except Exception:
        return (jsonify({"error": "Invalid JSON"}), 400, headers)

    # Normalize
    lead = {
        "name": (data.get("name") or "").strip(),
        "email": (data.get("email") or "").strip(),
        "phone": (data.get("phone") or "").strip(),
        "project": (data.get("project") or "").strip(),
        "timeline": (data.get("timeline") or "").strip(),
        "stress": (data.get("stress") or "").strip(),
        "feedback_consent": data.get("feedback_consent", ""),
        "source": data.get("source", "chc-site"),
    }

    print(f"CHC intake: name={lead['name']!r} email={lead['email']!r}", file=sys.stderr, flush=True)

    # Validate
    errors = _validate_lead(lead)
    if errors:
        return (jsonify({"error": "; ".join(errors)}), 400, headers)

    # Write to Firestore
    db = firestore.Client()
    lead["timestamp"] = datetime.now(timezone.utc)
    db.collection("leads").add(lead)
    print("Firestore write OK", file=sys.stderr, flush=True)

    # Notify Discord
    _notify_discord(lead)

    return (jsonify({"success": True}), 200, headers)
