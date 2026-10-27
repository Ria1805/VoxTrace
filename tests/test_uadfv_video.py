from voxtrace.video_detector import _assign_splits, _group_of


def test_uadfv_paired_filenames_share_identity_group():
    assert _group_of("0000") == _group_of("0000_fake")


def test_uadfv_paired_clips_are_assigned_to_the_same_split():
    groups = []
    for clip_id in range(49):
        groups.extend((str(clip_id), "{}_fake".format(clip_id)))

    splits = _assign_splits(groups, splits_json=None, seed=42)

    for clip_id in range(49):
        identity = str(clip_id)
        assert splits[identity] == splits[_group_of("{}_fake".format(clip_id))]
    assert {splits[identity] for identity in map(str, range(49))} == {
        "train", "val", "test"
    }
