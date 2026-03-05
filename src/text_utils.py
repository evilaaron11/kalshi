"""Text processing utilities for web scraping and query matching."""

from html.parser import HTMLParser


def strip_html(text: str) -> str:
    """Remove HTML tags from a string."""
    try:
        class Stripper(HTMLParser):
            def __init__(self):
                super().__init__()
                self.parts = []
            def handle_data(self, data):
                self.parts.append(data)

        s = Stripper()
        s.feed(text)
        return " ".join(s.parts).strip()
    except Exception:
        return text


def matches_query(text: str, query: str) -> bool:
    """Return True if text is relevant to query.

    Matches if: query is empty, exact substring match, or 2+ significant
    words (len > 3) from query appear in text.
    """
    if not query:
        return True
    text_lower = text.lower()
    query_lower = query.lower()
    if query_lower in text_lower:
        return True
    words = [w for w in query_lower.split() if len(w) > 3]
    if not words:
        return query_lower in text_lower
    if len(words) == 1:
        return words[0] in text_lower
    return sum(1 for w in words if w in text_lower) >= 2
