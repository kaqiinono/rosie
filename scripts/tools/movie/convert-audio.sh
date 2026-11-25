#!/usr/bin/env bash

shopt -s nocasematch nullglob

usage() {
  cat <<'EOF'
用法：bash convert-audio.sh [all|mp3|aac] [文件 ...]

all  导出 MP3、AAC 和内嵌字幕，并把非 MP4 视频转成 MP4（默认）
mp3  仅导出 MP3
aac  仅导出 AAC（也接受 acc）

省略文件时，读取脚本旁 files/ 目录里的媒体文件。输出保存在源文件旁。
EOF
}

write_output() (
  local source=$1 output=$2 stage staged
  shift 2

  if [[ -e $output || -L $output ]]; then
    printf '跳过已有文件 %s\n' "$output"
    return 0
  fi

  stage=$(mktemp -d "${output%/*}/.convert-audio.XXXXXX") || return 1
  staged="$stage/output.${output##*.}"
  trap 'rm -f "$staged"; rmdir "$stage"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  printf '正在生成 %s\n' "$output"

  if ! ffmpeg -hide_banner -loglevel error -stats -nostdin -n -xerror \
    -i "$source" "$@" "$staged"; then
    printf '转换失败 %s\n' "$output" >&2
    return 1
  fi

  mv -n "$staged" "$output" || return 1
  if [[ -e $staged ]]; then
    printf '跳过已有文件 %s\n' "$output"
  else
    printf '已生成 %s\n' "$output"
  fi
)

export_subtitle() {
  local source=$1 output_prefix=$2 index=$3 codec=$4
  case "$codec" in
    hdmv_pgs_subtitle)
      write_output "$source" "$output_prefix.sup" -map "0:$index" -c:s copy -f sup
      ;;
    ass|ssa|subrip|webvtt|mov_text|text|microdvd|mpl2|jacosub|realtext|sami|stl|subviewer|subviewer1|vplayer|pjs)
      write_output "$source" "$output_prefix.srt" -map "0:$index" -c:s srt
      ;;
    *)
      printf '跳过不支持的字幕轨 %s（%s）\n' "$index" "${codec:-未知格式}" >&2
      ;;
  esac
}

convert_file() {
  local mode=$1 source=$2 filename stem output_prefix streams line field
  local index codec kind attached_pic language audio_index='' video_index=''
  local subtitle_number=0 status=0
  local -a fields video_audio

  [[ $source = /* ]] || source="./$source"
  if [[ ! -f $source || ! -r $source ]]; then
    printf '无法读取文件 %s\n' "$source" >&2
    return 1
  fi
  filename=${source##*/}
  stem=${filename%.*}
  output_prefix="${source%/*}/${stem:-$filename}"

  if ! streams=$(ffprobe -v error \
    -show_entries 'stream=index,codec_name,codec_type:stream_disposition=attached_pic:stream_tags=language' \
    -of compact "$source"); then
    printf '无法读取媒体轨道 %s\n' "$source" >&2
    return 1
  fi

  while IFS= read -r line; do
    [[ $line = stream\|* ]] || continue
    index='' codec='' kind='' attached_pic=0 language=und
    IFS='|' read -r -a fields <<< "$line"
    for field in "${fields[@]}"; do
      case "$field" in
        index=*) index=${field#*=} ;;
        codec_name=*) codec=${field#*=} ;;
        codec_type=*) kind=${field#*=} ;;
        disposition:attached_pic=*) attached_pic=${field#*=} ;;
        tag:language=*) language=${field#*=} ;;
      esac
    done
    [[ $index =~ ^[0-9]+$ ]] || continue

    case "$kind" in
      audio)
        [[ -n $audio_index ]] || audio_index=$index
        ;;
      video)
        if [[ -z $video_index && $attached_pic != 1 ]]; then
          video_index=$index
        fi
        ;;
      subtitle)
        [[ $mode = all ]] || continue
        subtitle_number=$((subtitle_number + 1))
        [[ $language =~ ^[a-zA-Z0-9_-]+$ ]] || language=und
        export_subtitle "$source" "$output_prefix.$language.s$subtitle_number" \
          "$index" "$codec" || status=1
        ;;
    esac
  done <<< "$streams"

  if [[ -n $audio_index ]]; then
    if [[ $mode = all || $mode = mp3 ]]; then
      write_output "$source" "$output_prefix.mp3" \
        -map "0:$audio_index" -ac 2 -c:a libmp3lame -b:a 192k || status=1
    fi
    if [[ $mode = all || $mode = aac ]]; then
      write_output "$source" "$output_prefix.aac" \
        -map "0:$audio_index" -ac 2 -c:a aac -b:a 192k || status=1
    fi
  else
    printf '没有音轨 %s\n' "$source" >&2
    if [[ $mode != all || ( -z $video_index && $subtitle_number -eq 0 ) ]]; then
      status=1
    fi
  fi

  if [[ $mode = all && -n $video_index && $filename != *.mp4 ]]; then
    video_audio=()
    if [[ -n $audio_index ]]; then
      video_audio=(-map "0:$audio_index" -c:a aac -b:a 160k -ac 2)
    fi
    write_output "$source" "$output_prefix.mp4" -map "0:$video_index" \
      "${video_audio[@]}" -vf 'pad=ceil(iw/2)*2:ceil(ih/2)*2' \
      -pix_fmt yuv420p -c:v libx264 -preset fast -crf 20 \
      -movflags +faststart || status=1
  fi

  return "$status"
}

main() {
  local mode=all input_directory file status=0
  local -a sources=()

  case "${1:-}" in
    -h|--help) usage; return 0 ;;
    all|mp3|aac) mode=$1; shift ;;
    acc) mode=aac; shift ;;
  esac
  if [[ ${1:-} = -- ]]; then
    shift
  fi

  if (( $# > 0 )); then
    sources=("$@")
  else
    input_directory=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd) || return 1
    input_directory="$input_directory/files"
    for file in "$input_directory"/*; do
      [[ -f $file ]] || continue
      case "$file" in
        *.mp4|*.m4v|*.mov|*.mkv|*.webm|*.avi|*.rm|*.rmvb|*.flv|*.wmv|*.asf|*.mpg|*.mpeg|*.ts|*.mts|*.m2ts|*.vob|*.3gp|*.ogv|*.ac3|*.eac3|*.wav|*.m4a|*.flac|*.ogg|*.opus|*.aif|*.aiff|*.wma|*.dts)
          sources+=("$file")
          ;;
      esac
    done
    if (( ${#sources[@]} == 0 )); then
      printf '目录里没有可处理的媒体文件 %s\n' "$input_directory" >&2
      return 1
    fi
  fi

  if ! command -v ffmpeg >/dev/null 2>&1 || ! command -v ffprobe >/dev/null 2>&1; then
    printf '请先安装 FFmpeg，确保 ffmpeg 和 ffprobe 都可用。\n' >&2
    return 1
  fi

  for file in "${sources[@]}"; do
    convert_file "$mode" "$file" || status=1
  done
  return "$status"
}

main "$@"
