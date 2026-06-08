import json
from pathlib import Path


EXPECTED_SOURCE_PACKAGES = [
    "data/sites/jwc/index",
    "data/sites/xsc/index",
    "data/sites/cxcy/index",
    "data/sites/lib/index",
    "data/sites/xxb/index",
    "data/sites/www/index",
    "data/sites/job91/index",
    "data/sites/tyb/index",
    "data/sites/bwc/index",
    "data/sites/fwlc/index",
    "data/sites/gzzd/index",
    "data/sites/xxgk/index",
    "data/sites/cs/index",
    "data/sites/scie/index",
    "data/sites/bhs/index",
]


def read_json(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def test_collection_config_and_sitegraph_lock_use_full_source_registry():
    collection = read_json("config/collections/njupt-public.sitegraph.json")
    lock = read_json("config/data-locks/sitegraph.lock.json")

    assert collection["source_packages"] == EXPECTED_SOURCE_PACKAGES
    assert lock["source_packages"] == EXPECTED_SOURCE_PACKAGES
