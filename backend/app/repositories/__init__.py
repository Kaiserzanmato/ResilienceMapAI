"""Repository layer: each store has an in-memory implementation (the
existing MVP behavior, used when DATABASE_URL is unset) and a Postgres-backed
one, selected by the `get_*_repo()` factory in each module. This keeps the
existing test suite passing with zero DB dependency, and makes the swap to
real persistence a config change, not a code change, once a database is
provisioned (see the `marketplace` skill for provisioning Postgres via the
Vercel Marketplace)."""
