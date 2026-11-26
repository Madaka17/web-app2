"""Floor-plan reader: parsing, clamping, error mapping and the job limits.

Never calls the network: urlopen is patched. Runs under pytest, or directly:
    python -X utf8 test_plan_reader.py
"""
from __future__ import annotations

import atexit
import base64
import http.client
import io
import json
import shutil
import tempfile
import threading
import time
import urllib.error
from pathlib import Path
from unittest import mock

import plan_reader as pr
from plan_reader import PlanError, PlanJobs, clean, decode_image, parse, read_plan

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
GOOD = {
    "floors": 1,
    "rooms": [
        {"name": "ห้องนั่งเล่น", "type": "living", "width_m": 5, "length_m": 5},
        {"name": "ห้องน้ำ", "type": "bathroom", "width_m": 2, "length_m": 3},
    ],
    "doors": 5, "windows": 5, "exterior_wall_m": 36, "interior_wall_m": 21,
}


def raises(code, fn, *args):
    try:
        fn(*args)
    except PlanError as e:
        assert e.code == code, f"expected {code}, got {e.code}"
        return
    raise AssertionError(f"expected PlanError({code})")


def sse(*chunks):
    lines = [f"data: {json.dumps(c)}\n\n" for c in chunks] + ["data: [DONE]\n\n"]
    resp = mock.MagicMock()
    resp.__enter__.return_value = io.BytesIO("".join(lines).encode())
    return resp


