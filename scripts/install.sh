#!/usr/bin/env bash
# Gozar installer - fully automatic, no questions asked.
#
#   Panel:  bash <(curl -fsSL .../install.sh) --panel [--port 8080]
#   Agent:  bash <(curl -fsSL .../install.sh) --agent <TOKEN> --panel-url http://IP:8080
#
set -euo pipefail

REPO="${GOZAR_REPO:-Hosein21378/gozar}"
BRANCH="${BRANCH:-main}"
GH="${GOZAR_GH:-https://github.com/${REPO}}"
GH_RAW="${GOZAR_RAW:-https://raw.githubusercontent.com/${REPO}}"
INSTALL_DIR="/opt/gozar"
DATA_DIR="/etc/gozar"
DATA_FILE="${DATA_DIR}/data.json"
CRED_FILE="${DATA_DIR}/credentials.txt"
SERVICE_PANEL="gozar"
SERVICE_AGENT="gozar-agent"

GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; BOLD=$'\033[1m'; OFF=$'\033[0m'
ok()   { printf "%s[ ok ]%s %s\n" "$GREEN" "$OFF" "$1"; }
info() { printf "%s[ .. ]%s %s\n" "$OFF" "$OFF" "$1"; }
warn() { printf "%s[warn]%s %s\n" "$YELLOW" "$OFF" "$1"; }
die()  { printf "%s[fail]%s %s\n" "$RED" "$OFF" "$1"; exit 1; }

MODE=""; TOKEN=""; PANEL_URL=""; PORT="8080"
while [ $# -gt 0 ]; do
  case "$1" in
    --panel) MODE="panel";;
    --agent) MODE="agent"; TOKEN="${2:-}"; shift || true;;
    --panel-url) PANEL_URL="${2:-}"; shift || true;;
    --port) PORT="${2:-}"; shift || true;;
    -h|--help)
      echo "Gozar installer"
      echo "  bash install.sh --panel [--port 8080]"
      echo "  bash install.sh --agent <TOKEN> --panel-url http://IP:8080"
      exit 0;;
  esac
  shift || true
done

[ "$(id -u)" = "0" ] || die "must run as root:  sudo bash install.sh --panel"
[ "$(uname -s)" = "Linux" ] || die "Linux only"

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) BIN_ARCH="amd64";;
  aarch64|arm64) BIN_ARCH="arm64";;
  *) die "unsupported architecture: ${ARCH} (need amd64 or arm64)";;
esac

have() { command -v "$1" >/dev/null 2>&1; }
need() {
  have "$1" && return 0
  info "installing $1 ..."
  if have apt-get; then
    apt-get update -qq && apt-get install -y -qq "$2"
  elif have yum; then
    yum install -y "$2"
  elif have dnf; then
    dnf install -y "$2"
  elif have apk; then
    apk add --no-cache "$2"
  else
    die "cannot install $1 - please install it manually"
  fi
}

# ---------- fetch binary ----------
# 1) prebuilt binary committed in the repo  (fast, no compilation)
# 2) binary attached to a GitHub Release
# 3) build from source                      (last resort, needs open internet)
fetch_binary() {
  local out="$1" ver url
  local name="gozar-linux-${BIN_ARCH}"

  info "fetching ${name} ..."

  for br in "${BRANCH}" main master; do
    url="${GH_RAW}/${br}/bin/${name}"
    if curl -fsSL --max-time 300 "$url" -o "$out" 2>/dev/null && [ -s "$out" ]; then
      chmod +x "$out"
      if "${out}" version >/dev/null 2>&1; then
        ok "downloaded ${name}"
        return 0
      fi
    fi
    rm -f "$out"
  done

  ver="$(curl -fsSL --max-time 30 "${GH_RAW}/main/version.json" 2>/dev/null \
    | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
  if [ -n "$ver" ]; then
    url="${GH}/releases/download/v${ver}/${name}"
    if curl -fsSL --max-time 300 "$url" -o "$out" 2>/dev/null && [ -s "$out" ]; then
      chmod +x "$out"
      "${out}" version >/dev/null 2>&1 && { ok "downloaded ${name} (release v${ver})"; return 0; }
    fi
  fi
  rm -f "$out"

  warn "no prebuilt binary found - building from source (a few minutes)"
  build_from_source "$out" || die "build failed. As a workaround, place the binary manually at ${INSTALL_DIR}/gozar"
  chmod +x "$out"
}

