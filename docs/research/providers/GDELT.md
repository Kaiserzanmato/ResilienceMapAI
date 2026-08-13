# GDELT

Official DOC 2 API introduction: https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/. Public query API returns article discovery results in JSON/RSS and supports time windows; it is not an authoritative hazard authority. Published results can be noisy and link to third-party publisher terms. Risks: false positives, duplicate/syndicated stories, unsafe text, dynamic availability and query injection. Recommendation: PROTOTYPE only: event-driven, backend-only queries with allowlisted output fields and quality/deduplication evaluation. Never create an event from a headline.
