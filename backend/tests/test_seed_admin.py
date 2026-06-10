"""Tests for the seed_admin() reconciliation logic.

Covers:
  1. Legacy admin@ + non-admin adrian@ exist together -> promote adrian, delete legacy
  2. Only adrian exists with role=user -> promote to admin
  3. Only adrian exists as admin -> no-op (idempotent)
  4. Only legacy admin@ exists -> rename to adrian@
  5. Neither exists -> seed fresh adrian@ admin
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")

TEST_DB = "affilitube_seed_test_db"


def _make_user(email, role, tier="free"):
    return {
        "id": str(uuid.uuid4()),
        "email": email,
        "password_hash": "$2b$12$dummy",
        "role": role,
        "tier": tier,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


async def _setup_and_run(seed_users):
    import server
    test_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    test_db = test_client[TEST_DB]
    original_db = server.db
    server.db = test_db
    try:
        await test_db.users.delete_many({})
        if seed_users:
            await test_db.users.insert_many(seed_users)
        await server.seed_admin()
        legacy = await test_db.users.find_one({"email": "admin@affilitube.com"})
        adrian = await test_db.users.find_one({"email": "adrian@affilitube.com"})
        count_total = await test_db.users.count_documents({"email": {"$in": ["admin@affilitube.com", "adrian@affilitube.com"]}})
        return {"legacy": legacy, "adrian": adrian, "total": count_total}
    finally:
        await test_db.users.delete_many({})
        server.db = original_db
        test_client.close()


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.new_event_loop().run_until_complete(coro)


def test_both_exist_promotes_adrian_and_deletes_legacy():
    result = run(_setup_and_run([
        _make_user("admin@affilitube.com", "admin", "pro"),
        _make_user("adrian@affilitube.com", "user", "free"),
    ]))
    assert result["legacy"] is None
    assert result["adrian"] is not None
    assert result["adrian"]["role"] == "admin"
    assert result["adrian"]["tier"] == "pro"


def test_only_adrian_as_user_gets_promoted():
    result = run(_setup_and_run([
        _make_user("adrian@affilitube.com", "user", "free"),
    ]))
    assert result["adrian"]["role"] == "admin"
    assert result["adrian"]["tier"] == "pro"


def test_only_adrian_already_admin_is_idempotent():
    async def double_run():
        import server
        test_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        test_db = test_client[TEST_DB]
        original_db = server.db
        server.db = test_db
        try:
            await test_db.users.delete_many({})
            await test_db.users.insert_one(_make_user("adrian@affilitube.com", "admin", "pro"))
            await server.seed_admin()
            await server.seed_admin()
            count = await test_db.users.count_documents({"email": "adrian@affilitube.com"})
            adrian = await test_db.users.find_one({"email": "adrian@affilitube.com"})
            return count, adrian
        finally:
            await test_db.users.delete_many({})
            server.db = original_db
            test_client.close()
    count, adrian = run(double_run())
    assert count == 1
    assert adrian["role"] == "admin"


def test_only_legacy_admin_gets_renamed():
    result = run(_setup_and_run([
        _make_user("admin@affilitube.com", "admin", "pro"),
    ]))
    assert result["legacy"] is None
    assert result["adrian"] is not None
    assert result["adrian"]["role"] == "admin"


def test_neither_exist_seeds_fresh():
    result = run(_setup_and_run([]))
    assert result["adrian"] is not None
    assert result["adrian"]["role"] == "admin"
    assert result["adrian"]["tier"] == "pro"