build_from_source() {
  local out="$1" tmp gv
  need git git; need curl curl
  if ! have go; then
    gv="$(curl -fsSL --max-time 30 "https://go.dev/VERSION?m=text" 2>/dev/null | head -1 | sed 's/^go//')"
    [ -n "$gv" ] || gv="1.24.5"
    info "installing Go ${gv} ..."
    curl -fsSL -L --max-time 900 "https://go.dev/dl/go${gv}.linux-${BIN_ARCH}.tar.gz" -o /tmp/go.tgz \
      || die "could not download Go (dl.google.com may be unreachable)"
    rm -rf /usr/local/go && tar -C /usr/local -xzf /tmp/go.tgz
    export PATH="/usr/local/go/bin:$PATH"
  fi
  tmp="$(mktemp -d)"
  git clone --depth 1 -q "${GH}.git" "$tmp/gozar" || return 1
  ( cd "$tmp/gozar/server" && mkdir -p dist && cp -f ../web/dist/index.html dist/ 2>/dev/null || true
    HOME="$tmp" GOCACHE="$tmp/.cache" GOMODCACHE="$tmp/.mod" go build -o "$out" . ) || { rm -rf "$tmp"; return 1; }
  rm -rf "$tmp"
}

# ---------- helpers ----------
random_pass() {
  # 16 chars from /dev/urandom, no pipes that can break under pipefail
  local s=""
  s="$(head -c 64 /dev/urandom 2>/dev/null | tr -dc 'A-Za-z0-9')"
  if [ ${#s} -lt 16 ]; then
    s="$(head -c 64 /dev/urandom 2>/dev/null | od -An -tx1 | tr -d ' \n')"
  fi
  if [ ${#s} -lt 16 ]; then
    s="$(date +%s%N | tr -dc '0-9')GoZar"
  fi
  echo "${s:0:16}"
}

public_ip() {
  curl -fsSL --max-time 5 https://api.ipify.org 2>/dev/null \
    || curl -fsSL --max-time 5 https://ifconfig.me 2>/dev/null \
    || hostname -I 2>/dev/null | awk '{print $1}'
}

start_service() {
  local unit="$1"
  if have systemctl; then
    systemctl daemon-reload
    systemctl enable --now "${unit}" >/dev/null 2>&1 || true
    return 0
  fi
  return 1
}

# ---------- panel ----------
install_panel() {
  echo
  echo "${BOLD}Gozar panel installer${OFF}"
  echo "----------------------"
  need curl curl
  mkdir -p "$INSTALL_DIR" "$DATA_DIR"
  chmod 700 "$DATA_DIR"

  fetch_binary "${INSTALL_DIR}/gozar"

  # password: only generate on a fresh install, never lock out an existing one
  local ADMIN_PASS=""
  if [ -f "$DATA_FILE" ]; then
    info "existing data file found - keeping current password"
    [ -f "$CRED_FILE" ] && ADMIN_PASS="$(sed -n 's/^password: //p' "$CRED_FILE" 2>/dev/null | head -1)"
  else
    ADMIN_PASS="$(random_pass)"
    "${INSTALL_DIR}/gozar" setpass --data "$DATA_FILE" --user admin --password "$ADMIN_PASS" >/dev/null 2>&1 \
      || die "could not initialise admin account"
    umask 077
    {
      echo "Gozar panel credentials"
      echo "url:      http://$(public_ip):${PORT}"
      echo "username: admin"
      echo "password: ${ADMIN_PASS}"
      echo "generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    } > "$CRED_FILE"
    chmod 600 "$CRED_FILE"
    ok "generated admin password"
  fi

  # systemd unit
  if have systemctl; then
    cat > "/etc/systemd/system/${SERVICE_PANEL}.service" <<EOF
[Unit]
Description=Gozar Tunnel Panel
After=network.target

[Service]
Type=simple
ExecStart=${INSTALL_DIR}/gozar serve --addr 0.0.0.0:${PORT} --data ${DATA_FILE}
Restart=always
RestartSec=3
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF
    start_service "${SERVICE_PANEL}"
    sleep 2
    if systemctl is-active --quiet "${SERVICE_PANEL}"; then
      ok "service ${SERVICE_PANEL} is running"
    else
      warn "service did not start. Showing last log lines:"
      journalctl -u "${SERVICE_PANEL}" --no-pager -n 15 2>/dev/null || true
    fi
  else
    warn "systemd not found - starting in background"
    ( nohup "${INSTALL_DIR}/gozar" serve --addr 0.0.0.0:${PORT} --data "${DATA_FILE}" \
        >/var/log/gozar.log 2>&1 & ) || true
  fi

  # open firewall if a known tool is present (never fatal)
  if have ufw; then ufw allow "${PORT}/tcp" >/dev/null 2>&1 || true; fi
  if have firewall-cmd; then firewall-cmd --permanent --add-port="${PORT}/tcp" >/dev/null 2>&1 && firewall-cmd --reload >/dev/null 2>&1 || true; fi

  local ip; ip="$(public_ip)"
  echo
  echo "${BOLD}===================================================${OFF}"
  echo "${BOLD}  Gozar panel is ready${OFF}"
  echo "---------------------------------------------------"
  echo "  URL       http://${ip:-YOUR-SERVER-IP}:${PORT}"
  echo "  Username  admin"
  if [ -n "$ADMIN_PASS" ]; then
    echo "  Password  ${ADMIN_PASS}"
  else
    echo "  Password  (unchanged - see ${CRED_FILE})"
  fi
  echo "---------------------------------------------------"
  echo "  Saved to  ${CRED_FILE}"
  echo "  Start     systemctl start ${SERVICE_PANEL}"
  echo "  Stop      systemctl stop ${SERVICE_PANEL}"
  echo "  Logs      journalctl -u ${SERVICE_PANEL} -f"
  echo "${BOLD}===================================================${OFF}"
  echo
  info "Next: install the agent on each server to carry traffic."
  echo
}

# ---------- agent ----------
install_agent() {
  [ -n "$TOKEN" ]     || die "missing token:  --agent <TOKEN>"
  [ -n "$PANEL_URL" ] || die "missing panel url:  --panel-url http://IP:8080"

  echo
  echo "${BOLD}Gozar agent installer${OFF}"
  echo "----------------------"
  need curl curl
  mkdir -p "$INSTALL_DIR" "$DATA_DIR"

  fetch_binary "${INSTALL_DIR}/gozar"

  # پیش‌فرض نشانی پنل اگر داده نشده
  if [ -z "$PANEL_URL" ]; then
    die "missing panel url:  --panel-url http://IP:8080"
  fi

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

  start_service "${SERVICE_AGENT}"
  sleep 3
  echo
  if have systemctl && systemctl is-active --quiet "${SERVICE_AGENT}"; then
    echo "${BOLD}===================================================${OFF}"
    echo "${BOLD}  Gozar agent is running${OFF}"
    echo "---------------------------------------------------"
    echo "  Panel    ${PANEL_URL}"
    echo "  Status   systemctl status ${SERVICE_AGENT}"
    echo "  Logs     journalctl -u ${SERVICE_AGENT} -f"
    echo "${BOLD}===================================================${OFF}"
  else
    warn "agent did not report running:"
    journalctl -u "${SERVICE_AGENT}" --no-pager -n 15 2>/dev/null || true
  fi
  echo
}

case "$MODE" in
  panel) install_panel;;
  agent) install_agent;;
  *) die "pick a mode:  --panel   or   --agent <TOKEN> --panel-url <URL>";;
esac
