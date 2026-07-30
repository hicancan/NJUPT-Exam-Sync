from pathlib import Path

from academics.room.catalog import (
    ROOM_CATALOG_FORMAT,
    load_room_catalog,
    parse_room_location,
)


CATALOG_PATH = Path("academics/room/catalog/njupt-room-catalog.json")


def test_sanpailou_special_buildings_are_deterministic() -> None:
    wireless_one = parse_room_location(campus="仙林", location="无一")
    wireless_six = parse_room_location(campus="仙林", location="无6")
    library_room_4 = parse_room_location(campus="仙林", location="图4")
    library_room_5 = parse_room_location(campus="仙林", location="图5")
    east = parse_room_location(campus="仙林", location="教东-201")
    west = parse_room_location(campus="仙林", location="教西-305")

    assert wireless_one is not None
    assert wireless_one.campus == "三牌楼"
    assert wireless_one.building == "无线楼"
    assert wireless_one.floor == "1"
    assert wireless_one.room == "无1"
    assert wireless_six is not None
    assert wireless_six.floor == "3"
    assert wireless_six.room == "无6"
    assert library_room_4 is not None
    assert library_room_4.campus == "三牌楼"
    assert library_room_4.building == "图科楼"
    assert library_room_4.floor == "1"
    assert library_room_5 is not None
    assert library_room_5.floor == "4"
    assert east is not None
    assert east.campus == "三牌楼"
    assert west is not None
    assert west.campus == "三牌楼"


def test_current_catalog_is_the_single_maintained_room_set() -> None:
    catalog = load_room_catalog(CATALOG_PATH)
    assert catalog.format == ROOM_CATALOG_FORMAT
    identities = {
        (room.campus, room.building, room.floor, room.room)
        for room in catalog.rooms_by_key.values()
    }
    assert len(identities) == 157
    assert ("三牌楼", "无线楼", "1", "无1") in identities
    assert ("三牌楼", "无线楼", "1", "无2") in identities
    assert ("三牌楼", "无线楼", "2", "无3") in identities
    assert ("三牌楼", "无线楼", "2", "无4") in identities
    assert ("三牌楼", "无线楼", "3", "无5") in identities
    assert ("三牌楼", "无线楼", "3", "无6") in identities
    assert ("三牌楼", "图科楼", "1", "图4") in identities
    assert ("三牌楼", "图科楼", "4", "图5") in identities
