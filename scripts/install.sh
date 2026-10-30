#!/usr/bin/env bash
# نصب‌کنندهٔ گذر (Gozar)
#   پنل:  bash <(curl -fsSL .../install.sh) --panel
#   ایجنت: bash <(curl -fsSL .../install.sh) --agent <TOKEN> [--panel-url http://IP:8080]
set -euo pipefail

REPO="${GOZAR_REPO:-Hosein21378/gozar}"
BRANCH="${BRANCH:-main}"
RAW="https://raw.githubusercontent.com/${REPO}/${BRANCH}"
GH="${GOZAR_GH:-https://github.com/${REPO}}"
GH_RAW="${GOZAR_RAW:-https://raw.githubusercontent.com/${REPO}}"
INSTALL_DIR="/opt/gozar"
DATA_DIR="/etc/gozar"
SERVICE_PANEL="gozar"
SERVICE_AGENT="gozar-agent"

GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; DIM=$'\033[2m'; OFF=$'\033[0m'
say() { printf "%s%s%s\n" "$GREEN" "$1" "$OFF"; }
warn() { printf "%s%s%s\n" "$YELLOW" "$1" "$OFF"; }
die() { printf "%s%s%s\n" "$RED" "$1" "$OFF"; exit 1; }

MODE=""; TOKEN=""; PANEL_URL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --panel) MODE="panel";;
    --agent) MODE="agent"; TOKEN="${2:-}"; shift || true;;
    --panel-url) PANEL_URL="${2:-}"; shift || true;;
    -h|--help)
      echo "نصب‌کنندهٔ گذر (Gozar)"
      echo "  نصب پنل:    bash install.sh --panel"
      echo "  نصب ایجنت:  bash install.sh --agent <TOKEN> --panel-url http://IP:8080"
      exit 0;;
  esac
  shift || true
done

[ "$(id -u)" = "0" ] || die "این اسکریپت باید با root اجرا شود (sudo bash install.sh ...)"

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) BIN_ARCH="amd64";;
  aarch64|arm64) BIN_ARCH="arm64";;
  *) die "معماری ${ARCH} پشتیبانی نمی‌شود (فقط amd64 و arm64)";;
esac
[ "$(uname -s)" = "Linux" ] || die "فقط لینوکس پشتیبانی می‌شود"

have() { command -v "$1" >/dev/null 2>&1; }
need() {
  have "$1" && return 0
  warn "نصب $1 ..."
  if have apt-get; then
    apt-get update -qq && apt-get install -y -qq "$2"
  elif have yum; then
    yum install -y "$2"
  elif have dnf; then
    dnf install -y "$2"
  elif have apk; then
    apk add --no-cache "$2"
  else
    die "نمی‌توانم $1 را نصب کنم؛ خودتان نصب کنید"
  fi
}

# ---------- گرفتن باینری ----------
# ترتیب تلاش:
#   ۱) باینری آماده در خود مخزن  (سریع، بدون نیاز به کامپایل)
#   ۲) باینری پیوست‌شده به Release
#   ۳) ساخت از سورس             (آخرین چاره — به اینترنت آزاد نیاز دارد)
fetch_binary() {
  local out="$1" ver url
  local name="gozar-linux-${BIN_ARCH}"

  say "دریافت باینری ${name} ..."

  # ۱) از خود مخزن
  for br in main master; do
    url="${GH_RAW}/${br}/bin/${name}"
    if curl -fsSL --max-time 300 "$url" -o "$out" 2>/dev/null && [ -s "$out" ]; then
      chmod +x "$out"
      "${out}" version >/dev/null 2>&1 || { rm -f "$out"; continue; }
      say "باینری از مخزن دریافت شد ✅"
      return 0
    fi
    rm -f "$out"
  done

  # ۲) از Release
  ver="$(curl -fsSL --max-time 30 "${GH_RAW}/main/version.json" 2>/dev/null \
    | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  if [ -n "$ver" ]; then
    url="${GH}/releases/download/v${ver}/${name}"
    if curl -fsSL --max-time 300 "$url" -o "$out" 2>/dev/null && [ -s "$out" ]; then
      chmod +x "$out"
      "${out}" version >/dev/null 2>&1 || rm -f "$out"
    fi
  fi
  if [ -s "$out" ]; then
    say "باینری v${ver} از Release دریافت شد ✅"
    return 0
  fi

  # ۳) ساخت از سورس
  warn "هیچ باینری آماده‌ای پیدا نشد — از سورس می‌سازم (چند دقیقه)"
  build_from_source "$out" || die "ساخت از سورس ناموفق بود. اگر اینترنت محدود است، باینری را دستی بگذار در ${INSTALL_DIR}/gozar"
  chmod +x "$out"
}

