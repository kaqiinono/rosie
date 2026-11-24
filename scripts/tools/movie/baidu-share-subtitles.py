#!/usr/bin/env python3
"""Export existing Baidu Netdisk AI subtitles from a single-video share."""

import argparse
import json
import os
import re
import sys
import tempfile
from http.cookiejar import CookieJar
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit
from urllib.request import HTTPCookieProcessor, HTTPRedirectHandler, Request, build_opener


ORIGIN = "https://pan.baidu.com"
PAGE_LIMIT = 2 * 1024 * 1024
MANIFEST_LIMIT = 256 * 1024
SUBTITLE_LIMIT = 2 * 1024 * 1024
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36"
)
TIMESTAMP = r"\d{2,}:\d{2}:\d{2}[.,]\d{3}"
CUE_HEADER = re.compile(rf"^\d+[ \t]*\n({TIMESTAMP})[ \t]+-->[ \t]+({TIMESTAMP})[ \t]*\n", re.M)
MEDIA_ATTRIBUTE = re.compile(r'([A-Z0-9-]+)=("[^"]*"|[^,]*)')


class ExportError(Exception):
    pass


def baidu_url(url):
    try:
        parsed = urlsplit(url)
        host = parsed.hostname or ""
        return (
            parsed.scheme == "https"
            and parsed.port in (None, 443)
            and parsed.username is None
            and (host == "pan.baidu.com" or host.endswith(".baidupcs.com"))
        )
    except ValueError:
        return False


class BaiduRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not baidu_url(newurl):
            raise ExportError("网盘请求重定向到了不支持的地址")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class ShareClient:
    def __init__(self, short_id, code):
        self.short_id = short_id
        self.code = code
        self.share_url = f"{ORIGIN}/s/{short_id}"
        if code:
            self.share_url += "?" + urlencode({"pwd": code})
        self.opener = build_opener(BaiduRedirects(), HTTPCookieProcessor(CookieJar()))

    def read(self, url, stage, limit, *, data=None, referer=None):
        if not baidu_url(url):
            raise ExportError(f"{stage}失败，网盘返回了不支持的地址")
        request = Request(url, data=data, headers={
            "User-Agent": USER_AGENT,
            "Referer": referer or self.share_url,
            "X-Requested-With": "XMLHttpRequest",
            "Accept-Encoding": "identity",
        })
        try:
            with self.opener.open(request, timeout=15) as response:
                length = response.headers.get("Content-Length", "")
                if length.isdecimal() and int(length) > limit:
                    raise ExportError(f"{stage}失败，响应超过 {limit} 字节")
                raw = response.read(limit + 1)
        except HTTPError as error:
            raise ExportError(f"{stage}失败（HTTP {error.code}）") from None
        except (URLError, TimeoutError):
            raise ExportError(f"{stage}失败，请检查网络连接") from None
        if len(raw) > limit:
            raise ExportError(f"{stage}失败，响应超过 {limit} 字节")
        try:
            return raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise ExportError(f"{stage}失败，响应不是 UTF-8 文本") from None

    def get_json(self, path, query, stage, *, form=None):
        data = urlencode(form).encode("ascii") if form is not None else None
        raw = self.read(f"{ORIGIN}{path}?{urlencode(query)}", stage, PAGE_LIMIT, data=data)
        try:
            result = json.loads(raw)
        except ValueError:
            raise ExportError(f"{stage}失败，网盘返回了无法识别的数据") from None
        if not isinstance(result, dict) or result.get("errno") != 0:
            status = result.get("errno") if isinstance(result, dict) else None
            suffix = f"（网盘状态码 {status}）" if isinstance(status, int) else ""
            raise ExportError(f"{stage}失败{suffix}")
        return result

    def open_share(self):
        if self.code:
            self.get_json(
                "/share/verify",
                {"surl": self.short_id[1:], "channel": "chunlei", "web": 1, "clienttype": 0},
                "验证提取码",
                form={"pwd": self.code, "vcode": "", "vcode_str": ""},
            )
        page = self.read(self.share_url, "读取分享页", PAGE_LIMIT)
        match = re.search(r"locals\.mset\s*\(", page)
        if match:
            try:
                metadata, _ = json.JSONDecoder().raw_decode(page[match.end():].lstrip())
            except ValueError:
                metadata = None
            if isinstance(metadata, dict) and metadata.get("errno") == 0 and "file_list" in metadata:
                return metadata
        if "请输入提取码" in page and not self.code:
            raise ExportError("此分享需要提取码")
        raise ExportError("无法读取分享信息，请确认链接仍有效")

    def subtitle_manifest(self, metadata, video):
        config = self.get_json(
            "/share/tplconfig",
            {"surl": self.short_id, "fields": "sign,timestamp", "view_mode": 1},
            "读取播放器配置",
        )
        params = config.get("result") or config.get("data")
        if not isinstance(params, dict) or not params.get("sign") or not params.get("timestamp"):
            raise ExportError("网盘未返回完整的播放器配置")
        query = urlencode({
            "channel": "chunlei", "uk": metadata["share_uk"], "fid": video["fs_id"],
            "sign": params["sign"], "timestamp": params["timestamp"],
            "shareid": metadata["shareid"], "type": "M3U8_SUBTITLE_SRT", "vip": 0, "jsToken": "",
        })
        manifest_url = f"{ORIGIN}/share/streaming?{query}"
        manifest = self.read(manifest_url, "读取字幕清单", MANIFEST_LIMIT)
        if not manifest.lstrip().startswith("#EXTM3U"):
            raise ExportError("百度播放器当前未返回可导出的字幕清单")
        return manifest, manifest_url