def reply(content):
    cut = max(1, len(content) // 3)
    pieces = [content[:cut], content[cut:2 * cut], content[2 * cut:]]
    chunks = [{"choices": [{"delta": {"reasoning_content": "thinking"}}]}]
    chunks += [{"choices": [{"delta": {"content": p}}]} for p in pieces if p]
    return sse(*chunks)


def test_parse_valid_and_wrapped_in_prose():
    assert parse(json.dumps(GOOD))["rooms"][1]["type"] == "bathroom"
    wrapped = "นี่คือผลลัพธ์:\n```json\n" + json.dumps(GOOD) + "\n```\nหวังว่าจะช่วยได้"
    assert parse(wrapped) == parse(json.dumps(GOOD))


def test_clean_clamps_everything():
    raw = {
        "floors": 9,
        "rooms": [{"name": "x" * 99, "type": "garage", "width_m": -4, "length_m": 1e9}] * 50,
        "doors": -3, "windows": 1e6, "exterior_wall_m": "abc", "interior_wall_m": float("nan"),
    }
    out = clean(raw)
    assert out["floors"] == 5
    assert len(out["rooms"]) == 30
    r = out["rooms"][0]
    assert (r["type"], r["width_m"], r["length_m"], len(r["name"])) == ("other", 0.5, 30, 40)
    assert (out["doors"], out["windows"]) == (0, 60)
    assert (out["exterior_wall_m"], out["interior_wall_m"]) == (0, 0)


def test_clean_scales_small_rooms_up_to_floor():
    raw = {"floor_sizes": [{"floor": 1, "width_m": 10, "length_m": 10}],
           "rooms": [{"floor": 1, "name": "a", "type": "other", "width_m": 3, "length_m": 3},
                     {"floor": 1, "name": "b", "type": "other", "width_m": 3, "length_m": 3}]}
    rooms = clean(raw)["rooms"]
    total = sum(r["width_m"] * r["length_m"] for r in rooms)
    assert abs(total - 85) < 0.5
    assert rooms[0]["width_m"] == rooms[1]["width_m"] and rooms[0]["length_m"] == rooms[1]["length_m"]


def test_clean_scaling_leaves_other_rooms_alone():
    sizes = [{"floor": 1, "width_m": 10, "length_m": 10}]
    # A floor already covered to 70% or more is unchanged.
    full = {"floor_sizes": sizes, "rooms": [
        {"floor": 1, "name": "a", "type": "other", "width_m": 9, "length_m": 9}]}
    assert clean(full)["rooms"][0]["width_m"] == 9
    # A room whose floor has no known area is unchanged.
    no_area = {"floor_sizes": sizes, "rooms": [
        {"floor": 2, "name": "a", "type": "other", "width_m": 3, "length_m": 3}]}
    assert clean(no_area)["rooms"][0]["width_m"] == 3
    # A room with no floor is unchanged.
    no_floor = {"floor_sizes": sizes, "rooms": [
        {"name": "a", "type": "other", "width_m": 3, "length_m": 3}]}
    assert clean(no_floor)["rooms"][0]["width_m"] == 3


def test_clean_ignores_bad_floor_sizes():
    rooms = [{"floor": 1, "name": "a", "type": "other", "width_m": 3, "length_m": 3}]
    for bad in ["x", [{"floor": "a"}], [{"floor": 1, "width_m": "x", "length_m": 3}], [None, 5]]:
        out = clean({"floor_sizes": bad, "rooms": rooms})
        assert out["rooms"][0]["width_m"] == 3


def test_clean_room_keys_are_schema_only():
    raw = {"floor_sizes": [{"floor": 1, "width_m": 10, "length_m": 10}],
           "rooms": [{"floor": 1, "name": "a", "type": "other", "width_m": 3, "length_m": 3}]}
    for r in clean(raw)["rooms"]:
        assert set(r) == {"name", "type", "width_m", "length_m"}


def test_unreadable_answers():
    raises("unreadable", parse, "ขออภัย อ่านแปลนไม่ได้")
    raises("unreadable", parse, "{not json}")
    raises("unreadable", parse, json.dumps({"rooms": []}))


def test_decode_image_checks_type_size_and_magic():
    ok = base64.b64encode(PNG).decode()
    assert decode_image(ok, "image/png") == PNG
    raises("bad_image", decode_image, ok, "application/pdf")
    raises("bad_image", decode_image, ok, "image/jpeg")  # PNG bytes labelled JPEG
    raises("bad_image", decode_image, "%%%", "image/png")
    big = base64.b64encode(PNG + b"\x00" * pr.MAX_IMAGE_BYTES).decode()
    raises("bad_image", decode_image, big, "image/png")


def test_read_plan_maps_errors():
    with mock.patch.dict("os.environ", {"TOKENME_API_KEY": ""}):
        raises("config", read_plan, PNG, "image/png")
    with mock.patch.dict("os.environ", {"TOKENME_API_KEY": "k"}):
        with mock.patch("urllib.request.urlopen", return_value=reply(json.dumps(GOOD))) as call:
            assert read_plan(PNG, "image/png")["doors"] == 5
            req = call.call_args[0][0]
            assert req.get_header("User-agent") == pr.USER_AGENT
            assert json.loads(req.data)["max_tokens"] == pr.MAX_TOKENS
            assert json.loads(req.data)["stream"] is True
            assert json.loads(req.data)["chat_template_kwargs"] == {"thinking": False}
        for status, code in [(403, "upstream"), (503, "upstream"), (402, "budget"), (429, "budget")]:
            err = urllib.error.HTTPError(pr.URL, status, "x", {}, io.BytesIO(b""))
            with mock.patch("urllib.request.urlopen", side_effect=err):
                raises(code, read_plan, PNG, "image/png")
        with mock.patch("urllib.request.urlopen", side_effect=TimeoutError()):
            raises("timeout", read_plan, PNG, "image/png")
        with mock.patch("urllib.request.urlopen", return_value=reply("garbage")):
            raises("unreadable", read_plan, PNG, "image/png")
        with mock.patch("urllib.request.urlopen", return_value=sse(
            {"choices": [{"delta": {"reasoning_content": "still thinking"}}]},
        )):
            raises("unreadable", read_plan, PNG, "image/png")


def test_read_plan_total_deadline():
    # -1 rather than 0: the check is "elapsed > TIMEOUT_S", so any elapsed time trips it.
    # The watchdog is stubbed out so this proves the in-loop check on its own.
    with mock.patch.dict("os.environ", {"TOKENME_API_KEY": "k"}):
        with mock.patch.object(pr, "TIMEOUT_S", -1), \
                mock.patch("threading.Timer"), \
                mock.patch("urllib.request.urlopen", return_value=reply(json.dumps(GOOD))):
            raises("timeout", read_plan, PNG, "image/png")


def _read_with(resp):
    with mock.patch.dict("os.environ", {"TOKENME_API_KEY": "k"}), \
            mock.patch("urllib.request.urlopen", return_value=resp):
        return read_plan(PNG, "image/png")


def stream(text):
    """Raw SSE bytes, for shapes sse() cannot produce."""
    resp = mock.MagicMock()
    resp.__enter__.return_value = io.BytesIO(text.encode())
    return resp


class _Stalled:
    """A response whose read blocks like recv() until its socket is shut down."""

    def __init__(self):
        self.woke = threading.Event()
        self.fp = mock.MagicMock()
        self.fp.raw._sock.shutdown.side_effect = lambda how: self.woke.set()

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def __iter__(self):
        if not self.woke.wait(5):  # safety: the test must not hang
            raise AssertionError("watchdog never fired")
        raise OSError("socket shut down")


def test_watchdog_cuts_a_stalled_read():
    stalled = _Stalled()
    with mock.patch.dict("os.environ", {"TOKENME_API_KEY": "k"}), \
            mock.patch.object(pr, "TIMEOUT_S", 0.2), \
            mock.patch("urllib.request.urlopen", return_value=stalled):
        t0 = time.monotonic()
        raises("timeout", read_plan, PNG, "image/png")
        assert time.monotonic() - t0 < 2
    assert stalled.woke.is_set()


def test_error_event_in_stream():
    raises("upstream", _read_with, sse({"error": {"message": "boom", "code": 500}}))
    raises("budget", _read_with, sse({"error": {"message": "quota", "code": 429}}))
    raises("budget", _read_with, sse({"error": {"status": "402"}}))
    raises("upstream", _read_with, sse({"error": "plain string"}))


def test_incomplete_read_is_upstream():
    resp = mock.MagicMock()
    resp.__enter__.return_value.__iter__.side_effect = http.client.IncompleteRead(b"")
    raises("upstream", _read_with, resp)


def test_garbage_chunk_shapes_are_skipped():
    answer = json.dumps(GOOD)
    cut = len(answer) // 3
    good = [{"choices": [{"delta": {"content": p}}]}
            for p in (answer[:cut], answer[cut:2 * cut], answer[2 * cut:])]
    junk = ["x", 123, {"choices": ["x"]}, {"choices": [{"delta": {"content": 5}}]}]
    assert _read_with(sse(*junk, *good))["doors"] == 5


def test_keepalive_and_no_space_after_colon():
    chunk = {"choices": [{"delta": {"content": json.dumps(GOOD)}}]}
    text = ": keepalive\n\n" + "data:" + json.dumps(chunk) + "\n\n" + "data:[DONE]\n\n"
    assert _read_with(stream(text))["doors"] == 5


def test_thai_split_across_chunks():
    answer = json.dumps(GOOD, ensure_ascii=False)
    chunks = [{"choices": [{"delta": {"content": ch}}]} for ch in answer]
    assert _read_with(sse(*chunks))["rooms"][0]["name"] == "ห้องนั่งเล่น"


def wait(jobs, job_id):
    for _ in range(200):
        job = jobs.get(job_id)
        if job["status"] != "pending":
            return job
        time.sleep(0.01)
    raise AssertionError("job never finished")


def test_jobs_limit_per_ip_and_cache_is_free():
    calls = []

    def reader(image, mime):
        calls.append(image)
        return clean(GOOD)

    jobs = PlanJobs(reader=reader, cache_file=None)
    first = jobs.submit(b"img-0", "image/png", "1.1.1.1")
    assert wait(jobs, first["job_id"])["status"] == "done"
    # The same image again comes from the cache and does not count.
    for _ in range(10):
        assert jobs.submit(b"img-0", "image/png", "1.1.1.1")["status"] == "done"
    for i in range(1, pr.PER_IP_PER_DAY):
        wait(jobs, jobs.submit(f"img-{i}".encode(), "image/png", "1.1.1.1")["job_id"])
    raises("limit_ip", jobs.submit, b"img-new", "image/png", "1.1.1.1")
    # Another client still gets through.
    wait(jobs, jobs.submit(b"img-new", "image/png", "2.2.2.2")["job_id"])
    assert len(calls) == pr.PER_IP_PER_DAY + 1


def test_jobs_site_wide_cap_and_errors():
    jobs = PlanJobs(reader=lambda image, mime: (_ for _ in ()).throw(PlanError("budget")), cache_file=None)
    job = wait(jobs, jobs.submit(b"a", "image/png", "1.1.1.1")["job_id"])
    assert job == {"job_id": job["job_id"], "status": "error", "code": "budget"}
    with mock.patch.object(pr, "PER_DAY", 1):
        raises("limit_day", jobs.submit, b"b", "image/png", "3.3.3.3")
    assert jobs.get("nope") is None


def _counting_reader(calls):
    def reader(image, mime):
        calls.append(image)
        return clean(GOOD)
    return reader


def _tmpdir() -> Path:
    """A temp dir removed when the run ends (pytest does not inject tmp_path into defaulted args)."""
    d = tempfile.mkdtemp()
    atexit.register(shutil.rmtree, d, True)
    return Path(d)


def test_jobs_cache_survives_restart(tmp_path=None):
    tmp_path = tmp_path or _tmpdir()
    cache_file = tmp_path / "plan_reads.json"
    calls = []
    first = PlanJobs(reader=_counting_reader(calls), cache_file=cache_file)
    done = wait(first, first.submit(b"plan", "image/png", "1.1.1.1")["job_id"])
    assert done["status"] == "done"
    # A new instance on the same file, as after an API restart.
    second = PlanJobs(reader=_counting_reader(calls), cache_file=cache_file)
    again = second.submit(b"plan", "image/png", "1.1.1.1")
    assert again["status"] == "done" and again["result"] == done["result"]
    assert len(calls) == 1


def test_jobs_cache_file_bad_or_old_is_ignored(tmp_path=None):
    tmp_path = tmp_path or _tmpdir()
    cache_file = tmp_path / "plan_reads.json"
    for text in ["{not json", json.dumps({"version": 999, "reads": [["abc", GOOD]]})]:
        cache_file.write_text(text, encoding="utf-8")
        calls = []
        jobs = PlanJobs(reader=_counting_reader(calls), cache_file=cache_file)
        assert jobs._cache == {}
        assert wait(jobs, jobs.submit(b"plan", "image/png", "1.1.1.1")["job_id"])["status"] == "done"
        assert len(calls) == 1


def test_jobs_cache_keeps_newest(tmp_path=None):
    tmp_path = tmp_path or _tmpdir()
    cache_file = tmp_path / "plan_reads.json"
    with mock.patch.object(pr, "CACHE_SIZE", 2):
        jobs = PlanJobs(reader=_counting_reader([]), cache_file=cache_file)
        for name in (b"img-0", b"img-1", b"img-2"):
            wait(jobs, jobs.submit(name, "image/png", "1.1.1.1")["job_id"])
        calls = []
        jobs = PlanJobs(reader=_counting_reader(calls), cache_file=cache_file)
        assert len(jobs._cache) == 2
        for name in (b"img-1", b"img-2"):
            assert jobs.submit(name, "image/png", "1.1.1.1")["status"] == "done"
        assert calls == []
        wait(jobs, jobs.submit(b"img-0", "image/png", "1.1.1.1")["job_id"])
        assert len(calls) == 1


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
    print(f"{len(tests)} tests passed")