build_from_source() {
  local out="$1" tmp gv
  need git git; need curl curl
  if ! have go; then
    warn "نصب Go ..."
    gv="$(curl -fsSL --max-time 30 "https://go.dev/VERSION?m=text" 2>/dev/null | head -1 | sed 's/^go//')"
    [ -n "$gv" ] || gv="1.24.5"
    warn "نسخهٔ Go: ${gv}"
    curl -fsSL -L --max-time 600 "https://go.dev/dl/go${gv}.linux-${BIN_ARCH}.tar.gz" -o /tmp/go.tgz \
      || die "دانلود Go ناموفق بود (dl.google.com ممکن است در دسترس نباشد)"
    rm -rf /usr/local/go && tar -C /usr/local -xzf /tmp/go.tgz
    export PATH="/usr/local/go/bin:$PATH"
  fi
  tmp="$(mktemp -d)"
  git clone --depth 1 -q "${GH}.git" "$tmp/gozar" || return 1
  ( cd "$tmp/gozar/server" && mkdir -p dist && cp -f ../web/dist/index.html dist/ 2>/dev/null || true
    HOME="$tmp" GOCACHE="$tmp/.cache" GOMODCACHE="$tmp/.mod" go build -o "$out" . ) || { rm -rf "$tmp"; return 1; }
  rm -rf "$tmp"
}

# ---------- نصب پنل ----------
install_panel() {
  say "نصب پنل گذر ..."
  need curl curl
  mkdir -p "$INSTALL_DIR" "$DATA_DIR"
  fetch_binary "${INSTALL_DIR}/gozar"

  local port="8080"
  printf "پورت پنل (پیش‌فرض ۸۰۸۰): " >/dev/tty 2>/dev/null || true
  read -r port < /dev/tty 2>/dev/null || port="8080"
  [ -n "$port" ] || port="8080"

  cat > "/etc/systemd/system/${SERVICE_PANEL}.service" <<EOF
[Unit]
Description=Gozar Tunnel Panel
After=network.target
[Service]
Type=simple
ExecStart=${INSTALL_DIR}/gozar serve --addr 0.0.0.0:${port} --data ${DATA_DIR}/data.json
Restart=always
RestartSec=3
LimitNOFILE=65535
[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now "${SERVICE_PANEL}" >/dev/null 2>&1

  local ip
  ip="$(curl -fsSL --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
  say "پنل آماده است"
  printf "  نشانی:  %shttp://%s:%s%s\n" "$GREEN" "${ip:-SERVER-IP}" "$port" "$OFF"
  printf "  %sنام کاربری و رمز پیش‌فرض: admin / admin123 — حتماً عوض کن%s\n" "$YELLOW" "$OFF"
}

# ---------- نصب ایجنت ----------
install_agent() {
  [ -n "$TOKEN" ] || die "توکن لازم است: --agent <TOKEN>"
  if [ -z "$PANEL_URL" ]; then
    printf "نشانی پنل (مثلاً http://1.2.3.4:8080): " >/dev/tty 2>/dev/null || true
    read -r PANEL_URL < /dev/tty 2>/dev/null || true
  fi
  [ -n "$PANEL_URL" ] || die "نشانی پنل لازم است: --panel-url http://IP:8080"

  say "نصب ایجنت گذر ..."
  if ! "${INSTALL_DIR}/gozar" agent --help >/dev/null 2>&1; then
    warn ""
    warn "ایجنتِ گذر هنوز در این نسخه فعال نیست."
    warn "نسخهٔ ۱.۰.۰ فقط پنل مدیریت را دارد؛ بخش انتقال ترافیک در حال ساخت است."
    warn "پس از انتشار نسخهٔ ایجنت، همین دستور را دوباره اجرا کن."
    exit 1
  fi
  need curl curl
  mkdir -p "$INSTALL_DIR" "$DATA_DIR"
  fetch_binary "${INSTALL_DIR}/gozar"

  cat > "${DATA_DIR}/agent.env" <<EOF
GOZAR_PANEL=${PANEL_URL}
GOZAR_TOKEN=${TOKEN}
EOF
  chmod 600 "${DATA_DIR}/agent.env"

  cat > "/etc/systemd/system/${SERVICE_AGENT}.service" <<EOF
[Unit]
Description=Gozar Agent
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
EnvironmentFile=${DATA_DIR}/agent.env
ExecStart=${INSTALL_DIR}/gozar agent --panel ${PANEL_URL} --token ${TOKEN}
Restart=always
RestartSec=3
LimitNOFILE=65535
[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now "${SERVICE_AGENT}" >/dev/null 2>&1
  sleep 2
  if systemctl is-active --quiet "${SERVICE_AGENT}"; then
    say "ایجنت فعال است ✅"
  else
    warn "ایجنت بالا نیامد. وضعیت:"
    systemctl status "${SERVICE_AGENT}" --no-pager -l | head -20 || true
  fi
}

case "$MODE" in
  panel) install_panel;;
  agent) install_agent;;
  *) die "حالت را مشخص کن:  --panel   یا   --agent <TOKEN>";;
esac