def parse_share(link, code):
    link = link.strip().replace(r"https\://", "https://", 1)
    if not baidu_url(link):
        raise ExportError("请输入百度网盘 HTTPS 分享链接")
    parsed = urlsplit(link)
    match = re.fullmatch(r"/s/(1[A-Za-z0-9_-]+)/?", parsed.path)
    if parsed.hostname != "pan.baidu.com" or not match:
        raise ExportError("请输入 pan.baidu.com/s/ 开头的单个视频分享链接")
    code = code.strip() if code is not None else parse_qs(parsed.query).get("pwd", [""])[0]
    if code and not re.fullmatch(r"[A-Za-z0-9]{4}", code):
        raise ExportError("百度网盘提取码应为 4 位英文字母或数字")
    return match[1], code


def single_video(metadata):
    files = metadata.get("file_list")
    if not isinstance(files, list) or len(files) != 1:
        raise ExportError("请提供单个视频文件的分享链接")
    video = files[0]
    if (not isinstance(video, dict) or video.get("category") not in (1, "1")
            or video.get("isdir") not in (0, "0")):
        raise ExportError("分享内容不是单个视频文件")
    if (not isinstance(video.get("server_filename"), str) or not video["server_filename"]
            or not video.get("fs_id") or not metadata.get("share_uk") or not metadata.get("shareid")):
        raise ExportError("网盘返回的视频信息不完整")
    return video


def subtitle_tracks(manifest, manifest_url):
    lines = [line.strip() for line in manifest.splitlines() if line.strip()]
    tracks = []
    for index, line in enumerate(lines):
        if not line.startswith("#EXT-X-MEDIA:"):
            continue
        attributes = {key: value.strip('"') for key, value in MEDIA_ATTRIBUTE.findall(line)}
        if attributes.get("TYPE") != "SUBTITLES" or attributes.get("AI-SUB") != "YES":
            continue
        uri = attributes.get("URI")
        if not uri and index + 1 < len(lines) and not lines[index + 1].startswith("#"):
            uri = lines[index + 1]
        if not uri:
            raise ExportError("网盘字幕清单缺少字幕地址")
        name = attributes.get("NAME") or attributes.get("LANGUAGE") or "字幕"
        tracks.append((name, urljoin(manifest_url, uri)))
    if not tracks:
        raise ExportError("该视频没有百度播放器提供的 AI 字幕")
    return tracks


