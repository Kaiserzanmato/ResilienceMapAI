"""Which IP a request is attributed to, and that per-IP limits cannot be dodged
by sending an extra X-Forwarded-For entry. Proxies append to the header, so the
client's own entries sit to the LEFT of the real address."""
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from starlette.datastructures import Headers

from app.client_ip import client_ip
from app.config import get_settings
from app.main import app
from app.services import usage_quota

POINT = {"lat": 14.93, "lng": 120.85}


def _req(forwarded=None, peer="10.0.0.9", header="x-forwarded-for"):
    raw = [(header.encode(), forwarded.encode())] if forwarded is not None else []
    return SimpleNamespace(headers=Headers(raw=raw), client=SimpleNamespace(host=peer) if peer else None)


@pytest.fixture
def behind_proxy(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "client_ip_header", "x-forwarded-for")
    monkeypatch.setattr(settings, "client_ip_trusted_hops", 1)
    return settings


# ---------------------------------------------------------- the helper

def test_without_a_configured_header_the_socket_peer_is_used(monkeypatch):
    monkeypatch.setattr(get_settings(), "client_ip_header", "")
    assert client_ip(_req("198.51.100.1")) == "10.0.0.9"      # a header nobody trusts is ignored
    assert client_ip(_req(peer=None)) == "unknown"


def test_the_forwarded_address_is_used_when_the_header_is_configured(behind_proxy):
    assert client_ip(_req("198.51.100.1")) == "198.51.100.1"  # single entry: also the first entry
    assert client_ip(_req("2001:db8:0:0::1")) == "2001:db8::1"  # normalised, so one client has one key


def test_missing_empty_or_malformed_header_falls_back_to_the_peer(behind_proxy):
    for value in (None, "", " , ", "not-an-ip", "198.51.100.1:443", "unknown"):
        assert client_ip(_req(value)) == "10.0.0.9", value


def test_a_spoofed_prefix_is_ignored_because_the_proxy_appends_the_real_address(behind_proxy):
    # client sent "X-Forwarded-For: 6.6.6.6"; the proxy appended the address it saw
    assert client_ip(_req("6.6.6.6, 198.51.100.1")) == "198.51.100.1"
    assert client_ip(_req("6.6.6.6, 7.7.7.7, 8.8.8.8, 198.51.100.1")) == "198.51.100.1"


def test_trusted_hops_counts_proxies_from_the_right(behind_proxy):
    behind_proxy.client_ip_trusted_hops = 2     # e.g. CDN then load balancer
    assert client_ip(_req("6.6.6.6, 198.51.100.1, 172.16.0.4")) == "198.51.100.1"
    assert client_ip(_req("198.51.100.1")) == "10.0.0.9"      # fewer entries than trusted proxies: do not trust


# ------------------------------------------------ usage quota, end to end

def test_usage_quota_is_separate_per_forwarded_ip_and_a_spoofed_entry_cannot_reset_it(behind_proxy):
    client = TestClient(app, client=("203.0.113.20", 50000))
    for _ in range(get_settings().insights_quota_limit):
        usage_quota.consume("insights", usage_quota.client_key(_req("198.51.100.1")))

    def remaining(forwarded):
        return client.get("/api/usage-status", headers={"x-forwarded-for": forwarded}).json()["insights"]["remaining"]

    assert remaining("198.51.100.1") == 0                           # used up
    assert remaining("198.51.100.2") == get_settings().insights_quota_limit   # a different visitor is untouched
    assert remaining("1.2.3.4, 198.51.100.1") == 0                  # fake extra entry: still the same visitor
    assert remaining("9.9.9.9, 8.8.8.8, 198.51.100.1") == 0


# --------------------------------------------- flood flags, end to end

def test_flood_limits_are_separate_per_forwarded_ip_and_a_spoofed_entry_cannot_bypass_them(flood_enabled, behind_proxy):
    client = TestClient(app, client=("203.0.113.21", 50000))
    post = lambda forwarded: client.post("/api/flood/flags", json=POINT, headers={"x-forwarded-for": forwarded})

    for i in range(3):                                             # visitor A uses the 3 flags, each time with a new fake prefix
        assert post(f"10.9.9.{i}, 198.51.100.1").status_code == 202
    assert post("198.51.100.1").status_code == 429                 # A, no spoof
    assert post("5.5.5.5, 198.51.100.1").status_code == 429        # A with yet another fake prefix: not a bypass
    assert post("5.5.5.5, 6.6.6.6, 198.51.100.1").status_code == 429
    assert post("198.51.100.2").status_code == 202                 # visitor B has its own budget
    assert post("1.1.1.1, 198.51.100.2").status_code == 202        # B with a spoofed prefix is still B (2 of 3 used)
    assert post("2.2.2.2, 198.51.100.2").status_code == 202
    assert post("3.3.3.3, 198.51.100.2").status_code == 429        # and B is now at its limit too
