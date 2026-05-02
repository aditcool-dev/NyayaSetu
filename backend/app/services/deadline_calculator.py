from datetime import datetime, timedelta
import re

def calculate_absolute_deadline(judgment_date_str: str, raw_deadline: str) -> datetime | None:
    if not raw_deadline:
        return None
    try:
        judgment_date = datetime.fromisoformat(judgment_date_str.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        judgment_date = datetime.utcnow()

    raw_lower = raw_deadline.lower()
    
    # Try to extract "X days", "X months", "X weeks"
    days_match = re.search(r'(\d+)\s*days?', raw_lower)
    weeks_match = re.search(r'(\d+)\s*weeks?', raw_lower)
    months_match = re.search(r'(\d+)\s*months?', raw_lower)
    
    if days_match:
        days = int(days_match.group(1))
        return judgment_date + timedelta(days=days)
    elif weeks_match:
        weeks = int(weeks_match.group(1))
        return judgment_date + timedelta(weeks=weeks)
    elif months_match:
        months = int(months_match.group(1))
        return judgment_date + timedelta(days=months * 30) # approximation
        
    # Default fallback to 30 days if unclear
    return judgment_date + timedelta(days=30)

def calculate_appeal_window(judgment_date_str: str) -> datetime:
    try:
        judgment_date = datetime.fromisoformat(judgment_date_str.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        judgment_date = datetime.utcnow()
    # Standard limitation period is 90 days
    return judgment_date + timedelta(days=90)
