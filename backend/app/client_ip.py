"""One place that decides which IP a request is attributed to.

With no CLIENT_IP_HEADER configured this is the socket peer, as before. Behind
a reverse proxy (Render) the peer is the proxy, so every visitor would share one
bucket; set CLIENT_IP_HEADER=x-forwarded-for to use the forwarded address.

Which entry of X-Forwarded-For to trust matters. Proxies APPEND the address they
saw to whatever the client already sent, so with a client-supplied
`X-Forwarded-For: 1.2.3.4` the header arrives as `1.2.3.4, <real client>`. Taking
the *first* entry would let any client pick its own identity and dodge every
per-IP limit. So the entry is counted from the right: CLIENT_IP_TRUSTED_HOPS
(default 1) is how many proxies you trust to append one. With one trusted proxy
and a client that sent no header of its own, that entry is also the first one;
with a spoofed prefix it is still the real client. Only set a header when the
service is actually behind that proxy: a direct caller controls the whole value.
"""
from __future__ import annotations

import ipaddress

from fastapi import Request

from .config import get_settings


def client_ip(request: Request) -> str:
    settings = get_settings()
    peer = request.client.host if request.client else "unknown"
    header = settings.client_ip_header
    if not header:
        return peer
    raw = request.headers.get(header)
    if not raw:
        return peer
    entries = [part.strip() for part in raw.split(",") if part.strip()]
    hops = max(1, settings.client_ip_trusted_hops)
    if len(entries) < hops:
        return peer  # fewer proxies than expected: do not trust the header
    try:
        return str(ipaddress.ip_address(entries[-hops]))
    except ValueError:
        return peer  # not an IP address: ignore rather than key a bucket on junk