def timestamp_ms(value):
    hours, minutes, seconds, millis = map(int, re.split(r"[:,.]", value))
    if minutes >= 60 or seconds >= 60:
        raise ExportError("字幕时间码格式无效")
    return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis


def normalize_srt(raw):
    raw = raw.replace("\r\n", "\n").replace("\r", "\n").lstrip("\n")
    cues = list(CUE_HEADER.finditer(raw))
    if not cues or raw[:cues[0].start()].strip():
        raise ExportError("网盘未返回可读取的 SRT 字幕")
    records = []
    for index, cue in enumerate(cues):
        stop = cues[index + 1].start() if index + 1 < len(cues) else len(raw)
        text = [line for line in raw[cue.end():stop].splitlines() if line.strip()]
        if not text:
            continue
        start, end = (value.replace(".", ",") for value in cue.groups())
        if timestamp_ms(end) <= timestamp_ms(start):
            raise ExportError("字幕结束时间早于或等于开始时间")
        records.append("\n".join([str(len(records) + 1), f"{start} --> {end}", *text]))
    if not records:
        raise ExportError("字幕文件没有非空条目")
    return "\n\n".join(records) + "\n", len(records)


def filename_component(value, limit):
    cleaned = re.sub(r'[\\/:*?"<>|\x00-\x1f\x7f]', "_", value).strip(" .")
    return cleaned.encode("utf-8")[:limit].decode("utf-8", errors="ignore").rstrip(" .") or "字幕"


def write_subtitle(path, content):
    # Publish only a complete file, and preserve any existing user-edited copy.
    with tempfile.NamedTemporaryFile(dir=path.parent) as staged:
        staged.write(content)
        staged.flush()
        try:
            os.link(staged.name, path)
        except FileExistsError:
            if path.is_symlink() or not path.is_file() or path.read_bytes() != content:
                raise ExportError(f"文件已存在，未覆盖 {path}。请指定其他输出目录") from None


def export_subtitles(short_id, code, output_dir):
    client = ShareClient(short_id, code)
    metadata = client.open_share()
    video = single_video(metadata)
    manifest, manifest_url = client.subtitle_manifest(metadata, video)
    name = filename_component(Path(video["server_filename"]).stem, 120)
    files = {}
    for label, url in subtitle_tracks(manifest, manifest_url):
        language = filename_component(label, 70)
        filename = f"{name}.{language}.baidu-ai.srt"
        counter = 2
        while filename in files:
            filename = f"{name}.{language}.{counter}.baidu-ai.srt"
            counter += 1
        raw = client.read(url, f"读取{language}", SUBTITLE_LIMIT, referer=ORIGIN + "/")
        content, count = normalize_srt(raw)
        files[filename] = (content.encode("utf-8"), count)

    directory = output_dir or Path(tempfile.gettempdir()) / "baidu-share-subtitles" / short_id
    directory = directory.expanduser().resolve()
    directory.mkdir(parents=True, exist_ok=True)
    for filename, (content, count) in files.items():
        destination = directory / filename
        write_subtitle(destination, content)
        print(f"{destination}（{count} 条）")


def main():
    parser = argparse.ArgumentParser(description="从单个百度网盘视频分享导出已有的 AI 字幕为 SRT。")
    parser.add_argument("link", help="百度网盘视频分享链接")
    parser.add_argument("code", nargs="?", help="提取码，链接含 pwd 时可省略")
    parser.add_argument("--output-dir", type=Path, help="输出目录，默认使用系统临时目录")
    args = parser.parse_args()
    try:
        short_id, code = parse_share(args.link, args.code)
        export_subtitles(short_id, code, args.output_dir)
    except (ExportError, OSError) as error:
        print(f"导出失败：{error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
